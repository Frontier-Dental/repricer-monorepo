import express from "express";
import { recreateCronHandler } from "./recreate";
import { startCronHandler } from "./start";
import { startAllCronHandler } from "./start-all";
import { stopCronHandler } from "./stop";
import { stopAllCronHandler } from "./stop-all";
import { start422Handler } from "./start-422";
import { startOpportunityHandler } from "./start-opportunity";
import { updateProductManualHandler } from "./update-product-manual";
import { startOverrideHandler } from "./startoverride";
import { startFeedCronHandler } from "./start-feed-cron";
import { startProductCronHandler } from "./start-product-cron";
import { startManagedServiceCronHandler } from "./start-managed-service-cron";
import { startSpecificCronHandler } from "./start-specific-cron";

export const mainCronController = express.Router();

mainCronController.get("/schedule/StopAll", stopAllCronHandler);
mainCronController.get("/schedule/StartCronV3", startAllCronHandler);
mainCronController.post("/schedule/StopCron", stopCronHandler);
mainCronController.post("/schedule/StartCron", startCronHandler);
mainCronController.post("/schedule/RecreateCron", recreateCronHandler);
mainCronController.get("/schedule/start422", start422Handler);
mainCronController.get("/schedule/startOpportunity", startOpportunityHandler);
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
