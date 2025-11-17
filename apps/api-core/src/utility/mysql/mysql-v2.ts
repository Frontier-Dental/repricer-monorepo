import _ from "lodash";
import { applicationConfig } from "../config";
import { GetCacheClientOptions } from "../../client/cacheClient";
import CacheClient from "../../client/cacheClient";
import { CacheKey } from "@repricer-monorepo/shared";
import { getKnexInstance } from "../../model/sql-models/knex-wrapper";
import * as SqlMapper from "./mySql-mapper";

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
