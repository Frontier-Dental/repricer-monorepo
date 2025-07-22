const moment = require("moment");
const _ = require("lodash");
const asyncHandler = require("express-async-handler");
const mongoMiddleware = require("../middleware/mongoMiddleware");
const cacheController = require("../controllers/cacheController");
const httpHelper = require("../middleware/httpMiddleware");
const SessionHelper = require("../Utility/SessionHelper");

const getAdminSettings = asyncHandler(async (req, res) => {
  const cronResults = await mongoMiddleware.GetCronSettingsList();
  const cacheResults = await cacheController.GetAllCacheItems();
  let proxyFailureDetails = await mongoMiddleware.GetProxyFailureDetails();
  if (proxyFailureDetails && proxyFailureDetails.length > 0) {
    _.forEach(proxyFailureDetails, (data) => {
      data.lastResetTime = moment(data.lastResetTime).format(
        "DD-MM-YYYY HH:mm:ss",
      );
      data.initTime = moment(data.initTime).format("DD-MM-YYYY HH:mm:ss");
      data.lastUpdatedBy = data.AuditInfo ? data.AuditInfo.UpdatedBy : "-";
      data.lastUpdatedOn = data.AuditInfo
        ? moment(data.AuditInfo.UpdatedOn).format("DD-MM-YYYY HH:mm:ss")
        : "-";
    });
  }
  let cacheModel = [];
  if (cacheResults && cacheResults.status == 200) {
    cacheModel = cacheResults.data;
  }
  let adminModel = {};
  adminModel.items = cronResults;
  adminModel.cacheItems = cacheModel;
  adminModel.proxyFailureData = proxyFailureDetails;
  res.render("pages/admin/adminPurge", {
    userRole: req.session.users_id.userRole,
    itemModel: adminModel,
    groupName: "admin",
  });
});

const purgeBasedOnCronId = asyncHandler(async (req, res) => {
  const { cronId } = req.body;
  const auditInfo = await SessionHelper.GetAuditInfo(req);
  const response = await mongoMiddleware.PurgeCronBasedOnId(cronId);
  console.log(
    `PURGE : Logs are purged for Cron Id - ${cronId} by ${auditInfo.UpdatedBy} at ${auditInfo.UpdatedOn}`,
  );
  return res.json({
    status: true,
    message: `All cron logs purged successfully for Cron Id ${cronId}`,
  });
});

const purgeBasedOnDate = asyncHandler(async (req, res) => {
  const { date } = req.body;
  const auditInfo = await SessionHelper.GetAuditInfo(req);
  const response = await mongoMiddleware.PurgeCronBasedOnDate(date);
  console.log(
    `PURGE : Logs are purged for Date - ${date} by ${auditInfo.UpdatedBy} at ${auditInfo.UpdatedOn} || Logs Deleted : ${response.deletedCount}`,
  );
  return res.json({
    status: true,
    message: `All cron logs purged successfully. Total Purged count : ${response.deletedCount}`,
  });
});

const runSpecificCron = asyncHandler(async (req, res) => {
  const cronName = req.params.cronName;
  const serviceUrl = `${process.env.RUN_SPECIFIC_CRON}/${cronName}`;
  const auditInfo = await SessionHelper.GetAuditInfo(req);
  console.log(
    `MANUAL_CRON_RUN : Specific Cron run by ${auditInfo.UpdatedBy} on ${auditInfo.UpdatedOn} for Cron : ${cronName}`,
  );
  try {
    await httpHelper.native_get(serviceUrl);
    return res.json({
      status: true,
      message: `${cronName} executed successfully`,
    });
  } catch (exception) {
    return res.json({
      status: false,
      message: exception,
    });
  }
});

const UpdateProxyProviderThresholdValue = asyncHandler(async (req, res) => {
  const payload = req.body;
  try {
    await mongoMiddleware.UpdateProxyProviderThresholdValue(payload, req);
    return res.json({
      status: true,
      message: `Updated successfully`,
    });
  } catch (exception) {
    return res.json({
      status: false,
      message: exception,
    });
  }
});

const ResetProxyProvider = asyncHandler(async (req, res) => {
  const proxyProvider = parseInt(req.params.proxyProviderId);
  try {
    const auditInfo = await SessionHelper.GetAuditInfo(req);
    const resetUrl = `${process.env.PROXY_PROVIDER_RESET_URL}/${proxyProvider}/${auditInfo.UpdatedBy}`;
    await httpHelper.native_get(resetUrl);
    return res.json({
      status: true,
      message: `Reset the value successfully`,
    });
  } catch (exception) {
    return res.json({
      status: false,
      message: exception,
    });
  }
});

module.exports = {
  getAdminSettings,
  purgeBasedOnCronId,
  purgeBasedOnDate,
  runSpecificCron,
  UpdateProxyProviderThresholdValue,
  ResetProxyProvider,
};
