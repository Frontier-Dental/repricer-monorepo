import express from "express";
import { asyncHandler } from "../../utility/async-handler";
import { startMiniErpCron } from "./start-cron";
import { toggleMiniErpCronStatusHandler } from "./toggle-status";
import { recreateMiniErpCronHandler } from "./recreate";

export const minErpCronController = express.Router();

minErpCronController.post("/mini_erp/start", asyncHandler(startMiniErpCron));
minErpCronController.post("/mini_erp/toggleCronStatus", asyncHandler(toggleMiniErpCronStatusHandler));
minErpCronController.post("/mini_erp/recreate", asyncHandler(recreateMiniErpCronHandler));
