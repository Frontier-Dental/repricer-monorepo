import express from "express";
import * as scrapeController from "../controllers/scrape";
import { authMiddleware } from "../middleware/auth-middleware";

export const scrapeRouter = express.Router();

scrapeRouter.use(authMiddleware);

scrapeRouter.get("/", scrapeController.GetScrapeCron);
scrapeRouter.get(
  "/get_price_info/:identifier",
  scrapeController.GetLatestPriceInfo,
);
scrapeRouter.post("/save/download", scrapeController.exportItems);
scrapeRouter.post("/toggle_cron_status", scrapeController.ToggleCronStatus);
scrapeRouter.post("/update_scrape_cron", scrapeController.UpdateScrapeCronExp);
scrapeRouter.get("/show_products", scrapeController.GetScrapeProducts);
scrapeRouter.post("/download", scrapeController.exportItems);
scrapeRouter.post("/add_excel", scrapeController.importItems);
scrapeRouter.post("/add_item", scrapeController.addItems);
scrapeRouter.post("/edit_item", scrapeController.editItems);
scrapeRouter.post("/delete", scrapeController.deleteItem);
