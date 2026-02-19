import axios from "axios";
import { Request, Response } from "express";
import { applicationConfig } from "../utility/config";

// Layer mapping: derive layer from test file path
function getLayer(filePath: string): { name: string; order: number } {
  if (filePath.includes("/v1/rules/")) return { name: "Layer 1: Rules", order: 1 };
  if (filePath.includes("/v1/filters/")) return { name: "Layer 2: Filters", order: 2 };
  if (filePath.includes("/v1/integration/")) return { name: "Layer 3: Integration", order: 3 };
  if (filePath.includes("/golden-files/")) return { name: "Layer 4: Golden Files", order: 4 };
  if (filePath.includes("/invariants/")) return { name: "Layer 5: Invariants", order: 5 };
  if (filePath.includes("/backtest/")) return { name: "Layer 6: Backtesting", order: 6 };
  if (filePath.includes("/cross-algo/")) return { name: "Layer 7: Cross-Algo", order: 7 };
  return { name: "Other", order: 99 };
}

function getFileName(filePath: string): string {
  return filePath.split("/").pop() || filePath;
}

interface ProcessedSuite {
  name: string;
  filePath: string;
  status: string;
  duration: number;
  numPassed: number;
  numFailed: number;
  numPending: number;
  numTotal: number;
  tests: Array<{
    title: string;
    fullName: string;
    status: string;
    duration: number;
    failureMessages: string[];
  }>;
}

interface ProcessedLayer {
  name: string;
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

function processResults(data: any) {
  const layerMap = new Map<string, ProcessedLayer>();

  for (const suite of data.testResults || []) {
    const layer = getLayer(suite.name);
    const fileName = getFileName(suite.name);
    const duration = suite.endTime - suite.startTime;

    const assertions = suite.assertionResults || [];
    const numPassed = assertions.filter((a: any) => a.status === "passed").length;
    const numFailed = assertions.filter((a: any) => a.status === "failed").length;
    const numPending = assertions.filter((a: any) => a.status === "pending" || a.status === "skipped").length;

    const processedSuite: ProcessedSuite = {
      name: fileName,
      filePath: suite.name,
      status: suite.status,
      duration,
      numPassed,
      numFailed,
      numPending,
      numTotal: assertions.length,
      tests: assertions.map((a: any) => ({
        title: a.title,
        fullName: a.fullName,
        status: a.status,
        duration: a.duration || 0,
        failureMessages: a.failureMessages || [],
      })),
    };

    if (!layerMap.has(layer.name)) {
      layerMap.set(layer.name, {
        name: layer.name,
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
      duration: data.testResults ? Math.max(...data.testResults.map((s: any) => s.endTime || 0)) - data.startTime : 0,
    },
    layers,
  };
}

export async function GetTestResults(req: Request, res: Response) {
  try {
    const url = applicationConfig.REPRICER_API_BASE_URL + "/tests/results";
    const response = await axios.get(url).catch(() => null);

    if (!response || !response.data) {
      return res.render("pages/tests", {
        groupName: "tests",
        hasResults: false,
        results: null,
        error: "No test results available. Click 'Run Tests' to generate.",
        userRole: (req as any).session.users_id.userRole,
      });
    }

    const processed = processResults(response.data);

    return res.render("pages/tests", {
      groupName: "tests",
      hasResults: true,
      results: processed,
      error: null,
      userRole: (req as any).session.users_id.userRole,
    });
  } catch (err: any) {
    return res.render("pages/tests", {
      groupName: "tests",
      hasResults: false,
      results: null,
      error: "Failed to load test results: " + err.message,
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
