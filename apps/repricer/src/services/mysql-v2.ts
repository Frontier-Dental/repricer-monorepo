import * as SqlMapper from "../utility/mapper/mysql-mapper";
import { applicationConfig } from "../utility/config";
import { GetCacheClientOptions } from "../client/cacheClient";
import CacheClient from "../client/cacheClient";
import {
  CacheKey,
  CronSettingsDto,
  SecretKeyDto,
  AlternateProxyProviderDto,
} from "@repricer-monorepo/shared";
import { getKnexInstance } from "./knex-wrapper";
import { GetAuditInfo } from "../utility/session-helper";

export async function GetConfigurations(activeOnly = true) {
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  const configurationResult = await cacheClient.get<any>(
    `${CacheKey.IP_CONFIG}_${activeOnly}`,
  );
  if (configurationResult != null) {
    await cacheClient.disconnect();
    return configurationResult;
  }
  let configurationDetails = [];
  const db = getKnexInstance();
  const query = activeOnly
    ? `SELECT * FROM ipConfig where Active=${activeOnly}`
    : `SELECT * FROM ipConfig`;
  const result = await db.raw(query);
  if (result && result[0]) {
    configurationDetails = await SqlMapper.ToIpConfigModelList(result[0]);
    await cacheClient.set(
      `${CacheKey.IP_CONFIG}_${activeOnly}`,
      configurationDetails,
    ); // Cache for 1 hour
  }
  return configurationDetails;
}

export async function UpdateConfiguration(payload: any, req: any) {
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  await cacheClient.delete(`${CacheKey.IP_CONFIG}_true`);
  await cacheClient.delete(`${CacheKey.IP_CONFIG}_false`);
  await cacheClient.disconnect();
  const db = getKnexInstance();
  const auditInfo = await GetAuditInfo(req);
  for (const element of payload) {
    await db("ipConfig")
      .where({ ProxyProvider: element.proxyProvider, IpType: element.ipType })
      .update({
        UserName: element.userName,
        Password: element.password,
        HostUrl: element.hostUrl,
        Port: element.port,
        Active: element.active ? 1 : 0,
        UpdatedOn: auditInfo.UpdatedOn,
        UpdatedBy: auditInfo.UpdatedBy,
      });
  }
}

export async function GetEnvSettings() {
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  const envSettingsResult = await cacheClient.get(CacheKey.ENV_SETTINGS);
  if (envSettingsResult != null) {
    await cacheClient.disconnect();
    return envSettingsResult;
  }
  let envSettings = null;
  const db = getKnexInstance();
  const result = await db.raw(`call GetEnvSettings()`);
  if (result && result[0] && result[0].length > 0) {
    envSettings = await SqlMapper.ToEnvSettingsModel(result[0][0]);
    await cacheClient.set(CacheKey.ENV_SETTINGS, envSettings); // Cache for 1 hour
  }
  await cacheClient.disconnect();
  return envSettings;
}

export async function GetEnvValueByKey(keyName: string) {
  const envSettingsDetails = await GetEnvSettings();
  if (envSettingsDetails) {
    switch (keyName) {
      case "SOURCE":
        return envSettingsDetails.source;
      case "DELAY":
        return envSettingsDetails.delay;
      case "OWN_VENDOR_ID":
        return envSettingsDetails.ownVendorId;
      case "SISTER_VENDORS":
        return envSettingsDetails.excludedSisterVendors;
      case "FRONTIER_API_KEY":
        return envSettingsDetails.FrontierApiKey;
      case "DEV_SYNC_API_KEY":
        return envSettingsDetails.DevIntegrationKey;
      default:
        throw new Error(`Invalid key name: ${keyName}`);
    }
  }
}

export async function UpsertEnvSettings(payload: any) {
  let mongoResult: any = null;
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  const db = getKnexInstance();
  await db("env_settings")
    .where({ ConfigID: 1 })
    .update({
      Source: payload.source,
      Delay: parseInt(payload.delay),
      OverrideAll: JSON.parse(payload.override_all),
      FrontierApiKey: payload.FrontierApiKey,
      DevIntegrationKey: payload.DevIntegrationKey,
      ExpressCronBatchSize: parseInt(payload.expressCronBatchSize),
      ExpressCronOverlapThreshold: parseInt(
        payload.expressCronOverlapThreshold,
      ),
      ExpressCronInstanceLimit: parseInt(payload.expressCronInstanceLimit),
      UpdatedBy: payload.updatedBy,
      UpdatedOn: payload.updatedOn,
    });
  await db("env_override_execution_details")
    .where({ ConfigID: 1 })
    .update({
      OverridePriority: JSON.parse(
        payload.override_execution_priority_details.override_priority,
      ),
    });
  await db("env_execution_priorities")
    .where({ ConfigID: 1, EntityName: "TRADENT" })
    .update({
      Priority: JSON.parse(
        payload.override_execution_priority_details.priority_settings
          .tradent_priority,
      ),
    });
  await db("env_execution_priorities")
    .where({ ConfigID: 1, EntityName: "FRONTIER" })
    .update({
      Priority: JSON.parse(
        payload.override_execution_priority_details.priority_settings
          .frontier_priority,
      ),
    });
  await db("env_execution_priorities")
    .where({ ConfigID: 1, EntityName: "MVP" })
    .update({
      Priority: JSON.parse(
        payload.override_execution_priority_details.priority_settings
          .mvp_priority,
      ),
    });
  await db("env_execution_priorities")
    .where({ ConfigID: 1, EntityName: "TOPDENT" })
    .update({
      Priority: JSON.parse(
        payload.override_execution_priority_details.priority_settings
          .topDent_priority,
      ),
    });
  await db("env_execution_priorities")
    .where({ ConfigID: 1, EntityName: "FIRSTDENT" })
    .update({
      Priority: JSON.parse(
        payload.override_execution_priority_details.priority_settings
          .firstDent_priority,
      ),
    });
  await db("env_execution_priorities")
    .where({ ConfigID: 1, EntityName: "TRIAD" })
    .update({
      Priority: JSON.parse(
        payload.override_execution_priority_details.priority_settings
          .triad_priority,
      ),
    });
  await cacheClient.delete(CacheKey.ENV_SETTINGS);
  await cacheClient.disconnect();
  return mongoResult;
}

export async function InsertOrUpdateCronSettings(
  cronSettingEntity: CronSettingsDto,
  cronSettingSecretKeys: SecretKeyDto[],
  alternateProxyProviders: AlternateProxyProviderDto[],
) {
  const db = getKnexInstance();
  await db.transaction(async (trx) => {
    console.debug(
      `Upserting Cron Setting : ${cronSettingEntity.CronId} || Name : ${cronSettingEntity.CronName}`,
    );
    await trx<CronSettingsDto>("cron_settings")
      .insert(cronSettingEntity)
      .onConflict("CronId")
      .merge();

    for (const secretKey of cronSettingSecretKeys) {
      console.debug(
        `Upserting Secret Key for Cron : ${secretKey.CronId} || Vendor : ${secretKey.VendorName} || Value : ${secretKey.SecretKey}`,
      );
      await trx<SecretKeyDto>("secret_keys")
        .insert(secretKey)
        .onConflict(["CronId", "VendorName"])
        .merge();
    }

    for (const alternateProvider of alternateProxyProviders) {
      console.debug(
        `Upserting Alternate Provider for Cron : ${cronSettingEntity.CronId} || Sequence : ${alternateProvider.Sequence} || Value : ${alternateProvider.ProxyProvider}`,
      );
      await trx<AlternateProxyProviderDto>("alternate_proxy_providers")
        .insert(alternateProvider)
        .onConflict(["CronId", "Sequence"])
        .merge();
    }
  });
}

export async function GetCronSettingsList() {
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  const cronSettingsList = await cacheClient.get<any>(
    CacheKey.CRON_SETTINGS_LIST,
  );
  if (cronSettingsList != null) {
    await cacheClient.disconnect();
    return cronSettingsList;
  }
  let cronSettingsDetails = null;
  const db = getKnexInstance();
  const result = await db.raw(`call GetRegularCronSettingsList()`);
  if (result && result[0] && result[0].length > 0) {
    cronSettingsDetails = await SqlMapper.ToCronSettingsModel(result[0][0]);
    await cacheClient.set(CacheKey.CRON_SETTINGS_LIST, cronSettingsDetails); // Cache for 1 hour
  }
  await cacheClient.disconnect();
  return cronSettingsDetails;
}
