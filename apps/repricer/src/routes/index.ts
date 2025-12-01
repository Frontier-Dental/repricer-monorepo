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
import { storageSenseController } from "../controllers/storage-sense";
import { notifyController } from "../controllers/notify-controller";
import { ipHealthController } from "../controllers/ip-health";
import { monitorSenseController } from "../controllers/monitor-sense";
import { v2AlgoRouter } from "./v2-algo";
import { waitlistRouter } from "./waitlist";

const router = Express.Router();

router.use(userRouter);
router.use("/productV2", productV2Router);
router.use("/v2-algo", v2AlgoRouter);
router.use("/masteritem", productRouter);
router.use("/dashboard", cronLogsRouter);
router.use("/help", helpRouter);
router.use("/scrape", scrapeRouter);
router.use("/cronSettings", cronSettingsRouter);
router.use("/admin", adminRouter);
router.use("/config", configRouter);
router.use("/history", historyRouter);
router.use("/cache", cacheRouter);
router.use("/debug", debugRouter);
router.use("/report", reportRouter);
router.use("/play", playRouter);
router.use("/filter", cronFilterRouter);
router.use("/monitor", monitorRouter);
router.use("/app-log", appLogRouter);
router.use("/scrape", scrapeLogsRouter);
router.use("/waitlist", waitlistRouter);
router.use(storageSenseController);
router.use(notifyController);
router.use(ipHealthController);
router.use(monitorSenseController);

router.post(
  "/masteritem/sync_excel_data",
  AuthToken,
  productController.addExcelData,
);

export default router;
