import express, { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { extractBacktestData, setBacktestKnex } from "../utility/reprice-algo/__tests__/backtest/extract-data";
import { runProductRegressionBacktest } from "../utility/reprice-algo/__tests__/backtest/regression-runner";
import { runWhatIfBacktest } from "../utility/reprice-algo/__tests__/backtest/what-if-runner";
import { getKnexInstance } from "../model/sql-models/knex-wrapper";
import { VendorNameLookup } from "@repricer-monorepo/shared";

export const backtestController = express.Router();

// Use the app's existing knex instance (which has the decrypted password)
setBacktestKnex(getKnexInstance());

// Allow cross-origin requests from the repricer dashboard
backtestController.use("/backtest", (_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (_req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

/** Parse extraction options from request body */
function parseExtractOptions(body: any) {
  const { dateFrom, dateTo, limit = 200, mpIds, vendorIds, cronName, useV2Results = false } = body;

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 7);

  return {
    dateFrom: dateFrom ? new Date(dateFrom) : defaultFrom,
    dateTo: dateTo ? new Date(dateTo) : now,
    limit: Number(limit),
    mpIds: mpIds ? (Array.isArray(mpIds) ? mpIds.map(Number) : String(mpIds).split(",").map(Number).filter(Boolean)) : undefined,
    vendorIds: vendorIds ? (Array.isArray(vendorIds) ? vendorIds.map(Number) : String(vendorIds).split(",").map(Number).filter(Boolean)) : undefined,
    cronName: cronName || undefined,
    useV2Results,
  };
}

/** POST /backtest/regression — extract from DB + run regression in one call */
backtestController.post("/backtest/regression", async (req: Request, res: Response) => {
  try {
    const options = parseExtractOptions(req.body);

    console.log(`[backtest] Regression — extracting data: ${JSON.stringify({ ...options, dateFrom: options.dateFrom.toISOString(), dateTo: options.dateTo.toISOString() })}`);
    const records = await extractBacktestData(options);

    if (records.length === 0) {
      return res.status(StatusCodes.OK).json({
        total: 0,
        matches: 0,
        products: [],
        matchRate: 1,
        executionTimeMs: 0,
      });
    }

    console.log(`[backtest] Running product regression on ${records.length} records...`);
    const result = await runProductRegressionBacktest(records);

    return res.status(StatusCodes.OK).json({ ...result, vendorNames: VendorNameLookup });
  } catch (err: any) {
    console.error("[backtest] Regression error:", err);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: "Failed to run regression backtest",
      details: err.message,
    });
  }
});

/** POST /backtest/what-if — extract from DB + run what-if with overrides in one call */
backtestController.post("/backtest/what-if", async (req: Request, res: Response) => {
  try {
    const { overrides } = req.body;
    if (!overrides || typeof overrides !== "object") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Request body must include 'overrides' object.",
      });
    }

    const options = parseExtractOptions(req.body);

    console.log(`[backtest] What-if — extracting data: ${JSON.stringify({ ...options, dateFrom: options.dateFrom.toISOString(), dateTo: options.dateTo.toISOString() })}`);
    const records = await extractBacktestData(options);

    if (records.length === 0) {
      return res.status(StatusCodes.OK).json({
        total: 0,
        pricesChanged: 0,
        avgPriceDelta: 0,
        directionBreakdown: { newlyRepriced: 0, noLongerRepriced: 0, pricedHigher: 0, pricedLower: 0, unchanged: 0 },
        samples: [],
      });
    }

    console.log(`[backtest] Running what-if on ${records.length} records with overrides:`, overrides);
    const report = await runWhatIfBacktest(records, overrides);

    return res.status(StatusCodes.OK).json({ ...report, vendorNames: VendorNameLookup });
  } catch (err: any) {
    console.error("[backtest] What-if error:", err);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: "Failed to run what-if backtest",
      details: err.message,
    });
  }
});
