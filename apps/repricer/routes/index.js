const Express = require("express");
const indexController = require("../controllers/indexController.js");
const cronLogsController = require("../controllers/cronLogsController");
const Auth = require("../middleware/is-auth.js");
const AuthToken = require("../middleware/auth-token.js");
const productController = require("../controllers/productController.js");
const helpController = require("../controllers/helpController");
const cronSettingsController = require("../controllers/cronSettingsController");
const adminController = require("../controllers/adminController");
const configController = require("../controllers/configController");
const historyController = require("../controllers/historyController");
const cacheController = require("../controllers/cacheController");
const productV2Controller = require("../controllers/productV2Controller.js");
const reportController = require("../controllers/reportController.js");
const filterController = require("../controllers/cronFilterController");
const debugController = require("../controllers/debugController");
const monitorController = require("../controllers/monitorController.js");
const playController = require("../controllers/playController.js");
const appLogController = require("../controllers/appLogController.js");
const scrapeController = require("../controllers/scrapeController.js");
const scrapeLogsController = require("../controllers/scrapeLogsController.js");

const multer = require("multer");

const router = Express.Router();

router.get("/", indexController.index);
router.post("/login_post", indexController.login_post);
router.get("/logout", indexController.logout);

// get master items
router.get("/masteritem", Auth, productController.getMasterItemController);
// add masteritem
router.get("/masteritem/add", Auth, productController.addMasterItemController);
router.post(
  "/masteritem/add_item_post",
  Auth,
  productController.addMasterItemToDatabase,
);

router.get(
  "/masteritem/edit_item/:id",
  Auth,
  productController.editMasterItemController,
);
router.post("/delete_item", Auth, productController.deleteMasterItemController);

router.post(
  "/masteritem/update_item_post/",
  Auth,
  productController.updateMasterItemController,
);
router.post("/download_excel", Auth, productController.excelDownload);
router.post("/masteritem/add_excel_V2", Auth, productController.addExcelData);

router.post("/change_password", Auth, indexController.changePassword);
router.get("/masteritem/runAllCron", Auth, productController.runAllCron);
router.post(
  "/productV2/runManualCron",
  Auth,
  productV2Controller.runManualCron,
);
router.get("/masteritem/resetCron", Auth, productController.resetCron);
router.get("/masteritem/delete_all", Auth, productController.deleteAll);
router.get("/dashboard/download_json", Auth, cronLogsController.downloadLog);
router.get("/dashboard", Auth, cronLogsController.getCronLogs);
// router.get("/dashboard/:pgno", Auth, cronLogsController.getCronLogs);
// router.get("/dashboard/:pgno/:type", Auth, cronLogsController.getCronLogs);
router.get(
  "/dashboard/get_logs_details/:id",
  Auth,
  cronLogsController.getLogsDetails,
);
router.get(
  "/dashboard/get_raw_json/:mpId/:idx/:vendor",
  Auth,
  cronLogsController.getRawJson,
);
router.get(
  "/dashboard/update_price/:mpId/:idx",
  Auth,
  cronLogsController.updatePrice,
);
router.get("/dashboard/update_all/:idx", Auth, cronLogsController.updateAll);
router.get(
  "/dashboard/export_data/:idx",
  Auth,
  cronLogsController.exportDataV2,
);
router.get(
  "/dashboard/export_bulk_data/:from/:to",
  Auth,
  cronLogsController.exportBulkData,
);
router.get("/downloads/list_downloads", Auth, cronLogsController.listDownloads);
router.get("/download_file/:file", Auth, cronLogsController.downloadFile);
router.get("/delete_file/:id/:file", Auth, cronLogsController.deleteFile);
router.post(
  "/dashboard/updatePriceAsync",
  cronLogsController.updatePriceExternal,
);
router.get(
  "/dashboard/get_filter_logs/:noOfLogs",
  Auth,
  cronLogsController.getFilterCronLogsByLimit,
);

//Help EndPoints
router.get("/help/GetLogsById/:id", helpController.getLogsById);
router.get("/help/ProductDetails/:id", helpController.getProductDetails);

// router.get("/masteritem/:pgno",Auth, productController.getMasterItemController) ;

router.get("/cronSettings", Auth, cronSettingsController.getCronSettings);
router.post(
  "/cronSettings/update_cron_settings",
  Auth,
  cronSettingsController.updateCronSettings,
);
router.get(
  "/cronSettings/add_cron_settings",
  Auth,
  cronSettingsController.addCronSettings,
);
router.post(
  "/cronSettings/toggle_cron_status",
  Auth,
  cronSettingsController.toggleCronStatus,
);

router.get("/adminControl", Auth, adminController.getAdminSettings);
router.post(
  "/adminControl/purge_cron_id",
  Auth,
  adminController.purgeBasedOnCronId,
);
router.post(
  "/adminControl/purge_cron_time",
  Auth,
  adminController.purgeBasedOnDate,
);
router.post(
  "/masteritem/updateAllToMax",
  Auth,
  productV2Controller.updateToMax,
);
router.post(
  "/admin/update_threshold_value",
  Auth,
  adminController.UpdateProxyProviderThresholdValue,
);
router.get(
  "/admin/reset_proxy_provider/:proxyProviderId",
  Auth,
  adminController.ResetProxyProvider,
);

router.get("/configuration", Auth, configController.GetConfigSetup);
router.post("/config/update", Auth, configController.UpdateConfig);
router.post("/config/envUpdate", Auth, configController.UpdateEnvInfo);

router.get("/history", Auth, historyController.getHistory);
router.post(
  "/history/exportHistoryById",
  Auth,
  historyController.getHistoryById,
);
router.post("/history/get_all", Auth, historyController.getAllHistory);
router.get("/history/download/:file", Auth, historyController.downloadFile);

router.get("/help/healthCheck", helpController.doHealthCheck);
router.get("/help/ip_health_check", helpController.doIpHealthCheck);

router.get("/masteritem/stop_all_cron", Auth, productController.stopAllCron);

router.get("/cache/get_all_cache", cacheController.get_all_cache);
router.get("/cache/flush_all_cache", Auth, cacheController.flush_all_cache);
router.get("/cache/get_cache_item/:key", cacheController.get_cache_item);
router.get(
  "/cache/delete_cache_item/:key",
  Auth,
  cacheController.delete_cache_item,
);

router.get(
  "/masteritem/start_override",
  Auth,
  productController.start_override,
);
router.get(
  "/cronSettings/show_details/:param",
  Auth,
  cronSettingsController.show_details,
);

router.get("/help/ip_ping_check", helpController.pingCheck);
router.get("/help/let_me_in", Auth, helpController.troubleshoot);
router.post("/help/check_ip_status", helpController.debugIp);
router.post("/help/check_ip_status_v2", Auth, helpController.debugIpV2);

router.get(
  "/masteritem/get_all_active_products",
  productController.getAllActiveProducts,
);

router.get("/help/load_product/:id", helpController.loadProductDetails);
router.get("/productV2/show_all", Auth, productV2Controller.showAllProducts);
router.get("/productV2/load_initial", productV2Controller.collateProducts);
router.get(
  "/productV2/load_initial_product/:id",
  productV2Controller.collateProductsForId,
);
router.get("/productV2/editItem/:mpid", Auth, productV2Controller.editItemView);
router.get("/productV2/add", Auth, productV2Controller.addItems);
router.post(
  "/productV2/add_item_post",
  Auth,
  productV2Controller.addItemToDatabase,
);
router.post("/productV2/download_excel", Auth, productV2Controller.exportItems);

router.post(
  "/productV2/update_product_V2",
  Auth,
  productV2Controller.updateProductDetails,
);
router.post("/productV2/save_branches", Auth, productV2Controller.saveBranches);
router.post(
  "/productV2/activate_all",
  Auth,
  productV2Controller.activateProductForAll,
);
router.post(
  "/productV2/deactivate_all",
  Auth,
  productV2Controller.deActivateProductForAll,
);

router.get("/help/updateSecretKey", helpController.updateCronSecretKey);

router.get("/help/create_cron/:count", helpController.createCrons);
router.get(
  "/help/align_execution_priority",
  helpController.alignExecutionPriority,
);
router.get(
  "/schedule/run_specific_cron/:cronName",
  Auth,
  adminController.runSpecificCron,
);

router.get(
  "/report/get_failed_scrape",
  reportController.GetFailedRepriceDetails,
);
router.get(
  "/report/scrape_failure",
  Auth,
  reportController.ExportScrapeFailure,
);
router.get("/filter", Auth, filterController.GetFilterCron);
router.post(
  "/filter/update_filter_cron",
  Auth,
  filterController.UpdateFilterCron,
);
router.post(
  "/filter/update_slow_cron",
  Auth,
  filterController.UpdateSlowCronExpression,
);
router.get("/filter/export_log/:key", Auth, filterController.ExportLogDetails);

router.post(
  "/filter/toggle_cron_status",
  Auth,
  filterController.ToggleCronStatus,
);
router.get(
  "/debug/reset_slow_cron_update",
  debugController.ResetSlowCronUpdate,
);
router.post(
  "/debug/refill_parent_cron",
  debugController.RefillParentCronDetails,
);

router.get("/monitor/get_cron_details", monitorController.GetInprogressCron);
router.get("/monitor/get_422_product", monitorController.Get422ProductDetails);

router.get("/monitor/get_floor_below", monitorController.GetProductsBelowFloor);

router.get(
  "/play/scrape_data/:mpid/:proxyProviderId",
  Auth,
  playController.ScrapeProduct,
);
router.get("/play/let_me_in", Auth, playController.onInit);
router.post("/debug/correct_slow_cron", debugController.CorrectSlowCronDetails);
router.get("/cache/flush_repricer_all", cacheController.ClearRepricerCache);
router.post("/add_user", indexController.add_user);
router.post("/update_user", indexController.update_user);

router.get("/logs", Auth, appLogController.GetAppLogs);
router.get("/clear-logs", Auth, appLogController.clearLogs);
router.get("/export-logs", Auth, appLogController.excelExport);

router.get("/currentTasks", Auth, cronLogsController.getCurrentTasks);
router.get("/cronHistory", Auth, cronLogsController.getCronHistoryLogs);

router.get("/scrape", Auth, scrapeController.GetScrapeCron);
router.post(
  "/scrape/toggle_cron_status",
  Auth,
  scrapeController.ToggleCronStatus,
);
router.post(
  "/scrape/update_scrape_cron",
  Auth,
  scrapeController.UpdateScrapeCronExp,
);
router.post(
  "/cronHistory/get_cron_details",
  Auth,
  cronLogsController.getCustomCronDetails,
);
router.get("/scrape/show_products", Auth, scrapeController.GetScrapeProducts);
router.post("/scrape/download", Auth, scrapeController.exportItems);
router.post("/scrape/add_excel", Auth, scrapeController.importItems);
router.post("/scrape/add_item", Auth, scrapeController.addItems);
router.post("/scrape/edit_item", Auth, scrapeController.editItems);

router.get("/scrape/logs", Auth, scrapeLogsController.showLogHistory);
router.get(
  "/scrape/logs_history_list/:id",
  Auth,
  scrapeLogsController.logsHistoryList,
);
router.post("/delete", Auth, scrapeController.deleteItem);

router.get(
  "/monitor/load_scrape_only/:pageNo/:pageSize",
  monitorController.LoadScrapeOnlyProducts,
);
router.get(
  "/scrape/get_price_info/:identifier",
  AuthToken,
  scrapeController.GetLatestPriceInfo,
);

router.get(
  "/cronSettings/export_view/:type_info",
  Auth,
  cronSettingsController.exportItems,
);
router.post("/debug/map_vendor_to_root", debugController.MapVendorToRoot);

router.post("/scrape/save/download", scrapeController.exportItems);
router.post("/productV2/save/download_excel", productV2Controller.exportItems);

router.post(
  "/productV2/toggle_data_scrape",
  Auth,
  productV2Controller.toggleDataScrape,
);

router.get("/debug/get_floor_products", debugController.GetFloorBelowProducts);
router.get(
  "/help/getProductDetailsById/:id",
  AuthToken,
  helpController.getProductDetails,
);
router.get(
  "/help/sync_product/:id",
  Auth,
  productV2Controller.syncProductDetails,
);
router.post(
  "/masteritem/sync_excel_data",
  AuthToken,
  productController.addExcelData,
);
router.post(
  "/productV2/save_rootDetails",
  Auth,
  productV2Controller.saveRootDetails,
);
router.get(
  "/productV2/runManualSync",
  Auth,
  productV2Controller.runManualSyncOfProducts,
);
router.post("/debug/delete_history", debugController.DeleteHistory);
router.post(
  "/productV2/removeFrom422",
  Auth,
  productV2Controller.removeFrom422,
);
router.get(
  "/productV2/removeFrom422ForAll",
  Auth,
  productV2Controller.removeFrom422ForAll,
);
router.post(
  "/debug/live/delete_live_history",
  debugController.DeleteProdHistory,
);
module.exports = router;
