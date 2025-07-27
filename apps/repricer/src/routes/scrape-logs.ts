import express from "express";
import * as scrapeLogsController from "../controllers/scrape-logs";
import { authMiddleware } from "../middleware/is-auth";

export const scrapeLogsRouter = express.Router();

scrapeLogsRouter.use(authMiddleware);

scrapeLogsRouter.get("/scrape/logs", scrapeLogsController.showLogHistory);
scrapeLogsRouter.get(
  "/scrape/logs_history_list/:id",
  scrapeLogsController.logsHistoryList,
);
