import express from "express";
import { asyncHandler } from "../../utility/async-handler";
import { recreateCronHandler } from "./recreate";
import { startCronHandler } from "./start";
import { startAllCronHandler } from "./start-all";
import { stopCronHandler } from "./stop";
import { stopAllCronHandler } from "./stop-all";
import { start422Handler } from "./start-422";
import { updateProductManualHandler } from "./update-product-manual";
import { startOverrideHandler } from "./startoverride";
import { startFeedCronHandler } from "./start-feed-cron";
import { startProductCronHandler } from "./start-product-cron";
import { startManagedServiceCronHandler } from "./start-managed-service-cron";
import { startSpecificCronHandler } from "./start-specific-cron";

export const mainCronController = express.Router();

mainCronController.get("/schedule/StopAll", asyncHandler(stopAllCronHandler));
mainCronController.get("/schedule/StartCronV3", asyncHandler(startAllCronHandler));
mainCronController.post("/schedule/StopCron", asyncHandler(stopCronHandler));
mainCronController.post("/schedule/StartCron", asyncHandler(startCronHandler));
mainCronController.post("/schedule/RecreateCron", asyncHandler(recreateCronHandler));
mainCronController.get("/schedule/start422", asyncHandler(start422Handler));
mainCronController.post("/product/updateManualProd/:id", asyncHandler(updateProductManualHandler));
mainCronController.get("/schedule/startOverride", asyncHandler(startOverrideHandler));
mainCronController.get("/schedule/startFeedCron", asyncHandler(startFeedCronHandler));
mainCronController.get("/schedule/startProductCron", asyncHandler(startProductCronHandler));
mainCronController.get("/schedule/startManagedServiceCron", asyncHandler(startManagedServiceCronHandler));
mainCronController.get("/schedule/start_specific_cron/:key", asyncHandler(startSpecificCronHandler));
