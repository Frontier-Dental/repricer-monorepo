import express from "express";
import * as cronSettingsController from "../controllers/cron_settings";
import { authMiddleware } from "../middleware/auth-middleware";

export const cronSettingsRouter = express.Router();

cronSettingsRouter.use(authMiddleware);

cronSettingsRouter.get("/", cronSettingsController.getCronSettings);
cronSettingsRouter.post(
  "/update_cron_settings",
  cronSettingsController.updateCronSettings,
);
cronSettingsRouter.get(
  "/add_cron_settings",
  cronSettingsController.addCronSettings,
);
cronSettingsRouter.post(
  "/toggle_cron_status",
  cronSettingsController.toggleCronStatus,
);
cronSettingsRouter.get(
  "/show_details/:param",
  cronSettingsController.show_details,
);
cronSettingsRouter.get(
  "/export_view/:type_info",
  cronSettingsController.exportItems,
);
