import express from "express";
import * as reportController from "../controllers/report";
import { authMiddleware } from "../middleware/is-auth";

export const reportRouter = express.Router();

reportRouter.use(authMiddleware);

reportRouter.get(
  "/report/get_failed_scrape",
  reportController.GetFailedRepriceDetails,
);
reportRouter.get(
  "/report/scrape_failure",
  reportController.ExportScrapeFailure,
);
