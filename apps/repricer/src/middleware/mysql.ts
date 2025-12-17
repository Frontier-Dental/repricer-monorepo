import SqlConnectionPool from "../models/sql-models/mysql-db";
import * as SqlMapper from "../utility/mapper/mysql-mapper";
import { applicationConfig } from "../utility/config";
import { getKnexInstance } from "../services/knex-wrapper";

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
  const db = await SqlConnectionPool.getConnection();
  try {
    const queryToCall = `select count (Id) from table_scrapeProductList;`;
    const noOfRecords = await db.execute(queryToCall);
    return (noOfRecords[0] as any)[0]["count (Id)"];
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
}

export async function GetScrapeProductList(pageNumber: any, pageSize: any) {
  const db = await SqlConnectionPool.getConnection();
  try {
    const queryToCall = `CALL ${applicationConfig.SQL_SP_GET_SCRAPEPRODUCT_DETAILS}(?,?)`;
    const scrapeProductList = await db.query(queryToCall, [
      pageNumber,
      pageSize,
    ]);
    return (scrapeProductList[0] as any)[0];
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
}

export async function GetScrapeProductListByFilter(
  filterText: any,
  pageSize: any,
  pageNumber: any,
) {
  const db = await SqlConnectionPool.getConnection();
  try {
    const queryToCall = `CALL ${applicationConfig.SQL_SP_GET_SCRAPEPRODUCT_DETAILS_FILTER}(?,?, ?)`;
    const scrapeProductList = await db.query(queryToCall, [
      pageSize,
      filterText,
      pageNumber,
    ]);
    return (scrapeProductList[0] as any)[0];
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
}

export async function GetAllScrapeProductDetails() {
  const db = await SqlConnectionPool.getConnection();
  try {
    const queryToCall = `CALL ${applicationConfig.SQL_SP_GET_ALL_SCRAPEPRODUCT_DETAILS}()`;
    const scrapeProductList = await db.query(queryToCall);
    return (scrapeProductList[0] as any)[0];
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
}

export async function UpsertProductDetails(payload: any) {
  const db = await SqlConnectionPool.getConnection();
  try {
    const queryToCall = `CALL ${applicationConfig.SQL_SP_UPSERT_PRODUCT_DETAILS}(?,?,?,?,?,?,?,?)`;
    const upsertResult = await db.query(queryToCall, [
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
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
}

export async function DeleteScrapeProductById(mpId: any) {
  const db = await SqlConnectionPool.getConnection();
  try {
    const queryToCall = `delete from  ${applicationConfig.SQL_SCRAPEPRODUCTLIST} where MpId=${mpId}`;
    const noOfRecords = await db.execute(queryToCall);
    return noOfRecords;
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
}

export async function GetLastScrapeDetailsById(mpId: any) {
  const db = await SqlConnectionPool.getConnection();
  try {
    const queryToCall = `CALL ${applicationConfig.SQL_SP_GETLASTSCRAPEDETAILSBYID}(?)`;
    const scrapeDetails = await db.query(queryToCall, [mpId]);
    return (scrapeDetails[0] as any)[0];
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
}

export async function UpsertVendorData(payload: any, vendorName: any) {
  const db = await SqlConnectionPool.getConnection();
  try {
    let upsertResult: any = null;
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
      case "TRIAD":
        contextSpName = applicationConfig.SQL_SP_UPSERT_TRIAD;
        break;
      case "BITESUPPLY":
        contextSpName = applicationConfig.SQL_SP_UPSERT_BITESUPPLY;
        break;
      default:
        break;
    }
    if (
      !payload.inventoryThreshold ||
      payload.inventoryThreshold == null ||
      payload.inventoryThreshold == ""
    ) {
      payload.inventoryThreshold = 0;
    }
    if (
      !payload.percentageDown ||
      payload.percentageDown == null ||
      payload.percentageDown == ""
    ) {
      payload.percentageDown = 0;
    }
    if (
      !payload.badgePercentageDown ||
      payload.badgePercentageDown == null ||
      payload.badgePercentageDown == ""
    ) {
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
    if (
      payload.ownVendorThreshold === undefined ||
      payload.ownVendorThreshold === null ||
      payload.ownVendorThreshold === ""
    ) {
      payload.ownVendorThreshold = 1;
    }
    if (
      typeof payload.getBBBadge == "undefined" ||
      payload.getBBBadge == null
    ) {
      payload.getBBBadge = true;
    }
    if (
      typeof payload.getBBShipping == "undefined" ||
      payload.getBBShipping == null
    ) {
      payload.getBBShipping = true;
    }
    if (
      payload.getBBBadgeValue === undefined ||
      payload.getBBBadgeValue === null ||
      payload.getBBBadgeValue === ""
    ) {
      payload.getBBBadgeValue = 0.1;
    }
    if (
      payload.getBBShippingValue === undefined ||
      payload.getBBShippingValue === null ||
      payload.getBBShippingValue === ""
    ) {
      payload.getBBShippingValue = 0.005;
    }

    const queryToCall = `CALL ${contextSpName}(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
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
      payload.getBBBadge,
      payload.getBBShipping,
      parseFloat(payload.getBBBadgeValue),
      parseFloat(payload.getBBShippingValue),
    ]);
    if (rows != null && (rows as any)[0] != null) {
      upsertResult = (rows as any)[0][0];
    }
    if (upsertResult && upsertResult != null) {
      return upsertResult["updatedIdentifier"];
    } else return null;
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
}

export async function UpsertProductDetailsV2(payload: any) {
  const db = await SqlConnectionPool.getConnection();
  try {
    const queryToCall = `CALL ${applicationConfig.SQL_SP_UPSERT_PRODUCT_DETAILSV4}(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const slowCronId =
      payload.IsSlowActivated == true ? payload.SlowCronId : null;
    const slowCronName =
      payload.IsSlowActivated == true ? payload.SlowCronName : null;

    const upsertResult = await db.query(queryToCall, [
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
      slowCronName,
      slowCronId,
      payload.LinkedTradentDetailsInfo,
      payload.LinkedFrontiersDetailsInfo,
      payload.LinkedMvpDetailsInfo,
      payload.isSlowActivated,
      payload.IsBadgeItem,
      payload.LinkedTopDentDetailsInfo,
      payload.LinkedFirstDentDetailsInfo,
      payload.LinkedTriadDetailsInfo,
      payload.LinkedBiteSupplyDetailsInfo,
    ]);
    return upsertResult[0];
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
}

export async function GetCompleteProductDetails() {
  const db = await SqlConnectionPool.getConnection();
  try {
    let scrapeDetails: any = null;
    const queryToCall = `CALL ${applicationConfig.SQL_SP_GET_ALL_PRODUCT_DETAILS}()`;
    const [rows] = await db.query(queryToCall);
    if (rows != null && (rows as any)[0] != null) {
      scrapeDetails = (rows as any)[0];
    }
    return await SqlMapper.MapProductDetailsList(scrapeDetails);
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
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
  const db = await SqlConnectionPool.getConnection();
  try {
    let scrapeDetails: any = null;
    const queryToCall = `CALL ${applicationConfig.SQL_SP_GET_PRODUCT_LIST_BY_FILTERV2}(?,?)`;
    const [rows] = await db.query(queryToCall, [pageNumber, pageSize]);
    if (rows != null && (rows as any)[0] != null) {
      scrapeDetails = (rows as any)[0];
    }
    return await SqlMapper.MapProductDetailsList(scrapeDetails);
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
}

export async function GetAllRepriceEligibleProductByTag(filterTag: any) {
  const db = await SqlConnectionPool.getConnection();
  try {
    let scrapeDetails: any = null;
    const queryToCall = `CALL ${applicationConfig.SQL_SP_GET_PRODUCT_LIST_BY_TAGV2}(?)`;
    const [rows] = await db.query(queryToCall, [filterTag]);
    if (rows != null && (rows as any)[0] != null) {
      scrapeDetails = (rows as any)[0];
    }
    return await SqlMapper.MapProductDetailsList(scrapeDetails);
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
}

export async function GetFullProductDetailsById(mpid: any) {
  const db = await SqlConnectionPool.getConnection();
  try {
    let scrapeDetails: any = null;
    const queryToCall = `CALL ${applicationConfig.SQL_SP_GET_FULL_PRODUCT_DETAILS_BY_ID}(?)`;
    const [rows] = await db.query(queryToCall, [mpid]);
    if (rows != null && (rows as any)[0] != null) {
      scrapeDetails = (rows as any)[0];
    }
    return await SqlMapper.MapProductDetailsList(scrapeDetails);
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
}

export async function UpdateVendorData(payload: any, vendorName: any) {
  const db = await SqlConnectionPool.getConnection();
  try {
    let upsertResult: any = null;
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
      case "TRIAD":
        contextSpName = applicationConfig.SQL_SP_UPDATE_TRIAD;
        break;
      case "BITESUPPLY":
        contextSpName = applicationConfig.SQL_SP_UPDATE_BITESUPPLY;
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
    if (
      payload.ownVendorThreshold === undefined ||
      payload.ownVendorThreshold === null ||
      payload.ownVendorThreshold === ""
    ) {
      payload.ownVendorThreshold = 1;
    }
    if (
      typeof payload.getBBBadge == "undefined" ||
      payload.getBBBadge == null
    ) {
      payload.getBBBadge = true;
    }
    if (
      typeof payload.getBBShipping == "undefined" ||
      payload.getBBShipping == null
    ) {
      payload.getBBShipping = true;
    }
    if (
      payload.getBBBadgeValue === undefined ||
      payload.getBBBadgeValue === null ||
      payload.getBBBadgeValue === ""
    ) {
      payload.getBBBadgeValue = 0.1;
    }
    if (
      payload.getBBShippingValue === undefined ||
      payload.getBBShippingValue === null ||
      payload.getBBShippingValue === ""
    ) {
      payload.getBBShippingValue = 0.005;
    }

    const queryToCall = `CALL ${contextSpName}(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

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
      parseInt(payload.inventoryThreshold),
      parseFloat(payload.percentageDown),
      parseFloat(payload.badgePercentageDown),
      payload.competeWithNext,
      payload.ignorePhantomQBreak,
      parseInt(payload.ownVendorThreshold),
      payload.getBBBadge,
      payload.getBBShipping,
      parseFloat(payload.getBBBadgeValue),
      parseFloat(payload.getBBShippingValue),
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
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
}

export async function GetLinkedVendorDetails(mpId: any, vendorName: any) {
  const db = await SqlConnectionPool.getConnection();
  try {
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
    if (vendorName == "TRIAD") {
      tableName = "table_triadDetails";
    }

    const queryToCall = `select Id from ${tableName} where MpId=${mpId}`;
    const noOfRecords = await db.execute(queryToCall);
    return (noOfRecords[0] as any)[0]["Id"];
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
}

export async function UpdateProductV2(
  mpid: any,
  itemData: any,
  tId: any,
  fId: any,
  mId: any,
) {
  const db = await SqlConnectionPool.getConnection();
  try {
    let tableName = applicationConfig.SQL_SCRAPEPRODUCTLIST;
    const queryToCall = `update ${tableName} set RegularCronName=?,RegularCronId=?,SlowCronName=?,SlowCronId=?,LinkedTradentDetailsInfo=?,LinkedFrontiersDetailsInfo=?,LinkedMvpDetailsInfo=?,IsSlowActivated=? where MpId=?`;
    const noOfRecords = await db.execute(queryToCall, [
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
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
}

export async function ChangeProductActivation(mpid: any, status: any) {
  const db = await SqlConnectionPool.getConnection();
  try {
    let noOfRecords: any = null;
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
    queryToCall = `update table_triadDetails set Activated=? where MpId=?`;
    noOfRecords = await db.execute(queryToCall, [status, parseInt(mpid)]);
    console.log(
      `Updated in DB for ${mpid} with records ${JSON.stringify(noOfRecords)}`,
    );

    return noOfRecords;
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
}

export async function MapVendorToRoot(data: any) {
  const traId = await GetLinkedVendorDetails(parseInt(data.MPID), "TRADENT");
  const froId = await GetLinkedVendorDetails(parseInt(data.MPID), "FRONTIER");
  const mvpId = await GetLinkedVendorDetails(parseInt(data.MPID), "MVP");
  const triId = await GetLinkedVendorDetails(parseInt(data.MPID), "TRIAD");
  const biteSupplyId = await GetLinkedVendorDetails(
    parseInt(data.MPID),
    "BITESUPPLY",
  );
  const db = await SqlConnectionPool.getConnection();
  try {
    let queryToCall = `UPDATE ${applicationConfig.SQL_SCRAPEPRODUCTLIST} SET `;
    queryToCall += `LinkedTradentDetailsInfo = ?, `;
    queryToCall += `LinkedFrontiersDetailsInfo = ?, `;
    queryToCall += `LinkedMvpDetailsInfo = ?, `;
    queryToCall += `LinkedTriadDetailsInfo = ?, `;
    queryToCall += `LinkedBiteSupplyDetailsInfo = ?, `;
    queryToCall += `RegularCronName = ?, `;
    queryToCall += `RegularCronId = ? `;
    queryToCall += `WHERE MpId = ?`;
    const noOfRecords = await db.execute(queryToCall, [
      traId,
      froId,
      mvpId,
      triId,
      biteSupplyId,
      data.CronName.trim(),
      data.CronId,
      parseInt(data.MPID),
    ]);
    console.trace((noOfRecords[0] as any)[0]);
    return (noOfRecords[0] as any)[0];
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
}

export async function ToggleDataScrapeForId(
  mpid: any,
  status: any,
  auditInfo: any,
) {
  const db = await SqlConnectionPool.getConnection();
  try {
    let queryToCall = `update ${applicationConfig.SQL_SCRAPEPRODUCTLIST} set IsActive=?,LastUpdatedBy=?,LastUpdatedAt=? where MpId=?`;
    const noOfRecords = await db.execute(queryToCall, [
      status,
      auditInfo.UpdatedBy,
      auditInfo.UpdatedOn,
      parseInt(mpid),
    ]);
    console.log(
      `Updated in DB for ${mpid} with records ${JSON.stringify(noOfRecords)}`,
    );
    return noOfRecords;
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
}

export async function UpdateBranchDataForVendor(
  mpId: any,
  vendorName: any,
  payLoad: any,
) {
  const db = await SqlConnectionPool.getConnection();
  try {
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
    if (vendorName == "TRIAD") {
      tableName = "table_triadDetails";
    }

    const queryToCall = `Update ${tableName} set Activated=?,ChannelId=?,IsNCNeeded=?,BadgeIndicator=?,RepricingRule=?,FloorPrice=?,MaxPrice=?,UnitPrice=? where MpId=?`;
    const noOfRecords = await db.execute(queryToCall, [
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
    return (noOfRecords[0] as any)[0];
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
}

export async function ExecuteQuery(_query: any, _params: any) {
  const db = await SqlConnectionPool.getConnection();
  try {
    return await db.execute(_query, _params);
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
}
