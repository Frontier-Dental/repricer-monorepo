import Express from "express";
import * as productController from "../controllers/product";
import AuthToken from "../middleware/auth-token";
import { adminRouter } from "./admin";
import { appLogRouter } from "./app-log";
import { cacheRouter } from "./cache";
import { configRouter } from "./config";
import { cronLogsRouter } from "./cron-logs";
import { cronSettingsRouter } from "./cron-settings";
import { debugRouter } from "./debug";
import { cronFilterRouter } from "./filter";
import { helpRouter } from "./help";
import { historyRouter } from "./history";
import { monitorRouter } from "./monitor";
import { playRouter } from "./play";
import { productRouter } from "./product";
import { productV2Router } from "./product-v2";
import { reportRouter } from "./report";
import { scrapeRouter } from "./scrape";
import { scrapeLogsRouter } from "./scrape-logs";
import { userRouter } from "./user";

const router = Express.Router();

router.use(productV2Router);
router.use(productRouter);
router.use(cronLogsRouter);
router.use(userRouter);
router.use(helpRouter);
router.use(scrapeRouter);
router.use(cronSettingsRouter);
router.use(adminRouter);
router.use(configRouter);
router.use(historyRouter);
router.use(cacheRouter);
router.use(debugRouter);
router.use(reportRouter);
router.use(playRouter);
router.use(cronFilterRouter);
router.use(monitorRouter);
router.use(appLogRouter);
router.use(scrapeLogsRouter);

router.post(
  "/masteritem/sync_excel_data",
  AuthToken,
  productController.addExcelData,
);

export default router;
