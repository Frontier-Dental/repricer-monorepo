import express from "express";
import * as adminController from "../controllers/admin";
import { authMiddleware } from "../middleware/auth-middleware";
import { apiLimiter } from "../middleware/rate-limiter";
import { asyncHandler } from "../utility/async-handler";

export const adminRouter = express.Router();

adminRouter.use(authMiddleware);
adminRouter.use(apiLimiter);

adminRouter.get("/", asyncHandler(adminController.getAdminSettings));
adminRouter.post("/purge_cron_id", asyncHandler(adminController.purgeBasedOnCronId));
adminRouter.post("/purge_cron_time", asyncHandler(adminController.purgeBasedOnDate));
adminRouter.post("/update_threshold_value", asyncHandler(adminController.UpdateProxyProviderThresholdValue));
adminRouter.get("/reset_proxy_provider/:proxyProviderId", asyncHandler(adminController.ResetProxyProvider));
adminRouter.get("/run_specific_cron/:cronName", asyncHandler(adminController.runSpecificCron));
