import express, { Express, Request, Response, urlencoded, json } from "express";
import compression from "compression";
import fs from "fs";
import { StatusCodes } from "http-status-codes";
import { cacheController } from "./controller/cache";
import { feedController } from "./controller/feed";
import { dataController } from "./controller/product-data";
import { masterDataController } from "./controller/master-data";
import { debugController } from "./controller/debug";
import { filterCronController } from "./controller/filter-cron";
import { slowCronController } from "./controller/slow-cron-group";
import * as axiosHelper from "./utility/axios-helper";
import { proxySwitchController } from "./controller/proxy-switch";
import { appLogController } from "./controller/app_log";
import { scrapeCronController } from "./controller/scrape_cron";
import { searchController } from "./controller/search";
import { errorMiddleware } from "./utility/error-middleware";
import { manualRepriceController } from "./controller/manual-repricer";
import { mainCronController } from "./controller/main-cron";
import { applicationConfig, validateConfig } from "./utility/config";
import morgan from "morgan";

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  // Optionally: process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  // Optionally: process.exit(1);
});

const nodeApp: Express = express();
nodeApp.use(urlencoded({ extended: true, limit: "200kb" }));
nodeApp.use(json({ limit: "200kb" }));
nodeApp.use(morgan("combined"));
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
  }),
);
validateConfig();

const port = applicationConfig.PORT;
nodeApp.use(searchController);
nodeApp.use(mainCronController);
nodeApp.use(cacheController);
nodeApp.use(feedController);
nodeApp.use(dataController);
nodeApp.use(masterDataController);
nodeApp.use(manualRepriceController);
nodeApp.use(debugController);
nodeApp.use(filterCronController);
nodeApp.use(slowCronController);
nodeApp.use(proxySwitchController);
nodeApp.use(appLogController);
nodeApp.use(scrapeCronController);

// Health check endpoint
nodeApp.get("/health", (req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({ status: "ok" });
});

/**** GET API COLLECTIONS ****/
nodeApp.get("/api/GetStatus", async (req: Request, res: Response) => {
  res.status(StatusCodes.OK).json(`Application server running on post ${port}`);
});
nodeApp.use(errorMiddleware);

nodeApp.listen(port, () => {
  console.log(`Application server running on post ${port} at ${new Date()}`);
  if (applicationConfig.START_CRONS) {
    axiosHelper.native_get(applicationConfig.CRON_RUN_ALL_URL!);
    axiosHelper.native_get(applicationConfig.CRON_RUN_422_URL!);
    axiosHelper.native_get(applicationConfig.FILTER_CRON_RUN_URL!);
    axiosHelper.native_get(applicationConfig.SLOW_CRON_RUN_URL!);
    axiosHelper.native_get(applicationConfig.PROXYSWITCH_CRON_RUN_URL!);
    axiosHelper.native_get(applicationConfig.PROXYSWITCH_RESET_CRON_RUN_URL!);
    axiosHelper.native_get(applicationConfig.SCRAPE_ONLY_CRON_RUN_URL!);
  }
  if (!fs.existsSync("./activeProducts.json")) {
    fs.writeFileSync("./activeProducts.json", JSON.stringify([]));
    console.log(
      `Resetting complete for Active Products for Application Reset at ${new Date()}`,
    );
  }
});
