import axios from "axios";
import { Request, Response } from "express";
import { applicationConfig } from "../utility/config";

// Layer mapping: derive layer from test file path
const LAYER_DESCRIPTIONS: Record<string, string> = {
  "Layer 1: Rules": "Unit tests for individual repricing rules — direction, floor check, beat-Q, percentage pricing, etc.",
  "Layer 2: Filters": "Tests for pre-processing filters — excluded vendors, inventory threshold, handling time, badge indicators.",
  "Layer 3: Integration": "End-to-end tests combining multiple rules and filters in standard, NC, and multi-price-break modes.",
  "Layer 4: Golden Files": "Snapshot-based tests comparing algorithm output against known-good reference files.",
  "Layer 5: Invariants": "Property-based tests ensuring pricing invariants always hold (e.g., price >= floor, price <= max).",
  "Layer 6: Backtesting": "Regression and what-if tests replaying historical repricing scenarios.",
  "Layer 7: Cross-Algo": "Comparison tests verifying consistency between v1 and v2 algorithm implementations.",
};

function getLayer(filePath: string): { name: string; order: number; description: string } {
  if (filePath.includes("/v1/rules/")) return { name: "Layer 1: Rules", order: 1, description: LAYER_DESCRIPTIONS["Layer 1: Rules"] };
  if (filePath.includes("/v1/filters/")) return { name: "Layer 2: Filters", order: 2, description: LAYER_DESCRIPTIONS["Layer 2: Filters"] };
  if (filePath.includes("/v1/integration/")) return { name: "Layer 3: Integration", order: 3, description: LAYER_DESCRIPTIONS["Layer 3: Integration"] };
  if (filePath.includes("/golden-files/")) return { name: "Layer 4: Golden Files", order: 4, description: LAYER_DESCRIPTIONS["Layer 4: Golden Files"] };
  if (filePath.includes("/invariants/")) return { name: "Layer 5: Invariants", order: 5, description: LAYER_DESCRIPTIONS["Layer 5: Invariants"] };
  if (filePath.includes("/backtest/")) return { name: "Layer 6: Backtesting", order: 6, description: LAYER_DESCRIPTIONS["Layer 6: Backtesting"] };
  if (filePath.includes("/cross-algo/")) return { name: "Layer 7: Cross-Algo", order: 7, description: LAYER_DESCRIPTIONS["Layer 7: Cross-Algo"] };
  return { name: "Other", order: 99, description: "" };
}

function getFileName(filePath: string): string {
  return filePath.split("/").pop() || filePath;
}

interface ProcessedSuite {
  name: string;
  filePath: string;
  sourcePath: string;
  status: string;
  duration: number;
  numPassed: number;
  numFailed: number;
  numPending: number;
  numTotal: number;
  tests: Array<{
    title: string;
    fullName: string;
    ancestorTitles: string[];
    status: string;
    duration: number;
    failureMessages: string[];
    code: string;
  }>;
}

interface ProcessedLayer {
  name: string;
  description: string;
  order: number;
  suites: ProcessedSuite[];
  numSuites: number;
  numPassed: number;
  numFailed: number;
  numPending: number;
  numTotal: number;
  status: string;
  duration: number;
}

function processResults(data: any, sourcesMap: Record<string, Record<string, string>>) {
  const layerMap = new Map<string, ProcessedLayer>();

  for (const suite of data.testResults || []) {
    const layer = getLayer(suite.name);
    const fileName = getFileName(suite.name);
    const duration = suite.endTime - suite.startTime;

    const assertions = suite.assertionResults || [];
    const numPassed = assertions.filter((a: any) => a.status === "passed").length;
    const numFailed = assertions.filter((a: any) => a.status === "failed").length;
    const numPending = assertions.filter((a: any) => a.status === "pending" || a.status === "skipped").length;

    // Extract relative path from __tests__/ for the source endpoint
    const testsIdx = suite.name.indexOf("__tests__/");
    const sourcePath = testsIdx >= 0 ? suite.name.substring(testsIdx + "__tests__/".length) : "";

    // Get parsed test blocks for this suite
    const fileBlocks = sourcesMap[suite.name] || {};

    const processedSuite: ProcessedSuite = {
      name: fileName,
      filePath: suite.name,
      sourcePath,
      status: suite.status,
      duration,
      numPassed,
      numFailed,
      numPending,
      numTotal: assertions.length,
      tests: assertions.map((a: any) => ({
        title: a.title,
        fullName: a.fullName,
        ancestorTitles: a.ancestorTitles || [],
        status: a.status,
        duration: a.duration || 0,
        failureMessages: a.failureMessages || [],
        code: fileBlocks[a.title] || "",
      })),
    };

    if (!layerMap.has(layer.name)) {
      layerMap.set(layer.name, {
        name: layer.name,
        description: layer.description,
        order: layer.order,
        suites: [],
        numSuites: 0,
        numPassed: 0,
        numFailed: 0,
        numPending: 0,
        numTotal: 0,
        status: "passed",
        duration: 0,
      });
    }

    const l = layerMap.get(layer.name)!;
    l.suites.push(processedSuite);
    l.numSuites++;
    l.numPassed += numPassed;
    l.numFailed += numFailed;
    l.numPending += numPending;
    l.numTotal += assertions.length;
    l.duration += duration;
    if (numFailed > 0) l.status = "failed";
    else if (numPending > 0 && numPassed === 0) l.status = "skipped";
  }

  const layers = Array.from(layerMap.values()).sort((a, b) => a.order - b.order);

  const totalDuration = layers.reduce((sum, l) => sum + l.duration, 0);

  return {
    summary: {
      totalSuites: data.numTotalTestSuites || 0,
      passedSuites: data.numPassedTestSuites || 0,
      failedSuites: data.numFailedTestSuites || 0,
      totalTests: data.numTotalTests || 0,
      passedTests: data.numPassedTests || 0,
      failedTests: data.numFailedTests || 0,
      pendingTests: data.numPendingTests || 0,
      success: data.success,
      startTime: data.startTime ? new Date(data.startTime).toISOString() : null,
      duration: totalDuration,
    },
    layers,
  };
}

export async function GetTestResults(req: Request, res: Response) {
  try {
    const apiBaseUrl = applicationConfig.REPRICER_API_BASE_URL;

    const [response, sourcesResp] = await Promise.all([axios.get(apiBaseUrl + "/tests/results").catch(() => null), axios.get(apiBaseUrl + "/tests/sources-map").catch(() => null)]);

    const sourcesMap: Record<string, Record<string, string>> = sourcesResp?.data || {};

    if (!response || !response.data) {
      return res.render("pages/tests", {
        groupName: "tests",
        hasResults: false,
        results: null,
        error: "No test results available. Click 'Run Tests' to generate.",
        apiBaseUrl,
        userRole: (req as any).session.users_id.userRole,
      });
    }

    const processed = processResults(response.data, sourcesMap);

    return res.render("pages/tests", {
      groupName: "tests",
      hasResults: true,
      results: processed,
      error: null,
      apiBaseUrl,
      userRole: (req as any).session.users_id.userRole,
    });
  } catch (err: any) {
    return res.render("pages/tests", {
      groupName: "tests",
      hasResults: false,
      results: null,
      error: "Failed to load test results: " + err.message,
      apiBaseUrl: "",
      userRole: (req as any).session.users_id.userRole,
    });
  }
}

export async function RunTests(req: Request, res: Response) {
  try {
    const url = applicationConfig.REPRICER_API_BASE_URL + "/tests/run";
    await axios.post(url, {}, { timeout: 120_000 });
    return res.redirect("/tests");
  } catch (err: any) {
    return res.redirect("/tests?error=Test+run+failed:+" + encodeURIComponent(err.message));
  }
}
