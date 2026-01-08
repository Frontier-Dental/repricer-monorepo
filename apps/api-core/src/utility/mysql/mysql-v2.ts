import _ from "lodash";
import { applicationConfig } from "../config";
import { GetCacheClientOptions } from "../../client/cacheClient";
import CacheClient from "../../client/cacheClient";
import { CacheKey } from "@repricer-monorepo/shared";
import { getKnexInstance } from "../../model/sql-models/knex-wrapper";
import * as SqlMapper from "./mySql-mapper";

export async function GetFullCronSettingsList() {
  const cacheClient = CacheClient.getInstance(GetCacheClientOptions(applicationConfig));
  const cronSettingsList = await cacheClient.get<any>(CacheKey.CRON_SETTINGS_FULL_LIST);
  if (cronSettingsList != null) {
    await cacheClient.disconnect();
    return cronSettingsList;
  }
  let cronSettingsDetails = null;
  const db = getKnexInstance();
  const result = await db.raw(`call GetFullCronSettingsList()`);
  if (result && result[0] && result[0].length > 0) {
    cronSettingsDetails = await SqlMapper.ToCronSettingsModel(result[0][0]);
    await cacheClient.set(CacheKey.CRON_SETTINGS_FULL_LIST, cronSettingsDetails); // Cache for 1 hour
  }
  await cacheClient.disconnect();
  return cronSettingsDetails;
}

export async function GetRotatingProxyUrl() {
  const knex = getKnexInstance();
  const result = await knex("ipConfig").where({ ProxyProvider: 1, IpType: 1 });
  if (result && result.length > 0) {
    return result[0].HostUrl;
  }
  return null;
}

export async function GetProxyConfigByProviderId(providerId: any): Promise<any> {
  const knex = getKnexInstance();
  const result = await knex("ipConfig").where({ ProxyProvider: providerId });
  if (result && result.length > 0) {
    return await SqlMapper.ToIpConfigModelList(result);
  }
  return [];
}

export async function GetGlobalConfig() {
  const cacheClient = CacheClient.getInstance(GetCacheClientOptions(applicationConfig));
  try {
    const envSettingsResult = await cacheClient.get(CacheKey.ENV_SETTINGS);
    if (envSettingsResult != null) {
      await cacheClient.disconnect();
      return envSettingsResult;
    }
  } catch (err) {
    //console.error(`Error in GetGlobalConfig while getting from cache:`, err);
  }
  let envSettings = null;
  try {
    const db = getKnexInstance();
    const result = await db.raw(`call GetEnvSettings()`);
    if (result && result[0] && result[0].length > 0) {
      envSettings = await SqlMapper.ToEnvSettingsModel(result[0][0]);
      await cacheClient.set(CacheKey.ENV_SETTINGS, envSettings); // Cache for 1 hour
    }
    await cacheClient.disconnect();
  } catch (err) {
    console.error(`Error in GetGlobalConfig while getting from DB:`, err);
  }
  return envSettings;
}

export async function GetDelay() {
  const globalConfigDetails = await GetGlobalConfig();
  return globalConfigDetails!.delay || 0;
}

export async function GetCronSettingsList() {
  const cacheClient = CacheClient.getInstance(GetCacheClientOptions(applicationConfig));
  const cronSettingsList = await cacheClient.get<any>(CacheKey.CRON_SETTINGS_LIST);
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

export async function UpdateCronDetailsByCronId(cronId: string, _status: any): Promise<any> {
  const db = getKnexInstance();
  await db("cron_settings")
    .where({ CronId: cronId })
    .update({
      CronStatus: JSON.parse(_status),
      UpdatedTime: new Date(),
    });
  const cacheClient = CacheClient.getInstance(GetCacheClientOptions(applicationConfig));
  await cacheClient.delete(CacheKey.CRON_SETTINGS_LIST);
  await cacheClient.disconnect();
}

export async function GetCronSettingsDetailsByName(cronName: any): Promise<any> {
  const cronSettingsList = await GetFullCronSettingsList();
  if (cronSettingsList && cronSettingsList.length > 0) {
    return _.find(cronSettingsList, (o) => o.CronName === cronName);
  }
  return null;
}

export async function GetCronSettingsDetailsById(cronId: any): Promise<any> {
  const cronSettingsList = await GetFullCronSettingsList();
  if (cronSettingsList && cronSettingsList.length > 0) {
    return _.find(cronSettingsList, (o) => o.CronId === cronId);
  }
  return null;
}

export async function UpdateCronSettings(cronId: string): Promise<any> {
  const db = getKnexInstance();
  await db("cron_settings").where({ CronId: cronId }).update({
    UpdatedTime: new Date(),
  });
  const cacheClient = CacheClient.getInstance(GetCacheClientOptions(applicationConfig));
  await cacheClient.delete(CacheKey.CRON_SETTINGS_LIST);
  await cacheClient.disconnect();
}

export async function UpdateProxyDetailsByCronId(cronId: any, proxyProvider: any, sequence: number) {
  console.debug(`Updating proxy details for CronId: ${cronId} with ProxyProvider: ${proxyProvider} and Sequence: ${sequence}`);
  const db = getKnexInstance();
  await db("cron_settings")
    .where({ CronId: cronId })
    .update({
      ProxyProvider: parseInt(proxyProvider),
      SwitchSequence: sequence,
      UpdatedTime: new Date(),
    });
  const cacheClient = CacheClient.getInstance(GetCacheClientOptions(applicationConfig));
  await cacheClient.delete(CacheKey.CRON_SETTINGS_LIST);
  await cacheClient.disconnect();
}

export async function GetLinkedCronSettingsByProviderId(proxyProviderId: number) {
  const cronSettingsDetails = await GetFullCronSettingsList();
  return cronSettingsDetails?.filter((c: any) => c.ProxyProvider === proxyProviderId);
}

export async function GetSlowCronDetails(ignoreCache = false) {
  const cacheClient = CacheClient.getInstance(GetCacheClientOptions(applicationConfig));
  const slowCronDetails = await cacheClient.get(CacheKey.SLOW_CRON_DETAILS);
  if (slowCronDetails != null && !ignoreCache) {
    await cacheClient.disconnect();
    return slowCronDetails;
  }
  let cronSettingsDetails = null;
  const db = getKnexInstance();
  const result = await db.raw(`call GetSlowCronSettingsList()`);
  if (result && result[0] && result[0].length > 0) {
    cronSettingsDetails = await SqlMapper.ToCronSettingsModel(result[0][0]);
    await cacheClient.set(CacheKey.SLOW_CRON_DETAILS, cronSettingsDetails); // Cache for 1 hour
  }
  await cacheClient.disconnect();
  return cronSettingsDetails;
}

export async function GetScrapeCronDetails(ignoreCache = false) {
  const cacheClient = CacheClient.getInstance(GetCacheClientOptions(applicationConfig));
  const slowCronDetails = await cacheClient.get(CacheKey.SCRAPE_CRON_DETAILS);
  if (slowCronDetails != null && !ignoreCache) {
    await cacheClient.disconnect();
    return slowCronDetails;
  }
  let cronSettingsDetails = null;
  const db = getKnexInstance();
  const result = await db.raw(`call GetDataOnlyCronList()`);
  if (result && result[0] && result[0].length > 0) {
    cronSettingsDetails = await SqlMapper.ToCronSettingsModel(result[0][0]);
    await cacheClient.set(CacheKey.SCRAPE_CRON_DETAILS, cronSettingsDetails); // Cache for 1 hour
  }
  await cacheClient.disconnect();
  return cronSettingsDetails;
}

export async function GetFilteredCrons(ignoreCache = false) {
  const cacheClient = CacheClient.getInstance(GetCacheClientOptions(applicationConfig));
  const filterCronDetails = await cacheClient.get(CacheKey.FILTER_CRON_DETAILS);
  if (filterCronDetails != null && !ignoreCache) {
    await cacheClient.disconnect();
    return filterCronDetails;
  }
  let cronSettingsDetails = null;
  const db = getKnexInstance();
  const result = await db.raw(`call GetFilterCronList()`);
  if (result && result[0] && result[0].length > 0) {
    cronSettingsDetails = await SqlMapper.MapWithAuditInfo(result[0][0]);
    await cacheClient.set(CacheKey.FILTER_CRON_DETAILS, cronSettingsDetails); // Cache for 1 hour
  }
  await cacheClient.disconnect();
  return cronSettingsDetails;
}

export async function GetMiniErpCronDetails(ignoreCache = false) {
  const cacheClient = CacheClient.getInstance(GetCacheClientOptions(applicationConfig));
  const miniErpCronDetails = await cacheClient.get(CacheKey.MINI_ERP_CRON_DETAILS);
  if (miniErpCronDetails != null && !ignoreCache) {
    await cacheClient.disconnect();
    return miniErpCronDetails;
  }
  let cronSettingsDetails = null;
  const db = getKnexInstance();
  const result = await db.raw(`
    SELECT 
      cs.*,
      sk.VendorName,
      sk.SecretKey,
      app.Sequence,
      app.ProxyProvider as AlternateProxyProvider
    FROM cron_settings cs
    LEFT JOIN secret_keys sk ON cs.CronId = sk.CronId
    LEFT JOIN alternate_proxy_providers app ON cs.CronId = app.CronId
    WHERE cs.CronType = 'MINI_ERP'
    ORDER BY cs.CronId, sk.VendorName, app.Sequence
  `);
  if (result && result[0] && result[0].length > 0) {
    cronSettingsDetails = await SqlMapper.ToCronSettingsModel(result[0]);
    await cacheClient.set(CacheKey.MINI_ERP_CRON_DETAILS, cronSettingsDetails); // Cache for 1 hour
  }
  await cacheClient.disconnect();
  return cronSettingsDetails;
}

export async function GetFilterCronDetailsByName($cronName: any) {
  const filterCronDetails = await GetFilteredCrons();
  return filterCronDetails.find((x: any) => x.cronName == $cronName);
}

export async function GetProxySwitchCronDetails(ignoreCache = false) {
  const cacheClient = CacheClient.getInstance(GetCacheClientOptions(applicationConfig));
  const proxySwitchCronDetails = await cacheClient.get(CacheKey.PROXY_SWITCH_CRON_DETAILS);
  if (proxySwitchCronDetails != null && !ignoreCache) {
    await cacheClient.disconnect();
    return proxySwitchCronDetails;
  }
  let cronSettingsDetails = null;
  const db = getKnexInstance();
  const result = await db.raw(`call GetProxySwitcherCronList()`);
  if (result && result[0] && result[0].length > 0) {
    cronSettingsDetails = result[0][0];
    await cacheClient.set(CacheKey.PROXY_SWITCH_CRON_DETAILS, cronSettingsDetails); // Cache for 1 hour
  }
  await cacheClient.disconnect();
  return cronSettingsDetails;
}

export async function GetProxyFailureDetails() {
  const db = getKnexInstance();
  const result = await db.raw(`call GetProxyFailureDetails()`);
  if (result && result[0] && result[0].length > 0) {
    return await SqlMapper.MapWithAuditInfo(result[0][0]);
  }
  return [];
}

export async function UpdateProxyFailureDetails(proxyProvId: any, count: any) {
  const db = getKnexInstance();
  await db("proxy_failure_details")
    .where({ ProxyProviderId: parseInt(proxyProvId) })
    .update({
      FailureCount: parseInt(count),
      UpdatedTime: new Date(),
    });
}

export async function GetProxyFailureDetailsByProxyProviderId(proxyProvId: any) {
  const proxyProviderFailureDetails = await GetProxyFailureDetails();
  return proxyProviderFailureDetails.find((x: any) => x.proxyProvider == proxyProvId);
}

export async function InitProxyFailureDetails(proxyProvId: any, count: any) {
  const db = getKnexInstance();
  await db("proxy_failure_details")
    .where({ ProxyProviderId: parseInt(proxyProvId) })
    .update({
      FailureCount: parseInt(count),
      InitTime: new Date(),
    });
}

export async function ResetProxyFailureDetails(proxyProvId: any, userId: any) {
  const db = getKnexInstance();
  await db("proxy_failure_details")
    .where({ ProxyProviderId: parseInt(proxyProvId) })
    .update({
      LastResetTime: new Date(),
      InitTime: new Date("1990-01-01"),
      FailureCount: 0,
      UpdatedBy: userId,
      UpdatedTime: new Date(),
    });
}
