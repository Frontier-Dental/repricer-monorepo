import { authMiddleware } from "../middleware/auth-middleware";
import * as cronLogsController from "../controllers/cron_logs";

import express from "express";

export const cronLogsRouter = express.Router();
cronLogsRouter.use(authMiddleware);

cronLogsRouter.get("/download_json", cronLogsController.downloadLog);
cronLogsRouter.get("/", cronLogsController.getCronLogs);
cronLogsRouter.get("/get_logs_details/:id", cronLogsController.getLogsDetails);
cronLogsRouter.get(
  "/get_raw_json/:mpId/:idx/:vendor",
  cronLogsController.getRawJson,
);
cronLogsRouter.get("/update_price/:mpId/:idx", cronLogsController.updatePrice);

cronLogsRouter.get("/update_all/:idx", cronLogsController.updateAll);
cronLogsRouter.get("/export_data/:idx", cronLogsController.exportDataV2);
cronLogsRouter.get(
  "/export_bulk_data/:from/:to",
  cronLogsController.exportBulkData,
);
cronLogsRouter.get(
  "/downloads/list_downloads",
  cronLogsController.listDownloads,
);
// cronLogsRouter.get("/download_file/:file", cronLogsController.downloadFile);
// cronLogsRouter.get("/delete_file/:id/:file", cronLogsController.deleteFile);
cronLogsRouter.post(
  "/updatePriceAsync",
  cronLogsController.updatePriceExternal,
);
cronLogsRouter.get(
  "/get_filter_logs/:noOfLogs",
  cronLogsController.getFilterCronLogsByLimit,
);
cronLogsRouter.get("/currentTasks", cronLogsController.getCurrentTasks);
cronLogsRouter.get(
  "/getInProgressRegularCrons",
  cronLogsController.getInProgressRegularCrons,
);
cronLogsRouter.get(
  "/getInProgressScrapeCrons",
  cronLogsController.getInProgressScrapeCrons,
);
cronLogsRouter.get("/cronHistory", cronLogsController.getCronHistoryLogs);

// cronLogsRouter.post(
//   "/cronHistory/get_cron_details",
//   cronLogsController.getCustomCronDetails,
// );
