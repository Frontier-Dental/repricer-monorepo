import { authMiddleware } from "../middleware/is-auth";
import * as cronLogsController from "../controllers/cron_logs";

import express from "express";

export const cronLogsRouter = express.Router();
cronLogsRouter.use(authMiddleware);

cronLogsRouter.get("/dashboard/download_json", cronLogsController.downloadLog);
cronLogsRouter.get("/dashboard", cronLogsController.getCronLogs);
cronLogsRouter.get(
  "/dashboard/get_logs_details/:id",
  cronLogsController.getLogsDetails,
);
cronLogsRouter.get(
  "/dashboard/get_raw_json/:mpId/:idx/:vendor",
  cronLogsController.getRawJson,
);
cronLogsRouter.get(
  "/dashboard/update_price/:mpId/:idx",
  cronLogsController.updatePrice,
);

cronLogsRouter.get("/dashboard/update_all/:idx", cronLogsController.updateAll);
cronLogsRouter.get(
  "/dashboard/export_data/:idx",
  cronLogsController.exportDataV2,
);
cronLogsRouter.get(
  "/dashboard/export_bulk_data/:from/:to",
  cronLogsController.exportBulkData,
);
cronLogsRouter.get(
  "/downloads/list_downloads",
  cronLogsController.listDownloads,
);
cronLogsRouter.get("/download_file/:file", cronLogsController.downloadFile);
cronLogsRouter.get("/delete_file/:id/:file", cronLogsController.deleteFile);
cronLogsRouter.post(
  "/dashboard/updatePriceAsync",
  cronLogsController.updatePriceExternal,
);
cronLogsRouter.get(
  "/dashboard/get_filter_logs/:noOfLogs",
  cronLogsController.getFilterCronLogsByLimit,
);
cronLogsRouter.get("/currentTasks", cronLogsController.getCurrentTasks);
cronLogsRouter.get("/cronHistory", cronLogsController.getCronHistoryLogs);

cronLogsRouter.post(
  "/cronHistory/get_cron_details",
  cronLogsController.getCustomCronDetails,
);
