import express from "express";
import * as cronFilterController from "../controllers/cron-filter";
import { authMiddleware } from "../middleware/auth-middleware";

export const cronFilterRouter = express.Router();

cronFilterRouter.use(authMiddleware);

cronFilterRouter.get("/", cronFilterController.GetFilterCron);
cronFilterRouter.post("/update_filter_cron", cronFilterController.UpdateFilterCron);
cronFilterRouter.post("/update_slow_cron", cronFilterController.UpdateSlowCronExpression);
cronFilterRouter.get("/export_log/:key", cronFilterController.ExportLogDetails);
cronFilterRouter.post("/toggle_cron_status", cronFilterController.ToggleCronStatus);
cronFilterRouter.post("/toggle_direct_scrape_monitor", cronFilterController.ToggleDirectScrapeMonitorStatus);
