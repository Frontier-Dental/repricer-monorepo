import express from "express";
import * as scrapeController from "../controllers/scrape";
import { authMiddleware } from "../middleware/is-auth";

export const scrapeRouter = express.Router();

scrapeRouter.use(authMiddleware);

scrapeRouter.get(
  "/scrape/get_price_info/:identifier",
  scrapeController.GetLatestPriceInfo,
);
scrapeRouter.post("/scrape/save/download", scrapeController.exportItems);
scrapeRouter.get("/scrape", scrapeController.GetScrapeCron);
scrapeRouter.post(
  "/scrape/toggle_cron_status",
  scrapeController.ToggleCronStatus,
);
scrapeRouter.post(
  "/scrape/update_scrape_cron",
  scrapeController.UpdateScrapeCronExp,
);
scrapeRouter.get("/scrape/show_products", scrapeController.GetScrapeProducts);
scrapeRouter.post("/scrape/download", scrapeController.exportItems);
scrapeRouter.post("/scrape/add_excel", scrapeController.importItems);
scrapeRouter.post("/scrape/add_item", scrapeController.addItems);
scrapeRouter.post("/scrape/edit_item", scrapeController.editItems);
scrapeRouter.post("/delete", scrapeController.deleteItem);
