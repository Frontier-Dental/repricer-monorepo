import express from "express";
import { startScrapeCron } from "./start_scrape_cron";
import { recreateScrapeCron } from "./recreate_scrape_cron";
import { toggleStatus } from "./toggle_status";
import { runCron, runProduct } from "./run_cron";

export const scrapeCronController = express.Router();

scrapeCronController.get("/scrape/GetScrapeCron", startScrapeCron);
scrapeCronController.get("/scrape/RecreateScrapeCron", recreateScrapeCron);
scrapeCronController.post("/scrape/toggleCronStatus", toggleStatus);
scrapeCronController.get("/scrape/run_soc/:cronName", runCron);
scrapeCronController.get("/scrape/run_prod_soc/:product/:cronName", runProduct);
