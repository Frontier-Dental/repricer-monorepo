import express from "express";
import { param } from "express-validator";
import { v2AlgoTest } from "./algo-v2-test";
import { manualUpdate } from "./manual-update";
import { updateToMax } from "./update-to-max";

export const manualRepriceController = express.Router();

manualRepriceController.get("/repricer/ManualUpdate/:id", manualUpdate);
manualRepriceController.get("/repricer/UpdateToMax/:id", updateToMax);
manualRepriceController.post(
  "/repricer/V2AlgoTest/:mpid",
  param("mpid").isString().isLength({ min: 1 }),
  v2AlgoTest,
);
