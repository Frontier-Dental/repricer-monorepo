import _ from "lodash";
import moment from "moment";
import excelJs from "exceljs";
import * as mongoMiddleware from "../services/mongo";
import * as httpMiddleware from "../utility/http-wrappers";
import cronSettings from "../models/cron-settings";
import cronMapping from "../../resources/cronMapping.json";
import * as SessionHelper from "../utility/session-helper";
import * as MapperHelper from "../middleware/mapper-helper";
import { Request, Response } from "express";
import * as sqlV2Service from "../services/mysql-v2";

export async function GetFilterCron(req: Request, res: Response) {
  let filterCronDetails = await mongoMiddleware.GetFilteredCrons();
  for (let item of filterCronDetails) {
    item.expressionUrl = getExpressionUrl(item.cronExpression);
    item.lastUpdatedBy = await SessionHelper.GetAuditValue(
      item as any,
      "U_NAME",
    );
    item.lastUpdatedOn = await SessionHelper.GetAuditValue(
      item as any,
      "U_TIME",
    );
  }
  let slowCronDetails = await mongoMiddleware.GetSlowCronDetails();
  let configItems = await sqlV2Service.GetConfigurations(true);
  for (let item of slowCronDetails) {
    item.lastUpdatedBy = await SessionHelper.GetAuditValue(
      item as any,
      "U_NAME",
    );
    item.lastUpdatedOn = await SessionHelper.GetAuditValue(
      item as any,
      "U_TIME",
    );
    item.UpdatedTime = moment(item.UpdatedTime).format("DD-MM-YYYY HH:mm:ss");
    item.ProxyProvider_1 = await MapperHelper.GetAlternateProxyProviderId(
      item,
      1,
    );
    item.ProxyProvider_2 = await MapperHelper.GetAlternateProxyProviderId(
      item,
      2,
    );
    item.ProxyProvider_3 = await MapperHelper.GetAlternateProxyProviderId(
      item,
      3,
    );
    item.ProxyProvider_4 = await MapperHelper.GetAlternateProxyProviderId(
      item,
      4,
    );
    item.ProxyProvider_5 = await MapperHelper.GetAlternateProxyProviderId(
      item,
      5,
    );
    item.ProxyProvider_6 = await MapperHelper.GetAlternateProxyProviderId(
      item,
      6,
    );
    item.ProxyProvider_1_Name =
      await MapperHelper.GetAlternateProxyProviderName(
        configItems,
        item.ProxyProvider_1,
      );
    item.ProxyProvider_2_Name =
      await MapperHelper.GetAlternateProxyProviderName(
        configItems,
        item.ProxyProvider_2,
      );
    item.ProxyProvider_3_Name =
      await MapperHelper.GetAlternateProxyProviderName(
        configItems,
        item.ProxyProvider_3,
      );
    item.ProxyProvider_4_Name =
      await MapperHelper.GetAlternateProxyProviderName(
        configItems,
        item.ProxyProvider_4,
      );
    item.ProxyProvider_5_Name =
      await MapperHelper.GetAlternateProxyProviderName(
        configItems,
        item.ProxyProvider_5,
      );
    item.ProxyProvider_6_Name =
      await MapperHelper.GetAlternateProxyProviderName(
        configItems,
        item.ProxyProvider_6,
      );
    item.ProxyProvider_Name = await MapperHelper.GetAlternateProxyProviderName(
      configItems,
      item.ProxyProvider,
    );
    item.ThresholdReached = false; //await MapperHelper.GetIsStepReached(item, item.AlternateProxyProvider.length-1);
    item.CloseToThresholdReached = false; //await MapperHelper.GetIsStepReached(item, item.AlternateProxyProvider.length - 2);
  }
  res.render("pages/filter/filteredList", {
    configItems: configItems,
    slowCronData: slowCronDetails,
    filterCronData: filterCronDetails,
    groupName: "filter",
    userRole: (req as any).session.users_id.userRole,
  });
}

export async function UpdateFilterCron(req: Request, res: Response) {
  const requestPayload = req.body;
  let mongoQuery: any = null;
  let cronRecreationNeeded = false;
  switch (requestPayload.type.toUpperCase()) {
    case "CRONEXPRESSION":
      cronRecreationNeeded = true;
      mongoQuery = {
        $set: {
          cronExpression: requestPayload.value,
          updatedOn: new Date(),
          AuditInfo: await SessionHelper.GetAuditInfo(req),
        },
      };
      break;
    case "FILTERVALUE":
      mongoQuery = {
        $set: {
          filterValue: requestPayload.value,
          updatedOn: new Date(),
          AuditInfo: await SessionHelper.GetAuditInfo(req),
        },
      };
      break;
    case "LINKEDCRONNAME":
      mongoQuery = {
        $set: {
          linkedCronName: requestPayload.value.trim(),
          linkedCronId: await getSlowCronIdByCronName(
            requestPayload.value.trim(),
          ),
          updatedOn: new Date(),
          AuditInfo: await SessionHelper.GetAuditInfo(req),
        },
      };
      break;
    default:
      break;
  }
  if (mongoQuery != null) {
    await mongoMiddleware.UpdateFilterCronDetails(
      requestPayload.id,
      mongoQuery,
    );
    if (cronRecreationNeeded == true) {
      const jobName = cronMapping.find(
        (x) => x.cronId == requestPayload.id,
      )?.cronVariable;
      await httpMiddleware.recreateFilterCron({ jobName: jobName });
    }
    return res.json({
      status: true,
      message: `Filter Cron details updated successfully.`,
    });
  } else {
    return res.json({
      status: false,
      message: `Failed to Update Filter Cron Details.`,
    });
  }
}

export async function UpdateSlowCronExpression(req: Request, res: Response) {
  const payload = req.body;
  const cronSlowCronResponse = await mongoMiddleware.GetSlowCronDetails();
  const slowCronIds = _.map(cronSlowCronResponse, "CronId");
  let updatedList: any[] = [];
  let recreatePayload: any[] = [];
  for (const [index, cId] of slowCronIds.entries()) {
    const ipType = payload[`s_ip_type_${cId}`]
      ? payload[`s_ip_type_${cId}`]
      : cronSlowCronResponse[index].IpType;
    const ipValue = payload[`s_fixed_ip_${cId}`]
      ? payload[`s_fixed_ip_${cId}`]
      : cronSlowCronResponse[index].FixedIp;
    const proxyProv = payload[`s_proxy_provider_${cId}`]
      ? payload[`s_proxy_provider_${cId}`]
      : cronSlowCronResponse[index].ProxyProvider;
    const alternateProxyProviderDetails =
      await MapperHelper.MapAlternateProxyProviderDetails(index, payload);
    const cronSettingPayload: any = new cronSettings(
      cId,
      payload[`s_cron_name_${cId}`],
      payload[`s_cron_time_unit_${cId}`],
      payload[`s_cron_time_${cId}`],
      null as any,
      cronSlowCronResponse[index].CronStatus,
      payload[`s_offset_${cId}`],
      proxyProv,
      ipType,
      ipValue,
      alternateProxyProviderDetails,
    );

    if (
      !_.isEqual(
        cronSettingPayload.CronName,
        cronSlowCronResponse[index].CronName,
      ) ||
      !_.isEqual(
        cronSettingPayload.CronTime,
        cronSlowCronResponse[index].CronTime,
      ) ||
      !_.isEqual(
        cronSettingPayload.CronTimeUnit,
        cronSlowCronResponse[index].CronTimeUnit,
      ) ||
      !_.isEqual(
        cronSettingPayload.Offset,
        cronSlowCronResponse[index].Offset,
      ) ||
      !_.isEqual(
        cronSettingPayload.ProxyProvider,
        cronSlowCronResponse[index].ProxyProvider,
      ) ||
      !_.isEqual(
        cronSettingPayload.IpType,
        cronSlowCronResponse[index].IpType,
      ) ||
      !_.isEqual(
        cronSettingPayload.FixedIp,
        cronSlowCronResponse[index].FixedIp,
      ) ||
      !_.isEqual(
        cronSettingPayload.AlternateProxyProvider,
        cronSlowCronResponse[index].AlternateProxyProvider,
      )
    ) {
      updatedList.push(cronSettingPayload as unknown as never);
    }
    if (
      !_.isEqual(
        cronSettingPayload.CronTime,
        cronSlowCronResponse[index].CronTime,
      ) ||
      !_.isEqual(
        cronSettingPayload.CronTimeUnit,
        cronSlowCronResponse[index].CronTimeUnit,
      ) ||
      !_.isEqual(cronSettingPayload.Offset, cronSlowCronResponse[index].Offset)
    ) {
      recreatePayload.push(cronSettingPayload.CronId as unknown as never);
    }
  }

  if (updatedList.length > 0) {
    const updateResponse = await mongoMiddleware.updateSlowCron(
      updatedList,
      req,
    );
    if (updateResponse) {
      if (recreatePayload.length > 0) {
        for (const cronId of recreatePayload) {
          const jobName = cronMapping.find(
            (x) => x.cronId == cronId,
          )?.cronVariable;
          await httpMiddleware.recreateSlowCron({ jobName: jobName });
        }
      }
      return res.json({
        status: true,
        message: "Slow Cron updated successfully.",
      });
    } else {
      return res.json({
        status: false,
        message: "Something went wrong ,Please try again.",
      });
    }
  } else {
    return res.json({
      status: true,
      message: "No Changes found to update.",
    });
  }
}

export async function ExportLogDetails(req: Request, res: Response) {
  const cronKey = req.params.key;
  let cronLogDetails = await mongoMiddleware.GetFilterCronLogByKey(cronKey);
  const regularCronDetails = await mongoMiddleware.GetCronSettingsList();
  const filterCronDetails = await mongoMiddleware.GetFilteredCrons();
  const contextCronName = filterCronDetails.find(
    (c: any) => c.cronId == cronLogDetails.contextCronId,
  ).cronName;
  if (cronLogDetails && cronLogDetails.cronItem) {
    _.forEach(cronLogDetails.cronItem, (x) => {
      x.filterDate = moment(cronLogDetails.filterDate).format(
        "DD-MM-YY HH:mm:ss",
      );
      x.startTime = moment(cronLogDetails.startTime).format(
        "DD-MM-YY HH:mm:ss",
      );
      x.cronKey = cronKey;
      x.sourceCronName = x.sourceCronId
        ? regularCronDetails.find((c: any) => c.CronId == x.sourceCronId)
            ?.CronName
        : null;
      x.contextCronName = contextCronName;
    });
  }
  const workbook = new excelJs.Workbook();
  const worksheet = workbook.addWorksheet("ItemList");
  worksheet.columns = [
    { header: "Cron Key", key: "cronKey", width: 20 },
    { header: "Filter Cron Name", key: "contextCronName", width: 20 },
    { header: "Cron Run Time", key: "startTime", width: 20 },
    { header: "MPID", key: "productId", width: 20 },
    { header: "Last Update Time", key: "lastUpdateTime", width: 40 },
    { header: "Filter Date", key: "filterDate", width: 20 },
    { header: "Source Cron Name", key: "sourceCronName", width: 20 },
    { header: "Destination Cron Name", key: "destCronName", width: 20 },
  ];
  worksheet.addRows(cronLogDetails.cronItem);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=" + `${cronKey}.xlsx`,
  );
  return workbook.xlsx.write(res).then(function () {
    res.status(200).end();
  });
}

export async function ToggleCronStatus(req: Request, res: Response) {
  const contextCronId = req.body.id;
  const cronStatus = parseInt(req.body.status);
  const jobName = cronMapping.find(
    (x) => x.cronId == contextCronId,
  )?.cronVariable;
  const slowCronDetails = await mongoMiddleware.GetSlowCronDetails();
  const slowCronData = slowCronDetails.find(
    (x: any) => x.CronId == contextCronId,
  );
  if (!slowCronData) {
    //Update FilterCron Details
    const response = await httpMiddleware.toggleFilterCron({
      jobName: jobName,
      status: cronStatus,
    });
    if (response && response.status == 200) {
      const cronStatusStr = cronStatus == 1 ? "true" : "false";
      await mongoMiddleware.UpdateFilterCronDetails(contextCronId, {
        $set: {
          status: cronStatusStr,
          AuditInfo: await SessionHelper.GetAuditInfo(req),
        },
      });
      return res.json({
        status: true,
        message: response.data,
      });
    }
  } else if (slowCronData) {
    //Update SlowCron Details
    const response = await httpMiddleware.toggleSlowCron({
      jobName: jobName,
      status: cronStatus,
    });
    if (response && response.status == 200) {
      const cronStatusStr = cronStatus == 1 ? true : false;
      await mongoMiddleware.UpdateSlowCronDetails(contextCronId, {
        $set: {
          CronStatus: cronStatusStr,
          AuditInfo: await SessionHelper.GetAuditInfo(req),
        },
      });
      return res.json({
        status: true,
        message: response.data,
      });
    }
  } else {
    return res.json({
      status: false,
      message: `Sorry some error occurred!! Please try again...`,
    });
  }
}

function getExpressionUrl(expression: any) {
  let baseUrl = "https://crontab.guru/#";
  const expressionArray = expression.split(" ");
  _.forEach(expressionArray, (char, idx) => {
    if (idx == ((expressionArray.length - 1) as any)) {
      baseUrl += `${char}`;
    } else baseUrl += `${char}_`;
  });
  return baseUrl;
}

async function getSlowCronIdByCronName(cronName: any) {
  const cronSlowCronResponse = await mongoMiddleware.GetSlowCronDetails();
  return cronSlowCronResponse.find(
    (x: any) => x.CronName.toUpperCase() == cronName.toUpperCase(),
  ).CronId;
}
