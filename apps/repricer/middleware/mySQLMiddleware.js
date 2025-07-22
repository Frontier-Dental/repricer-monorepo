const SqlConnectionPool = require("../models/SqlModels/MySQLDb");
const SqlMapper = require("../Utility/Mapper/MySQLMapper");

module.exports.GetLatestRunInfo = async (
  noOfRecords,
  startDateTime,
  endDateTime,
) => {
  let runInfoDetails = null;
  const db = await SqlConnectionPool.getConnection();
  try {
    const queryToCall = `CALL ${process.env.SQL_SP_GETRUN_INFO}(?,?,?)`;
    runInfoDetails = await db.query(queryToCall, [
      noOfRecords,
      startDateTime,
      endDateTime,
    ]);
  } catch (exception) {
    console.log(`Exception while GetLatestRunInfo : ${exception}`);
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
  return runInfoDetails[0];
};

module.exports.GetLatestRunInfoForCron = async (
  noOfRecords,
  startDateTime,
  endDateTime,
  cronId,
) => {
  let runInfoDetails = null;
  const db = await SqlConnectionPool.getConnection();
  try {
    const queryToCall = `CALL ${process.env.SQL_SP_GETRUN_INFO_BY_CRON}(?,?,?,?)`;
    runInfoDetails = await db.query(queryToCall, [
      noOfRecords,
      startDateTime,
      endDateTime,
      cronId,
    ]);
  } catch (exception) {
    console.log(`Exception while GetLatestRunInfoForCron : ${exception}`);
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
  return runInfoDetails[0];
};

module.exports.GetNumberOfScrapeProducts = async () => {
  let noOfRecords = null;
  const db = await SqlConnectionPool.getConnection();
  try {
    const queryToCall = `select count (Id) from table_scrapeProductList;`;
    noOfRecords = await db.execute(queryToCall);
  } catch (exception) {
    console.log(`Exception while GetNumberOfScrapeProducts : ${exception}`);
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
  return noOfRecords[0][0]["count (Id)"];
};

module.exports.GetScrapeProductList = async (pageNumber, pageSize) => {
  let scrapeProductList = null;
  const db = await SqlConnectionPool.getConnection();
  try {
    const queryToCall = `CALL ${process.env.SQL_SP_GET_SCRAPEPRODUCT_DETAILS}(?,?)`;
    scrapeProductList = await db.query(queryToCall, [pageNumber, pageSize]);
  } catch (exception) {
    console.log(`Exception while GetScrapeProductList : ${exception}`);
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
  return scrapeProductList[0][0];
};

module.exports.GetScrapeProductListByFilter = async (
  filterText,
  pageSize,
  pageNumber,
) => {
  let scrapeProductList = null;
  const db = await SqlConnectionPool.getConnection();
  try {
    const queryToCall = `CALL ${process.env.SQL_SP_GET_SCRAPEPRODUCT_DETAILS_FILTER}(?,?, ?)`;
    scrapeProductList = await db.query(queryToCall, [
      pageSize,
      filterText,
      pageNumber,
    ]);
  } catch (exception) {
    console.log(`Exception while GetScrapeProductListByFilter : ${exception}`);
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
  return scrapeProductList[0][0];
};

module.exports.GetAllScrapeProductDetails = async () => {
  let scrapeProductList = null;
  const db = await SqlConnectionPool.getConnection();
  try {
    const queryToCall = `CALL ${process.env.SQL_SP_GET_ALL_SCRAPEPRODUCT_DETAILS}()`;
    scrapeProductList = await db.query(queryToCall);
  } catch (exception) {
    console.log(`Exception while GetAllScrapeProductDetails : ${exception}`);
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
  return scrapeProductList[0][0];
};

module.exports.UpsertProductDetails = async (payload) => {
  let upsertResult = null;
  const db = await SqlConnectionPool.getConnection();
  try {
    const queryToCall = `CALL ${process.env.SQL_SP_UPSERT_PRODUCT_DETAILS}(?,?,?,?,?,?,?,?)`;
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
  } catch (exception) {
    console.log(`Exception while GetAllScrapeProductDetails : ${exception}`);
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
  return upsertResult[0];
};

module.exports.DeleteScrapeProductById = async (mpId) => {
  let noOfRecords = null;
  const db = await SqlConnectionPool.getConnection();
  try {
    const queryToCall = `delete from  ${process.env.SQL_SCRAPEPRODUCTLIST} where MpId=${mpId}`;
    noOfRecords = await db.execute(queryToCall);
  } catch (exception) {
    console.log(`Exception while GetNumberOfScrapeProducts : ${exception}`);
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
  return noOfRecords;
};

module.exports.GetLastScrapeDetailsById = async (mpId) => {
  let scrapeDetails = null;
  const db = await SqlConnectionPool.getConnection();
  try {
    const queryToCall = `CALL ${process.env.SQL_SP_GETLASTSCRAPEDETAILSBYID}(?)`;
    scrapeDetails = await db.query(queryToCall, [mpId]);
  } catch (exception) {
    console.log(`Exception while GetLastScrapeDetailsById : ${exception}`);
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
  return scrapeDetails[0][0];
};

module.exports.UpsertVendorData = async (payload, vendorName) => {
  let upsertResult = null;
  const db = await SqlConnectionPool.getConnection();
  let contextSpName = null;
  switch (vendorName) {
    case "TRADENT":
      contextSpName = process.env.SQL_SP_UPSERT_TRADENT;
      break;
    case "FRONTIER":
      contextSpName = process.env.SQL_SP_UPSERT_FRONTIER;
      break;
    case "MVP":
      contextSpName = process.env.SQL_SP_UPSERT_MVP;
      break;
    case "TOPDENT":
      contextSpName = process.env.SQL_SP_UPSERT_TOPDENT;
      break;
    case "FIRSTDENT":
      contextSpName = process.env.SQL_SP_UPSERT_FIRSTDENT;
      break;
    default:
      break;
  }
  try {
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
    if (rows != null && rows[0] != null) {
      upsertResult = rows[0][0];
    }
  } catch (exception) {
    console.log(`Exception while UpsertVendorData : ${exception}`);
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
  if (upsertResult && upsertResult != null) {
    return upsertResult["updatedIdentifier"];
  } else return null;
};

module.exports.UpsertProductDetailsV2 = async (payload) => {
  let upsertResult = null;
  const db = await SqlConnectionPool.getConnection();
  try {
    const queryToCall = `CALL ${process.env.SQL_SP_UPSERT_PRODUCT_DETAILSV3}(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
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
  } catch (exception) {
    console.log(`Exception while UpsertProductDetailsV3 : ${exception}`);
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
  return upsertResult[0];
};

module.exports.GetCompleteProductDetails = async () => {
  let scrapeDetails = null;
  const db = await SqlConnectionPool.getConnection();
  try {
    const queryToCall = `CALL ${process.env.SQL_SP_GET_ALL_PRODUCT_DETAILS}()`;
    const [rows] = await db.query(queryToCall);
    if (rows != null && rows[0] != null) {
      scrapeDetails = rows[0];
    }
  } catch (exception) {
    console.log(`Exception while GetCompleteProductDetails : ${exception}`);
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
  return await SqlMapper.MapProductDetailsList(scrapeDetails);
};

module.exports.GetNumberOfRepriceEligibleProductCount = async () => {
  let noOfRecords = null;
  const db = await SqlConnectionPool.getConnection();
  try {
    const queryToCall = `SELECT 
    (select count(*) from table_scrapeProductList) - 
    (select count(*) from table_scrapeProductList where LinkedTradentDetailsInfo is null and LinkedFrontiersDetailsInfo is null and LinkedMvpDetailsInfo is null and LinkedTopDentDetailsInfo is null and LinkedFirstDentDetailsInfo is null) AS result`;
    noOfRecords = await db.execute(queryToCall);
  } catch (exception) {
    console.log(
      `Exception while GetNumberOfRepriceEligibleProductCount : ${exception}`,
    );
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
  return noOfRecords[0][0]["result"];
};

module.exports.GetAllRepriceEligibleProductByFilter = async (
  pageNumber,
  pageSize,
) => {
  let scrapeDetails = null;
  const db = await SqlConnectionPool.getConnection();
  try {
    const queryToCall = `CALL ${process.env.SQL_SP_GET_PRODUCT_LIST_BY_FILTERV2}(?,?)`;
    const [rows] = await db.query(queryToCall, [pageNumber, pageSize]);
    if (rows != null && rows[0] != null) {
      scrapeDetails = rows[0];
    }
  } catch (exception) {
    console.log(
      `Exception while GetAllRepriceEligibleProductByFilter : ${exception}`,
    );
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
  return await SqlMapper.MapProductDetailsList(scrapeDetails);
};

module.exports.GetAllRepriceEligibleProductByTag = async (filterTag) => {
  let scrapeDetails = null;
  const db = await SqlConnectionPool.getConnection();
  try {
    const queryToCall = `CALL ${process.env.SQL_SP_GET_PRODUCT_LIST_BY_TAGV2}(?)`;
    const [rows] = await db.query(queryToCall, [filterTag]);
    if (rows != null && rows[0] != null) {
      scrapeDetails = rows[0];
    }
  } catch (exception) {
    console.log(
      `Exception while GetAllRepriceEligibleProductByTag : ${exception}`,
    );
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
  return await SqlMapper.MapProductDetailsList(scrapeDetails);
};

module.exports.GetFullProductDetailsById = async (mpid) => {
  console.log("GetFullProductDetailsById", mpid);
  let scrapeDetails = null;
  const db = await SqlConnectionPool.getConnection();
  try {
    const queryToCall = `CALL ${process.env.SQL_SP_GET_FULL_PRODUCT_DETAILS_BY_ID}(?)`;
    const [rows] = await db.query(queryToCall, [mpid]);
    if (rows != null && rows[0] != null) {
      scrapeDetails = rows[0];
    }
  } catch (exception) {
    console.log(`Exception while GetFullProductDetailsById : ${exception}`);
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
  return await SqlMapper.MapProductDetailsList(scrapeDetails);
};

module.exports.UpdateVendorData = async (payload, vendorName) => {
  let upsertResult = null;
  const db = await SqlConnectionPool.getConnection();
  let contextSpName = null;
  switch (vendorName) {
    case "TRADENT":
      contextSpName = process.env.SQL_SP_UPDATE_TRADENT;
      break;
    case "FRONTIER":
      contextSpName = process.env.SQL_SP_UPDATE_FRONTIER;
      break;
    case "MVP":
      contextSpName = process.env.SQL_SP_UPDATE_MVP;
      break;
    case "FIRSTDENT":
      contextSpName = process.env.SQL_SP_UPDATE_FIRSTDENT;
      break;
    case "TOPDENT":
      contextSpName = process.env.SQL_SP_UPDATE_TOPDENT;
      break;
    default:
      break;
  }
  try {
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
    if (rows != null && rows[0] != null) {
      upsertResult = rows[0][0];
      console.log(
        `UPDATE_RESULT : ${payload.mpid} : ${JSON.stringify(upsertResult)}`,
      );
    }
  } catch (exception) {
    console.log(`Exception while UpdateVendorData : ${exception}`);
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
  if (upsertResult && upsertResult != null) {
    return upsertResult["updatedIdentifier"];
  } else return null;
};

module.exports.GetLinkedVendorDetails = async (mpId, vendorName) => {
  try {
    let noOfRecords = null;
    const db = await SqlConnectionPool.getConnection();
    let tableName = null;
    if (vendorName == "TRADENT") {
      tableName = "table_tradentDetails";
    }
    if (vendorName == "FRONTIER") {
      tableName = "table_frontierDetails";
    }
    if (vendorName == "MVP") {
      tableName = "table_mvpDetails";
    }
    try {
      const queryToCall = `select Id from ${tableName} where MpId=${mpId}`;
      noOfRecords = await db.execute(queryToCall);
    } catch (exception) {
      console.log(`Exception while GetNumberOfScrapeProducts : ${exception}`);
    } finally {
      SqlConnectionPool.releaseConnection(db);
    }
    return noOfRecords[0][0]["Id"];
  } catch (exception) {
    return null;
  }
};

module.exports.UpdateProductV2 = async (mpid, itemData, tId, fId, mId) => {
  let noOfRecords = null;
  const db = await SqlConnectionPool.getConnection();
  let tableName = process.env.SQL_SCRAPEPRODUCTLIST;
  try {
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
  } catch (exception) {
    console.log(`Exception while GetNumberOfScrapeProducts : ${exception}`);
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
  return noOfRecords;
};

module.exports.ChangeProductActivation = async (mpid, status) => {
  let noOfRecords = null;
  const db = await SqlConnectionPool.getConnection();
  try {
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
  } catch (exception) {
    console.log(`Exception while ChangeProductActivation : ${exception}`);
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
  return noOfRecords;
};

module.exports.MapVendorToRoot = async (data) => {
  try {
    const traId = await this.GetLinkedVendorDetails(
      parseInt(data.MPID),
      "TRADENT",
    );
    const froId = await this.GetLinkedVendorDetails(
      parseInt(data.MPID),
      "FRONTIER",
    );
    const mvpId = await this.GetLinkedVendorDetails(parseInt(data.MPID), "MVP");
    let noOfRecords = null;
    const db = await SqlConnectionPool.getConnection();
    try {
      let queryToCall = `UPDATE ${process.env.SQL_SCRAPEPRODUCTLIST} SET `;
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
    } catch (exception) {
      console.log(`Exception while GetNumberOfScrapeProducts : ${exception}`);
    } finally {
      SqlConnectionPool.releaseConnection(db);
    }
    console.trace(noOfRecords[0][0]);
    return noOfRecords[0][0];
  } catch (exception) {
    return null;
  }
};

module.exports.ToggleDataScrapeForId = async (mpid, status, auditInfo) => {
  let noOfRecords = null;
  const db = await SqlConnectionPool.getConnection();
  try {
    let queryToCall = `update ${process.env.SQL_SCRAPEPRODUCTLIST} set IsActive=?,LastUpdatedBy=?,LastUpdatedAt=? where MpId=?`;
    noOfRecords = await db.execute(queryToCall, [
      status,
      auditInfo.UpdatedBy,
      auditInfo.UpdatedOn,
      parseInt(mpid),
    ]);
    console.log(
      `Updated in DB for ${mpid} with records ${JSON.stringify(noOfRecords)}`,
    );
  } catch (exception) {
    console.log(`Exception while ToggleDataScrapeForId : ${exception}`);
  } finally {
    SqlConnectionPool.releaseConnection(db);
  }
  return noOfRecords;
};

module.exports.UpdateBranchDataForVendor = async (
  mpId,
  vendorName,
  payLoad,
) => {
  try {
    let noOfRecords = null;
    const db = await SqlConnectionPool.getConnection();
    let tableName = null;
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
    try {
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
    } catch (exception) {
      console.log(`Exception while UpdateBranchDataForVendor : ${exception}`);
    } finally {
      SqlConnectionPool.releaseConnection(db);
    }
    return noOfRecords[0][0];
  } catch (exception) {
    return null;
  }
};

module.exports.ExecuteQuery = async (_query, _params) => {
  try {
    let noOfRecords = null;
    const db = await SqlConnectionPool.getConnection();
    try {
      [noOfRecords] = await db.execute(_query, _params);
    } catch (exception) {
      console.log(`Exception while ExecuteQuery : ${exception}`);
    } finally {
      SqlConnectionPool.releaseConnection(db);
    }
    return noOfRecords;
  } catch (exception) {
    return null;
  }
};
