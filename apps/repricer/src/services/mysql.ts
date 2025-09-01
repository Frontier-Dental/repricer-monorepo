import SqlConnectionPool from "../models/sql-models/mysql-db";
import * as SqlMapper from "../utility/mapper/mysql-mapper";
import { applicationConfig } from "../utility/config";
import { getKnexInstance } from "./knex-wrapper";
import bcrypt from "bcrypt";

export async function GetLatestRunInfo(
  noOfRecords: any,
  startDateTime: any,
  endDateTime: any,
) {
  const db = getKnexInstance();
  const result = await db.raw(
    `CALL ${applicationConfig.SQL_SP_GETRUN_INFO}(?,?,?)`,
    [noOfRecords, startDateTime, endDateTime],
  );
  return result[0];
}

export async function GetLatestRunInfoForCron(
  noOfRecords: any,
  startDateTime: any,
  endDateTime: any,
  cronId: any,
) {
  const db = getKnexInstance();
  const result = await db.raw(
    `CALL ${applicationConfig.SQL_SP_GETRUN_INFO_BY_CRON}(?,?,?,?)`,
    [noOfRecords, startDateTime, endDateTime, cronId],
  );
  return result[0];
}

export async function GetNumberOfScrapeProducts() {
  let noOfRecords: any = null;
  const db = await SqlConnectionPool.getConnection();
  const queryToCall = `select count (Id) from table_scrapeProductList;`;
  noOfRecords = await db.execute(queryToCall);
  return noOfRecords[0][0]["count (Id)"];
}

export async function GetScrapeProductList(pageNumber: any, pageSize: any) {
  let scrapeProductList: any = null;
  const db = await SqlConnectionPool.getConnection();
  const queryToCall = `CALL ${applicationConfig.SQL_SP_GET_SCRAPEPRODUCT_DETAILS}(?,?)`;
  scrapeProductList = await db.query(queryToCall, [pageNumber, pageSize]);
  return scrapeProductList[0][0];
}

export async function GetScrapeProductListByFilter(
  filterText: any,
  pageSize: any,
  pageNumber: any,
) {
  let scrapeProductList: any = null;
  const db = await SqlConnectionPool.getConnection();
  const queryToCall = `CALL ${applicationConfig.SQL_SP_GET_SCRAPEPRODUCT_DETAILS_FILTER}(?,?, ?)`;
  scrapeProductList = await db.query(queryToCall, [
    pageSize,
    filterText,
    pageNumber,
  ]);
  return scrapeProductList[0][0];
}

export async function GetAllScrapeProductDetails() {
  let scrapeProductList: any = null;
  const db = await SqlConnectionPool.getConnection();
  const queryToCall = `CALL ${applicationConfig.SQL_SP_GET_ALL_SCRAPEPRODUCT_DETAILS}()`;
  scrapeProductList = await db.query(queryToCall);
  return scrapeProductList[0][0];
}

export async function UpsertProductDetails(payload: any) {
  let upsertResult: any = null;
  const db = await SqlConnectionPool.getConnection();
  const queryToCall = `CALL ${applicationConfig.SQL_SP_UPSERT_PRODUCT_DETAILS}(?,?,?,?,?,?,?,?)`;
  upsertResult = await db.query(queryToCall, [
    payload.mpId,
    payload.isActive,
    payload.net32Url,
    payload.linkedCron,
    payload.linkedCronId,
    payload.lastUpdatedBy,
    payload.lastUpdatedOn,
    payload.isBadgeItem,
  ]);
  return upsertResult[0];
}

export async function DeleteScrapeProductById(mpId: any) {
  let noOfRecords: any = null;
  const db = await SqlConnectionPool.getConnection();
  const queryToCall = `delete from  ${applicationConfig.SQL_SCRAPEPRODUCTLIST} where MpId=${mpId}`;
  noOfRecords = await db.execute(queryToCall);
  return noOfRecords;
}

export async function GetLastScrapeDetailsById(mpId: any) {
  let scrapeDetails: any = null;
  const db = await SqlConnectionPool.getConnection();
  const queryToCall = `CALL ${applicationConfig.SQL_SP_GETLASTSCRAPEDETAILSBYID}(?)`;
  scrapeDetails = await db.query(queryToCall, [mpId]);
  return scrapeDetails[0][0];
}

export async function UpsertVendorData(payload: any, vendorName: any) {
  let upsertResult: any = null;
  const db = await SqlConnectionPool.getConnection();
  let contextSpName: any = null;
  switch (vendorName) {
    case "TRADENT":
      contextSpName = applicationConfig.SQL_SP_UPSERT_TRADENT;
      break;
    case "FRONTIER":
      contextSpName = applicationConfig.SQL_SP_UPSERT_FRONTIER;
      break;
    case "MVP":
      contextSpName = applicationConfig.SQL_SP_UPSERT_MVP;
      break;
    case "TOPDENT":
      contextSpName = applicationConfig.SQL_SP_UPSERT_TOPDENT;
      break;
    case "FIRSTDENT":
      contextSpName = applicationConfig.SQL_SP_UPSERT_FIRSTDENT;
      break;
    default:
      break;
  }
  if (!payload.inventoryThreshold) {
    payload.inventoryThreshold = 0;
  }
  if (!payload.percentageDown) {
    payload.percentageDown = 0;
  }
  if (!payload.badgePercentageDown) {
    payload.badgePercentageDown = 0;
  }
  if (
    typeof payload.competeWithNext == "undefined" ||
    payload.competeWithNext == null
  ) {
    payload.competeWithNext = false;
  }
  if (
    typeof payload.ignorePhantomQBreak == "undefined" ||
    payload.ignorePhantomQBreak == null
  ) {
    payload.ignorePhantomQBreak = true;
  }
  if (!payload.ownVendorThreshold) {
    payload.ownVendorThreshold = 1;
  }
  const queryToCall = `CALL ${contextSpName}(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
  var [rows] = await db.query(queryToCall, [
    parseInt(payload.mpid),
    payload.channelName,
    payload.scrapeOn,
    payload.allowReprice,
    payload.activated,
    payload.unitPrice,
    payload.focusId,
    payload.requestInterval,
    payload.floorPrice,
    payload.maxPrice,
    payload.channelId,
    payload.createdAt,
    payload.updatedAt,
    payload.updatedBy,
    payload.lastCronTime,
    payload.lastUpdateTime,
    payload.lastAttemptedTime,
    payload.is_nc_needed,
    payload.repricingRule,
    payload.requestIntervalUnit,
    payload.suppressPriceBreak,
    payload.priority,
    payload.last_cron_message,
    payload.lowest_vendor,
    payload.lowest_vendor_price,
    payload.lastExistingPrice,
    payload.lastSuggestedPrice,
    payload.nextCronTime,
    payload.beatQPrice,
    payload.competeAll,
    payload.percentageIncrease,
    payload.suppressPriceBreakForOne,
    payload.compareWithQ1,
    payload.wait_update_period,
    payload.lastCronRun,
    payload.abortDeactivatingQPriceBreak,
    payload.badgeIndicator,
    payload.badgePercentage,
    payload.lastUpdatedBy,
    payload.inactiveVendorId,
    payload.includeInactiveVendors,
    payload.override_bulk_rule,
    payload.override_bulk_update,
    payload.latest_price,
    payload.executionPriority,
    payload.applyBuyBoxLogic,
    payload.applyNcForBuyBox,
    payload.sisterVendorId,
    payload.handlingTimeFilter,
    payload.keepPosition,
    payload.excludedVendors,
    parseInt(payload.inventoryThreshold),
    parseFloat(payload.percentageDown),
    parseFloat(payload.badgePercentageDown),
    payload.competeWithNext,
    payload.ignorePhantomQBreak,
    parseInt(payload.ownVendorThreshold),
  ]);
  if (rows != null && (rows as any)[0] != null) {
    upsertResult = (rows as any)[0][0];
  }
  if (upsertResult && upsertResult != null) {
    return upsertResult["updatedIdentifier"];
  } else return null;
}

export async function UpsertProductDetailsV2(payload: any) {
  let upsertResult: any = null;
  const db = await SqlConnectionPool.getConnection();
  const queryToCall = `CALL ${applicationConfig.SQL_SP_UPSERT_PRODUCT_DETAILSV3}(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
  upsertResult = await db.query(queryToCall, [
    payload.MpId,
    payload.IsActive,
    payload.Net32Url,
    payload.LinkedCronName,
    payload.LinkedCronId,
    payload.LastUpdatedBy,
    payload.LastUpdatedAt,
    payload.ProductName,
    payload.RegularCronName,
    payload.RegularCronId,
    payload.SlowCronName,
    payload.SlowCronId,
    payload.LinkedTradentDetailsInfo,
    payload.LinkedFrontiersDetailsInfo,
    payload.LinkedMvpDetailsInfo,
    false,
    payload.IsBadgeItem,
    payload.LinkedTopDentDetailsInfo,
    payload.LinkedFirstDentDetailsInfo,
  ]);
  return upsertResult[0];
}

export async function GetCompleteProductDetails() {
  let scrapeDetails: any = null;
  const db = await SqlConnectionPool.getConnection();
  const queryToCall = `CALL ${applicationConfig.SQL_SP_GET_ALL_PRODUCT_DETAILS}()`;
  const [rows] = await db.query(queryToCall);
  if (rows != null && (rows as any)[0] != null) {
    scrapeDetails = (rows as any)[0];
  }
  return await SqlMapper.MapProductDetailsList(scrapeDetails);
}

export async function GetNumberOfRepriceEligibleProductCount() {
  const db = getKnexInstance();
  const totalCount = await db("table_scrapeProductList")
    .count("* as count")
    .first();
  const nullCount = await db("table_scrapeProductList")
    .count("* as count")
    .whereNull("LinkedTradentDetailsInfo")
    .whereNull("LinkedFrontiersDetailsInfo")
    .whereNull("LinkedMvpDetailsInfo")
    .whereNull("LinkedTopDentDetailsInfo")
    .whereNull("LinkedFirstDentDetailsInfo")
    .first();

  const result = (totalCount?.count as number) - (nullCount?.count as number);
  return result;
}

export async function GetAllRepriceEligibleProductByFilter(
  pageNumber: any,
  pageSize: any,
) {
  const knex = getKnexInstance();

  // Calculate offset for pagination
  const offset = pageNumber * pageSize;

  // Common select fields for all queries
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

  // Get paginated MpIds first
  const paginatedMpIds = await knex("table_scrapeProductList")
    .select("MpId")
    .whereNotNull("RegularCronName")
    .orderBy("Id", "desc")
    .limit(pageSize)
    .offset(offset);

  const mpIds = paginatedMpIds.map((row) => row.MpId);

  if (mpIds.length === 0) {
    return [];
  }

  // Build subqueries for each table join
  const tradentQuery = knex("table_scrapeProductList as pl")
    .select([...selectFields, "tdl.*"])
    .leftJoin(
      "table_tradentDetails as tdl",
      "tdl.id",
      "pl.LinkedTradentDetailsInfo",
    )
    .whereIn("pl.MpId", mpIds);

  const frontierQuery = knex("table_scrapeProductList as pl")
    .select([...selectFields, "fdl.*"])
    .leftJoin(
      "table_frontierDetails as fdl",
      "fdl.id",
      "pl.LinkedFrontiersDetailsInfo",
    )
    .whereIn("pl.MpId", mpIds);

  const mvpQuery = knex("table_scrapeProductList as pl")
    .select([...selectFields, "mdl.*"])
    .leftJoin("table_mvpDetails as mdl", "mdl.id", "pl.LinkedMvpDetailsInfo")
    .whereIn("pl.MpId", mpIds);

  const firstDentQuery = knex("table_scrapeProductList as pl")
    .select([...selectFields, "firstDl.*"])
    .leftJoin(
      "table_firstDentDetails as firstDl",
      "firstDl.id",
      "pl.LinkedFirstDentDetailsInfo",
    )
    .whereIn("pl.MpId", mpIds);

  const topDentQuery = knex("table_scrapeProductList as pl")
    .select([...selectFields, "topDl.*"])
    .leftJoin(
      "table_topDentDetails as topDl",
      "topDl.id",
      "pl.LinkedTopDentDetailsInfo",
    )
    .whereIn("pl.MpId", mpIds);

  const triadQuery = knex("table_scrapeProductList as pl")
    .select([...selectFields, "triadDl.*"])
    .leftJoin(
      "table_triadDetails as triadDl",
      "triadDl.id",
      "pl.LinkedTriadDetailsInfo",
    )
    .whereIn("pl.MpId", mpIds);

  // Combine all queries using UNION
  const result = await knex
    .union([
      tradentQuery,
      frontierQuery,
      mvpQuery,
      firstDentQuery,
      topDentQuery,
      triadQuery,
    ])
    .orderBy("ProductId");

  return SqlMapper.MapProductDetailsList(result);
}

export async function GetAllRepriceEligibleProductByTag(filterTag: any) {
  const knex = getKnexInstance();

  // Create search pattern for LIKE queries
  const searchPattern = `%${filterTag}%`;

  // Common select fields for all queries
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

  // Get matching MpIds from all vendor tables
  const matchingMpIds = await knex
    .union([
      knex("table_tradentDetails")
        .select("MpId")
        .where(function () {
          this.where("MpId", "like", searchPattern)
            .orWhere("FocusId", "like", searchPattern)
            .orWhere("ChannelId", "like", searchPattern);
        }),
      knex("table_frontierDetails")
        .select("MpId")
        .where(function () {
          this.where("MpId", "like", searchPattern)
            .orWhere("FocusId", "like", searchPattern)
            .orWhere("ChannelId", "like", searchPattern);
        }),
      knex("table_mvpDetails")
        .select("MpId")
        .where(function () {
          this.where("MpId", "like", searchPattern)
            .orWhere("FocusId", "like", searchPattern)
            .orWhere("ChannelId", "like", searchPattern);
        }),
      knex("table_firstDentDetails")
        .select("MpId")
        .where(function () {
          this.where("MpId", "like", searchPattern)
            .orWhere("FocusId", "like", searchPattern)
            .orWhere("ChannelId", "like", searchPattern);
        }),
      knex("table_topDentDetails")
        .select("MpId")
        .where(function () {
          this.where("MpId", "like", searchPattern)
            .orWhere("FocusId", "like", searchPattern)
            .orWhere("ChannelId", "like", searchPattern);
        }),
    ])
    .distinct();

  const mpIds = matchingMpIds.map((row) => row.MpId);

  if (mpIds.length === 0) {
    return [];
  }

  // Build subqueries for each table join
  const tradentQuery = knex("table_scrapeProductList as pl")
    .select([...selectFields, "tdl.*"])
    .leftJoin(
      "table_tradentDetails as tdl",
      "tdl.id",
      "pl.LinkedTradentDetailsInfo",
    )
    .whereIn("pl.MpId", mpIds);

  const frontierQuery = knex("table_scrapeProductList as pl")
    .select([...selectFields, "fdl.*"])
    .leftJoin(
      "table_frontierDetails as fdl",
      "fdl.id",
      "pl.LinkedFrontiersDetailsInfo",
    )
    .whereIn("pl.MpId", mpIds);

  const mvpQuery = knex("table_scrapeProductList as pl")
    .select([...selectFields, "mdl.*"])
    .leftJoin("table_mvpDetails as mdl", "mdl.id", "pl.LinkedMvpDetailsInfo")
    .whereIn("pl.MpId", mpIds);

  const firstDentQuery = knex("table_scrapeProductList as pl")
    .select([...selectFields, "firstDl.*"])
    .leftJoin(
      "table_firstDentDetails as firstDl",
      "firstDl.id",
      "pl.LinkedFirstDentDetailsInfo",
    )
    .whereIn("pl.MpId", mpIds);

  const topDentQuery = knex("table_scrapeProductList as pl")
    .select([...selectFields, "topDl.*"])
    .leftJoin(
      "table_topDentDetails as topDl",
      "topDl.id",
      "pl.LinkedTopDentDetailsInfo",
    )
    .whereIn("pl.MpId", mpIds);

  const triadQuery = knex("table_scrapeProductList as pl")
    .select([...selectFields, "triadDl.*"])
    .leftJoin(
      "table_triadDetails as triadDl",
      "triadDl.id",
      "pl.LinkedTriadDetailsInfo",
    )
    .whereIn("pl.MpId", mpIds);

  // Combine all queries using UNION
  const result = await knex
    .union([
      tradentQuery,
      frontierQuery,
      mvpQuery,
      firstDentQuery,
      topDentQuery,
      triadQuery,
    ])
    .whereNotNull("ChannelName")
    .orderBy("ProductId");

  return SqlMapper.MapProductDetailsList(result);
}

export async function GetFullProductDetailsById(mpid: any) {
  let scrapeDetails: any = null;
  const db = await SqlConnectionPool.getConnection();
  const queryToCall = `CALL ${applicationConfig.SQL_SP_GET_FULL_PRODUCT_DETAILS_BY_ID}(?)`;
  const [rows] = await db.query(queryToCall, [mpid]);
  if (rows != null && (rows as any)[0] != null) {
    scrapeDetails = (rows as any)[0];
  }
  return SqlMapper.MapProductDetailsList(scrapeDetails);
}

export async function UpdateVendorData(payload: any, vendorName: any) {
  let upsertResult: any = null;
  const db = await SqlConnectionPool.getConnection();
  let contextSpName: any = null;
  switch (vendorName) {
    case "TRADENT":
      contextSpName = applicationConfig.SQL_SP_UPDATE_TRADENT;
      break;
    case "FRONTIER":
      contextSpName = applicationConfig.SQL_SP_UPDATE_FRONTIER;
      break;
    case "MVP":
      contextSpName = applicationConfig.SQL_SP_UPDATE_MVP;
      break;
    case "FIRSTDENT":
      contextSpName = applicationConfig.SQL_SP_UPDATE_FIRSTDENT;
      break;
    case "TOPDENT":
      contextSpName = applicationConfig.SQL_SP_UPDATE_TOPDENT;
      break;
    default:
      break;
  }
  if (!payload.inventoryThreshold) {
    payload.inventoryThreshold = 0;
  }
  if (!payload.percentageDown) {
    payload.percentageDown = 0;
  }
  if (!payload.badgePercentageDown) {
    payload.badgePercentageDown = 0;
  }
  if (
    typeof payload.competeWithNext == "undefined" ||
    payload.competeWithNext == null
  ) {
    payload.competeWithNext = false;
  }
  if (
    typeof payload.ignorePhantomQBreak == "undefined" ||
    payload.ignorePhantomQBreak == null
  ) {
    payload.ignorePhantomQBreak = true;
  }
  if (!payload.ownVendorThreshold) {
    payload.ownVendorThreshold = 1;
  }
  const queryToCall = `CALL ${contextSpName}(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
  var [rows] = await db.query(queryToCall, [
    parseInt(payload.mpid),
    payload.channelName,
    payload.scrapeOn,
    payload.allowReprice,
    payload.activated,
    parseFloat(payload.unitPrice),
    payload.focusId,
    payload.requestInterval,
    parseFloat(payload.floorPrice),
    parseFloat(payload.maxPrice),
    payload.channelId,
    payload.lastUpdatedOn,
    payload.lastUpdatedByUser,
    payload.lastCronTime,
    payload.lastUpdateTime,
    payload.lastAttemptedTime,
    payload.is_nc_needed,
    payload.repricingRule,
    payload.requestIntervalUnit,
    payload.suppressPriceBreak,
    parseInt(payload.priority),
    payload.last_cron_message,
    payload.lowest_vendor,
    payload.lowest_vendor_price,
    payload.lastExistingPrice,
    payload.lastSuggestedPrice,
    payload.nextCronTime,
    payload.beatQPrice,
    payload.competeAll,
    payload.percentageIncrease,
    payload.suppressPriceBreakForOne,
    payload.compareWithQ1,
    payload.wait_update_period,
    payload.lastCronRun,
    payload.abortDeactivatingQPriceBreak,
    payload.badgeIndicator,
    payload.badgePercentage,
    payload.lastUpdatedBy,
    payload.inactiveVendorId,
    payload.includeInactiveVendors,
    payload.override_bulk_rule,
    payload.override_bulk_update,
    parseInt(payload.latest_price),
    payload.executionPriority,
    payload.applyBuyBoxLogic,
    payload.applyNcForBuyBox,
    payload.sisterVendorId,
    payload.handlingTimeFilter,
    payload.keepPosition,
    payload.excludedVendors,
    parseFloat(payload.inventoryThreshold),
    parseFloat(payload.percentageDown),
    parseFloat(payload.badgePercentageDown),
    payload.competeWithNext,
    payload.ignorePhantomQBreak,
    parseInt(payload.ownVendorThreshold),
  ]);
  if (rows != null && (rows as any)[0] != null) {
    upsertResult = (rows as any)[0][0];
    console.log(
      `UPDATE_RESULT : ${payload.mpid} : ${JSON.stringify(upsertResult)}`,
    );
  }
  if (upsertResult && upsertResult != null) {
    return upsertResult["updatedIdentifier"];
  } else return null;
}

export async function GetLinkedVendorDetails(mpId: any, vendorName: any) {
  let noOfRecords: any = null;
  const db = await SqlConnectionPool.getConnection();
  let tableName: any = null;
  if (vendorName == "TRADENT") {
    tableName = "table_tradentDetails";
  }
  if (vendorName == "FRONTIER") {
    tableName = "table_frontierDetails";
  }
  if (vendorName == "MVP") {
    tableName = "table_mvpDetails";
  }
  const queryToCall = `select Id from ${tableName} where MpId=${mpId}`;
  noOfRecords = await db.execute(queryToCall);
  return noOfRecords[0][0]["Id"];
}

export async function UpdateProductV2(
  mpid: any,
  itemData: any,
  tId: any,
  fId: any,
  mId: any,
) {
  let noOfRecords: any = null;
  const db = await SqlConnectionPool.getConnection();
  let tableName = applicationConfig.SQL_SCRAPEPRODUCTLIST;
  const queryToCall = `update ${tableName} set RegularCronName=?,RegularCronId=?,SlowCronName=?,SlowCronId=?,LinkedTradentDetailsInfo=?,LinkedFrontiersDetailsInfo=?,LinkedMvpDetailsInfo=?,IsSlowActivated=? where MpId=?`;
  noOfRecords = await db.execute(queryToCall, [
    itemData.cronName,
    itemData.cronId,
    itemData.slowCronName,
    itemData.slowCronId,
    tId,
    fId,
    mId,
    itemData.isSlowActivated,
    parseInt(mpid),
  ]);
  console.log(
    `Updated in DB for ${mpid} with records ${JSON.stringify(noOfRecords)}`,
  );
  return noOfRecords;
}

export async function ChangeProductActivation(mpid: any, status: any) {
  let noOfRecords: any = null;
  const db = await SqlConnectionPool.getConnection();
  let queryToCall = `update table_tradentDetails set Activated=? where MpId=?`;
  noOfRecords = await db.execute(queryToCall, [status, parseInt(mpid)]);
  console.log(
    `Updated in DB for ${mpid} with records ${JSON.stringify(noOfRecords)}`,
  );
  queryToCall = `update table_frontierDetails set Activated=? where MpId=?`;
  noOfRecords = await db.execute(queryToCall, [status, parseInt(mpid)]);
  console.log(
    `Updated in DB for ${mpid} with records ${JSON.stringify(noOfRecords)}`,
  );
  queryToCall = `update table_mvpDetails set Activated=? where MpId=?`;
  noOfRecords = await db.execute(queryToCall, [status, parseInt(mpid)]);
  console.log(
    `Updated in DB for ${mpid} with records ${JSON.stringify(noOfRecords)}`,
  );
  queryToCall = `update table_firstDentDetails set Activated=? where MpId=?`;
  noOfRecords = await db.execute(queryToCall, [status, parseInt(mpid)]);
  console.log(
    `Updated in DB for ${mpid} with records ${JSON.stringify(noOfRecords)}`,
  );
  queryToCall = `update table_topDentDetails set Activated=? where MpId=?`;
  noOfRecords = await db.execute(queryToCall, [status, parseInt(mpid)]);
  console.log(
    `Updated in DB for ${mpid} with records ${JSON.stringify(noOfRecords)}`,
  );
  return noOfRecords;
}

export async function MapVendorToRoot(data: any) {
  const traId = await GetLinkedVendorDetails(parseInt(data.MPID), "TRADENT");
  const froId = await GetLinkedVendorDetails(parseInt(data.MPID), "FRONTIER");
  const mvpId = await GetLinkedVendorDetails(parseInt(data.MPID), "MVP");
  let noOfRecords: any = null;
  const db = await SqlConnectionPool.getConnection();
  let queryToCall = `UPDATE ${applicationConfig.SQL_SCRAPEPRODUCTLIST} SET `;
  queryToCall += `LinkedTradentDetailsInfo = ?, `;
  queryToCall += `LinkedFrontiersDetailsInfo = ?, `;
  queryToCall += `LinkedMvpDetailsInfo = ?, `;
  queryToCall += `RegularCronName = ?, `;
  queryToCall += `RegularCronId = ? `;
  queryToCall += `WHERE MpId = ?`;
  noOfRecords = await db.execute(queryToCall, [
    traId,
    froId,
    mvpId,
    data.CronName.trim(),
    data.CronId,
    parseInt(data.MPID),
  ]);
  console.trace(noOfRecords[0][0]);
  return noOfRecords[0][0];
}

export async function ToggleDataScrapeForId(
  mpid: any,
  status: any,
  auditInfo: any,
) {
  let noOfRecords: any = null;
  const db = await SqlConnectionPool.getConnection();
  let queryToCall = `update ${applicationConfig.SQL_SCRAPEPRODUCTLIST} set IsActive=?,LastUpdatedBy=?,LastUpdatedAt=? where MpId=?`;
  noOfRecords = await db.execute(queryToCall, [
    status,
    auditInfo.UpdatedBy,
    auditInfo.UpdatedOn,
    parseInt(mpid),
  ]);
  console.log(
    `Updated in DB for ${mpid} with records ${JSON.stringify(noOfRecords)}`,
  );
  return noOfRecords;
}

export async function UpdateBranchDataForVendor(
  mpId: any,
  vendorName: any,
  payLoad: any,
) {
  let noOfRecords: any = null;
  const db = await SqlConnectionPool.getConnection();
  let tableName: any = null;
  if (vendorName == "TRADENT") {
    tableName = "table_tradentDetails";
  }
  if (vendorName == "FRONTIER") {
    tableName = "table_frontierDetails";
  }
  if (vendorName == "MVP") {
    tableName = "table_mvpDetails";
  }
  if (vendorName == "FIRSTDENT") {
    tableName = "table_firstDentDetails";
  }
  if (vendorName == "TOPDENT") {
    tableName = "table_topDentDetails";
  }
  const queryToCall = `Update ${tableName} set Activated=?,ChannelId=?,IsNCNeeded=?,BadgeIndicator=?,RepricingRule=?,FloorPrice=?,MaxPrice=?,UnitPrice=? where MpId=?`;
  noOfRecords = await db.execute(queryToCall, [
    JSON.parse(payLoad.activated),
    payLoad.channelId,
    JSON.parse(payLoad.is_nc_needed),
    payLoad.badgeIndicator,
    parseInt(payLoad.repricingRule),
    parseFloat(payLoad.floorPrice),
    parseFloat(payLoad.maxPrice),
    parseFloat(payLoad.unitPrice),
    parseInt(mpId),
  ]);
  return noOfRecords[0][0];
}

export async function ExecuteQuery(_query: any, _params: any) {
  const db = await SqlConnectionPool.getConnection();
  return db.execute(_query, _params);
}

export async function CreateUser(username: string, password: string) {
  const db = getKnexInstance();
  const [userId] = await db("users").insert({
    username,
    password,
  });
  return userId;
}

export async function AuthenticateUser(username: string, password: string) {
  const db = getKnexInstance();
  const user = await db("users")
    .select("id", "username", "password")
    .where("username", username)
    .first();

  if (!user) {
    return null;
  }

  // Compare the provided password with the stored hash
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (isPasswordValid) {
    // Return user without password for security
    return {
      id: user.id,
      username: user.username,
    };
  }

  return null;
}

export async function ChangePassword(username: string, newPassword: string) {
  const db = getKnexInstance();
  const result = await db("users").where("username", username).update({
    password: newPassword,
    updated_at: db.fn.now(),
  });
  return result > 0;
}

export async function CheckUserExists(username: string) {
  const db = getKnexInstance();
  const user = await db("users")
    .select("id", "username")
    .where("username", username)
    .first();
  return user || null;
}

export async function GetAllRepriceEligibleProductByMpid(mpid: any) {
  let scrapeDetails = null;
  const db = await SqlConnectionPool.getConnection();
  try {
    const queryToCall = `CALL ${applicationConfig.SQL_SP_GET_PRODUCT_BY_MPID}(?)`;
    const [rows] = await db.query(queryToCall, [mpid]);
    if (rows != null && (rows as any)[0] != null) {
      scrapeDetails = (rows as any)[0];
    }
  } catch (exception) {
    console.log(
      `Exception while GetAllRepriceEligibleProductByMpid : ${exception}`,
    );
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
  return await SqlMapper.MapProductDetailsList(scrapeDetails);
}

export async function GetAllRepriceEligibleProductByChannelId(channelId: any) {
  let scrapeDetails = null;
  const db = await SqlConnectionPool.getConnection();
  try {
    const queryToCall = `CALL ${applicationConfig.SQL_SP_GET_PRODUCT_BY_CHANNEL_ID}(?)`;
    const [rows] = await db.query(queryToCall, [channelId]);
    if (rows != null && (rows as any)[0] != null) {
      scrapeDetails = (rows as any)[0];
    }
  } catch (exception) {
    console.log(
      `Exception while GetAllRepriceEligibleProductByChannelId : ${exception}`,
    );
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
  return await SqlMapper.MapProductDetailsList(scrapeDetails);
}
