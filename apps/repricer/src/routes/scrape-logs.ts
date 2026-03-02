import express from "express";
import * as scrapeLogsController from "../controllers/scrape-logs";
import { authMiddleware } from "../middleware/auth-middleware";
import { apiLimiter } from "../middleware/rate-limiter";
export const scrapeLogsRouter = express.Router();

scrapeLogsRouter.use(authMiddleware);
scrapeLogsRouter.use(apiLimiter);

scrapeLogsRouter.get("/logs", scrapeLogsController.showLogHistory);
scrapeLogsRouter.get("/logs_history_list/:id", scrapeLogsController.logsHistoryList);
