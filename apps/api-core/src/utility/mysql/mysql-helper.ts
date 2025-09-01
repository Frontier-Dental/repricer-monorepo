import _ from "lodash";
import { getKnexInstance } from "../../model/sql-models/knex-wrapper";
import moment from "moment";
import { FullProductDetailsV2 } from "../../types/full-product-details-v2";
import { GetTriggeredByValue, MapProductDetailsList } from "./mySql-mapper";
import { HistoryModel } from "../../model/sql-models/history";
import { applicationConfig } from "../config";
import { VendorName } from "@repricer-monorepo/shared";
import {
  PriceBreakInfo,
  ProductInfo,
  ProxyNet32,
  RunInfo,
  StatusInfo,
  UpdateCronForProductPayload,
  UpdateProductPayload,
} from "./types";
import { RepriceResultEnum } from "../../model/enumerations";
import * as filterMapper from "../filter-mapper";
import { GetTriggeredByVendor } from "../filter-mapper";

export async function InsertRunInfo(runInfo: RunInfo) {
  const knex = getKnexInstance();
  const insertObj = {
    CronName: runInfo.CronName,
    CronId: runInfo.CronId,
    RunStartTime: moment(runInfo.RunStartTime).format("DD-MM-YYYY HH:mm:ss"),
    RunId: runInfo.RunId,
    KeyGenId: runInfo.KeyGenId,
    RunType: runInfo.RunType,
    ProductCount: runInfo.ProductCount,
    EligibleCount: runInfo.EligibleCount,
    ScrapedSuccessCount: runInfo.ScrapedSuccessCount,
    ScrapedFailureCount: runInfo.ScrapedFailureCount,
  };
  const insertResult = await knex(applicationConfig.SQL_RUNINFO!).insert(
    insertObj,
  );
  return insertResult;
}

export async function UpdateRunInfo(query: string) {
  // This function expects a raw query string, so we must keep it as raw
  const knex = getKnexInstance();
  const updatedResult = await knex.raw(query);
  return updatedResult?.[0];
}

export async function InsertProductInfo(
  productInfo: ProductInfo,
): Promise<any> {
  const knex = getKnexInstance();
  const insertObj = {
    LinkedCronInfo: productInfo.LinkedCronInfo,
    Mpid: productInfo.Mpid,
    VendorProductId: productInfo.VendorProductId,
    VendorProductCode: productInfo.VendorProductCode,
    VendorName: productInfo.VendorName,
    VendorRegion: productInfo.VendorRegion,
    InStock: productInfo.InStock,
    StandardShipping: productInfo.StandardShipping,
    StandardShippingStatus: productInfo.StandardShippingStatus,
    FreeShippingGap: productInfo.FreeShippingGap,
    ShippingTime: productInfo.ShippingTime,
    IsFulfillmentPolicyStock: productInfo.IsFulfillmentPolicyStock,
    IsBackordered: productInfo.IsBackordered,
    BadgeId: productInfo.BadgeId,
    BadgeName: productInfo.BadgeName,
    ArrivalBusinessDays: productInfo.ArrivalBusinessDays,
    ItemRank: productInfo.ItemRank,
    IsOwnVendor: productInfo.IsOwnVendor,
    VendorId: productInfo.VendorId,
    HeavyShippingStatus: productInfo.HeavyShippingStatus,
    HeavyShipping: productInfo.HeavyShipping,
    Inventory: productInfo.Inventory,
    ArrivalDate: productInfo.ArrivalDate,
    IsLowestTotalPrice: productInfo.IsLowestTotalPrice,
    StartTime: productInfo.StartTime,
    EndTime: productInfo.EndTime,
  };
  const insertResult = await knex(applicationConfig.SQL_PRODUCTINFO!).insert(
    insertObj,
  );
  return insertResult;
}

export async function InsertPriceBreakInfo(priceBreakInfo: PriceBreakInfo) {
  const knex = getKnexInstance();
  const insertObj = {
    LinkedProductInfo: priceBreakInfo.LinkedProductInfo,
    PMID: priceBreakInfo.PMID,
    MinQty: priceBreakInfo.MinQty,
    UnitPrice: priceBreakInfo.UnitPrice,
    PromoAddlDescr: priceBreakInfo.PromoAddlDescr,
    IsActive: priceBreakInfo.IsActive,
  };
  const insertResult = await knex(applicationConfig.SQL_PRICEBREAKINFO!).insert(
    insertObj,
  );
  return insertResult;
}

export async function InsertRunCompletionStatus(statusInfo: StatusInfo) {
  const knex = getKnexInstance();
  const insertObj = {
    KeyGenId: statusInfo.KeyGenId,
    RunType: statusInfo.RunType,
    IsCompleted: statusInfo.IsCompleted,
  };
  const insertResult = await knex(
    applicationConfig.SQL_RUNCOMPLETIONSTATUS!,
  ).insert(insertObj);
  return insertResult;
}

export async function UpdateRunCompletionStatus(statusInfo: StatusInfo) {
  const knex = getKnexInstance();
  const updateResult = await knex(applicationConfig.SQL_RUNCOMPLETIONSTATUS!)
    .update({ IsCompleted: statusInfo.IsCompleted })
    .where("KeyGenId", statusInfo.KeyGenId);
  return updateResult;
}

export async function GetEligibleScrapeProductList(cronId: string) {
  // Stored procedure, must use raw
  const knex = getKnexInstance();
  const queryToCall = `CALL ${applicationConfig.SQL_GET_SCRAPE_PRODUCTS_BY_CRON}(?)`;
  const productList = await knex.raw(queryToCall, [cronId]);
  return (productList as any)?.[0]?.[0];
}

export async function UpdateLastScrapeInfo(mpid: string, time: string) {
  const knex = getKnexInstance();
  const updateResult = await knex(applicationConfig.SQL_SCRAPE_PRODUCT_LIST!)
    .update({ LastScrapedDate: time })
    .where("MpId", mpid);
  return updateResult;
}

export async function GetScrapeProductDetailsByIdAndCron(
  cronId: string,
  productId: string,
) {
  // Stored procedure, must use raw
  const knex = getKnexInstance();
  const queryToCall = `CALL ${applicationConfig.SQL_GET_PRODUCT_BYID_CRON}(?,?)`;
  const productList = await knex.raw(queryToCall, [cronId, productId]);
  return (productList as any)?.[0]?.[0];
}

export async function GetActiveProductListByCronId(
  cronId: string,
  isSlowCron = false,
) {
  // Stored procedure, must use raw
  const knex = getKnexInstance();
  let queryToCall = `CALL ${applicationConfig.SQL_SP_GET_REGULAR_CRON_PRODUCTS_BY_CRON}(?)`;
  if (isSlowCron == true) {
    queryToCall = `CALL ${applicationConfig.SQL_SP_GET_SLOW_CRON_PRODUCTS_BY_CRON}(?)`;
  }
  const [rows] = await knex.raw(queryToCall, [cronId]);
  const productList = (rows as any)[0];
  return MapProductDetailsList(productList);
}

export async function GetItemListById(mpId: string | number) {
  const knex = getKnexInstance();

  // Common select fields for all queries - use explicit column names
  const selectFields = [
    "pl.Id as ProductIdentifier",
    "pl.MpId as ProductId",
    "pl.ProductName",
    "pl.Net32Url",
    "pl.IsActive as ScrapeOnlyActive",
    "pl.LinkedCronName as LinkedScrapeOnlyCron",
    "pl.LinkedCronId as LinkedScrapeOnlyCronId",
    "pl.RegularCronName",
    "pl.RegularCronId",
    "pl.SlowCronName",
    "pl.SlowCronId",
    "pl.IsSlowActivated",
    "pl.IsBadgeItem",
    "pl.algo_execution_mode",
  ];

  // Helper function to build each subquery
  const buildSubquery = (tableAlias: string, linkedField: string) => {
    return knex("table_scrapeProductList as pl")
      .select([...selectFields, `${tableAlias}.*`])
      .leftJoin(
        `table_${tableAlias}Details as ${tableAlias}`,
        `${tableAlias}.id`,
        `pl.${linkedField}`,
      )
      .where("pl.MpId", mpId)
      .whereExists(function () {
        this.select(1)
          .from(`table_${tableAlias}Details`)
          .whereNotNull("ChannelName")
          .andWhere("MpId", mpId);
      });
  };

  // Build all subqueries
  const tradentQuery = buildSubquery("tradent", "LinkedTradentDetailsInfo");
  const frontierQuery = buildSubquery("frontier", "LinkedFrontiersDetailsInfo");
  const mvpQuery = buildSubquery("mvp", "LinkedMvpDetailsInfo");
  const firstDentQuery = buildSubquery(
    "firstDent",
    "LinkedFirstDentDetailsInfo",
  );
  const topDentQuery = buildSubquery("topDent", "LinkedTopDentDetailsInfo");
  const triadQuery = buildSubquery("triad", "LinkedTriadDetailsInfo");

  // Combine all queries using UNION
  const result = await knex.union([
    tradentQuery,
    frontierQuery,
    mvpQuery,
    firstDentQuery,
    topDentQuery,
    triadQuery,
  ]);
  // .whereNotNull("ChannelName");

  return _.first(MapProductDetailsList(result));
}

export async function UpdateProductAsync(
  payload: UpdateProductPayload,
  isPriceUpdated: boolean,
  contextVendor: string,
) {
  const knex = getKnexInstance();
  let contextTableName = getContextTableNameByVendorName(contextVendor);

  // Build the update object
  const updateObj: Record<string, any> = {
    LastCronTime: payload.last_cron_time,
    LastAttemptedTime: payload.last_attempted_time,
    LastCronRun: payload.lastCronRun,
    LastCronMessage: payload.last_cron_message,
    LastUpdatedBy: payload.lastUpdatedBy,
    LowestVendor: payload.lowest_vendor,
    LowestVendorPrice: payload.lowest_vendor_price,
    LastExistingPrice: payload.lastExistingPrice,
    LastSuggestedPrice: payload.lastSuggestedPrice,
  };

  if (payload.next_cron_time && payload.next_cron_time !== "") {
    updateObj.NextCronTime = payload.next_cron_time;
  }
  if (isPriceUpdated) {
    updateObj.LastUpdateTime = payload.last_update_time ?? "";
  }

  const result = await knex(contextTableName!)
    .update(updateObj)
    .where("MpId", parseInt(payload.mpid as string));
  return result;
}

export async function UpdateCronForProductAsync(
  payload: UpdateCronForProductPayload,
) {
  const knex = getKnexInstance();
  const slowCronId = await getContextItemByKey(payload, "slowCronId");
  const slowCronName = await getContextItemByKey(payload, "slowCronName");
  const updateResult = await knex(applicationConfig.SQL_SCRAPE_PRODUCT_LIST!)
    .update({
      SlowCronId: slowCronId,
      SlowCronName: slowCronName,
      IsSlowActivated: payload.isSlowActivated,
    })
    .where("MpId", parseInt(payload.mpId as string));
  return updateResult;
}

export async function GetFilterEligibleProductsList(filterDate: Date | string) {
  // Stored procedure, must use raw
  const knex = getKnexInstance();
  const parameter = moment(filterDate).format("YYYY-MM-DD HH:mm:ss");
  const queryToCall = `CALL ${applicationConfig.SQL_SP_FILTER_ELIGIBLE_PRODUCT}(?)`;
  const [rows] = await knex.raw(queryToCall, [parameter]);
  const productList = (rows as any)[0];
  return productList;
}

export async function InsertHistoricalApiResponse(
  jsonData: any,
  refTime: Date,
) {
  const knex = getKnexInstance();
  const insertObj = {
    RefTime: refTime,
    ApiResponse: JSON.stringify(jsonData),
  };
  const insertResult = await knex(
    applicationConfig.SQL_HISTORY_API_RESPONSE!,
  ).insert(insertObj);
  return (insertResult as any)?.[0]?.insertId;
}

export async function InsertHistory(history: HistoryModel, refTime: Date) {
  const knex = getKnexInstance();
  const insertObj = {
    RefTime: refTime,
    MpId: history.MpId,
    ChannelName: history.ChannelName,
    ExistingPrice: history.ExistingPrice,
    MinQty: history.MinQty,
    Position: history.Position,
    LowestVendor: history.LowestVendor,
    LowestPrice: history.LowestPrice,
    SuggestedPrice: history.SuggestedPrice,
    RepriceComment: history.RepriceComment,
    MaxVendor: history.MaxVendor,
    MaxVendorPrice: history.MaxVendorPrice,
    OtherVendorList: history.OtherVendorList,
    LinkedApiResponse: history.LinkedApiResponse,
    ContextCronName: history.ContextCronName,
    TriggeredByVendor: history.TriggeredByVendor,
    RepriceResult: history.RepriceResult,
  };
  const insertResult = await knex(applicationConfig.SQL_HISTORY!).insert(
    insertObj,
  );
  return insertResult[0];
}

export async function UpdateTriggeredByVendor(
  payload: any,
  contextVendor: string,
  mpid: string,
) {
  const knex = getKnexInstance();
  let triggeredByValue = null;
  let contextTableName = getContextTableNameByVendorName(contextVendor);
  triggeredByValue = await filterMapper.GetTriggeredByVendor(
    payload,
    mpid,
    contextVendor,
  );

  if (triggeredByValue != null && triggeredByValue.updateRequired) {
    const updateResult = await knex(contextTableName!)
      .update({ TriggeredByVendor: triggeredByValue })
      .where("MpId", parseInt(mpid as string));

    console.debug(
      `TriggeredByVendor Updated || MPID : ${mpid} || ${contextVendor} || ${triggeredByValue.resultStr}`,
    );
  } else {
    console.log(
      `Skipped Updating TriggeredByVendor value for MPID: ${mpid} || ${contextVendor}`,
    );
  }

  return triggeredByValue;
}

export async function UpdateHistoryWithMessage(
  identifier: string | number,
  history: string,
) {
  const knex = getKnexInstance();
  const updateResult = await knex(applicationConfig.SQL_HISTORY!)
    .update({ RepriceComment: history })
    .where("Id", identifier);
  return updateResult;
}

export async function GetActiveFullProductDetailsList(cronId: string) {
  const knex = getKnexInstance();

  // Build the base query for each vendor using UNION
  const tradentQuery = knex
    .select(
      "pl.Id as ProductIdentifier",
      "pl.MpId as ProductId",
      "pl.ProductName",
      "pl.Net32Url",
      "pl.IsActive as ScrapeOnlyActive",
      "pl.LinkedCronName as LinkedScrapeOnlyCron",
      "pl.LinkedCronId as LinkedScrapeOnlyCronId",
      "pl.RegularCronName",
      "pl.RegularCronId",
      "pl.SlowCronName",
      "pl.SlowCronId",
      "pl.IsSlowActivated",
      "pl.algo_execution_mode",
      knex.raw("tdl.*"),
    )
    .from("table_scrapeProductList as pl")
    .leftJoin(
      "table_tradentDetails as tdl",
      "tdl.id",
      "pl.LinkedTradentDetailsInfo",
    )
    .where("pl.RegularCronId", cronId)
    .where("pl.IsSlowActivated", "!=", true)
    .whereNotNull("tdl.ChannelName")
    .where("tdl.Activated", true);

  const frontierQuery = knex
    .select(
      "pl.Id as ProductIdentifier",
      "pl.MpId as ProductId",
      "pl.ProductName",
      "pl.Net32Url",
      "pl.IsActive as ScrapeOnlyActive",
      "pl.LinkedCronName as LinkedScrapeOnlyCron",
      "pl.LinkedCronId as LinkedScrapeOnlyCronId",
      "pl.RegularCronName",
      "pl.RegularCronId",
      "pl.SlowCronName",
      "pl.SlowCronId",
      "pl.IsSlowActivated",
      "pl.algo_execution_mode",

      knex.raw("fdl.*"),
    )
    .from("table_scrapeProductList as pl")
    .leftJoin(
      "table_frontierDetails as fdl",
      "fdl.id",
      "pl.LinkedFrontiersDetailsInfo",
    )
    .where("pl.RegularCronId", cronId)
    .where("pl.IsSlowActivated", "!=", true)
    .whereNotNull("fdl.ChannelName")
    .where("fdl.Activated", true);

  const mvpQuery = knex
    .select(
      "pl.Id as ProductIdentifier",
      "pl.MpId as ProductId",
      "pl.ProductName",
      "pl.Net32Url",
      "pl.IsActive as ScrapeOnlyActive",
      "pl.LinkedCronName as LinkedScrapeOnlyCron",
      "pl.LinkedCronId as LinkedScrapeOnlyCronId",
      "pl.RegularCronName",
      "pl.RegularCronId",
      "pl.SlowCronName",
      "pl.SlowCronId",
      "pl.IsSlowActivated",
      "pl.algo_execution_mode",
      knex.raw("mdl.*"),
    )
    .from("table_scrapeProductList as pl")
    .leftJoin("table_mvpDetails as mdl", "mdl.id", "pl.LinkedMvpDetailsInfo")
    .where("pl.RegularCronId", cronId)
    .where("pl.IsSlowActivated", "!=", true)
    .whereNotNull("mdl.ChannelName")
    .where("mdl.Activated", true);

  const firstDentQuery = knex
    .select(
      "pl.Id as ProductIdentifier",
      "pl.MpId as ProductId",
      "pl.ProductName",
      "pl.Net32Url",
      "pl.IsActive as ScrapeOnlyActive",
      "pl.LinkedCronName as LinkedScrapeOnlyCron",
      "pl.LinkedCronId as LinkedScrapeOnlyCronId",
      "pl.RegularCronName",
      "pl.RegularCronId",
      "pl.SlowCronName",
      "pl.SlowCronId",
      "pl.IsSlowActivated",
      "pl.algo_execution_mode",
      knex.raw("firstDl.*"),
    )
    .from("table_scrapeProductList as pl")
    .leftJoin(
      "table_firstDentDetails as firstDl",
      "firstDl.id",
      "pl.LinkedFirstDentDetailsInfo",
    )
    .where("pl.RegularCronId", cronId)
    .where("pl.IsSlowActivated", "!=", true)
    .whereNotNull("firstDl.ChannelName")
    .where("firstDl.Activated", true);

  const topDentQuery = knex
    .select(
      "pl.Id as ProductIdentifier",
      "pl.MpId as ProductId",
      "pl.ProductName",
      "pl.Net32Url",
      "pl.IsActive as ScrapeOnlyActive",
      "pl.LinkedCronName as LinkedScrapeOnlyCron",
      "pl.LinkedCronId as LinkedScrapeOnlyCronId",
      "pl.RegularCronName",
      "pl.RegularCronId",
      "pl.SlowCronName",
      "pl.SlowCronId",
      "pl.IsSlowActivated",
      "pl.algo_execution_mode",
      knex.raw("topDl.*"),
    )
    .from("table_scrapeProductList as pl")
    .leftJoin(
      "table_topDentDetails as topDl",
      "topDl.id",
      "pl.LinkedTopDentDetailsInfo",
    )
    .where("pl.RegularCronId", cronId)
    .where("pl.IsSlowActivated", "!=", true)
    .whereNotNull("topDl.ChannelName")
    .where("topDl.Activated", true);

  const triadQuery = knex
    .select(
      "pl.Id as ProductIdentifier",
      "pl.MpId as ProductId",
      "pl.ProductName",
      "pl.Net32Url",
      "pl.IsActive as ScrapeOnlyActive",
      "pl.LinkedCronName as LinkedScrapeOnlyCron",
      "pl.LinkedCronId as LinkedScrapeOnlyCronId",
      "pl.RegularCronName",
      "pl.RegularCronId",
      "pl.SlowCronName",
      "pl.SlowCronId",
      "pl.IsSlowActivated",
      "pl.algo_execution_mode",
      knex.raw("triadDl.*"),
    )
    .from("table_scrapeProductList as pl")
    .leftJoin(
      "table_triadDetails as triadDl",
      "triadDl.id",
      "pl.LinkedTriadDetailsInfo",
    )
    .where("pl.RegularCronId", cronId)
    .where("pl.IsSlowActivated", "!=", true)
    .whereNotNull("triadDl.ChannelName")
    .where("triadDl.Activated", true);

  // Use raw SQL for the UNION query to ensure MySQL2 compatibility
  const unionQuery = `
    (${tradentQuery.toString()})
    UNION
    (${frontierQuery.toString()})
    UNION
    (${mvpQuery.toString()})
    UNION
    (${firstDentQuery.toString()})
    UNION
    (${topDentQuery.toString()})
    UNION
    (${triadQuery.toString()})
    ORDER BY ProductId
  `;

  const result = await knex.raw(unionQuery);
  return MapProductDetailsList(result[0]);
}

export async function UpdateRepriceResultStatus(
  repriceResultStatus: RepriceResultEnum,
  mpid: string,
  contextVendor: any,
) {
  let contextTableName = getContextTableNameByVendorName(contextVendor);
  const knex = getKnexInstance();
  try {
    await knex(contextTableName!)
      .where("MpId", parseInt(mpid as string))
      .update({ RepriceResult: repriceResultStatus });
  } catch (exception) {
    console.log(`Exception while UpdateRepriceResultStatus : ${exception}`);
  }
}

export async function GetProxiesNet32(
  usernames: string[],
): Promise<ProxyNet32[]> {
  let proxyList: ProxyNet32[] = [];
  const knex = getKnexInstance();
  try {
    if (usernames.length === 0) {
      return [];
    }

    proxyList = await knex(process.env.SQL_PROXY_NET_32!)
      .whereIn("username", usernames)
      .select("*");
  } catch (exception) {
    console.log(`Exception while GetProxiesNet32: ${exception}`);
  }
  return proxyList;
}

export async function GetVendorKeys(
  vendors: string[],
): Promise<Map<string, string | null> | null> {
  const knex = getKnexInstance();
  try {
    if (vendors.length === 0) {
      return new Map<string, string | null>();
    }

    const rows = await knex(process.env.SQL_VENDOR_KEYS || "table_vendorKeys")
      .whereIn("vendor", vendors)
      .where("is_primary", 1)
      .where("is_active", 1)
      .select("vendor", "value");

    const vendorKeyMap = new Map<string, string | null>();

    for (const vendor of vendors) {
      const match = rows.find((row) => row.vendor === vendor);
      const value = match?.value ?? null;
      vendorKeyMap.set(vendor, value);
    }

    return vendorKeyMap;
  } catch (exception) {
    console.error("Error in GetVendorKeys:", exception);
    return null;
  }
}

export async function ExecuteQuery(_query: string, _params: any) {
  try {
    const knex = getKnexInstance();
    const result = await knex.raw(_query, _params);
    return result[0];
  } catch (exception) {
    console.log(`Exception while ExecuteQuery : ${exception}`);
    return null;
  }
}

/**************************** PRIVATE FUNCTIONS ***********************************/
async function getContextItemByKey(payload: any, key: string): Promise<any> {
  if (payload.tradentDetails != null) return payload.tradentDetails[key];
  if (payload.frontierDetails != null) return payload.frontierDetails[key];
  if (payload.mvpDetails != null) return payload.mvpDetails[key];
  if (payload.topDentDetails != null) return payload.topDentDetails[key];
  if (payload.firstDentDetails != null) return payload.firstDentDetails[key];
  if (payload.triadDetails != null) return payload.triadDetails[key];
}

function getContextTableNameByVendorName(contextVendor: string) {
  let contextTableName: string | null = null;
  if (contextVendor === "TRADENT") {
    contextTableName = process.env.SQL_TRADENT_DETAILS!;
  } else if (contextVendor === "FRONTIER") {
    contextTableName = process.env.SQL_FRONTIER_DETAILS!;
  } else if (contextVendor === "MVP") {
    contextTableName = process.env.SQL_MVP_DETAILS!;
  } else if (contextVendor === "TOPDENT") {
    contextTableName = process.env.SQL_TOPDENT_DETAILS!;
  } else if (contextVendor === "FIRSTDENT") {
    contextTableName = process.env.SQL_FIRSTDENT_DETAILS!;
  } else if (contextVendor === "TRIAD") {
    contextTableName = process.env.SQL_TRIAD_DETAILS!;
  }
  return contextTableName;
}
