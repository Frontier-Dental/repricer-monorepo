import express from "express";
import { param } from "express-validator";
import { asyncHandler } from "../../utility/async-handler";
import { v2AlgoTest } from "./algo-v2-test";
import { manualRepriceHandler } from "./manual-reprice";
import { updateToMax } from "./update-to-max";

export const manualRepriceController = express.Router();

manualRepriceController.get("/repricer/ManualUpdate/:id", asyncHandler(manualRepriceHandler));
manualRepriceController.get("/repricer/UpdateToMax/:id", asyncHandler(updateToMax));
manualRepriceController.post("/repricer/V2AlgoTest/:mpid", param("mpid").isString().isLength({ min: 1 }), asyncHandler(v2AlgoTest));
