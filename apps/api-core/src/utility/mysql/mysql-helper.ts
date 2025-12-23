import { VendorName } from "@repricer-monorepo/shared";
import _ from "lodash";
import moment from "moment";
import { RepriceResultEnum } from "../../model/enumerations";
import { HistoryModel } from "../../model/sql-models/history";
import { getKnexInstance } from "../../model/sql-models/knex-wrapper";
import { applicationConfig } from "../config";
import { GetTriggeredByValue, MapProductDetailsList } from "./mySql-mapper";
import { CurrentStock, PriceBreakInfo, ProductInfo, ProxyNet32, RunInfo, StatusInfo, UpdateCronForProductPayload, UpdateProductPayload } from "./types";
import { WaitlistModel } from "../../model/waitlist-model";

export async function InsertRunInfo(runInfo: RunInfo) {
  try {
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
    const insertResult = await knex(applicationConfig.SQL_RUNINFO!).insert(insertObj);
    return insertResult;
  } catch (error) {
    console.log("Error in InsertRunInfo", runInfo, error);
    //throw error;
  } finally {
    //destroyKnexInstance();
  }
}

export async function UpdateRunInfo(query: string) {
  // This function expects a raw query string, so we must keep it as raw
  try {
    const knex = getKnexInstance();
    const updatedResult = await knex.raw(query);
    return updatedResult?.[0];
  } catch (error) {
    console.log("Error in UpdateRunInfo", query, error);
    //throw error;
  } finally {
    //destroyKnexInstance();
  }
}

export async function InsertProductInfo(productInfo: ProductInfo): Promise<any> {
  try {
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
    const insertResult = await knex(applicationConfig.SQL_PRODUCTINFO!).insert(insertObj);
    return insertResult;
  } catch (error) {
    console.log("Error in InsertProductInfo", productInfo, error);
    //throw error;
  } finally {
    //destroyKnexInstance();
  }
}

export async function InsertPriceBreakInfo(priceBreakInfo: PriceBreakInfo) {
  try {
    const knex = getKnexInstance();
    const insertObj = {
      LinkedProductInfo: priceBreakInfo.LinkedProductInfo,
      PMID: priceBreakInfo.PMID,
      MinQty: priceBreakInfo.MinQty,
      UnitPrice: priceBreakInfo.UnitPrice,
      PromoAddlDescr: priceBreakInfo.PromoAddlDescr,
      IsActive: priceBreakInfo.IsActive,
    };
    const insertResult = await knex(applicationConfig.SQL_PRICEBREAKINFO!).insert(insertObj);
    return insertResult;
  } catch (error) {
    console.log("Error in InsertPriceBreakInfo", priceBreakInfo, error);
    //throw error;
  } finally {
    //destroyKnexInstance();
  }
}

export async function InsertRunCompletionStatus(statusInfo: StatusInfo) {
  try {
    const knex = getKnexInstance();
    const insertObj = {
      KeyGenId: statusInfo.KeyGenId,
      RunType: statusInfo.RunType,
      IsCompleted: statusInfo.IsCompleted,
    };
    const insertResult = await knex(applicationConfig.SQL_RUNCOMPLETIONSTATUS!).insert(insertObj);
    return insertResult;
  } catch (error) {
    console.log("Error in InsertRunCompletionStatus", statusInfo, error);
    //throw error;
  } finally {
    //destroyKnexInstance();
  }
}

export async function UpdateRunCompletionStatus(statusInfo: StatusInfo) {
  try {
    const knex = getKnexInstance();
    const updateResult = await knex(applicationConfig.SQL_RUNCOMPLETIONSTATUS!).update({ IsCompleted: statusInfo.IsCompleted }).where("KeyGenId", statusInfo.KeyGenId);
    return updateResult;
  } catch (error) {
    console.log("Error in UpdateRunCompletionStatus", statusInfo, error);
    //throw error;
  } finally {
    //destroyKnexInstance();
  }
}

export async function GetEligibleScrapeProductList(cronId: string) {
  // Stored procedure, must use raw
  try {
    const knex = getKnexInstance();
    const queryToCall = `CALL ${applicationConfig.SQL_GET_SCRAPE_PRODUCTS_BY_CRON}(?)`;
    const productList = await knex.raw(queryToCall, [cronId]);
    return (productList as any)?.[0]?.[0];
  } catch (error) {
    console.log("Error in GetEligibleScrapeProductList", cronId, error);
    //throw error;
  } finally {
    //destroyKnexInstance();
  }
}

export async function UpdateLastScrapeInfo(mpid: string, time: string) {
  try {
    const knex = getKnexInstance();
    const updateResult = await knex(applicationConfig.SQL_SCRAPE_PRODUCT_LIST!).update({ LastScrapedDate: time }).where("MpId", mpid);
    return updateResult;
  } catch (error) {
    console.log("Error in UpdateLastScrapeInfo", mpid, time, error);
    //throw error;
  } finally {
    //destroyKnexInstance();
  }
}

export async function GetScrapeProductDetailsByIdAndCron(cronId: string, productId: string) {
  // Stored procedure, must use raw
  try {
    const knex = getKnexInstance();
    const queryToCall = `CALL ${applicationConfig.SQL_GET_PRODUCT_BYID_CRON}(?,?)`;
    const productList = await knex.raw(queryToCall, [cronId, productId]);
    return (productList as any)?.[0]?.[0];
  } catch (error) {
    console.log("Error in GetScrapeProductDetailsByIdAndCron", cronId, productId, error);
    //throw error;
  } finally {
    //destroyKnexInstance();
  }
}

export async function GetActiveProductListByCronId(cronId: string, isSlowCron = false) {
  // Stored procedure, must use raw
  try {
    const knex = getKnexInstance();
    let queryToCall = `CALL ${applicationConfig.SQL_SP_GET_REGULAR_CRON_PRODUCTS_BY_CRON}(?)`;
    if (isSlowCron == true) {
      queryToCall = `CALL ${applicationConfig.SQL_SP_GET_SLOW_CRON_PRODUCTS_BY_CRON}(?)`;
    }
    const [rows] = await knex.raw(queryToCall, [cronId]);
    const productList = (rows as any)[0];
    return MapProductDetailsList(productList);
  } catch (error) {
    console.log("Error in GetActiveProductListByCronId", cronId, isSlowCron, error);
    //throw error;
  } finally {
    //destroyKnexInstance();
  }
}

export async function GetItemListById(mpId: string | number) {
  try {
    const knex = getKnexInstance();

    // Common select fields for all queries - use explicit column names
    const selectFields = ["pl.Id as ProductIdentifier", "pl.MpId as ProductId", "pl.ProductName", "pl.Net32Url", "pl.IsActive as ScrapeOnlyActive", "pl.LinkedCronName as LinkedScrapeOnlyCron", "pl.LinkedCronId as LinkedScrapeOnlyCronId", "pl.RegularCronName", "pl.RegularCronId", "pl.SlowCronName", "pl.SlowCronId", "pl.IsSlowActivated", "pl.IsBadgeItem", "pl.algo_execution_mode"];

    // Helper function to build each subquery
    const buildSubquery = (tableAlias: string, linkedField: string) => {
      return knex("table_scrapeProductList as pl")
        .select([...selectFields, `${tableAlias}.*`])
        .leftJoin(`table_${tableAlias}Details as ${tableAlias}`, `${tableAlias}.id`, `pl.${linkedField}`)
        .where("pl.MpId", mpId)
        .whereExists(function () {
          this.select(1).from(`table_${tableAlias}Details`).whereNotNull("ChannelName").andWhere("MpId", mpId);
        });
    };

    // Build all subqueries
    const tradentQuery = buildSubquery("tradent", "LinkedTradentDetailsInfo");
    const frontierQuery = buildSubquery("frontier", "LinkedFrontiersDetailsInfo");
    const mvpQuery = buildSubquery("mvp", "LinkedMvpDetailsInfo");
    const firstDentQuery = buildSubquery("firstDent", "LinkedFirstDentDetailsInfo");
    const topDentQuery = buildSubquery("topDent", "LinkedTopDentDetailsInfo");
    const triadQuery = buildSubquery("triad", "LinkedTriadDetailsInfo");

    // Combine all queries using UNION
    const result = await knex.union([tradentQuery, frontierQuery, mvpQuery, firstDentQuery, topDentQuery, triadQuery]);
    // .whereNotNull("ChannelName");

    return _.first(MapProductDetailsList(result));
  } catch (error) {
    console.log("Error in GetItemListById", mpId, error);
    //throw error;
  } finally {
    //destroyKnexInstance();
  }
}

export async function UpdateProductAsync(
  payload: UpdateProductPayload,
  isPriceUpdated: boolean,
  contextVendor: string,
  marketData?: {
    inStock?: boolean;
    inventory?: number;
    ourPrice?: number | null;
  }
) {
  try {
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

    // Add market state fields if provided (backward compatible)
    if (marketData) {
      if (marketData.inStock !== undefined) {
        updateObj.CurrentInStock = marketData.inStock;
      }
      if (marketData.inventory !== undefined) {
        updateObj.CurrentInventory = marketData.inventory;
      }
      if (marketData.ourPrice !== undefined) {
        updateObj.OurLastPrice = marketData.ourPrice;
      }
      // Update timestamp when market data is provided
      updateObj.MarketStateUpdatedAt = new Date();
    }

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
  } catch (error) {
    console.log("Error in UpdateProductAsync", payload, isPriceUpdated, contextVendor, marketData, error);
    //throw error;
  } finally {
    //destroyKnexInstance();
  }
}

// New function to update ONLY market state fields (for scraping)
export async function UpdateMarketStateOnly(
  mpid: string | number,
  vendorName: string,
  marketData: {
    inStock?: boolean;
    inventory?: number;
    ourPrice?: number;
  }
) {
  try {
    const knex = getKnexInstance();
    const contextTableName = getContextTableNameByVendorName(vendorName);

    if (!contextTableName) {
      console.log(`No table found for vendor: ${vendorName}`);
      return null;
    }

    const updateObj: Record<string, any> = {};

    // Only update fields that have data
    if (marketData.inStock !== undefined) {
      updateObj.CurrentInStock = marketData.inStock;
    }
    if (marketData.inventory !== undefined) {
      updateObj.CurrentInventory = marketData.inventory;
    }
    if (marketData.ourPrice !== undefined) {
      updateObj.OurLastPrice = marketData.ourPrice;
    }

    // Only perform update if we have fields to update
    if (Object.keys(updateObj).length > 0) {
      updateObj.MarketStateUpdatedAt = new Date();

      const result = await knex(contextTableName).update(updateObj).where("MpId", parseInt(mpid.toString()));

      return result;
    }

    return 0; // No updates performed
  } catch (error) {
    console.log("Error in UpdateMarketStateOnly", mpid, vendorName, marketData, error);
    //throw error;
  }
}

export async function UpdateCronForProductAsync(payload: UpdateCronForProductPayload) {
  try {
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
  } catch (error) {
    console.log("Error in UpdateCronForProductAsync", payload, error);
    //throw error;
  } finally {
    //destroyKnexInstance();
  }
}

export async function GetFilterEligibleProductsList(filterDate: Date | string) {
  // Stored procedure, must use raw
  try {
    const knex = getKnexInstance();
    const parameter = moment(filterDate).format("YYYY-MM-DD HH:mm:ss");
    const queryToCall = `CALL ${applicationConfig.SQL_SP_FILTER_ELIGIBLE_PRODUCT}(?)`;
    const [rows] = await knex.raw(queryToCall, [parameter]);
    const productList = (rows as any)[0];
    return productList;
  } catch (error) {
    console.log("Error in GetFilterEligibleProductsList", filterDate, error);
    //throw error;
  } finally {
    //destroyKnexInstance();
  }
}

export async function InsertHistoricalApiResponse(jsonData: any, refTime: Date) {
  try {
    const knex = getKnexInstance();
    const insertObj = {
      RefTime: refTime,
      ApiResponse: JSON.stringify(jsonData),
    };
    const insertResult = await knex(applicationConfig.SQL_HISTORY_API_RESPONSE!).insert(insertObj);
    return insertResult[0];
  } catch (error) {
    console.log("Error in InsertHistoricalApiResponse", jsonData, refTime, error);
    //throw error;
  } finally {
    //destroyKnexInstance();
  }
}

export async function InsertHistory(history: HistoryModel, refTime: Date) {
  try {
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
      SuggestedPrice: history.SuggestedPrice || null,
      RepriceComment: history.RepriceComment,
      MaxVendor: history.MaxVendor,
      MaxVendorPrice: history.MaxVendorPrice,
      OtherVendorList: history.OtherVendorList,
      LinkedApiResponse: history.LinkedApiResponse,
      ContextCronName: history.ContextCronName,
      TriggeredByVendor: history.TriggeredByVendor,
      RepriceResult: history.RepriceResult,
    };
    const insertResult = await knex(applicationConfig.SQL_HISTORY!).insert(insertObj);
    return insertResult[0];
  } catch (error) {
    console.log("Error in InsertHistory", history, refTime, error);
    //throw error;
  } finally {
    //destroyKnexInstance();
  }
}

export async function UpdateTriggeredByVendor(payload: any, contextVendor: string, mpid: string | number): Promise<any> {
  let updatedResult = null;
  let triggeredByValue = null;
  const db = getKnexInstance();
  try {
    let contextTableName: string | null = null;
    switch (contextVendor) {
      case "TRADENT":
        contextTableName = applicationConfig.SQL_TRADENT_DETAILS;
        break;
      case "FRONTIER":
        contextTableName = applicationConfig.SQL_FRONTIER_DETAILS;
        break;
      case "MVP":
        contextTableName = applicationConfig.SQL_MVP_DETAILS;
        break;
      case "TOPDENT":
        contextTableName = applicationConfig.SQL_TOPDENT_DETAILS;
        break;
      case "FIRSTDENT":
        contextTableName = applicationConfig.SQL_FIRSTDENT_DETAILS;
        break;
      case "TRIAD":
        contextTableName = applicationConfig.SQL_TRIAD_DETAILS;
        break;
      default:
        break;
    }
    triggeredByValue = GetTriggeredByValue(payload);
    let updateQuery = `UPDATE ${contextTableName} SET TriggeredByVendor=? WHERE MpId =?`;
    updatedResult = await db.raw(updateQuery, [triggeredByValue, parseInt(mpid as string)]);
  } catch (exception) {
    console.log(`Exception while UpdateTriggeredByVendor : ${exception} for Vendor ${contextVendor} || MPID : ${payload.mpid}`);
  } finally {
    //destroyKnexInstance();
  }
  return triggeredByValue;
}

export async function UpdateHistoryWithMessage(identifier: string | number, history: string) {
  try {
    const knex = getKnexInstance();
    const updateResult = await knex(applicationConfig.SQL_HISTORY!).update({ RepriceComment: history }).where("Id", identifier);
    return updateResult;
  } catch (error) {
    console.log("Error in UpdateHistoryWithMessage", identifier, history, error);
    //throw error;
  } finally {
    //destroyKnexInstance();
  }
}

export async function GetActiveFullProductDetailsList(cronId: string) {
  try {
    const knex = getKnexInstance();

    // Build the base query for each vendor using UNION
    const tradentQuery = knex.select("pl.Id as ProductIdentifier", "pl.MpId as ProductId", "pl.ProductName", "pl.Net32Url", "pl.IsActive as ScrapeOnlyActive", "pl.LinkedCronName as LinkedScrapeOnlyCron", "pl.LinkedCronId as LinkedScrapeOnlyCronId", "pl.RegularCronName", "pl.RegularCronId", "pl.SlowCronName", "pl.SlowCronId", "pl.IsSlowActivated", "pl.algo_execution_mode", knex.raw("tdl.*")).from("table_scrapeProductList as pl").leftJoin("table_tradentDetails as tdl", "tdl.id", "pl.LinkedTradentDetailsInfo").where("pl.RegularCronId", cronId).where("pl.IsSlowActivated", "!=", true).whereNotNull("tdl.ChannelName").where("tdl.Activated", true);

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

        knex.raw("fdl.*")
      )
      .from("table_scrapeProductList as pl")
      .leftJoin("table_frontierDetails as fdl", "fdl.id", "pl.LinkedFrontiersDetailsInfo")
      .where("pl.RegularCronId", cronId)
      .where("pl.IsSlowActivated", "!=", true)
      .whereNotNull("fdl.ChannelName")
      .where("fdl.Activated", true);

    const mvpQuery = knex.select("pl.Id as ProductIdentifier", "pl.MpId as ProductId", "pl.ProductName", "pl.Net32Url", "pl.IsActive as ScrapeOnlyActive", "pl.LinkedCronName as LinkedScrapeOnlyCron", "pl.LinkedCronId as LinkedScrapeOnlyCronId", "pl.RegularCronName", "pl.RegularCronId", "pl.SlowCronName", "pl.SlowCronId", "pl.IsSlowActivated", "pl.algo_execution_mode", knex.raw("mdl.*")).from("table_scrapeProductList as pl").leftJoin("table_mvpDetails as mdl", "mdl.id", "pl.LinkedMvpDetailsInfo").where("pl.RegularCronId", cronId).where("pl.IsSlowActivated", "!=", true).whereNotNull("mdl.ChannelName").where("mdl.Activated", true);

    const firstDentQuery = knex.select("pl.Id as ProductIdentifier", "pl.MpId as ProductId", "pl.ProductName", "pl.Net32Url", "pl.IsActive as ScrapeOnlyActive", "pl.LinkedCronName as LinkedScrapeOnlyCron", "pl.LinkedCronId as LinkedScrapeOnlyCronId", "pl.RegularCronName", "pl.RegularCronId", "pl.SlowCronName", "pl.SlowCronId", "pl.IsSlowActivated", "pl.algo_execution_mode", knex.raw("firstDl.*")).from("table_scrapeProductList as pl").leftJoin("table_firstDentDetails as firstDl", "firstDl.id", "pl.LinkedFirstDentDetailsInfo").where("pl.RegularCronId", cronId).where("pl.IsSlowActivated", "!=", true).whereNotNull("firstDl.ChannelName").where("firstDl.Activated", true);

    const topDentQuery = knex.select("pl.Id as ProductIdentifier", "pl.MpId as ProductId", "pl.ProductName", "pl.Net32Url", "pl.IsActive as ScrapeOnlyActive", "pl.LinkedCronName as LinkedScrapeOnlyCron", "pl.LinkedCronId as LinkedScrapeOnlyCronId", "pl.RegularCronName", "pl.RegularCronId", "pl.SlowCronName", "pl.SlowCronId", "pl.IsSlowActivated", "pl.algo_execution_mode", knex.raw("topDl.*")).from("table_scrapeProductList as pl").leftJoin("table_topDentDetails as topDl", "topDl.id", "pl.LinkedTopDentDetailsInfo").where("pl.RegularCronId", cronId).where("pl.IsSlowActivated", "!=", true).whereNotNull("topDl.ChannelName").where("topDl.Activated", true);

    const triadQuery = knex.select("pl.Id as ProductIdentifier", "pl.MpId as ProductId", "pl.ProductName", "pl.Net32Url", "pl.IsActive as ScrapeOnlyActive", "pl.LinkedCronName as LinkedScrapeOnlyCron", "pl.LinkedCronId as LinkedScrapeOnlyCronId", "pl.RegularCronName", "pl.RegularCronId", "pl.SlowCronName", "pl.SlowCronId", "pl.IsSlowActivated", "pl.algo_execution_mode", knex.raw("triadDl.*")).from("table_scrapeProductList as pl").leftJoin("table_triadDetails as triadDl", "triadDl.id", "pl.LinkedTriadDetailsInfo").where("pl.RegularCronId", cronId).where("pl.IsSlowActivated", "!=", true).whereNotNull("triadDl.ChannelName").where("triadDl.Activated", true);

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
  } catch (error) {
    console.log("Error in GetActiveFullProductDetailsList", cronId, error);
    //throw error;
  } finally {
    //destroyKnexInstance();
  }
}

export async function getNet32UrlById(mpId: number) {
  try {
    const knex = getKnexInstance();
    const result = await knex("table_scrapeProductList").where("MpId", mpId).select("Net32Url").first();
    return result?.Net32Url || null;
  } catch (error) {
    console.log("Error in getNet32UrlById", mpId, error);
    //throw error;
  } finally {
    //destroyKnexInstance();
  }
}

export async function UpdateRepriceResultStatus(repriceResultStatus: RepriceResultEnum, mpid: string, contextVendor: string) {
  try {
    let contextTableName = getContextTableNameByVendorName(contextVendor);
    const knex = getKnexInstance();
    await knex(contextTableName!)
      .where("MpId", parseInt(mpid as string))
      .update({ RepriceResult: repriceResultStatus });
  } catch (error) {
    console.log("Error in UpdateRepriceResultStatus", repriceResultStatus, mpid, contextVendor, error);
    //throw error;
  } finally {
    //destroyKnexInstance();
  }
}

export async function GetProxiesNet32(usernames: string[]): Promise<ProxyNet32[]> {
  try {
    let proxyList: ProxyNet32[] = [];
    const knex = getKnexInstance();
    if (usernames.length === 0) {
      return [];
    }

    proxyList = await knex(applicationConfig.SQL_PROXY_NET_32!).whereIn("proxy_username", usernames).select("*");

    return proxyList;
  } catch (error) {
    console.log("Error in GetProxiesNet32", usernames, error);
    return [];
    //throw error;
  } finally {
    //destroyKnexInstance();
  }
}

export async function GetVendorKeys(vendors: string[]): Promise<Map<string, string | null> | null> {
  try {
    const knex = getKnexInstance();
    if (vendors.length === 0) {
      return new Map<string, string | null>();
    }

    const rows = await knex(applicationConfig.SQL_VENDOR_KEYS).whereIn("vendor", vendors).where("is_primary", 1).where("is_active", 1).select("vendor", "value");

    const vendorKeyMap = new Map<string, string | null>();

    for (const vendor of vendors) {
      const match = rows.find((row) => row.vendor === vendor);
      const value = match?.value ?? null;
      vendorKeyMap.set(vendor, value);
    }

    return vendorKeyMap;
  } catch (error) {
    console.log("Error in GetVendorKeys", vendors, error);
    return null;
    //throw error;
  } finally {
    //destroyKnexInstance();
  }
}

export async function ExecuteQuery(_query: string, _params: any) {
  try {
    const knex = getKnexInstance();
    const result = await knex.raw(_query, _params);
    return result[0];
  } catch (error) {
    console.log("Error in ExecuteQuery", _query, _params, error);
    //throw error;
  } finally {
    //destroyKnexInstance();
  }
}

export async function GetCurrentStock(mpids: string[], vendorName: string): Promise<CurrentStock[]> {
  const contextTableName = getContextTableNameByVendorName(vendorName?.toUpperCase());
  try {
    const knex = getKnexInstance();
    const result = await knex(contextTableName!).whereIn("mpid", mpids).select("mpid", "CurrentInStock", "CurrentInventory");
    return result;
  } catch (error) {
    console.log("Error in GetCurrentStock", mpids, vendorName, contextTableName, error);
    throw error;
  } finally {
    //destroyKnexInstance();
  }
}

export async function WaitlistInsert(waitlistItems: WaitlistModel[]) {
  try {
    const knex = getKnexInstance();
    await knex(applicationConfig.SQL_WAITLIST!).insert(waitlistItems);
  } catch (error) {
    console.log("Error in WaitlistInsert", waitlistItems, error);
    throw error;
  } finally {
    //destroyKnexInstance();
  }
}

export async function GetWaitlistPendingItems(): Promise<WaitlistModel[]> {
  try {
    const knex = getKnexInstance();
    const result = await knex(applicationConfig.SQL_WAITLIST!).where("api_status", "pending").select("*");
    return result;
  } catch (error) {
    console.log("Error in GetWaitlistPendingItems", error);
    throw error;
  } finally {
    //destroyKnexInstance();
  }
}

export async function UpdateWaitlistStatus(id: number, status: string, message?: string) {
  try {
    const knex = getKnexInstance();
    await knex(applicationConfig.SQL_WAITLIST!).where("id", id).update({ api_status: status, message: message, updated_at: new Date() });
  } catch (error) {
    console.log("Error in UpdateWaitlistStatus", id, status, message, error);
    throw error;
  } finally {
    //destroyKnexInstance();
  }
}

export async function UpdateVendorStock(vendorName: string, mpid: number, inventory: number) {
  const contextTableName = getContextTableNameByVendorName(vendorName?.toUpperCase());
  try {
    const knex = getKnexInstance();
    await knex(contextTableName!).where("MpId", mpid).update({ CurrentInventory: inventory });
  } catch (error) {
    console.log("Error in UpdateVendorStock", vendorName, mpid, inventory, error);
    throw error;
  } finally {
    //destroyKnexInstance();
  }
}

/**************************** PRIVATE FUNCTIONS ***********************************/
function getContextItemByKey(payload: any, key: string): any {
  if (payload.tradentDetails != null) return payload.tradentDetails[key];
  if (payload.frontierDetails != null) return payload.frontierDetails[key];
  if (payload.mvpDetails != null) return payload.mvpDetails[key];
  if (payload.topDentDetails != null) return payload.topDentDetails[key];
  if (payload.firstDentDetails != null) return payload.firstDentDetails[key];
  if (payload.triadDetails != null) return payload.triadDetails[key];
}

function getContextTableNameByVendorName(contextVendor: string) {
  let contextTableName: string | null = null;
  if (contextVendor === VendorName.TRADENT) {
    contextTableName = applicationConfig.SQL_TRADENT_DETAILS;
  } else if (contextVendor === VendorName.FRONTIER) {
    contextTableName = applicationConfig.SQL_FRONTIER_DETAILS;
  } else if (contextVendor === VendorName.MVP) {
    contextTableName = applicationConfig.SQL_MVP_DETAILS;
  } else if (contextVendor === VendorName.TOPDENT) {
    contextTableName = applicationConfig.SQL_TOPDENT_DETAILS;
  } else if (contextVendor === VendorName.FIRSTDENT) {
    contextTableName = applicationConfig.SQL_FIRSTDENT_DETAILS;
  } else if (contextVendor === VendorName.TRIAD) {
    contextTableName = applicationConfig.SQL_TRIAD_DETAILS;
  }
  return contextTableName;
}
