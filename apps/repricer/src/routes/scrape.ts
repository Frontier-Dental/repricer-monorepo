import express from "express";
import * as scrapeController from "../controllers/scrape";
import { authMiddleware } from "../middleware/auth-middleware";
import { apiLimiter } from "../middleware/rate-limiter";
import { asyncHandler } from "../utility/async-handler";

export const scrapeRouter = express.Router();

scrapeRouter.use(authMiddleware);
scrapeRouter.use(apiLimiter);

scrapeRouter.get("/", asyncHandler(scrapeController.GetScrapeCron));
scrapeRouter.get("/get_price_info/:identifier", asyncHandler(scrapeController.GetLatestPriceInfo));
scrapeRouter.post("/save/download", asyncHandler(scrapeController.exportItems));
scrapeRouter.post("/toggle_cron_status", asyncHandler(scrapeController.ToggleCronStatus));
scrapeRouter.post("/update_scrape_cron", asyncHandler(scrapeController.UpdateScrapeCronExp));
scrapeRouter.get("/show_products", asyncHandler(scrapeController.GetScrapeProducts));
scrapeRouter.post("/download", asyncHandler(scrapeController.exportItems));
scrapeRouter.post("/add_excel", asyncHandler(scrapeController.importItems));
scrapeRouter.post("/add_item", asyncHandler(scrapeController.addItems));
scrapeRouter.post("/edit_item", asyncHandler(scrapeController.editItems));
scrapeRouter.post("/delete", asyncHandler(scrapeController.deleteItem));
