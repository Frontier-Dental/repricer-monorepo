import express from "express";
import * as adminController from "../controllers/admin";
import { authMiddleware } from "../middleware/auth-middleware";

export const adminRouter = express.Router();

adminRouter.use(authMiddleware);

adminRouter.get("/", adminController.getAdminSettings);
adminRouter.post("/purge_cron_id", adminController.purgeBasedOnCronId);
adminRouter.post("/purge_cron_time", adminController.purgeBasedOnDate);
adminRouter.post(
  "/update_threshold_value",
  adminController.UpdateProxyProviderThresholdValue,
);
adminRouter.get(
  "/reset_proxy_provider/:proxyProviderId",
  adminController.ResetProxyProvider,
);
adminRouter.get(
  "/run_specific_cron/:cronName",
  adminController.runSpecificCron,
);
