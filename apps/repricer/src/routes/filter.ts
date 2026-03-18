import express from "express";
import * as cronFilterController from "../controllers/cron-filter";
import { authMiddleware } from "../middleware/auth-middleware";
import { apiLimiter } from "../middleware/rate-limiter";
import { asyncHandler } from "../utility/async-handler";

export const cronFilterRouter = express.Router();

cronFilterRouter.use(authMiddleware);
cronFilterRouter.use(apiLimiter);

cronFilterRouter.get("/", asyncHandler(cronFilterController.GetFilterCron));
cronFilterRouter.post("/update_filter_cron", asyncHandler(cronFilterController.UpdateFilterCron));
cronFilterRouter.post("/update_slow_cron", asyncHandler(cronFilterController.UpdateSlowCronExpression));
cronFilterRouter.get("/export_log/:key", asyncHandler(cronFilterController.ExportLogDetails));
cronFilterRouter.post("/toggle_cron_status", asyncHandler(cronFilterController.ToggleCronStatus));
