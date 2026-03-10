import express from "express";
import * as appLogController from "../controllers/app-log";
import { authMiddleware } from "../middleware/auth-middleware";
import { apiLimiter } from "../middleware/rate-limiter";

export const appLogRouter = express.Router();

appLogRouter.use(authMiddleware);
appLogRouter.use(apiLimiter);

appLogRouter.get("/logs", appLogController.GetAppLogs);
appLogRouter.get("/clear-logs", appLogController.clearLogs);
appLogRouter.get("/export-logs", appLogController.excelExport);
