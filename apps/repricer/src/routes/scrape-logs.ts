import express from "express";
import * as scrapeLogsController from "../controllers/scrape-logs";
import { authMiddleware } from "../middleware/auth-middleware";

export const scrapeLogsRouter = express.Router();

scrapeLogsRouter.use(authMiddleware);

scrapeLogsRouter.get("/logs", scrapeLogsController.showLogHistory);
scrapeLogsRouter.get(
  "/logs_history_list/:id",
  scrapeLogsController.logsHistoryList,
);
