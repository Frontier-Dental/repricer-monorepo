import express from "express";
import * as monitorController from "../controllers/monitor";
import { authMiddleware } from "../middleware/is-auth";

export const monitorRouter = express.Router();

monitorRouter.use(authMiddleware);

monitorRouter.get(
  "/monitor/get_cron_details",
  monitorController.GetInprogressCron,
);
monitorRouter.get(
  "/monitor/get_422_product",
  monitorController.Get422ProductDetails,
);

monitorRouter.get(
  "/monitor/get_floor_below",
  monitorController.GetProductsBelowFloor,
);

monitorRouter.get(
  "/monitor/load_scrape_only/:pageNo/:pageSize",
  monitorController.LoadScrapeOnlyProducts,
);
