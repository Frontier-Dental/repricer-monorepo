const _ = require("lodash");
const moment = require("moment");
const excelJs = require("exceljs");
const asyncHandler = require("express-async-handler");
const mongoMiddleware = require("../middleware/mongoMiddleware");
const httpMiddleware = require("../middleware/httpMiddleware");
const cronSettings = require("../models/cronSettings");
const cronMapping = require("../resources/cronMapping.json");
const SessionHelper = require("../Utility/SessionHelper");
const MapperHelper = require("../middleware/mapperHelper");

const GetFilterCron = asyncHandler(async (req, res) => {
  let filterCronDetails = await mongoMiddleware.GetFilteredCrons();
  for (let item of filterCronDetails) {
    item.expressionUrl = getExpressionUrl(item.cronExpression);
    item.lastUpdatedBy = await SessionHelper.GetAuditValue(item, "U_NAME");
    item.lastUpdatedOn = await SessionHelper.GetAuditValue(item, "U_TIME");
  }
  let slowCronDetails = await mongoMiddleware.GetSlowCronDetails();
  let configItems = await mongoMiddleware.GetConfigurations(true);
  for (let item of slowCronDetails) {
    item.lastUpdatedBy = await SessionHelper.GetAuditValue(item, "U_NAME");
    item.lastUpdatedOn = await SessionHelper.GetAuditValue(item, "U_TIME");
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
    item.ThresholdReached = await MapperHelper.GetIsStepReached(item, 4);
    item.CloseToThresholdReached = await MapperHelper.GetIsStepReached(item, 3);
  }
  res.render("pages/filter/filteredList", {
    configItems: configItems,
    slowCronData: slowCronDetails,
    filterCronData: filterCronDetails,
    groupName: "filter",
    userRole: req.session.users_id.userRole,
  });
});

const UpdateFilterCron = asyncHandler(async (req, res) => {
  const requestPayload = req.body;
  let mongoQuery = null;
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
      ).cronVariable;
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
});

const UpdateSlowCronExpression = asyncHandler(async (req, res) => {
  const payload = req.body;
  const cronSlowCronResponse = await mongoMiddleware.GetSlowCronDetails();
  const slowCronIds = _.map(cronSlowCronResponse, "CronId");
  let updatedList = [];
  let recreatePayload = [];
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
    const cronSettingPayload = new cronSettings(
      cId,
      payload[`s_cron_name_${cId}`],
      payload[`s_cron_time_unit_${cId}`],
      payload[`s_cron_time_${cId}`],
      null,
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
      updatedList.push(cronSettingPayload);
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
      recreatePayload.push(cronSettingPayload.CronId);
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
          ).cronVariable;
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
});

const ExportLogDetails = asyncHandler(async (req, res) => {
  const cronKey = req.params.key;
  let cronLogDetails = await mongoMiddleware.GetFilterCronLogByKey(cronKey);
  const regularCronDetails = await mongoMiddleware.GetCronSettingsList();
  const filterCronDetails = await mongoMiddleware.GetFilteredCrons();
  const contextCronName = filterCronDetails.find(
    (c) => c.cronId == cronLogDetails.contextCronId,
  ).cronName;
  if (cronLogDetails && cronLogDetails.cronItem) {
    _.forEach(cronLogDetails.cronItem, (x) => {
      try {
        x.filterDate = moment(cronLogDetails.filterDate).format(
          "DD-MM-YY HH:mm:ss",
        );
        x.startTime = moment(cronLogDetails.startTime).format(
          "DD-MM-YY HH:mm:ss",
        );
        x.cronKey = cronKey;
        x.sourceCronName = x.sourceCronId
          ? regularCronDetails.find((c) => c.CronId == x.sourceCronId).CronName
          : null;
        x.contextCronName = contextCronName;
      } catch (ex) {
        console.log(
          `Error while mapping ${x.productId} || Error : ${ex.message}`,
        );
      }
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
});

const ToggleCronStatus = asyncHandler(async (req, res) => {
  const contextCronId = req.body.id;
  const cronStatus = parseInt(req.body.status);
  const jobName = cronMapping.find(
    (x) => x.cronId == contextCronId,
  ).cronVariable;
  const slowCronDetails = await mongoMiddleware.GetSlowCronDetails();
  const slowCronData = slowCronDetails.find((x) => x.CronId == contextCronId);
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
});

function getExpressionUrl(expression) {
  let baseUrl = "https://crontab.guru/#";
  const expressionArray = expression.split(" ");
  _.forEach(expressionArray, (char, idx) => {
    if (idx == expressionArray.length - 1) {
      baseUrl += `${char}`;
    } else baseUrl += `${char}_`;
  });
  return baseUrl;
}

async function getSlowCronIdByCronName(cronName) {
  const cronSlowCronResponse = await mongoMiddleware.GetSlowCronDetails();
  return cronSlowCronResponse.find(
    (x) => x.CronName.toUpperCase() == cronName.toUpperCase(),
  ).CronId;
}

module.exports = {
  UpdateFilterCron,
  GetFilterCron,
  UpdateSlowCronExpression,
  ExportLogDetails,
  ToggleCronStatus,
};
