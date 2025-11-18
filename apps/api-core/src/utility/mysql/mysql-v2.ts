import _ from "lodash";
import { applicationConfig } from "../config";
import { GetCacheClientOptions } from "../../client/cacheClient";
import CacheClient from "../../client/cacheClient";
import { CacheKey } from "@repricer-monorepo/shared";
import { getKnexInstance } from "../../model/sql-models/knex-wrapper";
import * as SqlMapper from "./mySql-mapper";

export async function GetFullCronSettingsList() {
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  const cronSettingsList = await cacheClient.get<any>(
    CacheKey.CRON_SETTINGS_FULL_LIST,
  );
  if (cronSettingsList != null) {
    await cacheClient.disconnect();
    return cronSettingsList;
  }
  let cronSettingsDetails = null;
  const db = getKnexInstance();
  const result = await db.raw(`call GetFullCronSettingsList()`);
  if (result && result[0] && result[0].length > 0) {
    cronSettingsDetails = await SqlMapper.ToCronSettingsModel(result[0][0]);
    await cacheClient.set(
      CacheKey.CRON_SETTINGS_FULL_LIST,
      cronSettingsDetails,
    ); // Cache for 1 hour
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

export async function GetProxyConfigByProviderId(
  providerId: any,
): Promise<any> {
  const knex = getKnexInstance();
  const result = await knex("ipConfig").where({ ProxyProvider: providerId });
  if (result && result.length > 0) {
    return await SqlMapper.ToIpConfigModelList(result);
  }
  return [];
}

export async function GetGlobalConfig() {
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  try {
    const envSettingsResult = await cacheClient.get(CacheKey.ENV_SETTINGS);
    if (envSettingsResult != null) {
      await cacheClient.disconnect();
      return envSettingsResult;
    }
  } catch (err) {
    console.error(`Error in GetGlobalConfig while getting from cache:`, err);
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

export async function UpdateCronDetailsByCronId(
  cronId: string,
  _status: any,
): Promise<any> {
  const db = getKnexInstance();
  await db("cron_settings")
    .where({ CronId: cronId })
    .update({
      CronStatus: JSON.parse(_status),
      UpdatedTime: new Date(),
    });
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  await cacheClient.delete(CacheKey.CRON_SETTINGS_LIST);
  await cacheClient.disconnect();
}

export async function GetCronSettingsDetailsByName(
  cronName: any,
): Promise<any> {
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
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  await cacheClient.delete(CacheKey.CRON_SETTINGS_LIST);
  await cacheClient.disconnect();
}

export async function UpdateProxyDetailsByCronId(
  cronId: any,
  proxyProvider: any,
  sequence: number,
) {
  console.debug(
    `Updating proxy details for CronId: ${cronId} with ProxyProvider: ${proxyProvider} and Sequence: ${sequence}`,
  );
  const db = getKnexInstance();
  await db("cron_settings")
    .where({ CronId: cronId })
    .update({
      ProxyProvider: parseInt(proxyProvider),
      SwitchSequence: sequence,
      UpdatedTime: new Date(),
    });
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  await cacheClient.delete(CacheKey.CRON_SETTINGS_LIST);
  await cacheClient.disconnect();
}

export async function GetLinkedCronSettingsByProviderId(
  proxyProviderId: number,
) {
  const cronSettingsDetails = await GetFullCronSettingsList();
  return cronSettingsDetails?.filter(
    (c: any) => c.ProxyProvider === proxyProviderId,
  );
}
