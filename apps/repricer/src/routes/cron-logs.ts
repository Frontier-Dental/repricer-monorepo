import { authMiddleware } from "../middleware/auth-middleware";
import * as cronLogsController from "../controllers/cron_logs";

import express from "express";
import { apiLimiter } from "../middleware/rate-limiter";
import { asyncHandler } from "../utility/async-handler";

export const cronLogsRouter = express.Router();
cronLogsRouter.use(authMiddleware);
cronLogsRouter.use(apiLimiter);

cronLogsRouter.get("/download_json", asyncHandler(cronLogsController.downloadLog));
cronLogsRouter.get("/", asyncHandler(cronLogsController.getCronLogs));
cronLogsRouter.get("/get_logs_details/:id", asyncHandler(cronLogsController.getLogsDetails));
cronLogsRouter.get("/get_raw_json/:mpId/:idx/:vendor", asyncHandler(cronLogsController.getRawJson));
cronLogsRouter.get("/update_price/:mpId/:idx", asyncHandler(cronLogsController.updatePrice));

cronLogsRouter.get("/update_all/:idx", asyncHandler(cronLogsController.updateAll));
cronLogsRouter.get("/export_data/:idx", asyncHandler(cronLogsController.exportDataV2));
cronLogsRouter.get("/export_bulk_data/:from/:to", asyncHandler(cronLogsController.exportBulkData));
cronLogsRouter.get("/downloads/list_downloads", asyncHandler(cronLogsController.listDownloads));
// cronLogsRouter.get("/download_file/:file", cronLogsController.downloadFile);
// cronLogsRouter.get("/delete_file/:id/:file", cronLogsController.deleteFile);
cronLogsRouter.post("/updatePriceAsync", asyncHandler(cronLogsController.updatePriceExternal));
cronLogsRouter.get("/get_filter_logs/:noOfLogs", asyncHandler(cronLogsController.getFilterCronLogsByLimit));
cronLogsRouter.get("/currentTasks", asyncHandler(cronLogsController.getCurrentTasks));
cronLogsRouter.get("/getInProgressRegularCrons", asyncHandler(cronLogsController.getInProgressRegularCrons));
cronLogsRouter.get("/getInProgressScrapeCrons", asyncHandler(cronLogsController.getInProgressScrapeCrons));
cronLogsRouter.get("/cronHistory", asyncHandler(cronLogsController.getCronHistoryLogs));

// cronLogsRouter.post(
//   "/cronHistory/get_cron_details",
//   cronLogsController.getCustomCronDetails,
// );
