import _ from "lodash";
import { applicationConfig } from "../config";
import { GetCacheClientOptions } from "../../client/cacheClient";
import CacheClient from "../../client/cacheClient";
import { CacheKey } from "@repricer-monorepo/shared";
import { getKnexInstance } from "../../model/sql-models/knex-wrapper";
import * as SqlMapper from "./mySql-mapper";
import { getMongoDb } from "../mongo";

export async function GetRotatingProxyUrl() {
  const knex = getKnexInstance();
  const result = await knex("ipConfig").where({ ProxyProvider: 1, IpType: 1 });
  if (result && result.length > 0) {
    return result[0].HostUrl;
  }
  return null;
}

export const GetProxyConfigByProviderId = async (
  providerId: any,
): Promise<any> => {
  const knex = getKnexInstance();
  const result = await knex("ipConfig").where({ ProxyProvider: providerId });
  if (result && result.length > 0) {
    return await SqlMapper.ToIpConfigModelList(result);
  }
  return [];
};
