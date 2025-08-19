import moment from "moment";
import _ from "lodash";
import * as mongoMiddleware from "../services/mongo";
import * as cacheController from "./cache";
import * as httpHelper from "../utility/http-wrappers";
import * as SessionHelper from "../utility/session-helper";
import { Request, Response } from "express";
import { applicationConfig } from "../utility/config";

export async function getAdminSettings(req: Request, res: Response) {
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
  let cacheModel: any = [];
  if (cacheResults && cacheResults.status == 200) {
    cacheModel = cacheResults.data;
  }
  let adminModel: any = {};
  adminModel.items = cronResults;
  adminModel.cacheItems = cacheModel;
  adminModel.proxyFailureData = proxyFailureDetails;
  res.render("pages/admin/adminPurge", {
    userRole: (req as any).session.users_id.userRole,
    itemModel: adminModel,
    groupName: "admin",
  });
}

export async function purgeBasedOnCronId(req: Request, res: Response) {
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
}

export async function purgeBasedOnDate(req: Request, res: Response) {
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
}

export async function runSpecificCron(req: Request, res: Response) {
  const cronName = req.params.cronName;
  const serviceUrl = `${applicationConfig.REPRICER_API_BASE_URL}${applicationConfig.RUN_SPECIFIC_CRON_ENDPOINT}/${cronName}`;
  const auditInfo = await SessionHelper.GetAuditInfo(req);
  console.log(
    `MANUAL_CRON_RUN : Specific Cron run by ${auditInfo.UpdatedBy} on ${auditInfo.UpdatedOn} for Cron : ${cronName}`,
  );
  await httpHelper.native_get(serviceUrl);
  return res.json({
    status: true,
    message: `${cronName} executed successfully`,
  });
}

export async function UpdateProxyProviderThresholdValue(
  req: Request,
  res: Response,
) {
  const payload = req.body;
  await mongoMiddleware.UpdateProxyProviderThresholdValue(payload, req);
  return res.json({
    status: true,
    message: `Updated successfully`,
  });
}

export async function ResetProxyProvider(req: Request, res: Response) {
  const proxyProvider = parseInt(req.params.proxyProviderId);
  const auditInfo = await SessionHelper.GetAuditInfo(req);
  const resetUrl = `${applicationConfig.REPRICER_API_BASE_URL}${applicationConfig.PROXY_PROVIDER_RESET_URL_ENDPOINT}/${proxyProvider}/${auditInfo.UpdatedBy}`;
  await httpHelper.native_get(resetUrl);
  return res.json({
    status: true,
    message: `Reset the value successfully`,
  });
}
