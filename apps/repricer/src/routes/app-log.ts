import express from "express";
import * as appLogController from "../controllers/app-log";
import { authMiddleware } from "../middleware/auth-middleware";
import { apiLimiter } from "../middleware/rate-limiter";
import { asyncHandler } from "../utility/async-handler";

export const appLogRouter = express.Router();

appLogRouter.use(authMiddleware);
appLogRouter.use(apiLimiter);

appLogRouter.get("/logs", asyncHandler(appLogController.GetAppLogs));
appLogRouter.get("/clear-logs", asyncHandler(appLogController.clearLogs));
appLogRouter.get("/export-logs", asyncHandler(appLogController.excelExport));
