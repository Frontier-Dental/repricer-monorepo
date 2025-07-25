import _ from "lodash";
import { getKnexInstance } from "../model/sql-models/knex-wrapper";
import moment from "moment";
import { FullProductDetailsV2 } from "../types/full-product-details-v2";
import { GetTriggeredByValue, MapProductDetailsList } from "./mySql-mapper";
import { HistoryModel } from "../model/sql-models/history";
import { applicationConfig } from "./config";

// Define types for the function parameters where possible
interface RunInfo {
  CronName: string;
  CronId: string;
  RunStartTime: Date | string;
  RunId: string;
  KeyGenId: string;
  RunType: string;
  ProductCount: number;
  EligibleCount: number;
  ScrapedSuccessCount: number;
  ScrapedFailureCount: number;
}

interface ProductInfo {
  LinkedCronInfo: number;
  Mpid: string;
  VendorProductId: string;
  VendorProductCode: string;
  VendorName: string;
  VendorRegion: string;
  InStock: number;
  StandardShipping: number;
  StandardShippingStatus: string;
  FreeShippingGap: number;
  ShippingTime: number;
  IsFulfillmentPolicyStock: number;
  IsBackordered: number;
  BadgeId: number;
  BadgeName: string;
  ArrivalBusinessDays: number;
  ItemRank: number;
  IsOwnVendor: number;
  VendorId: string;
  HeavyShippingStatus: string;
  HeavyShipping: number;
  Inventory: number;
  ArrivalDate: string;
  IsLowestTotalPrice: string;
  StartTime: string;
  EndTime: string;
}

interface PriceBreakInfo {
  LinkedProductInfo: number;
  PMID: number;
  MinQty: number;
  UnitPrice: number;
  PromoAddlDescr: string;
  IsActive: number;
}

interface StatusInfo {
  KeyGenId: string;
  RunType: string;
  IsCompleted: number;
}

interface UpdateProductPayload {
  lastCronRun: string;
  last_cron_message: string;
  lastUpdatedBy: string;
  lowest_vendor: string;
  lowest_vendor_price: string;
  lastExistingPrice: string;
  lastSuggestedPrice: string;
  last_cron_time: string;
  last_attempted_time: string;
  next_cron_time: string;
  last_update_time?: string;
  mpid: string | number;
}

interface UpdateCronForProductPayload {
  slowCronId?: string;
  slowCronName?: string;
  isSlowActivated: number;
  mpId: string | number;
  tradentDetails?: Record<string, any>;
  frontierDetails?: Record<string, any>;
  mvpDetails?: Record<string, any>;
}

interface History {
  MpId: string | number;
  ChannelName: string;
  ExistingPrice: number;
  MinQty: number;
  Position: number;
  LowestVendor: string;
  LowestPrice: number;
  SuggestedPrice: number;
  RepriceComment: string;
  MaxVendor: string;
  MaxVendorPrice: number;
  OtherVendorList: string;
  LinkedApiResponse: number;
  ContextCronName: string;
}

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
  // Stored procedure, must use raw
  const knex = getKnexInstance();
  const queryToCall = `CALL ${applicationConfig.SQL_SP_GET_FULL_PRODUCT_DETAILS_BY_ID}(?)`;
  const [rows] = await knex.raw(queryToCall, [parseInt(mpId as string)]);
  const productList = (rows as any)[0] as FullProductDetailsV2[];
  return _.first(MapProductDetailsList(productList));
}

export async function UpdateProductAsync(
  payload: UpdateProductPayload,
  isPriceUpdated: boolean,
  contextVendor: string,
) {
  const knex = getKnexInstance();
  let contextTableName: string | null = null;
  switch (contextVendor) {
    case "TRADENT":
      contextTableName = applicationConfig.SQL_TRADENT_DETAILS!;
      break;
    case "FRONTIER":
      contextTableName = applicationConfig.SQL_FRONTIER_DETAILS!;
      break;
    case "MVP":
      contextTableName = applicationConfig.SQL_MVP_DETAILS!;
      break;
    case "TOPDENT":
      contextTableName = applicationConfig.SQL_TOPDENT_DETAILS!;
      break;
    case "FIRSTDENT":
      contextTableName = applicationConfig.SQL_FIRSTDENT_DETAILS!;
      break;
    default:
      break;
  }

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
  if (isPriceUpdated === true) {
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
  };
  const insertResult = await knex(applicationConfig.SQL_HISTORY!).insert(
    insertObj,
  );
  return insertResult[0];
}

export async function UpdateTriggeredByVendor(
  payload: any,
  contextVendor: string,
  mpid: string | number,
) {
  const knex = getKnexInstance();
  let contextTableName: string | null = null;
  switch (contextVendor) {
    case "TRADENT":
      contextTableName = applicationConfig.SQL_TRADENT_DETAILS!;
      break;
    case "FRONTIER":
      contextTableName = applicationConfig.SQL_FRONTIER_DETAILS!;
      break;
    case "MVP":
      contextTableName = applicationConfig.SQL_MVP_DETAILS!;
      break;
    case "TOPDENT":
      contextTableName = applicationConfig.SQL_TOPDENT_DETAILS!;
      break;
    case "FIRSTDENT":
      contextTableName = applicationConfig.SQL_FIRSTDENT_DETAILS!;
      break;
    default:
      break;
  }
  const updateValue = GetTriggeredByValue(payload);
  const updateResult = await knex(contextTableName!)
    .update({ TriggeredByVendor: updateValue })
    .where("MpId", parseInt(mpid as string));
  return updateResult;
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

/**************************** PRIVATE FUNCTIONS ***********************************/
async function getContextItemByKey(payload: any, key: string): Promise<any> {
  if (payload.tradentDetails != null) return payload.tradentDetails[key];
  if (payload.frontierDetails != null) return payload.frontierDetails[key];
  if (payload.mvpDetails != null) return payload.mvpDetails[key];
}
