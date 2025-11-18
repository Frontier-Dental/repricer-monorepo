import { Request, Response } from "express";
import _ from "lodash";
import moment from "moment";
import * as SessionHelper from "../utility/session-helper";
import * as mongoMiddleware from "../services/mongo";
import * as sqlV2Service from "../services/mysql-v2";
const securedPassword = "*****************";

export async function GetConfigSetup(req: Request, res: Response) {
  let configItems = await sqlV2Service.GetConfigurations(false);

  configItems = _.filter(configItems, (x) => x.isDummy != true);
  await Promise.all(
    configItems.map(async (config: any) => {
      config.lastUpdatedBy = config.AuditInfo
        ? config.AuditInfo.UpdatedBy
        : "-";
      config.lastUpdatedOn = config.AuditInfo
        ? moment(config.AuditInfo.UpdatedOn).format("DD-MM-YYYY HH:mm:ss")
        : "-";
      config.password = securedPassword;
    }),
  );

  let envData: any = await sqlV2Service.GetEnvSettings(); //await mongoMiddleware.GetEnvSettings();
  envData.lastUpdatedBy = envData.AuditInfo ? envData.AuditInfo.UpdatedBy : "-";
  envData.lastUpdatedOn = envData.AuditInfo
    ? moment(envData.AuditInfo.UpdatedOn).format("DD-MM-YYYY HH:mm:ss")
    : "-";
  let configData: any = {};
  configData.configDetails = configItems;
  configData.envInfo = envData;
  configData.totalProxies = configItems.length;

  res.render("pages/config/index", {
    userRole: (req as any).session.users_id.userRole,
    config: configData,
    groupName: "config",
  });
}

export async function UpdateConfig(req: Request, res: Response) {
  const payload = req.body;
  let updatedConfigs: any[] = [];
  let configSettingsResponse = await sqlV2Service.GetConfigurations(false); //await mongoMiddleware.GetConfigurations(false);

  for (const $cr in payload.proxyProviderName) {
    const ipTypeStr =
      payload.ipTypeName[$cr] == "" || payload.ipTypeName[$cr] == " "
        ? "N/A"
        : payload.ipTypeName[$cr].trim();

    const proxyNameStr = payload.proxyProviderName[$cr].split("_")[0].trim();
    const methodStr = payload.proxyProviderName[$cr].split("_")[1].trim();
    let contextConfig: any = null;
    if (methodStr != null && methodStr != "") {
      const contextConfigList = configSettingsResponse.filter(
        (x: any) =>
          x.proxyProviderName == proxyNameStr && x.ipTypeName == ipTypeStr,
      );
      if (contextConfigList && contextConfigList.length > 0) {
        contextConfig = _.cloneDeep(
          contextConfigList.find((t: any) => t.method == methodStr),
        );
      }
    } else {
      contextConfig = _.cloneDeep(
        configSettingsResponse.find(
          (x: any) =>
            x.proxyProviderName == proxyNameStr && x.ipTypeName == ipTypeStr,
        ),
      );
    }

    if (contextConfig) {
      contextConfig.userName = payload.userName[$cr];
      contextConfig.password =
        payload.password[$cr] != securedPassword
          ? payload.password[$cr]
          : contextConfig.password;
      contextConfig.hostUrl = payload.hostUrl[$cr];
      contextConfig.port =
        payload.port[$cr] != null && payload.port[$cr] != ""
          ? parseInt(payload.port[$cr])
          : payload.port[$cr];
      contextConfig.active = payload.active[$cr] === "true" ? true : false;
      //contextConfig.proxyPriority = parseInt(payload.proxyPriority[$cr]);
      if (!_.isEqual(contextConfig, configSettingsResponse[$cr as any])) {
        updatedConfigs.push(contextConfig as unknown as never);
      }
    }
  }
  await sqlV2Service.UpdateConfiguration(updatedConfigs, req);
  //await mongoMiddleware.UpdateConfiguration(updatedConfigs, req);
  return res.json({
    status: true,
    message: "Configuration settings updated successfully.",
  });
}

export async function UpdateEnvInfo(req: Request, res: Response) {
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
    delay: globalDelay,
    source: sourceType,
    override_all: overrideValue,
    override_execution_priority_details: execPriorityObj,
    expressCronBatchSize: cronBatchSize,
    expressCronOverlapThreshold: cronOverlapThreshold,
    expressCronInstanceLimit: cronInstanceLimit,
    AuditInfo: await SessionHelper.GetAuditInfo(req),
  };
  await sqlV2Service.UpsertEnvSettings(payload); //await mongoMiddleware.UpsertEnvSettings(payload);
  return res.json({
    status: true,
    message: "Global settings updated successfully.",
  });
}
