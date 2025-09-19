import express from "express";
import * as reportController from "../controllers/report";
import { authMiddleware } from "../middleware/auth-middleware";

export const reportRouter = express.Router();

reportRouter.use(authMiddleware);

reportRouter.get(
  "/get_failed_scrape",
  reportController.GetFailedRepriceDetails,
);
reportRouter.get("/scrape_failure", reportController.ExportScrapeFailure);
