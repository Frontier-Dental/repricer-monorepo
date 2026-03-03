import express, { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

export const testsController = express.Router();

const REPORTS_DIR = path.resolve(__dirname, "../../reports");
const RESULTS_FILE = path.join(REPORTS_DIR, "test-results.json");

/** GET /tests/results — return the latest test results JSON */
testsController.get("/tests/results", async (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(RESULTS_FILE)) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "No test results found. Run tests first.",
      });
    }

    const raw = fs.readFileSync(RESULTS_FILE, "utf-8");
    const data = JSON.parse(raw);
    return res.status(StatusCodes.OK).json(data);
  } catch (err: any) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: "Failed to read test results",
      details: err.message,
    });
  }
});

/** GET /tests/source — return test file source code */
testsController.get("/tests/source", async (req: Request, res: Response) => {
  try {
    const filePath = req.query.file as string;
    if (!filePath) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "file query param required" });
    }

    const testsRoot = path.resolve(__dirname, "../../src/utility/reprice-algo/__tests__");
    const resolved = path.resolve(testsRoot, filePath);

    // Prevent directory traversal
    if (!resolved.startsWith(testsRoot) || !resolved.endsWith(".test.ts")) {
      return res.status(StatusCodes.FORBIDDEN).json({ error: "Invalid file path" });
    }

    if (!fs.existsSync(resolved)) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "File not found" });
    }

    const content = fs.readFileSync(resolved, "utf-8");
    return res.status(StatusCodes.OK).json({ file: filePath, content });
  } catch (err: any) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: "Failed to read source file",
      details: err.message,
    });
  }
});

/**
 * Parse a test file and extract each it()/test() block's code, keyed by title.
 * Returns { "test title": "code body..." }
 */
function parseTestBlocks(content: string): Record<string, string> {
  const blocks: Record<string, string> = {};
  // Match it('title', ...) or test('title', ...)
  const regex = /(?:it|test)\s*\(\s*(['"`])((?:(?!\1).)*)\1/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const title = match[2];
    const startIdx = match.index;

    // Find the arrow/function body opening brace
    let braceStart = content.indexOf("{", match.index + match[0].length);
    if (braceStart === -1) continue;

    // Walk braces to find the matching close
    let depth = 1;
    let i = braceStart + 1;
    while (i < content.length && depth > 0) {
      if (content[i] === "{") depth++;
      else if (content[i] === "}") depth--;
      i++;
    }

    // Extract just the body (without outer braces), trimmed
    const body = content.substring(braceStart + 1, i - 1).trim();
    blocks[title] = body;
  }

  return blocks;
}

/** GET /tests/sources-map — parse all test files from latest results into title→code map */
testsController.get("/tests/sources-map", async (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(RESULTS_FILE)) {
      return res.status(StatusCodes.OK).json({});
    }

    const raw = fs.readFileSync(RESULTS_FILE, "utf-8");
    const data = JSON.parse(raw);
    const result: Record<string, Record<string, string>> = {};

    for (const suite of data.testResults || []) {
      const filePath = suite.name;
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, "utf-8");
      result[filePath] = parseTestBlocks(content);
    }

    return res.status(StatusCodes.OK).json(result);
  } catch (err: any) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: "Failed to parse test sources",
      details: err.message,
    });
  }
});

/** POST /tests/run — execute jest and return results */
testsController.post("/tests/run", async (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(REPORTS_DIR)) {
      fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }

    const projectRoot = path.resolve(__dirname, "../..");

    // Run jest with JSON output — jest exits with code 1 if tests fail,
    // so we catch that and still read the results file
    try {
      execSync("npx jest --json --outputFile=reports/test-results.json --forceExit 2>&1", {
        cwd: projectRoot,
        timeout: 120_000,
        encoding: "utf-8",
      });
    } catch (execErr: any) {
      // Jest exits with code 1 when tests fail — that's expected.
      // The results file is still written. Only fail if the file wasn't created.
      if (!fs.existsSync(RESULTS_FILE)) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
          error: "Jest execution failed and no results file was produced",
          details: execErr.message?.substring(0, 500),
        });
      }
    }

    const raw = fs.readFileSync(RESULTS_FILE, "utf-8");
    const data = JSON.parse(raw);
    return res.status(StatusCodes.OK).json(data);
  } catch (err: any) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: "Failed to run tests",
      details: err.message,
    });
  }
});
