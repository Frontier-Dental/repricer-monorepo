import express from "express";
import { asyncHandler } from "../../utility/async-handler";
import { startAllSlowCronHandler } from "./start";
import { recreateSlowCronHandler } from "./recreate";
import { toggleSlowCronStatusHandler } from "./toggle-status";
import { startSpecificSlowCronHandler } from "./start-specific";

export const slowCronGroupRouter = express.Router();

slowCronGroupRouter.get("/slow_cron/start_cron", asyncHandler(startAllSlowCronHandler));
slowCronGroupRouter.post("/slow_cron/RecreateSlowCron", asyncHandler(recreateSlowCronHandler));
slowCronGroupRouter.post("/slow_cron/ToggleCronStatus", asyncHandler(toggleSlowCronStatusHandler));
slowCronGroupRouter.get("/slow_cron/start_specific_cron/:key", asyncHandler(startSpecificSlowCronHandler));
