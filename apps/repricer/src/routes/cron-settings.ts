import express from "express";
import * as cronSettingsController from "../controllers/cron_settings";
import { authMiddleware } from "../middleware/is-auth";

export const cronSettingsRouter = express.Router();

cronSettingsRouter.use(authMiddleware);

cronSettingsRouter.get("/cronSettings", cronSettingsController.getCronSettings);
cronSettingsRouter.post(
  "/cronSettings/update_cron_settings",
  cronSettingsController.updateCronSettings,
);
cronSettingsRouter.get(
  "/cronSettings/add_cron_settings",
  cronSettingsController.addCronSettings,
);
cronSettingsRouter.post(
  "/cronSettings/toggle_cron_status",
  cronSettingsController.toggleCronStatus,
);
cronSettingsRouter.get(
  "/cronSettings/show_details/:param",
  cronSettingsController.show_details,
);
cronSettingsRouter.get(
  "/cronSettings/export_view/:type_info",
  cronSettingsController.exportItems,
);
