import express from "express";
import { startAllSlowCronHandler } from "./start";
import { recreateSlowCronHandler } from "./recreate";
import { toggleSlowCronStatusHandler } from "./toggle-status";
import { startSpecificSlowCronHandler } from "./start-specific";

export const slowCronGroupRouter = express.Router();

slowCronGroupRouter.get("/slow_cron/start_cron", startAllSlowCronHandler);
slowCronGroupRouter.post(
  "/slow_cron/RecreateSlowCron",
  recreateSlowCronHandler,
);
slowCronGroupRouter.post(
  "/slow_cron/ToggleCronStatus",
  toggleSlowCronStatusHandler,
);
slowCronGroupRouter.get(
  "/slow_cron/start_specific_cron/:key",
  startSpecificSlowCronHandler,
);
