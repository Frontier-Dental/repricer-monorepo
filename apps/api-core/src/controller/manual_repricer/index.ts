import express from "express";
import { param } from "express-validator";
import { v2AlgoTest } from "./algo_v2_test";
import { manualUpdate } from "./manual_update";
import { updateToMax } from "./update_to_max";

export const manualRepriceController = express.Router();

manualRepriceController.get("/repricer/ManualUpdate/:id", manualUpdate);
manualRepriceController.get("/repricer/UpdateToMax/:id", updateToMax);
manualRepriceController.post(
  "/repricer/V2AlgoTest/:mpid",
  param("mpid").isString().isLength({ min: 1 }),
  v2AlgoTest,
);
