import express from "express";
import { startScrapeCron } from "./start-scrape-cron";
import { recreateScrapeCron } from "./recreate-scrape-cron";
import { toggleStatus } from "./toggle-status";
import { runCron, runProduct } from "./run-cron";

export const scrapeCronController = express.Router();

scrapeCronController.get("/scrape/GetScrapeCron", startScrapeCron);
scrapeCronController.post("/scrape/RecreateScrapeCron", recreateScrapeCron);
scrapeCronController.post("/scrape/toggleCronStatus", toggleStatus);
scrapeCronController.get("/scrape/run_soc/:cronName", runCron);
scrapeCronController.get("/scrape/run_prod_soc/:product/:cronName", runProduct);
