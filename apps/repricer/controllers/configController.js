const _ = require("lodash");
const moment = require("moment");
const { json } = require("express");
const asyncHandler = require("express-async-handler");
const mongoMiddleware = require("../middleware/mongoMiddleware");
const EnvSettings = require("../models/envSettings");
const SessionHelper = require("../Utility/SessionHelper");

module.exports.GetConfigSetup = asyncHandler(async (req, res) => {
  let configItems = await mongoMiddleware.GetConfigurations(false);

  await Promise.all(
    configItems.map(async (config) => {
      config.lastUpdatedBy = config.AuditInfo
        ? config.AuditInfo.UpdatedBy
        : "-";
      config.lastUpdatedOn = config.AuditInfo
        ? moment(config.AuditInfo.UpdatedOn).format("DD-MM-YYYY HH:mm:ss")
        : "-";
      const proxyCrons = await mongoMiddleware.GetCronsByProxyProvider(
        config.proxyProvider,
      );
      config.regularCrons = proxyCrons.regularCrons;
      config.slowCrons = proxyCrons.slowCrons;
      config.scrapeCrons = proxyCrons.scrapeCrons;
      config.error422Crons = proxyCrons.error422Crons;
    }),
  );

  let envData = await mongoMiddleware.GetEnvSettings();
  envData.lastUpdatedBy = envData.AuditInfo ? envData.AuditInfo.UpdatedBy : "-";
  envData.lastUpdatedOn = envData.AuditInfo
    ? moment(envData.AuditInfo.UpdatedOn).format("DD-MM-YYYY HH:mm:ss")
    : "-";
  let configData = {};
  configData.configDetails = configItems;
  configData.envInfo = envData;
  configData.totalProxies = configItems.length;

  res.render("pages/config/index", {
    userRole: req.session.users_id.userRole,
    config: configData,
    groupName: "config",
  });
});

module.exports.UpdateConfig = asyncHandler(async (req, res) => {
  const payload = req.body;
  let updatedConfigs = [];
  let configSettingsResponse = await mongoMiddleware.GetConfigurations(false);

  for (const $cr in payload.proxyProviderName) {
    const ipTypeStr =
      payload.ipTypeName[$cr] == "" || payload.ipTypeName[$cr] == " "
        ? "N/A"
        : payload.ipTypeName[$cr].trim();

    const proxyNameStr = payload.proxyProviderName[$cr].split("_")[0].trim();
    const methodStr = payload.proxyProviderName[$cr].split("_")[1].trim();
    let contextConfig = null;
    if (methodStr != null && methodStr != "") {
      const contextConfigList = configSettingsResponse.filter(
        (x) => x.proxyProviderName == proxyNameStr && x.ipTypeName == ipTypeStr,
      );
      if (contextConfigList && contextConfigList.length > 0) {
        contextConfig = _.cloneDeep(
          contextConfigList.find((t) => t.method == methodStr),
        );
      }
    } else {
      contextConfig = _.cloneDeep(
        configSettingsResponse.find(
          (x) =>
            x.proxyProviderName == proxyNameStr && x.ipTypeName == ipTypeStr,
        ),
      );
    }

    if (contextConfig) {
      contextConfig.userName = payload.userName[$cr];
      contextConfig.password = payload.password[$cr];
      contextConfig.hostUrl = payload.hostUrl[$cr];
      contextConfig.port =
        payload.port[$cr] != null && payload.port[$cr] != ""
          ? parseInt(payload.port[$cr])
          : payload.port[$cr];
      contextConfig.active = payload.active[$cr] === "true" ? true : false;
      //contextConfig.proxyPriority = parseInt(payload.proxyPriority[$cr]);
      if (!_.isEqual(contextConfig, configSettingsResponse[$cr])) {
        updatedConfigs.push(contextConfig);
      }
    }
  }

  await mongoMiddleware.UpdateConfiguration(updatedConfigs, req);
  return res.json({
    status: true,
    message: "Configuration settings updated successfully.",
  });
});

module.exports.UpdateEnvInfo = asyncHandler(async (req, res) => {
  const {
    globalDelay,
    sourceType,
    overrideValue,
    execPriorityObj,
    cronOverlapThreshold,
    cronBatchSize,
    cronInstanceLimit,
  } = req.body;
  const payload = {
    $set: {
      delay: globalDelay,
      source: sourceType,
      override_all: overrideValue,
      override_execution_priority_details: execPriorityObj,
      expressCronBatchSize: cronBatchSize,
      expressCronOverlapThreshold: cronOverlapThreshold,
      expressCronInstanceLimit: cronInstanceLimit,
      AuditInfo: await SessionHelper.GetAuditInfo(req),
    },
  };
  await mongoMiddleware.UpsertEnvSettings(payload);
  return res.json({
    status: true,
    message: "Global settings updated successfully.",
  });
});
