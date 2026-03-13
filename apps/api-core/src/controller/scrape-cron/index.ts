import express from "express";
import { asyncHandler } from "../../utility/async-handler";
import { startScrapeCron } from "./start-scrape-cron";
import { recreateScrapeCron } from "./recreate-scrape-cron";
import { toggleStatus } from "./toggle-status";
import { runCron, runProduct } from "./run-cron";

export const scrapeCronController = express.Router();

scrapeCronController.get("/scrape/GetScrapeCron", asyncHandler(startScrapeCron));
scrapeCronController.post("/scrape/RecreateScrapeCron", asyncHandler(recreateScrapeCron));
scrapeCronController.post("/scrape/toggleCronStatus", asyncHandler(toggleStatus));
scrapeCronController.get("/scrape/run_soc/:cronName", asyncHandler(runCron));
scrapeCronController.get("/scrape/run_prod_soc/:product/:cronName", asyncHandler(runProduct));
