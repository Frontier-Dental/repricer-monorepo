import express from "express";
import * as cronSettingsController from "../controllers/cron_settings";
import { authMiddleware } from "../middleware/auth-middleware";
import { apiLimiter } from "../middleware/rate-limiter";
import { asyncHandler } from "../utility/async-handler";

export const cronSettingsRouter = express.Router();

cronSettingsRouter.use(authMiddleware);
cronSettingsRouter.use(apiLimiter);

cronSettingsRouter.get("/", asyncHandler(cronSettingsController.getCronSettings));
cronSettingsRouter.post("/update_cron_settings", asyncHandler(cronSettingsController.updateCronSettings));

cronSettingsRouter.post("/toggle_cron_status", asyncHandler(cronSettingsController.toggleCronStatus));
cronSettingsRouter.get("/show_details/:param", asyncHandler(cronSettingsController.show_details));
cronSettingsRouter.get("/export_view/:type_info", asyncHandler(cronSettingsController.exportItems));
