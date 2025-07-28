import express from "express";
import * as monitorController from "../controllers/monitor";
import { authMiddleware } from "../middleware/auth-middleware";

export const monitorRouter = express.Router();

monitorRouter.use(authMiddleware);

monitorRouter.get("/get_cron_details", monitorController.GetInprogressCron);
monitorRouter.get("/get_422_product", monitorController.Get422ProductDetails);

monitorRouter.get("/get_floor_below", monitorController.GetProductsBelowFloor);

monitorRouter.get(
  "/load_scrape_only/:pageNo/:pageSize",
  monitorController.LoadScrapeOnlyProducts,
);
