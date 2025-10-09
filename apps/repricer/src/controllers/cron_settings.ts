import _ from "lodash";
import { Request, Response } from "express";
import * as mongoMiddleware from "../services/mongo";
import * as httpMiddleware from "../utility/http-wrappers";
import * as SessionHelper from "../utility/session-helper";
import * as MapperHelper from "../middleware/mapper-helper";
import cronSettings from "../models/cron-settings";
import cronMapping from "../../resources/cronMapping.json";
import moment from "moment";
import excelJs from "exceljs";
import { v4 as uuidv4 } from "uuid";

export async function getCronSettings(req: Request, res: Response) {
  const cronSettingsResult = await mongoMiddleware.GetCronSettingsList();
  let configItems = await mongoMiddleware.GetConfigurations(true);
  let cronSettingsResponse: any = _.filter(cronSettingsResult, (sett) => {
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
    setting.ProxyProvider_4 = await MapperHelper.GetAlternateProxyProviderId(
      setting,
      4,
    );
    setting.ProxyProvider_5 = await MapperHelper.GetAlternateProxyProviderId(
      setting,
      5,
    );
    setting.ProxyProvider_6 = await MapperHelper.GetAlternateProxyProviderId(
      setting,
      6,
    );
    setting.ProxyProvider_1_Name =
      await MapperHelper.GetAlternateProxyProviderName(
        configItems,
        setting.ProxyProvider_1,
      );
    setting.ProxyProvider_2_Name =
      await MapperHelper.GetAlternateProxyProviderName(
        configItems,
        setting.ProxyProvider_2,
      );
    setting.ProxyProvider_3_Name =
      await MapperHelper.GetAlternateProxyProviderName(
        configItems,
        setting.ProxyProvider_3,
      );
    setting.ProxyProvider_4_Name =
      await MapperHelper.GetAlternateProxyProviderName(
        configItems,
        setting.ProxyProvider_4,
      );
    setting.ProxyProvider_5_Name =
      await MapperHelper.GetAlternateProxyProviderName(
        configItems,
        setting.ProxyProvider_5,
      );
    setting.ProxyProvider_6_Name =
      await MapperHelper.GetAlternateProxyProviderName(
        configItems,
        setting.ProxyProvider_6,
      );
    setting.ProxyProvider_Name =
      await MapperHelper.GetAlternateProxyProviderName(
        configItems,
        setting.ProxyProvider,
      );
    setting.ThresholdReached = false; //await MapperHelper.GetIsStepReached(setting, setting.AlternateProxyProvider.length-1);
    setting.CloseToThresholdReached = false; //await MapperHelper.GetIsStepReached(setting, setting.AlternateProxyProvider.length - 2);
  }
  const hiddenCronDetails = cronSettingsResult.find(
    (x: any) => x.IsHidden == true,
  );
  cronSettingsResponse.custom = {};
  cronSettingsResponse.custom.CronId = hiddenCronDetails?.CronId;
  cronSettingsResponse.custom.CronName = hiddenCronDetails?.CronName;
  cronSettingsResponse.custom.IsActive = hiddenCronDetails?.CronStatus;
  cronSettingsResponse.custom.ProxyProvider = hiddenCronDetails?.ProxyProvider
    ? hiddenCronDetails.ProxyProvider
    : 0;
  cronSettingsResponse.custom.IpType = hiddenCronDetails?.IpType
    ? hiddenCronDetails.IpType
    : 0;
  cronSettingsResponse.custom.FixedIp = hiddenCronDetails?.FixedIp;
  cronSettingsResponse.custom.Offset = hiddenCronDetails?.Offset;
  cronSettingsResponse.custom.CronTime = hiddenCronDetails?.CronTime;
  cronSettingsResponse.custom.CronTimeUnit = hiddenCronDetails?.CronTimeUnit;
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
  cronSettingsResponse.custom.ProxyProvider_4 =
    await MapperHelper.GetAlternateProxyProviderId(hiddenCronDetails, 4);
  cronSettingsResponse.custom.ProxyProvider_5 =
    await MapperHelper.GetAlternateProxyProviderId(hiddenCronDetails, 5);
  cronSettingsResponse.custom.ProxyProvider_6 =
    await MapperHelper.GetAlternateProxyProviderId(hiddenCronDetails, 6);
  cronSettingsResponse.custom.ProxyProvider_1_Name =
    await MapperHelper.GetAlternateProxyProviderName(
      configItems,
      cronSettingsResponse.custom.ProxyProvider_1,
    );
  cronSettingsResponse.custom.ProxyProvider_2_Name =
    await MapperHelper.GetAlternateProxyProviderName(
      configItems,
      cronSettingsResponse.custom.ProxyProvider_2,
    );
  cronSettingsResponse.custom.ProxyProvider_3_Name =
    await MapperHelper.GetAlternateProxyProviderName(
      configItems,
      cronSettingsResponse.custom.ProxyProvider_3,
    );
  cronSettingsResponse.custom.ProxyProvider_4_Name =
    await MapperHelper.GetAlternateProxyProviderName(
      configItems,
      cronSettingsResponse.custom.ProxyProvider_4,
    );
  cronSettingsResponse.custom.ProxyProvider_5_Name =
    await MapperHelper.GetAlternateProxyProviderName(
      configItems,
      cronSettingsResponse.custom.ProxyProvider_5,
    );
  cronSettingsResponse.custom.ProxyProvider_6_Name =
    await MapperHelper.GetAlternateProxyProviderName(
      configItems,
      cronSettingsResponse.custom.ProxyProvider_6,
    );
  cronSettingsResponse.custom.ProxyProvider_Name =
    await MapperHelper.GetAlternateProxyProviderName(
      configItems,
      hiddenCronDetails!.ProxyProvider,
    );
  cronSettingsResponse.custom.ThresholdReached = false; //await MapperHelper.GetIsStepReached(hiddenCronDetails, hiddenCronDetails.AlternateProxyProvider.length-1);
  cronSettingsResponse.custom.CloseToThresholdReached = false; // await MapperHelper.GetIsStepReached(hiddenCronDetails, hiddenCronDetails.AlternateProxyProvider.length - 2);

  // Setup Opportunity Cron data
  const opportunityCronDetails = cronSettingsResult.find(
    (x: any) => x.CronName == "Cron-Opportunity",
  );
  cronSettingsResponse.opportunity = {};
  if (opportunityCronDetails) {
    cronSettingsResponse.opportunity.CronId = opportunityCronDetails.CronId;
    cronSettingsResponse.opportunity.CronName = opportunityCronDetails.CronName;
    cronSettingsResponse.opportunity.IsActive =
      opportunityCronDetails.CronStatus;
    cronSettingsResponse.opportunity.ProxyProvider =
      opportunityCronDetails.ProxyProvider
        ? opportunityCronDetails.ProxyProvider
        : 0;
    cronSettingsResponse.opportunity.IpType = opportunityCronDetails.IpType
      ? opportunityCronDetails.IpType
      : 0;
    cronSettingsResponse.opportunity.FixedIp = opportunityCronDetails.FixedIp;
    cronSettingsResponse.opportunity.Offset = opportunityCronDetails.Offset;
    cronSettingsResponse.opportunity.CronTime = opportunityCronDetails.CronTime;
    cronSettingsResponse.opportunity.CronTimeUnit =
      opportunityCronDetails.CronTimeUnit;
    cronSettingsResponse.opportunity.EligibleProductsCount =
      await mongoMiddleware.GetOpportunityItemsCount();
    cronSettingsResponse.opportunity.lastUpdatedBy =
      await SessionHelper.GetAuditValue(opportunityCronDetails, "U_NAME");
    cronSettingsResponse.opportunity.lastUpdatedOn =
      await SessionHelper.GetAuditValue(opportunityCronDetails, "U_TIME");
    cronSettingsResponse.opportunity.ProxyProvider_1 =
      await MapperHelper.GetAlternateProxyProviderId(opportunityCronDetails, 1);
    cronSettingsResponse.opportunity.ProxyProvider_2 =
      await MapperHelper.GetAlternateProxyProviderId(opportunityCronDetails, 2);
    cronSettingsResponse.opportunity.ProxyProvider_3 =
      await MapperHelper.GetAlternateProxyProviderId(opportunityCronDetails, 3);
    cronSettingsResponse.opportunity.ProxyProvider_4 =
      await MapperHelper.GetAlternateProxyProviderId(opportunityCronDetails, 4);
    cronSettingsResponse.opportunity.ProxyProvider_5 =
      await MapperHelper.GetAlternateProxyProviderId(opportunityCronDetails, 5);
    cronSettingsResponse.opportunity.ProxyProvider_6 =
      await MapperHelper.GetAlternateProxyProviderId(opportunityCronDetails, 6);
    cronSettingsResponse.opportunity.ProxyProvider_1_Name =
      await MapperHelper.GetAlternateProxyProviderName(
        configItems,
        cronSettingsResponse.opportunity.ProxyProvider_1,
      );
    cronSettingsResponse.opportunity.ProxyProvider_2_Name =
      await MapperHelper.GetAlternateProxyProviderName(
        configItems,
        cronSettingsResponse.opportunity.ProxyProvider_2,
      );
    cronSettingsResponse.opportunity.ProxyProvider_3_Name =
      await MapperHelper.GetAlternateProxyProviderName(
        configItems,
        cronSettingsResponse.opportunity.ProxyProvider_3,
      );
    cronSettingsResponse.opportunity.ProxyProvider_4_Name =
      await MapperHelper.GetAlternateProxyProviderName(
        configItems,
        cronSettingsResponse.opportunity.ProxyProvider_4,
      );
    cronSettingsResponse.opportunity.ProxyProvider_5_Name =
      await MapperHelper.GetAlternateProxyProviderName(
        configItems,
        cronSettingsResponse.opportunity.ProxyProvider_5,
      );
    cronSettingsResponse.opportunity.ProxyProvider_6_Name =
      await MapperHelper.GetAlternateProxyProviderName(
        configItems,
        cronSettingsResponse.opportunity.ProxyProvider_6,
      );
    cronSettingsResponse.opportunity.ProxyProvider_Name =
      await MapperHelper.GetAlternateProxyProviderName(
        configItems,
        opportunityCronDetails.ProxyProvider,
      );
    cronSettingsResponse.opportunity.ThresholdReached = false;
    cronSettingsResponse.opportunity.CloseToThresholdReached = false;
  } else {
    // Set default values when opportunity cron doesn't exist in database
    cronSettingsResponse.opportunity.CronId = null;
    cronSettingsResponse.opportunity.CronName = "Cron-Opportunity";
    cronSettingsResponse.opportunity.IsActive = false;
    cronSettingsResponse.opportunity.ProxyProvider = 0;
    cronSettingsResponse.opportunity.IpType = 0;
    cronSettingsResponse.opportunity.FixedIp = null;
    cronSettingsResponse.opportunity.Offset = 0;
    cronSettingsResponse.opportunity.CronTime = 30;
    cronSettingsResponse.opportunity.CronTimeUnit = "min";
    cronSettingsResponse.opportunity.EligibleProductsCount = 0;
    cronSettingsResponse.opportunity.lastUpdatedBy = "N/A";
    cronSettingsResponse.opportunity.lastUpdatedOn = "N/A";
    cronSettingsResponse.opportunity.ProxyProvider_1 = 99;
    cronSettingsResponse.opportunity.ProxyProvider_2 = 99;
    cronSettingsResponse.opportunity.ProxyProvider_3 = 99;
    cronSettingsResponse.opportunity.ProxyProvider_4 = 99;
    cronSettingsResponse.opportunity.ProxyProvider_5 = 99;
    cronSettingsResponse.opportunity.ProxyProvider_6 = 99;
    cronSettingsResponse.opportunity.ProxyProvider_1_Name = "";
    cronSettingsResponse.opportunity.ProxyProvider_2_Name = "";
    cronSettingsResponse.opportunity.ProxyProvider_3_Name = "";
    cronSettingsResponse.opportunity.ProxyProvider_4_Name = "";
    cronSettingsResponse.opportunity.ProxyProvider_5_Name = "";
    cronSettingsResponse.opportunity.ProxyProvider_6_Name = "";
    cronSettingsResponse.opportunity.ProxyProvider_Name = "";
    cronSettingsResponse.opportunity.ThresholdReached = false;
    cronSettingsResponse.opportunity.CloseToThresholdReached = false;
  }

  res.render("pages/settings/settingsList", {
    configItems: configItems,
    settings: cronSettingsResponse,
    groupName: "settings",
    userRole: (req as any).session?.users_id?.userRole,
  });
}

export async function updateCronSettings(req: Request, res: Response) {
  const payload = req.body;
  const cronSettingsResponseFull = await mongoMiddleware.GetCronSettingsList();
  const cronSettingsResponse = _.filter(
    cronSettingsResponseFull,
    (x) => x.IsHidden != true,
  );
  var listOfUpdates: any[] = [];
  var listOfUpdatedCronKey: any[] = [];
  for (const $cr in payload.cron_id_hdn as any) {
    var offset = cronSettingsResponse[$cr as any].Offset
      ? cronSettingsResponse[$cr as any].Offset
      : 0;
    const ipType = payload[`ip_type_${payload.cron_id_hdn[$cr]}`]
      ? payload[`ip_type_${payload.cron_id_hdn[$cr]}`]
      : cronSettingsResponse[$cr as any].IpType;
    const ipValue = payload[`fixed_ip_${payload.cron_id_hdn[$cr]}`]
      ? payload[`fixed_ip_${payload.cron_id_hdn[$cr]}`]
      : cronSettingsResponse[$cr as any].FixedIp;
    const proxyProv = payload.proxy_provider[$cr]
      ? payload.proxy_provider[$cr]
      : cronSettingsResponse[$cr as any].ProxyProvider;
    const secretKeyDetails = await getSecretKeyDetails($cr, payload);
    const alternateProxyProviderDetails =
      await MapperHelper.MapAlternateProxyProviderDetails($cr, payload);
    const cronSettingPayload = new cronSettings(
      payload.cron_id_hdn[$cr],
      payload.cron_name[$cr],
      payload.cron_time_unit[$cr],
      payload.cron_time[$cr],
      secretKeyDetails as any,
      true as any,
      payload.offset[$cr],
      proxyProv,
      ipType,
      ipValue,
      alternateProxyProviderDetails,
    );

    if (
      !_.isEqual(
        cronSettingPayload.CronName,
        cronSettingsResponse[$cr as any].CronName,
      ) ||
      !_.isEqual(
        cronSettingPayload.CronTime,
        cronSettingsResponse[$cr as any].CronTime,
      ) ||
      !_.isEqual(
        cronSettingPayload.CronTimeUnit,
        cronSettingsResponse[$cr as any].CronTimeUnit,
      ) ||
      !_.isEqual(
        cronSettingPayload.SecretKey,
        cronSettingsResponse[$cr as any].SecretKey,
      ) ||
      !_.isEqual(cronSettingPayload.Offset, offset) ||
      !_.isEqual(
        cronSettingPayload.ProxyProvider,
        cronSettingsResponse[$cr as any].ProxyProvider,
      ) ||
      !_.isEqual(
        cronSettingPayload.IpType,
        cronSettingsResponse[$cr as any].IpType,
      ) ||
      !_.isEqual(
        cronSettingPayload.FixedIp,
        cronSettingsResponse[$cr as any].FixedIp,
      ) ||
      !_.isEqual(
        alternateProxyProviderDetails,
        cronSettingsResponse[$cr as any].AlternateProxyProvider,
      )
    ) {
      listOfUpdates.push(cronSettingPayload);
      if (
        !_.isEqual(
          cronSettingPayload.CronTime,
          cronSettingsResponse[$cr as any].CronTime,
        ) ||
        !_.isEqual(
          cronSettingPayload.CronTimeUnit,
          cronSettingsResponse[$cr as any].CronTimeUnit,
        ) ||
        !_.isEqual(cronSettingPayload.Offset, offset)
      ) {
        listOfUpdatedCronKey.push(
          cronMapping.find((c) => c.cronId == cronSettingPayload.CronId)!
            .cronVariable,
        );
      }
    }
  }

  // Get 422 Cron Updates
  const cron422 = cronSettingsResponseFull.find((x: any) => x.IsHidden == true);
  const alternateProxyProviderDetailsFor422 =
    await MapperHelper.MapAlternateProxyProviderDetails(999, payload); //999 in 1st param means it is for 422
  if (
    cron422?.ProxyProvider != payload.proxy_provider_422 ||
    cron422?.FixedIp != payload[`fixed_ip_${cron422?.CronId}`] ||
    cron422?.IpType != payload[`ip_type_${cron422?.CronId}`] ||
    cron422?.CronTime != payload.cron_time_422 ||
    cron422?.CronTimeUnit != payload.cron_time_unit_422 ||
    cron422?.Offset != payload.offset_422 ||
    !_.isEqual(
      alternateProxyProviderDetailsFor422,
      cron422?.AlternateProxyProvider,
    )
  ) {
    const cronSetting422Payload = new cronSettings(
      cron422?.CronId,
      cron422?.CronName,
      payload.cron_time_unit_422,
      payload.cron_time_422,
      null as any,
      cron422?.CronStatus,
      payload.offset_422,
      payload.proxy_provider_422,
      payload[`ip_type_${cron422?.CronId}`],
      payload[`fixed_ip_${cron422?.CronId}`],
      alternateProxyProviderDetailsFor422,
    );
    listOfUpdates.push(cronSetting422Payload);
    if (
      cron422?.CronTime != payload.cron_time_422 ||
      cron422?.Offset != payload.offset_422 ||
      cron422?.CronTimeUnit != payload.cron_time_unit_422
    ) {
      listOfUpdatedCronKey.push(
        cronMapping.find((c) => c.cronId == cronSetting422Payload.CronId)!
          .cronVariable,
      );
    }
  }

  // Get Opportunity Cron Updates
  const cronOpportunity = cronSettingsResponseFull.find(
    (x: any) => x.CronName == "Cron-Opportunity",
  );
  const alternateProxyProviderDetailsForOpportunity =
    await MapperHelper.MapAlternateProxyProviderDetails(998, payload); //998 in 1st param means it is for opportunity
  if (
    cronOpportunity?.ProxyProvider != payload.proxy_provider_opportunity ||
    cronOpportunity?.CronTime != payload.cron_time_opportunity ||
    cronOpportunity?.CronTimeUnit != payload.cron_time_unit_opportunity ||
    cronOpportunity?.Offset != payload.offset_opportunity ||
    !_.isEqual(
      alternateProxyProviderDetailsForOpportunity,
      cronOpportunity?.AlternateProxyProvider,
    )
  ) {
    const cronSettingOpportunityPayload = new cronSettings(
      cronOpportunity?.CronId,
      cronOpportunity?.CronName,
      payload.cron_time_unit_opportunity,
      payload.cron_time_opportunity,
      null as any,
      cronOpportunity?.CronStatus,
      payload.offset_opportunity,
      payload.proxy_provider_opportunity,
      null as any,
      null as any,
      alternateProxyProviderDetailsForOpportunity,
    );
    listOfUpdates.push(cronSettingOpportunityPayload);
    if (
      cronOpportunity?.CronTime != payload.cron_time_opportunity ||
      cronOpportunity?.Offset != payload.offset_opportunity ||
      cronOpportunity?.CronTimeUnit != payload.cron_time_unit_opportunity
    ) {
      listOfUpdatedCronKey.push(
        cronMapping.find(
          (c) => c.cronId == cronSettingOpportunityPayload.CronId,
        )!.cronVariable,
      );
    }
  }

  if (listOfUpdates.length > 0) {
    await mongoMiddleware.UpdateCronSettingsList(listOfUpdates, req);
    if (listOfUpdatedCronKey.length > 0) {
      const cronRecreateResponse =
        await httpMiddleware.recreateCron(listOfUpdatedCronKey);
      if (cronRecreateResponse && cronRecreateResponse.status == 200) {
        return res.json({
          status: true,
          message: "Cron settings updated successfully.",
        });
      } else if (
        cronRecreateResponse &&
        (cronRecreateResponse as any).response.data
      ) {
        await mongoMiddleware.UpdateCronSettingsList(cronSettingsResponse, req);
        return res.json({
          status: false,
          message: (cronRecreateResponse as any).response.data,
        });
      } else if (
        cronRecreateResponse &&
        (cronRecreateResponse as any).message
      ) {
        await mongoMiddleware.UpdateCronSettingsList(cronSettingsResponse, req);
        return res.json({
          status: false,
          message: (cronRecreateResponse as any).message,
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
}

export async function addCronSettings(req: Request, res: Response) {
  let cronSettingsResponse = await mongoMiddleware.GetCronSettingsList();
  cronSettingsResponse.push(
    new cronSettings(
      uuidv4().toString().replace("-", ""),
      "Cron-X",
      "min",
      60 as any,
      "XXXXXXXXXXXXXXX" as any,
      new Date() as any,
      new Date() as any,
      false as any,
      null as any,
      null as any,
    ) as any,
  );
  await mongoMiddleware.InsertCronSettings(_.last(cronSettingsResponse));
  res.render("pages/settings/settingsList", {
    settings: cronSettingsResponse,
    groupName: "settings",
    userRole: (req as any).session.users_id.userRole,
  });
}

export async function toggleCronStatus(req: Request, res: Response) {
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
      cronSettingsResponse.find((x: any) => x.CronName == CronName)?.CronId,
      JSON.parse(payload.Action),
      req,
    );
    return res.json({
      status: true,
      message: `Cron ${CronName} ${actionResponse} Successfully.`,
    });
  } else {
    const existingSettings = cronSettingsResponse.find(
      (x: any) => x.CronId == payload.CronId,
    );
    if (JSON.parse(payload.Action) != existingSettings?.CronStatus) {
      const jobName = cronMapping.find(
        (x) => x.cronId == payload.CronId,
      )!.cronVariable;
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
}

export async function show_details(req: Request, res: Response) {
  const param = req.params.param.trim();
  let productList = await mongoMiddleware.Get422ProductDetailsByType(param);
  (productList as any).paramData = param;
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
    userRole: (req as any).session.users_id.userRole,
  });
}

export async function exportItems(req: Request, res: Response) {
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
}

async function getSecretKeyDetails(idx: any, payload: any) {
  let secretKeyDetails: any[] = [];
  const vendorName = [
    "TRADENT",
    "FRONTIER",
    "MVP",
    "FIRSTDENT",
    "TOPDENT",
    "TRIAD",
  ];
  for (const v of vendorName) {
    let vDetail: any = {};
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
      case "TRIAD":
        vDetail.secretKey = payload.secret_key_triad[idx];
        break;
      default:
        break;
    }

    secretKeyDetails.push(vDetail as never);
  }
  return secretKeyDetails;
}
