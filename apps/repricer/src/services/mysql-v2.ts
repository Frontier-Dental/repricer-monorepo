import * as SqlMapper from "../utility/mapper/mysql-mapper";
import { applicationConfig } from "../utility/config";
import { GetCacheClientOptions } from "../client/cacheClient";
import CacheClient from "../client/cacheClient";
import { CacheKey } from "@repricer-monorepo/shared";
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
