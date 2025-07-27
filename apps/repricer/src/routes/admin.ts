import express from "express";
import * as adminController from "../controllers/admin";
import { authMiddleware } from "../middleware/is-auth";

export const adminRouter = express.Router();

adminRouter.use(authMiddleware);

adminRouter.get("/adminControl", adminController.getAdminSettings);
adminRouter.post(
  "/adminControl/purge_cron_id",
  adminController.purgeBasedOnCronId,
);
adminRouter.post(
  "/adminControl/purge_cron_time",
  adminController.purgeBasedOnDate,
);
adminRouter.post(
  "/admin/update_threshold_value",
  adminController.UpdateProxyProviderThresholdValue,
);
adminRouter.get(
  "/admin/reset_proxy_provider/:proxyProviderId",
  adminController.ResetProxyProvider,
);
adminRouter.get(
  "/schedule/run_specific_cron/:cronName",
  adminController.runSpecificCron,
);
