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
