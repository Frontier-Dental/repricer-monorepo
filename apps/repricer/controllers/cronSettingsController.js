const _ = require("lodash");
const { json } = require("express");
const uuid = require("uuid");
const asyncHandler = require("express-async-handler");
const mongoMiddleware = require("../middleware/mongoMiddleware");
const httpMiddleware = require("../middleware/httpMiddleware");
const cronSettings = require("../models/cronSettings");
const cronMapping = require("../resources/cronMapping.json");
const moment = require("moment");
const SessionHelper = require("../Utility/SessionHelper");
const MapperHelper = require("../middleware/mapperHelper");
const excelJs = require("exceljs");

const getCronSettings = asyncHandler(async (req, res) => {
  const cronSettingsResult = await mongoMiddleware.GetCronSettingsList();
  let configItems = await mongoMiddleware.GetConfigurations(true);
  let cronSettingsResponse = _.filter(cronSettingsResult, (sett) => {
    return sett.IsHidden != true;
  });
  for (let setting of cronSettingsResponse) {
    setting.lastUpdatedBy = await SessionHelper.GetAuditValue(
      setting,
      "U_NAME",
    );
    setting.lastUpdatedOn = await SessionHelper.GetAuditValue(
      setting,
      "U_TIME",
    );
    setting.UpdatedTime = moment(setting.UpdatedTime).format(
      "DD-MM-YYYY HH:mm:ss",
    );
    setting.ProxyProvider_1 = await MapperHelper.GetAlternateProxyProviderId(
      setting,
      1,
    );
    setting.ProxyProvider_2 = await MapperHelper.GetAlternateProxyProviderId(
      setting,
      2,
    );
    setting.ProxyProvider_3 = await MapperHelper.GetAlternateProxyProviderId(
      setting,
      3,
    );
    setting.ProxyProvider_4 = null; //await MapperHelper.GetAlternateProxyProviderId(setting, 4);
    setting.ThresholdReached = await MapperHelper.GetIsStepReached(
      setting,
      setting.AlternateProxyProvider.length,
    );
    setting.CloseToThresholdReached = await MapperHelper.GetIsStepReached(
      setting,
      setting.AlternateProxyProvider.length - 1,
    );
  }
  const hiddenCronDetails = cronSettingsResult.find((x) => x.IsHidden == true);
  cronSettingsResponse.custom = {};
  cronSettingsResponse.custom.CronId = hiddenCronDetails.CronId;
  cronSettingsResponse.custom.CronName = hiddenCronDetails.CronName;
  cronSettingsResponse.custom.IsActive = hiddenCronDetails.CronStatus;
  cronSettingsResponse.custom.ProxyProvider = hiddenCronDetails.ProxyProvider
    ? hiddenCronDetails.ProxyProvider
    : 0;
  cronSettingsResponse.custom.IpType = hiddenCronDetails.IpType
    ? hiddenCronDetails.IpType
    : 0;
  cronSettingsResponse.custom.FixedIp = hiddenCronDetails.FixedIp;
  cronSettingsResponse.custom.Offset = hiddenCronDetails.Offset;
  cronSettingsResponse.custom.CronTime = hiddenCronDetails.CronTime;
  cronSettingsResponse.custom.CronTimeUnit = hiddenCronDetails.CronTimeUnit;
  cronSettingsResponse.custom.NoOf422Products =
    await mongoMiddleware.Get422ProductCountByType("422_ERROR");
  cronSettingsResponse.custom.NoOfPriceUpdateProducts =
    await mongoMiddleware.Get422ProductCountByType("PRICE_UPDATE");
  cronSettingsResponse.custom.EligibleProductsCount =
    await mongoMiddleware.GetContextErrorItemsCount(true);
  cronSettingsResponse.custom.lastUpdatedBy = await SessionHelper.GetAuditValue(
    hiddenCronDetails,
    "U_NAME",
  );
  cronSettingsResponse.custom.lastUpdatedOn = await SessionHelper.GetAuditValue(
    hiddenCronDetails,
    "U_TIME",
  );
  cronSettingsResponse.custom.ProxyProvider_1 =
    await MapperHelper.GetAlternateProxyProviderId(hiddenCronDetails, 1);
  cronSettingsResponse.custom.ProxyProvider_2 =
    await MapperHelper.GetAlternateProxyProviderId(hiddenCronDetails, 2);
  cronSettingsResponse.custom.ProxyProvider_3 =
    await MapperHelper.GetAlternateProxyProviderId(hiddenCronDetails, 3);
  cronSettingsResponse.custom.ProxyProvider_4 = null; //await MapperHelper.GetAlternateProxyProviderId(hiddenCronDetails, 4);
  cronSettingsResponse.custom.ThresholdReached =
    await MapperHelper.GetIsStepReached(
      hiddenCronDetails,
      hiddenCronDetails.AlternateProxyProvider.length,
    );
  cronSettingsResponse.custom.CloseToThresholdReached =
    await MapperHelper.GetIsStepReached(
      hiddenCronDetails,
      hiddenCronDetails.AlternateProxyProvider.length - 1,
    );

  res.render("pages/settings/settingsList", {
    configItems: configItems,
    settings: cronSettingsResponse,
    groupName: "settings",
    userRole: req.session.users_id.userRole,
  });
});

const updateCronSettings = asyncHandler(async (req, res) => {
  const payload = req.body;
  const cronSettingsResponseFull = await mongoMiddleware.GetCronSettingsList();
  const cronSettingsResponse = _.filter(
    cronSettingsResponseFull,
    (x) => x.IsHidden != true,
  );
  var listOfUpdates = [];
  var listOfUpdatedCronKey = [];
  for (const $cr in payload.cron_id_hdn) {
    var offset = cronSettingsResponse[$cr].hasOwnProperty("Offset")
      ? cronSettingsResponse[$cr].Offset
      : 0;
    const ipType = payload[`ip_type_${payload.cron_id_hdn[$cr]}`]
      ? payload[`ip_type_${payload.cron_id_hdn[$cr]}`]
      : cronSettingsResponse[$cr].IpType;
    const ipValue = payload[`fixed_ip_${payload.cron_id_hdn[$cr]}`]
      ? payload[`fixed_ip_${payload.cron_id_hdn[$cr]}`]
      : cronSettingsResponse[$cr].FixedIp;
    const proxyProv = payload.proxy_provider[$cr]
      ? payload.proxy_provider[$cr]
      : cronSettingsResponse[$cr].ProxyProvider;
    const secretKeyDetails = await getSecretKeyDetails($cr, payload);
    const alternateProxyProviderDetails =
      await MapperHelper.MapAlternateProxyProviderDetails($cr, payload);
    const cronSettingPayload = new cronSettings(
      payload.cron_id_hdn[$cr],
      payload.cron_name[$cr],
      payload.cron_time_unit[$cr],
      payload.cron_time[$cr],
      secretKeyDetails,
      true,
      payload.offset[$cr],
      proxyProv,
      ipType,
      ipValue,
      alternateProxyProviderDetails,
    );

    if (
      !_.isEqual(
        cronSettingPayload.CronName,
        cronSettingsResponse[$cr].CronName,
      ) ||
      !_.isEqual(
        cronSettingPayload.CronTime,
        cronSettingsResponse[$cr].CronTime,
      ) ||
      !_.isEqual(
        cronSettingPayload.CronTimeUnit,
        cronSettingsResponse[$cr].CronTimeUnit,
      ) ||
      !_.isEqual(
        cronSettingPayload.SecretKey,
        cronSettingsResponse[$cr].SecretKey,
      ) ||
      !_.isEqual(cronSettingPayload.Offset, offset) ||
      !_.isEqual(
        cronSettingPayload.ProxyProvider,
        cronSettingsResponse[$cr].ProxyProvider,
      ) ||
      !_.isEqual(cronSettingPayload.IpType, cronSettingsResponse[$cr].IpType) ||
      !_.isEqual(
        cronSettingPayload.FixedIp,
        cronSettingsResponse[$cr].FixedIp,
      ) ||
      !_.isEqual(
        alternateProxyProviderDetails,
        cronSettingsResponse[$cr].AlternateProxyProvider,
      )
    ) {
      listOfUpdates.push(cronSettingPayload);
      if (
        !_.isEqual(
          cronSettingPayload.CronTime,
          cronSettingsResponse[$cr].CronTime,
        ) ||
        !_.isEqual(
          cronSettingPayload.CronTimeUnit,
          cronSettingsResponse[$cr].CronTimeUnit,
        ) ||
        !_.isEqual(cronSettingPayload.Offset, offset)
      ) {
        listOfUpdatedCronKey.push(
          cronMapping.find((c) => c.cronId == cronSettingPayload.CronId)
            .cronVariable,
        );
      }
    }
  }

  // Get 422 Cron Updates
  const cron422 = cronSettingsResponseFull.find((x) => x.IsHidden == true);
  const alternateProxyProviderDetailsFor422 =
    await MapperHelper.MapAlternateProxyProviderDetails(999, payload); //999 in 1st param means it is for 422
  if (
    cron422.ProxyProvider != payload.proxy_provider_422 ||
    cron422.FixedIp != payload[`fixed_ip_${cron422.CronId}`] ||
    cron422.IpType != payload[`ip_type_${cron422.CronId}`] ||
    cron422.CronTime != payload.cron_time_422 ||
    cron422.CronTimeUnit != payload.cron_time_unit_422 ||
    cron422.Offset != payload.offset_422 ||
    !_.isEqual(
      alternateProxyProviderDetailsFor422,
      cron422.AlternateProxyProvider,
    )
  ) {
    const cronSetting422Payload = new cronSettings(
      cron422.CronId,
      cron422.CronName,
      payload.cron_time_unit_422,
      payload.cron_time_422,
      null,
      cron422.CronStatus,
      payload.offset_422,
      payload.proxy_provider_422,
      payload[`ip_type_${cron422.CronId}`],
      payload[`fixed_ip_${cron422.CronId}`],
      alternateProxyProviderDetailsFor422,
    );
    listOfUpdates.push(cronSetting422Payload);
    if (
      cron422.CronTime != payload.cron_time_422 ||
      cron422.Offset != payload.offset_422 ||
      cron422.CronTimeUnit != payload.cron_time_unit_422
    ) {
      listOfUpdatedCronKey.push(
        cronMapping.find((c) => c.cronId == cronSetting422Payload.CronId)
          .cronVariable,
      );
    }
  }
  if (listOfUpdates.length > 0) {
    const response = await mongoMiddleware.UpdateCronSettingsList(
      listOfUpdates,
      req,
    );
    if (listOfUpdatedCronKey.length > 0) {
      const cronRecreateResponse =
        await httpMiddleware.recreateCron(listOfUpdatedCronKey);
      if (cronRecreateResponse && cronRecreateResponse.status == 200) {
        return res.json({
          status: true,
          message: "Cron settings updated successfully.",
        });
      } else if (cronRecreateResponse && cronRecreateResponse.response.data) {
        await mongoMiddleware.UpdateCronSettingsList(cronSettingsResponse, req);
        return res.json({
          status: false,
          message: cronRecreateResponse.response.data,
        });
      } else if (cronRecreateResponse && cronRecreateResponse.message) {
        await mongoMiddleware.UpdateCronSettingsList(cronSettingsResponse, req);
        return res.json({
          status: false,
          message: cronRecreateResponse.message,
        });
      } else {
        await mongoMiddleware.UpdateCronSettingsList(cronSettingsResponse, req);
        return res.json({
          status: false,
          message: "Cron update failed. Please retry",
        });
      }
    }
    return res.json({
      status: true,
      message: "Cron settings updated successfully.",
    });
  } else {
    return res.json({
      status: true,
      message: "No Changes found to update.",
    });
  }
});

const addCronSettings = asyncHandler(async (req, res) => {
  let cronSettingsResponse = await mongoMiddleware.GetCronSettingsList();
  cronSettingsResponse.push(
    new cronSettings(
      uuid.v4().toString().replace("-", ""),
      "Cron-X",
      "min",
      60,
      "XXXXXXXXXXXXXXX",
      new Date(),
      new Date(),
      false,
    ),
  );
  await mongoMiddleware.InsertCronSettings(_.last(cronSettingsResponse));
  res.render("pages/settings/settingsList", {
    settings: cronSettingsResponse,
    groupName: "settings",
    userRole: req.session.users_id.userRole,
  });
});

const toggleCronStatus = asyncHandler(async (req, res) => {
  let cronSettingsResponse = await mongoMiddleware.GetCronSettingsList();
  let actionResponse = "";
  const payload = req.body;
  const { CronName } = req.body;
  if (CronName && CronName != null) {
    if (JSON.parse(payload.Action) == true) {
      await httpMiddleware.startCron({ jobName: CronName, cronId: null });
      actionResponse = "Started";
    } else if (JSON.parse(payload.Action) == false) {
      await httpMiddleware.stopCron({ jobName: CronName });
      actionResponse = "Stopped";
    }
    await mongoMiddleware.ToggleCronStatus(
      cronSettingsResponse.find((x) => x.CronName == CronName).CronId,
      JSON.parse(payload.Action),
      req,
    );
    return res.json({
      status: true,
      message: `Cron ${CronName} ${actionResponse} Successfully.`,
    });
  } else {
    const existingSettings = cronSettingsResponse.find(
      (x) => x.CronId == payload.CronId,
    );
    if (JSON.parse(payload.Action) != existingSettings.CronStatus) {
      const jobName = cronMapping.find(
        (x) => x.cronId == payload.CronId,
      ).cronVariable;
      if (JSON.parse(payload.Action) == true) {
        await httpMiddleware.startCron({
          jobName: jobName,
          cronId: payload.CronId,
        });
        actionResponse = "Started";
      } else if (JSON.parse(payload.Action) == false) {
        await httpMiddleware.stopCron({ jobName: jobName });
        actionResponse = "Stopped";
      }
      await mongoMiddleware.ToggleCronStatus(
        payload.CronId,
        JSON.parse(payload.Action),
        req,
      );
    }

    return res.json({
      status: true,
      message: `Cron ${payload.CronId} ${actionResponse} Successfully.`,
    });
  }
});

const show_details = asyncHandler(async (req, res) => {
  const param = req.params.param.trim();
  let productList = await mongoMiddleware.Get422ProductDetailsByType(param);
  productList.paramData = param;
  if (productList.length > 0) {
    for (let prod of productList) {
      prod.nextCronTime = prod.nextCronTime
        ? moment(prod.nextCronTime).format("DD-MM-YYYY HH:mm:ss")
        : null;
      prod.updatedOn = prod.updatedOn
        ? moment(prod.updatedOn).format("DD-MM-YYYY HH:mm:ss")
        : null;
    }
  }
  res.render("pages/settings/detail_view", {
    items: productList,
    groupName: "settings",
    userRole: req.session.users_id.userRole,
  });
});

const exportItems = asyncHandler(async (req, res) => {
  const type = req.params.type_info;
  let productList = await mongoMiddleware.Get422ProductDetailsByType(
    type.trim(),
  );
  if (productList.length > 0) {
    for (let prod of productList) {
      prod.nextCronTime = prod.nextCronTime
        ? moment(prod.nextCronTime).format("DD-MM-YYYY HH:mm:ss")
        : null;
      prod.updatedOn = prod.updatedOn
        ? moment(prod.updatedOn).format("DD-MM-YYYY HH:mm:ss")
        : null;
    }
  }
  const workbook = new excelJs.Workbook();
  let worksheet = workbook.addWorksheet("ItemList", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  worksheet.autoFilter = "A1:E1";
  worksheet.columns = [
    { header: "MPID", key: "mpId", width: 20 },
    { header: "CONTEXT VENDOR", key: "vendorName", width: 20 },
    { header: "UPDATED AT", key: "updatedOn", width: 20 },
    { header: "NEXT CRON TIME", key: "nextCronTime", width: 20 },
    { header: "INSERT REASON", key: "insertReason", width: 20 },
  ];
  worksheet.addRows(productList);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=" + "422ExportData.xlsx",
  );

  return workbook.xlsx.write(res).then(function () {
    res.status(200).end();
  });
});

async function getSecretKeyDetails(idx, payload) {
  let secretKeyDetails = [];
  const vendorName = ["TRADENT", "FRONTIER", "MVP", "FIRSTDENT", "TOPDENT"];
  for (const v of vendorName) {
    let vDetail = {};
    vDetail.vendorName = v;
    switch (v) {
      case "TRADENT":
        vDetail.secretKey = payload.secret_key_tradent[idx];
        break;
      case "FRONTIER":
        vDetail.secretKey = payload.secret_key_frontier[idx];
        break;
      case "MVP":
        vDetail.secretKey = payload.secret_key_mvp[idx];
        break;
      case "FIRSTDENT":
        vDetail.secretKey = payload.secret_key_firstdent[idx];
        break;
      case "TOPDENT":
        vDetail.secretKey = payload.secret_key_topdent[idx];
        break;
      default:
        break;
    }

    secretKeyDetails.push(vDetail);
  }
  return secretKeyDetails;
}

module.exports = {
  getCronSettings,
  updateCronSettings,
  addCronSettings,
  toggleCronStatus,
  show_details,
  exportItems,
};
