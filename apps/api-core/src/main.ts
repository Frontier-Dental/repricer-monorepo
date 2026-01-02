import compression from "compression";
import express, { Express, json, Request, Response, urlencoded } from "express";
import fs from "fs";
import { StatusCodes } from "http-status-codes";
import morgan from "morgan";
import packageJson from "../package.json";
import { appLogController } from "./controller/app_log";
import { cacheController } from "./controller/cache";
import { debugController } from "./controller/debug";
import { feedController } from "./controller/feed";
import { filterCronRouter } from "./controller/filter-cron";
import { startFilterCronLogic } from "./controller/filter-cron/start";
import { mainCronController } from "./controller/main-cron";
import { start422Logic } from "./controller/main-cron/start-422";
import { startAllCronLogic } from "./controller/main-cron/start-all";
import { manualRepriceController } from "./controller/manual-repricer";
import { masterDataController } from "./controller/master-data";
import { dataController } from "./controller/product-data";
import { proxySwitchController, startProxySwitchCronLogic, startProxySwitchResetCronLogic } from "./controller/proxy-switch";
import { scrapeCronController } from "./controller/scrape-cron";
import { startScrapeCronLogic } from "./controller/scrape-cron/start-scrape-cron";
import { searchController } from "./controller/search";
import { slowCronGroupRouter } from "./controller/slow-cron-group";
import { startSlowCronLogic } from "./controller/slow-cron-group/start";
import { startV2AlgoHtmlFileCleanupCron } from "./services/algo-html-file-cleanup";
import { applicationConfig, validateConfig } from "./utility/config";
import { errorMiddleware } from "./utility/error-middleware";
import { initializeThresholdScraping } from "./utility/reprice-algo/v2/threshold-scraping";
import { startMiniErpCronLogic } from "./controller/mini-erp-cron/start-cron";
import { minErpCronController } from "./controller/mini-erp-cron";

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  // Optionally: process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  // Optionally: process.exit(1);
});

validateConfig();

const nodeApp: Express = express();
if (applicationConfig.REQUEST_LOGGING) {
  nodeApp.use(morgan("combined"));
}
nodeApp.use(urlencoded({ extended: true, limit: "200kb" }));
nodeApp.use(json({ limit: "200kb" }));
nodeApp.use(
  compression({
    filter: (req: Request, res: Response) => {
      if (req.headers["x-no-compression"]) {
        return false;
      }
      return compression.filter(req, res);
    },
    threshold: 0,
    level: 9,
  })
);
const port = applicationConfig.PORT;
process.env.TZ = "Canada/Eastern";
nodeApp.use(searchController);
nodeApp.use(mainCronController);
nodeApp.use(cacheController);
nodeApp.use(feedController);
nodeApp.use(dataController);
nodeApp.use(masterDataController);
nodeApp.use(manualRepriceController);
nodeApp.use(debugController);
nodeApp.use(filterCronRouter);
nodeApp.use(slowCronGroupRouter);
nodeApp.use(proxySwitchController);
nodeApp.use(appLogController);
nodeApp.use(scrapeCronController);
nodeApp.use(minErpCronController);

// Health check endpoint
nodeApp.get("/health", (req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({ status: "ok" });
});

/**** GET API COLLECTIONS ****/
nodeApp.get("/api/GetStatus", async (req: Request, res: Response) => {
  res.status(StatusCodes.OK).json(`Application server running on post ${port}`);
});
nodeApp.use(errorMiddleware);

nodeApp.listen(port, async () => {
  console.info(`Application server running on post ${port} at ${new Date()}`);
  console.info(`Application version: ${packageJson.version}`);
  initializeThresholdScraping();
  if (applicationConfig.SCHEDULE_CRONS_ON_STARTUP) {
    console.info("Scheduling enabled crons on startup");
    await startAllCronLogic();
    await start422Logic();
    await startFilterCronLogic();
    await startSlowCronLogic();
    await startProxySwitchCronLogic();
    await startProxySwitchResetCronLogic();
    await startScrapeCronLogic();
    await startMiniErpCronLogic();
    startV2AlgoHtmlFileCleanupCron();
    console.info("All enabled crons started on startup");
  }
  if (!fs.existsSync("./activeProducts.json")) {
    fs.writeFileSync("./activeProducts.json", JSON.stringify([]));
    console.info(`Resetting complete for Active Products for Application Reset at ${new Date()}`);
  }
});
