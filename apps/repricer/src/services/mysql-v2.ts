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
import AuditInfo from "../models/audit-info";

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
  const db = getKnexInstance();
  const auditInfo = await GetAuditInfo(req);
  console.debug(
    `Updating IP Configurations at ${new Date().toISOString()} || By : ${auditInfo.UpdatedBy}`,
  );
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
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  await cacheClient.delete(`${CacheKey.IP_CONFIG}_true`);
  await cacheClient.delete(`${CacheKey.IP_CONFIG}_false`);
  await cacheClient.disconnect();
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
  console.debug(
    `Updating Env Settings at ${new Date().toISOString()} || By : ${payload.updatedBy}`,
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

export async function UpdateCronSettingsList(payload: any, req: any) {
  const db = getKnexInstance();
  for (const element of payload) {
    console.debug(
      `Updating Cron Settings at ${new Date().toISOString()} : ${element.CronId} || Name : ${element.CronName}`,
    );
    await db("cron_settings")
      .where({ CronId: element.CronId })
      .update({
        CronTime: element.CronTime ? parseInt(element.CronTime) : null,
        CronTimeUnit: element.CronTimeUnit,
        Offset: element.Offset ? parseInt(element.Offset) : null,
        ProxyProvider: element.ProxyProvider
          ? parseInt(element.ProxyProvider)
          : null,
        IpType: element.IpType ? parseInt(element.IpType) : null,
        FixedIp: element.FixedIp,
        UpdatedTime: (await GetAuditInfo(req)).UpdatedOn,
        UpdatedBy: (await GetAuditInfo(req)).UpdatedBy,
      });

    if (element.SecretKey && element.SecretKey.length > 0) {
      for (const secret of element.SecretKey) {
        console.debug(
          `Updating Secret Key for Cron : ${element.CronId} || Vendor : ${secret.vendorName} || Value : ${secret.secretKey}`,
        );
        await db("secret_keys")
          .where({ CronId: element.CronId, VendorName: secret.vendorName })
          .update({
            SecretKey: secret.secretKey,
          });
      }
    }

    if (
      element.AlternateProxyProvider &&
      element.AlternateProxyProvider.length > 0
    ) {
      for (const alternateProvider of element.AlternateProxyProvider) {
        console.debug(
          `Updating Alternate Provider for Cron : ${element.CronId} || Sequence : ${alternateProvider.Sequence} || Value : ${alternateProvider.ProxyProvider}`,
        );
        await db("alternate_proxy_providers")
          .where({
            CronId: element.CronId,
            Sequence: alternateProvider.Sequence,
          })
          .update({
            ProxyProvider: parseInt(alternateProvider.ProxyProvider),
          });
      }
    }
  }
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  await cacheClient.delete(CacheKey.CRON_SETTINGS_LIST);
  await cacheClient.delete(CacheKey.SLOW_CRON_DETAILS);
  await cacheClient.delete(CacheKey.SCRAPE_CRON_DETAILS);
  await cacheClient.disconnect();
}

export async function ToggleCronStatus(
  cronId: string,
  cronStatus: string,
  req: any,
) {
  console.debug(
    `Toggling Cron Status at ${new Date().toISOString()} : ${cronId} || Status : ${cronStatus}`,
  );
  const db = getKnexInstance();
  await db("cron_settings")
    .where({ CronId: cronId })
    .update({
      CronStatus: JSON.parse(cronStatus),
      UpdatedBy: (await GetAuditInfo(req)).UpdatedBy,
      UpdatedTime: (await GetAuditInfo(req)).UpdatedOn,
    });
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  await cacheClient.delete(CacheKey.CRON_SETTINGS_LIST);
  await cacheClient.delete(CacheKey.SLOW_CRON_DETAILS);
  await cacheClient.delete(CacheKey.SCRAPE_CRON_DETAILS);
  await cacheClient.delete(CacheKey.MINI_ERP_CRON_DETAILS);
  await cacheClient.disconnect();
}

export async function GetSlowCronDetails() {
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  const slowCronDetails = await cacheClient.get(CacheKey.SLOW_CRON_DETAILS);
  if (slowCronDetails != null) {
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

export async function GetScrapeCrons() {
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  const slowCronDetails = await cacheClient.get(CacheKey.SCRAPE_CRON_DETAILS);
  if (slowCronDetails != null) {
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

export async function GetMiniErpCronDetails() {
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  const miniErpCronDetails = await cacheClient.get(
    CacheKey.MINI_ERP_CRON_DETAILS,
  );
  if (miniErpCronDetails != null) {
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
    await cacheClient.set(CacheKey.MINI_ERP_CRON_DETAILS, cronSettingsDetails);
  }
  await cacheClient.disconnect();
  return cronSettingsDetails;
}

export async function UpsertFilterCronSettings(filterCronSettingsPayload: any) {
  if (filterCronSettingsPayload && filterCronSettingsPayload.length > 0) {
    const db = getKnexInstance();
    for (const filterCron of filterCronSettingsPayload) {
      console.debug(
        `Upserting Filter Cron Settings for Cron : ${filterCron.cronName} at ${new Date().toISOString()}`,
      );
      await db.transaction(async (trx) => {
        await trx("filter_cron_settings")
          .insert({
            CronId: filterCron.cronId,
            CronName: filterCron.cronName,
            CronExpression: filterCron.cronExpression,
            Status: JSON.parse(filterCron.status),
            FilterValue: parseInt(filterCron.filterValue),
            LinkedCronId: filterCron.linkedCronId,
            LinkedCronName: filterCron.linkedCronName,
            UpdatedBy: filterCron.AuditInfo
              ? filterCron.AuditInfo.UpdatedBy
              : "ANONYMOUS",
            CreatedTime: new Date(),
            UpdatedTime: new Date(),
          })
          .onConflict("CronId")
          .merge({
            CronExpression: filterCron.cronExpression,
            Status: JSON.parse(filterCron.status),
            FilterValue: parseInt(filterCron.filterValue),
            LinkedCronId: filterCron.linkedCronId,
            LinkedCronName: filterCron.linkedCronName,
            UpdatedBy: filterCron.AuditInfo
              ? filterCron.AuditInfo.UpdatedBy
              : "ANONYMOUS",
            UpdatedTime: new Date(),
          });
      });
    }
  }
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  await cacheClient.delete(CacheKey.FILTER_CRON_DETAILS);
  await cacheClient.disconnect();
}

export async function GetFilteredCrons() {
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  const filterCronDetails = await cacheClient.get(CacheKey.FILTER_CRON_DETAILS);
  if (filterCronDetails != null) {
    await cacheClient.disconnect();
    return filterCronDetails;
  }
  let cronSettingsDetails = null;
  const db = getKnexInstance();
  const result = await db.raw(`call GetFilterCronList()`);
  if (result && result[0] && result[0].length > 0) {
    cronSettingsDetails = await SqlMapper.ToFilterSettingsModel(result[0][0]);
    await cacheClient.set(CacheKey.FILTER_CRON_DETAILS, cronSettingsDetails); // Cache for 1 hour
  }
  await cacheClient.disconnect();
  return cronSettingsDetails;
}

export async function ToggleFilterCronStatus(
  cronId: string,
  status: boolean,
  auditInfo: AuditInfo,
) {
  const db = getKnexInstance();
  await db("filter_cron_settings").where({ CronId: cronId }).update({
    Status: status,
    UpdatedBy: auditInfo.UpdatedBy,
    UpdatedTime: auditInfo.UpdatedOn,
  });
  const cacheClient = CacheClient.getInstance(
    GetCacheClientOptions(applicationConfig),
  );
  await cacheClient.delete(CacheKey.FILTER_CRON_DETAILS);
  await cacheClient.disconnect();
}

export async function GetWaitlistItems(queryData: any) {
  const { page, pageSize, offset, sort, status, startDate, endDate, search } =
    queryData;
  const knex = getKnexInstance();

  // Build the base query
  let query = knex("waitlist").select("*");

  // Apply status filter if provided
  if (status) {
    query = query.where("api_status", status);
  }

  // Apply date range filter if provided
  if (startDate && endDate) {
    query = query.whereBetween("created_at", [startDate, endDate]);
  }

  // Apply search filter if provided
  if (search) {
    query = query.where("vendor_name", "like", `%${search}%`);
  }

  // Apply sorting
  if (sort) {
    const [column, direction] = sort.split(" ");
    const sortDirection = direction?.toUpperCase() === "ASC" ? "asc" : "desc";
    query = query.orderBy(column || "created_at", sortDirection);
  } else {
    query = query.orderBy("created_at", "desc");
  }

  // Get total count for pagination
  const countQuery = query
    .clone()
    .clearSelect()
    .clearOrder()
    .count("* as total")
    .first();
  const totalResult = await countQuery;
  const total = totalResult ? Number(totalResult.total) : 0;

  // Apply pagination
  if (pageSize) {
    query = query.limit(pageSize);
  }
  if (offset !== undefined) {
    query = query.offset(offset);
  }

  // Execute query
  const results = await query;

  return {
    data: results,
    pagination: {
      page: page || 1,
      pageSize: pageSize || 10,
      total,
      totalPages: Math.ceil(total / (pageSize || 10)),
    },
  };
}

export async function DeleteWaitlistItem(id: number) {
  const db = getKnexInstance();
  await db("waitlist").where({ id }).delete();
  return {
    status: true,
    message: "Waitlist item deleted successfully",
  };
}

export async function BulkDeleteWaitlistItems(ids: number[]) {
  const db = getKnexInstance();
  await db("waitlist").whereIn("id", ids).delete();
  return {
    status: true,
    message: "Waitlist items deleted successfully",
  };
}
