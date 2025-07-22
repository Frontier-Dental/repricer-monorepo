import express from "express";
import { recreateCronHandler } from "./recreate";
import { startCronHandler } from "./start";
import { startAllCronHandler } from "./start_all";
import { stopCronHandler } from "./stop";
import { stopAllCronHandler } from "./stop_all";
import { start422Handler } from "./start_422";
import { updateProductManualHandler } from "./update_product_manual";
import { startOverrideHandler } from "./start_override";
import { startFeedCronHandler } from "./start_feed_cron";
import { startProductCronHandler } from "./start_product_cron";
import { startManagedServiceCronHandler } from "./start_managed_service_cron";
import { startSpecificCronHandler } from "./start_specific_cron";

export const mainCronController = express.Router();

mainCronController.get("/schedule/StopAll", stopAllCronHandler);
mainCronController.get("/schedule/StartCronV3", startAllCronHandler);
mainCronController.post("/schedule/StopCron", stopCronHandler);
mainCronController.post("/schedule/StartCron", startCronHandler);
mainCronController.post("/schedule/RecreateCron", recreateCronHandler);
mainCronController.get("/schedule/start422", start422Handler);
mainCronController.post(
  "/product/updateManualProd/:id",
  updateProductManualHandler,
);
mainCronController.get("/schedule/startOverride", startOverrideHandler);
mainCronController.get("/schedule/startFeedCron", startFeedCronHandler);
mainCronController.get("/schedule/startProductCron", startProductCronHandler);
mainCronController.get(
  "/schedule/startManagedServiceCron",
  startManagedServiceCronHandler,
);
mainCronController.get(
  "/schedule/start_specific_cron/:key",
  startSpecificCronHandler,
);
