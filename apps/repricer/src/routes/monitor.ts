import express from "express";
import * as monitorController from "../controllers/monitor";
import { authMiddleware } from "../middleware/auth-middleware";
import { apiLimiter } from "../middleware/rate-limiter";
import { asyncHandler } from "../utility/async-handler";

export const monitorRouter = express.Router();

//monitorRouter.use(authMiddleware);
monitorRouter.use(apiLimiter);

monitorRouter.get("/get_cron_details", asyncHandler(monitorController.GetInprogressCron));
monitorRouter.get("/get_422_product", asyncHandler(monitorController.Get422ProductDetails));

monitorRouter.get("/get_floor_below", authMiddleware, asyncHandler(monitorController.GetProductsBelowFloor));

monitorRouter.get("/load_scrape_only/:pageNo/:pageSize", authMiddleware, asyncHandler(monitorController.LoadScrapeOnlyProducts));
