import express from "express";
import * as cronFilterController from "../controllers/cron-filter";
import { authMiddleware } from "../middleware/is-auth";

export const cronFilterRouter = express.Router();

cronFilterRouter.use(authMiddleware);

cronFilterRouter.get("/filter", cronFilterController.GetFilterCron);
cronFilterRouter.post(
  "/filter/update_filter_cron",
  cronFilterController.UpdateFilterCron,
);
cronFilterRouter.post(
  "/filter/update_slow_cron",
  cronFilterController.UpdateSlowCronExpression,
);
cronFilterRouter.get(
  "/filter/export_log/:key",
  cronFilterController.ExportLogDetails,
);
cronFilterRouter.post(
  "/filter/toggle_cron_status",
  cronFilterController.ToggleCronStatus,
);
