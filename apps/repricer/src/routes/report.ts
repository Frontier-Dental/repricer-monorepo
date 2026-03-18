import express from "express";
import * as reportController from "../controllers/report";
import { authMiddleware } from "../middleware/auth-middleware";
import { apiLimiter } from "../middleware/rate-limiter";
import { asyncHandler } from "../utility/async-handler";

export const reportRouter = express.Router();

reportRouter.use(authMiddleware);
reportRouter.use(apiLimiter);

reportRouter.get("/get_failed_scrape", asyncHandler(reportController.GetFailedRepriceDetails));
reportRouter.get("/scrape_failure", asyncHandler(reportController.ExportScrapeFailure));
