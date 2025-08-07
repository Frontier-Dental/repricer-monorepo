import excelJs from "exceljs";
import { Request, Response } from "express";
import _ from "lodash";
import moment from "moment";
import * as httpHelper from "../middleware/http-wrappers";
import * as mapper from "../middleware/mapper-helper";
import * as mongoMiddleware from "../middleware/mongo";
import * as mySqlHelper from "../middleware/mysql";
import * as productHelper from "../middleware/product-helper";
import apiMapping from "../../resources/apiMapping.json";
import badgeResx from "../../resources/badgeIndicatorMapping.json";
import handlingTimeGroupResx from "../../resources/HandlingTimeFilterMapping.json";
import * as SessionHelper from "../utility/session-helper";
import { applicationConfig } from "../utility/config";
import axios from "axios";

export async function showAllProducts(req: Request, res: Response) {
  let pgNo = 0;
  if (req.query.pgno) {
    pgNo = (req.query.pgno as any) - 1;
  }
  let pageSize = 0,
    pageNumber = 0,
    totalDocs = 0,
    totalPages = 0;
  pageSize = applicationConfig.CRON_PAGESIZE;
  pageNumber = pgNo || 0;
  totalDocs = await mySqlHelper.GetNumberOfRepriceEligibleProductCount();
  totalPages = Math.ceil(totalDocs / pageSize);
  let masterItems: any[] = [];
  if (req.query.tags) {
    masterItems = await mySqlHelper.GetAllRepriceEligibleProductByTag(
      req.query.tags,
    );
    totalDocs = masterItems.length;
    masterItems = spliceResult(masterItems, pageNumber, pageSize);
  } else {
    masterItems = await mySqlHelper.GetAllRepriceEligibleProductByFilter(
      pageNumber,
      pageSize,
    );
  }
  //let cronSettings = await mongoMiddleware.GetCronSettingsList();
  //const slowCronSettings = await mongoMiddleware.GetSlowCronDetails();
  //cronSettings = _.concat(cronSettings, slowCronSettings);
  if (masterItems && masterItems.length > 0) {
    for (let prod of masterItems) {
      prod = mapper.MapBadgeIndicator(prod);
      //prod = await mapper.MapCronName(prod, cronSettings);
    }
  }
  const productDetailsViewModel = mapper.MapV2(masterItems);

  res.render("pages/products/get_all", {
    items: productDetailsViewModel,
    pageNumber,
    pageSize,
    totalDocs,
    totalPages,
    tags: req.query.tags || "",
    groupName: "Products",
    userRole: (req as any).session.users_id?.userRole,
  });
}

// Cache for products data
let productsCache: any[] | null = null;
let productsCacheTime: Date | null = null;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

export async function getAllProductsForCron(
  req: Request<{ cronName: string }>,
  res: Response,
) {
  const ignoreCache = req.query.ignoreCache === "true";
  const now = new Date();

  // Check if we should use cache
  if (!ignoreCache && productsCache && productsCacheTime) {
    const cacheAge = now.getTime() - productsCacheTime.getTime();
    if (cacheAge < CACHE_DURATION) {
      console.log(
        `Returning cached products data (age: ${Math.round(cacheAge / 1000)}s)`,
      );
      return res.json({
        data: productsCache,
        cacheTimestamp: productsCacheTime.toISOString(),
        isCached: true,
      });
    }
  }

  console.log("Fetching fresh products data from database...");
  const result = await mySqlHelper.getAllProductDetails();

  // Update cache
  productsCache = result;
  productsCacheTime = now;

  console.log(`Updated products cache with ${result.length} records`);
  return res.json({
    data: result,
    cacheTimestamp: now.toISOString(),
    isCached: false,
  });
}

export async function getV2AlgoExecutionByProductId(
  req: Request<{ mpId: string }>,
  res: Response,
) {
  const mpId = parseInt(req.params.mpId);
  if (isNaN(mpId)) {
    return res.status(400).json({
      status: false,
      message: "Invalid product ID. Must be a valid number.",
    });
  }

  const algoResult = await mySqlHelper.getV2AlgoExecutionByScrapeProductId(
    mpId,
    10,
  );

  return res.json({
    status: true,
    data: algoResult,
    message: `Found ${algoResult.length} algorithm execution records for MP ID ${mpId}`,
  });
}

export async function getProductDetailsByProductId(
  req: Request<{ mpId: string }>,
  res: Response,
) {
  const mpId = parseInt(req.params.mpId);
  if (isNaN(mpId)) {
    return res.status(400).json({
      status: false,
      message: "Invalid product ID. Must be a valid number.",
    });
  }

  const productDetails =
    await mySqlHelper.getFullProductDetailsByProductId(mpId);

  return res.json({
    status: true,
    data: productDetails,
    message: `Found ${productDetails.length} product detail records for MP ID ${mpId}`,
  });
}

export async function collateProducts(req: Request, res: Response) {
  const _urlForActiveTradentProducts = apiMapping.find(
    (x) => x.vendorId == "17357",
  )!.activeListUrl;
  const tradentActiveProducts = await httpHelper.native_get(
    _urlForActiveTradentProducts,
  );
  if (
    tradentActiveProducts &&
    tradentActiveProducts.data &&
    tradentActiveProducts.data.productList.length > 0
  ) {
    productHelper.LoadProducts(tradentActiveProducts.data.productList);
  }
  return res.json({
    status: true,
    message: `Products collating started at ${new Date()}`,
  });
}

export async function editItemView(req: Request, res: Response) {
  const mpid = req.params.mpid;
  let productDetails = await mySqlHelper.GetFullProductDetailsById(mpid); // await mongoMiddleware.FindProductById(mpid);
  let cronSettingsResponse = await mongoMiddleware.GetCronSettingsList();
  const slowCronSettings = await mongoMiddleware.GetSlowCronDetails();
  cronSettingsResponse = _.concat(cronSettingsResponse, slowCronSettings);
  _.first(productDetails).cronSettings = cronSettingsResponse.filter(
    (x: any) => x.IsHidden != true,
  );
  _.first(productDetails).scrapeOnlyCrons =
    await mongoMiddleware.GetScrapeCrons();

  res.render("pages/products/index", {
    model: _.first(productDetails),
    groupName: "Products",
    userRole: (req as any).session.users_id.userRole,
  });
}

export async function updateProductDetails(req: Request, res: Response) {
  var details = req.body;
  //const scrapeOnlyCronSettings = await mongoMiddleware.GetScrapeCrons();
  let cronSettingsResponse = await mongoMiddleware.GetCronSettingsList();
  const slowCronSettingsResponse = await mongoMiddleware.GetSlowCronDetails();
  cronSettingsResponse = _.concat(
    cronSettingsResponse,
    slowCronSettingsResponse,
  );
  let productDetails = _.first(
    await mySqlHelper.GetFullProductDetailsById(details.mpid),
  ); //await mongoMiddleware.FindProductById(details.mpid);
  if (details.channel_name.toUpperCase() == "TRADENT") {
    productDetails.tradentDetails = await mapper.MapUserResponse(
      productDetails.tradentDetails,
      details,
      cronSettingsResponse,
    );
    productDetails.tradentDetails.isScrapeOnlyActivated =
      productDetails.isScrapeOnlyActivated;
    productDetails.tradentDetails.scrapeOnlyCronId =
      productDetails.scrapeOnlyCronId;
    productDetails.tradentDetails.scrapeOnlyCronName =
      productDetails.scrapeOnlyCronName;
    productDetails.tradentDetails.isBadgeItem = productDetails.isBadgeItem;
    productDetails.frontierDetails = null;
    productDetails.mvpDetails = null;
    productDetails.firstDentDetails = null;
    productDetails.topDentDetails = null;
  }
  if (details.channel_name.toUpperCase() == "FRONTIER") {
    productDetails.frontierDetails = await mapper.MapUserResponse(
      productDetails.frontierDetails,
      details,
      cronSettingsResponse,
    );
    productDetails.frontierDetails.isScrapeOnlyActivated =
      productDetails.isScrapeOnlyActivated;
    productDetails.frontierDetails.scrapeOnlyCronId =
      productDetails.scrapeOnlyCronId;
    productDetails.frontierDetails.scrapeOnlyCronName =
      productDetails.scrapeOnlyCronName;
    productDetails.frontierDetails.isBadgeItem = productDetails.isBadgeItem;
    productDetails.tradentDetails = null;
    productDetails.mvpDetails = null;
    productDetails.firstDentDetails = null;
    productDetails.topDentDetails = null;
  }
  if (details.channel_name.toUpperCase() == "MVP") {
    productDetails.mvpDetails = await mapper.MapUserResponse(
      productDetails.mvpDetails,
      details,
      cronSettingsResponse,
    );
    productDetails.mvpDetails.isScrapeOnlyActivated =
      productDetails.isScrapeOnlyActivated;
    productDetails.mvpDetails.scrapeOnlyCronId =
      productDetails.scrapeOnlyCronId;
    productDetails.mvpDetails.scrapeOnlyCronName =
      productDetails.scrapeOnlyCronName;
    productDetails.mvpDetails.isBadgeItem = productDetails.isBadgeItem;
    productDetails.frontierDetails = null;
    productDetails.tradentDetails = null;
    productDetails.firstDentDetails = null;
    productDetails.topDentDetails = null;
  }
  if (details.channel_name.toUpperCase() == "FIRSTDENT") {
    productDetails.firstDentDetails = await mapper.MapUserResponse(
      productDetails.firstDentDetails,
      details,
      cronSettingsResponse,
    );
    productDetails.firstDentDetails.isScrapeOnlyActivated =
      productDetails.isScrapeOnlyActivated;
    productDetails.firstDentDetails.scrapeOnlyCronId =
      productDetails.scrapeOnlyCronId;
    productDetails.firstDentDetails.scrapeOnlyCronName =
      productDetails.scrapeOnlyCronName;
    productDetails.firstDentDetails.isBadgeItem = productDetails.isBadgeItem;
    productDetails.frontierDetails = null;
    productDetails.tradentDetails = null;
    productDetails.mvpDetails = null;
    productDetails.topDentDetails = null;
  }
  if (details.channel_name.toUpperCase() == "TOPDENT") {
    productDetails.topDentDetails = await mapper.MapUserResponse(
      productDetails.topDentDetails,
      details,
      cronSettingsResponse,
    );
    productDetails.topDentDetails.isScrapeOnlyActivated =
      productDetails.isScrapeOnlyActivated;
    productDetails.topDentDetails.scrapeOnlyCronId =
      productDetails.scrapeOnlyCronId;
    productDetails.topDentDetails.scrapeOnlyCronName =
      productDetails.scrapeOnlyCronName;
    productDetails.topDentDetails.isBadgeItem = productDetails.isBadgeItem;
    productDetails.frontierDetails = null;
    productDetails.tradentDetails = null;
    productDetails.mvpDetails = null;
    productDetails.firstDentDetails = null;
  }

  await mapper.UpsertProductDetailsInSql(productDetails, details.mpid, req); //await mongoMiddleware.InsertOrUpdateProduct(_.first(productDetails), req);
  return res.json({
    status: true,
    message: `Products updated successfully!`,
  });
}

export async function collateProductsForId(req: Request, res: Response) {
  const mpid = req.params.id;
  await productHelper.LoadProducts([mpid.trim()]);
  return res.json({
    status: true,
    message: `Products collating & loaded for MPID : ${mpid} at ${new Date()}`,
  });
}

export async function addItems(req: Request, res: Response) {
  let productDetails: any = {
    tradentDetails: null,
    frontierDetails: null,
    mvpDetails: null,
    topDentDetails: null,
    firstDentDetails: null,
  };
  let cronSettingsResponse = await mongoMiddleware.GetCronSettingsList();
  const slowCronSettings = await mongoMiddleware.GetSlowCronDetails();
  cronSettingsResponse = _.concat(cronSettingsResponse, slowCronSettings);
  productDetails.cronSettings = cronSettingsResponse.filter(
    (x: any) => x.IsHidden != true,
  );
  productDetails.slowCrons = slowCronSettings.filter(
    (x: any) => x.IsHidden != true,
  );
  productDetails.scrapeOnlyCrons = await mongoMiddleware.GetScrapeCrons();
  res.render("pages/products/add", {
    model: productDetails,
    groupName: "item",
    userRole: (req as any).session.users_id.userRole,
  });
}

export async function addItemToDatabase(req: Request, res: Response) {
  var details = req.body;
  let productDetails: any = {};
  const scrapeOnlyCronSettings = await mongoMiddleware.GetScrapeCrons();
  if (details.tradentDetails && details.tradentDetails != null) {
    productDetails.tradentDetails = {};
    productDetails.tradentDetails = await mapper.MapFormData(
      productDetails.tradentDetails,
      details,
      details.tradentDetails,
    );
    productDetails.tradentDetails.isScrapeOnlyActivated =
      details.isScrapeOnlyActivated == "on" ? true : false;
    productDetails.tradentDetails.scrapeOnlyCronId = details.scrapeOnlyCron;
    productDetails.tradentDetails.scrapeOnlyCronName =
      scrapeOnlyCronSettings.find(
        (x: any) => (x.CronId = details.scrapeOnlyCron),
      ).CronName;
    productDetails.tradentDetails.isBadgeItem =
      details.isBadgeItem == "on" ? true : false;
  }
  if (details.frontierDetails && details.frontierDetails != null) {
    productDetails.frontierDetails = {};
    productDetails.frontierDetails = await mapper.MapFormData(
      productDetails.frontierDetails,
      details,
      details.frontierDetails,
    );
    productDetails.frontierDetails.isScrapeOnlyActivated =
      details.isScrapeOnlyActivated == "on" ? true : false;
    productDetails.frontierDetails.scrapeOnlyCronId = details.scrapeOnlyCron;
    productDetails.frontierDetails.scrapeOnlyCronName =
      scrapeOnlyCronSettings.find(
        (x: any) => (x.CronId = details.scrapeOnlyCron),
      ).CronName;
    productDetails.frontierDetails.isBadgeItem =
      details.isBadgeItem == "on" ? true : false;
  }
  if (details.mvpDetails && details.mvpDetails != null) {
    productDetails.mvpDetails = {};
    productDetails.mvpDetails = await mapper.MapFormData(
      productDetails.mvpDetails,
      details,
      details.mvpDetails,
    );
    productDetails.mvpDetails.isScrapeOnlyActivated =
      details.isScrapeOnlyActivated == "on" ? true : false;
    productDetails.mvpDetails.scrapeOnlyCronId = details.scrapeOnlyCron;
    productDetails.mvpDetails.scrapeOnlyCronName = scrapeOnlyCronSettings.find(
      (x: any) => (x.CronId = details.scrapeOnlyCron),
    ).CronName;
    productDetails.mvpDetails.isBadgeItem =
      details.isBadgeItem == "on" ? true : false;
  }
  if (details.firstDentDetails && details.firstDentDetails != null) {
    productDetails.firstDentDetails = {};
    productDetails.firstDentDetails = await mapper.MapFormData(
      productDetails.firstDentDetails,
      details,
      details.firstDentDetails,
    );
    productDetails.firstDentDetails.isScrapeOnlyActivated =
      details.isScrapeOnlyActivated == "on" ? true : false;
    productDetails.firstDentDetails.scrapeOnlyCronId = details.scrapeOnlyCron;
    productDetails.firstDentDetails.scrapeOnlyCronName =
      scrapeOnlyCronSettings.find(
        (x: any) => (x.CronId = details.scrapeOnlyCron),
      ).CronName;
    productDetails.firstDentDetails.isBadgeItem =
      details.isBadgeItem == "on" ? true : false;
  }
  if (details.topDentDetails && details.topDentDetails != null) {
    productDetails.topDentDetails = {};
    productDetails.topDentDetails = await mapper.MapFormData(
      productDetails.topDentDetails,
      details,
      details.topDentDetails,
    );
    productDetails.topDentDetails.isScrapeOnlyActivated =
      details.isScrapeOnlyActivated == "on" ? true : false;
    productDetails.topDentDetails.scrapeOnlyCronId = details.scrapeOnlyCron;
    productDetails.topDentDetails.scrapeOnlyCronName =
      scrapeOnlyCronSettings.find(
        (x: any) => (x.CronId = details.scrapeOnlyCron),
      ).CronName;
    productDetails.topDentDetails.isBadgeItem =
      details.isBadgeItem == "on" ? true : false;
  }
  await mapper.UpsertProductDetailsInSql(productDetails, details.mpid, req);
  return res.json({
    status: true,
    message: `Products added successfully!`,
  });
}

export async function simulateManualReprice(req: Request, res: Response) {
  const mpid = req.params.id;
  const manualRepriceUrl = `${applicationConfig.REPRICER_API_BASE_URL}${applicationConfig.SIMULATE_REPRICER_ENDPOINT}/${mpid.trim()}`;
  const repriceResult = await axios.post(manualRepriceUrl);

  // Extract HTML from the response
  const html = repriceResult.data.html;

  if (html) {
    // Set content type to HTML and send the HTML directly
    res.setHeader("Content-Type", "text/html");
    return res.send(html);
  } else {
    // Fallback to JSON if no HTML is available
    return res.json(repriceResult.data);
  }
}

export async function runManualReprice(req: Request, res: Response) {
  const selectedProducts = Array.isArray(req.body.mpIds)
    ? req.body.mpIds
    : [req.body.mpIds];
  let failedIds: any[] = [];
  if (selectedProducts && selectedProducts.length > 0) {
    for (const prod of selectedProducts) {
      const manualRepriceUrl = `${applicationConfig.REPRICER_API_BASE_URL}${applicationConfig.MANUAL_REPRICER_ENDPOINT}/${prod.trim()}`;
      const repriceResult = await httpHelper.native_get(manualRepriceUrl);
      if (
        repriceResult &&
        repriceResult.status == 200 &&
        repriceResult.data &&
        repriceResult.data.logId
      ) {
        console.log(
          "Manual Log with _id " +
            repriceResult.data.logId +
            ", added successfully",
        );
      } else {
        failedIds.push(prod.trim() as never);
      }
    }
  }
  if (failedIds.length > 0) {
    return res.json({
      status: false,
      message: `Manual Scrape Failed for the following Ids ${failedIds.join(",")}!!.Please try again.`,
    });
  } else
    return res.json({
      status: true,
      message: `Manual Scrape Done Successfully!`,
    });
}

export async function syncProductDetails(req: Request, res: Response) {
  const idx = req.params.id.trim();
  const vendorIdentifier = [
    "tradentDetails",
    "frontierDetails",
    "mvpDetails",
    "topDentDetails",
    "firstDentDetails",
  ];
  const productDetailsUrl = applicationConfig.PROD_SYNC_URL!.replace(
    "{productId}",
    idx,
  );
  const headers = {
    oprType: "DEV_SYNC",
    apiKey:
      "gMoRUrPRDdQVuDRPBzO3wo3rcSaSdhlqpi8vR2QMsrRtg2yvhotES0DLd60VR3YIlyEYfmybIa6Du5NM1UbzcG57jCPN9SZFDbI7GbmCZO2KSlR7fcnWYODoChyKA3jr",
  };
  const getProdResponse = await httpHelper.native_get_V2(
    productDetailsUrl,
    headers,
  );
  if (
    getProdResponse &&
    getProdResponse.data.message != null &&
    getProdResponse.data.message.length > 0
  ) {
    let productDetails: any = _.first(getProdResponse.data.message);
    for (const vId of vendorIdentifier) {
      if (productDetails[vId] != null) {
        productDetails[vId]["isScrapeOnlyActivated"] =
          productDetails.isScrapeOnlyActivated;
        productDetails[vId]["scrapeOnlyCronName"] =
          productDetails.scrapeOnlyCronName;
        productDetails[vId]["scrapeOnlyCronId"] =
          productDetails.scrapeOnlyCronId;
        productDetails[vId]["isSlowActivated"] = false;
        productDetails[vId]["isBadgeItem"] = productDetails.isBadgeItem;
      }
    }
    await mapper.UpsertProductDetailsInSql(
      _.first(getProdResponse.data.message),
      idx,
      req,
    );
  }
  return res.json({
    status: true,
    message: `Product ${idx} synced successfully!`,
  });
}

export async function runManualSyncOfProducts(req: Request, res: Response) {
  httpHelper.native_get(applicationConfig.MANUAL_PRODUCT_SYNC_PROCESS);
  return res.json({
    status: true,
    message: `Manual Product Details Sync has been started. Please wait for 15 minutes for the sync to be completed and retry after getting a confirmation email.`,
  });
}

export async function removeFrom422(req: Request, res: Response) {
  const selectedProducts = Array.isArray(req.body.mpIds)
    ? req.body.mpIds
    : [req.body.mpIds];

  if (selectedProducts && selectedProducts.length > 0) {
    await mongoMiddleware.Update422StatusById(
      parseInt(selectedProducts[0]),
      false,
    );
    return res.json({
      status: true,
      message: `Successfully removed ${selectedProducts[0]} from 422.`,
    });
  }
}

export async function removeFrom422ForAll(req: Request, res: Response) {
  await mongoMiddleware.Update422StatusById(null, true);
  return res.json({
    status: true,
    message: `Successfully removed all products from 422.`,
  });
}

export async function toggleDataScrape(req: Request, res: Response) {
  if (req.body.mpid) {
    const AuditInfo = await SessionHelper.GetAuditInfo(req);
    let activatedResponse = await mySqlHelper.ToggleDataScrapeForId(
      parseInt(req.body.mpid.trim()),
      JSON.parse(req.body.state),
      AuditInfo,
    );
    if (activatedResponse) {
      const returnState =
        JSON.parse(req.body.state) == true ? "activated" : "de-activated";
      return res.json({
        status: true,
        message: `${req.body.mpid} product ${returnState} successfully.`,
      });
    }
  } else {
    return res.json({
      status: true,
      message: "MpId is Missing",
    });
  }
}

export async function saveRootDetails(req: Request, res: Response) {
  const { mpid, rootDetailsForPayload } = req.body;
  const mpidTrimmed = mpid.trim();

  const regularCronSettingsDetails =
    await mongoMiddleware.GetCronSettingsList();
  const scrapeOnlyCronSettingsDetails = await mongoMiddleware.GetScrapeCrons();
  const linkedRegularCronName = regularCronSettingsDetails.find(
    (x: any) => x.CronId == rootDetailsForPayload.cronGroup,
  )?.CronName;
  const scrapeOnlyCronName = scrapeOnlyCronSettingsDetails.find(
    (x: any) => x.CronId == rootDetailsForPayload.scrapeOnlyCron,
  ).CronName;
  const query = `UPDATE ${applicationConfig.SQL_SCRAPEPRODUCTLIST} SET Net32Url=?,RegularCronId=?,RegularCronName=?,LinkedCronId=?,LinkedCronName=?,IsBadgeItem=?,IsActive=? WHERE MpId=?`;
  const params = [
    rootDetailsForPayload.net32Url,
    rootDetailsForPayload.cronGroup,
    linkedRegularCronName,
    rootDetailsForPayload.scrapeOnlyCron,
    scrapeOnlyCronName,
    JSON.parse(rootDetailsForPayload.isBadgeItem),
    JSON.parse(rootDetailsForPayload.isScrapeOnlyActivated),
    mpidTrimmed,
  ];
  await mySqlHelper.ExecuteQuery(query, params);
  return res.json({
    status: true,
    message: `${mpidTrimmed} saved successfully.`,
  });
}

export async function activateProductForAll(req: Request, res: Response) {
  if (req.body.mpid) {
    let activatedResponse = await mySqlHelper.ChangeProductActivation(
      parseInt(req.body.mpid.trim()),
      true,
    ); //await mongoMiddleware.ActivateProductModel(req.body.mpid.trim());
    if (activatedResponse) {
      return res.json({
        status: true,
        message: `${req.body.mpid} product activated successfully.`,
      });
    }
  } else {
    return res.json({
      status: true,
      message: "MpId is Missing",
    });
  }
}

export async function deActivateProductForAll(req: Request, res: Response) {
  if (req.body.mpid) {
    const removeItems = await mySqlHelper.ChangeProductActivation(
      parseInt(req.body.mpid.trim()),
      false,
    ); //await mongoMiddleware.DeactivateProductModel(req.body.mpid.trim());
    if (removeItems) {
      return res.json({
        status: true,
        message: `${req.body.mpid} product deactivated successfully.`,
      });
    }
  } else {
    return res.json({
      status: true,
      message: "MpId is Missing",
    });
  }
}

export async function saveBranches(req: Request, res: Response) {
  const mpidTrimmed = req.body.mpid.trim();
  const {
    mpid,
    tradentDetails,
    frontierDetails,
    mvpDetails,
    topDentDetails,
    firstDentDetails,
  } = req.body;

  // Ensure only specific missing detail objects are initialized without overwriting existing objects
  const existingProduct = _.first(
    await mySqlHelper.GetFullProductDetailsById(mpidTrimmed),
  ); //await mongoMiddleware.FindOneProductModel({ mpId: mpidTrimmed });

  const updateInitialization: any = {};
  if (
    !existingProduct.tradentDetails &&
    tradentDetails &&
    Object.keys(tradentDetails).length > 0
  ) {
    updateInitialization.tradentDetails = {};
  }
  if (
    !existingProduct.frontierDetails &&
    frontierDetails &&
    Object.keys(frontierDetails).length > 0
  ) {
    updateInitialization.frontierDetails = {};
  }
  if (
    !existingProduct.mvpDetails &&
    mvpDetails &&
    Object.keys(mvpDetails).length > 0
  ) {
    updateInitialization.mvpDetails = {};
  }
  if (
    !existingProduct.topDentDetails &&
    topDentDetails &&
    Object.keys(topDentDetails).length > 0
  ) {
    updateInitialization.topDentDetails = {};
  }
  if (
    !existingProduct.firstDentDetails &&
    firstDentDetails &&
    Object.keys(firstDentDetails).length > 0
  ) {
    updateInitialization.firstDentDetails = {};
  }

  // if (Object.keys(updateInitialization).length > 0) {
  //   await mongoMiddleware.UpdateProductModel(
  //     { mpId: mpidTrimmed },
  //     { $set: updateInitialization },
  //   );
  // }

  // Build specific field updates for existing detail objects
  let updateData: any = {};

  // Only update non-null fields for each branch if they have data
  if (tradentDetails && Object.keys(tradentDetails).length > 0) {
    updateData[`tradentDetails`] = {};
    for (const key in tradentDetails) {
      if (tradentDetails[key] !== null && tradentDetails[key] !== undefined) {
        updateData[`tradentDetails`][`${key}`] = tradentDetails[key];
      }
    }
    await mySqlHelper.UpdateBranchDataForVendor(
      mpidTrimmed,
      "TRADENT",
      updateData["tradentDetails"],
    );
  }

  if (frontierDetails && Object.keys(frontierDetails).length > 0) {
    updateData[`frontierDetails`] = {};
    for (const key in frontierDetails) {
      if (frontierDetails[key] !== null && frontierDetails[key] !== undefined) {
        updateData[`frontierDetails`][`${key}`] = frontierDetails[key];
      }
    }
    await mySqlHelper.UpdateBranchDataForVendor(
      mpidTrimmed,
      "FRONTIER",
      updateData["frontierDetails"],
    );
  }

  if (mvpDetails && Object.keys(mvpDetails).length > 0) {
    updateData[`mvpDetails`] = {};
    for (const key in mvpDetails) {
      if (mvpDetails[key] !== null && mvpDetails[key] !== undefined) {
        updateData[`mvpDetails`][`${key}`] = mvpDetails[key];
      }
    }
    await mySqlHelper.UpdateBranchDataForVendor(
      mpidTrimmed,
      "MVP",
      updateData["mvpDetails"],
    );
  }
  if (topDentDetails && Object.keys(topDentDetails).length > 0) {
    updateData[`topDentDetails`] = {};
    for (const key in topDentDetails) {
      if (topDentDetails[key] !== null && topDentDetails[key] !== undefined) {
        updateData[`topDentDetails`][`${key}`] = topDentDetails[key];
      }
    }
    await mySqlHelper.UpdateBranchDataForVendor(
      mpidTrimmed,
      "TOPDENT",
      updateData["topDentDetails"],
    );
  }
  if (firstDentDetails && Object.keys(firstDentDetails).length > 0) {
    updateData[`firstDentDetails`] = {};
    for (const key in firstDentDetails) {
      if (
        firstDentDetails[key] !== null &&
        firstDentDetails[key] !== undefined
      ) {
        updateData[`firstDentDetails`][`${key}`] = firstDentDetails[key];
      }
    }
    await mySqlHelper.UpdateBranchDataForVendor(
      mpidTrimmed,
      "FIRSTDENT",
      updateData["firstDentDetails"],
    );
  }

  console.log(
    `Updating product with specific branch fields for MPID ${mpidTrimmed}:`,
    updateData,
  );

  // Apply the update with specific fields if there are any updates
  return res.json({
    status: true,
    message: `${mpidTrimmed} branches saved successfully.`,
  });
}

export async function updateToMax(req: Request, res: Response) {
  const selectedProducts = Array.isArray(req.body.mpIds)
    ? req.body.mpIds
    : [req.body.mpIds];
  let failedIds: any[] = [];
  if (selectedProducts && selectedProducts.length > 0) {
    for (const prod of selectedProducts) {
      const updateToMaxResponse = `${applicationConfig.REPRICER_API_BASE_URL}${applicationConfig.MAX_UPDATE_REPRICER_ENDPOINT}/${prod.trim()}`;
      const repriceResult = await httpHelper.native_get(updateToMaxResponse);
      if (
        repriceResult &&
        repriceResult.status == 200 &&
        repriceResult.data &&
        repriceResult.data.logId
      ) {
        console.log(
          "Manual Log with _id " +
            repriceResult.data.logId +
            ", added successfully",
        );
      } else {
        failedIds.push(prod.trim() as never);
      }
    }
  }
  if (failedIds.length > 0) {
    return res.json({
      status: false,
      message: `Update to Max Failed for the following Ids ${failedIds.join(",")} !!.Please try again.`,
    });
  } else
    return res.json({
      status: true,
      message: `Update to Max Done Successfully!`,
    });
}

/****** PRIVATE FUNCTIONS ******/
export async function exportItems(req: Request, res: Response) {
  //let ItemCollection = await mongoMiddleware.GetAllProductDetails();
  let ItemCollection = await mySqlHelper.GetCompleteProductDetails();
  const AllItems: any[] = [];
  ItemCollection.map((val) => {
    if (val.tradentDetails && val.tradentDetails != null) {
      val.tradentDetails.scrapeOnlyCronName = val.scrapeOnlyCronName;
      val.tradentDetails.isScrapeOnlyActivated = val.isScrapeOnlyActivated;
      val.tradentDetails.isBadgeItem = val.isBadgeItem;
      AllItems.push(val.tradentDetails);
    }
    if (val.frontierDetails && val.frontierDetails != null) {
      val.frontierDetails.scrapeOnlyCronName = val.scrapeOnlyCronName;
      val.frontierDetails.isScrapeOnlyActivated = val.isScrapeOnlyActivated;
      val.frontierDetails.isBadgeItem = val.isBadgeItem;
      AllItems.push(val.frontierDetails);
    }
    if (val.mvpDetails && val.mvpDetails != null) {
      val.mvpDetails.scrapeOnlyCronName = val.scrapeOnlyCronName;
      val.mvpDetails.isScrapeOnlyActivated = val.isScrapeOnlyActivated;
      val.mvpDetails.isBadgeItem = val.isBadgeItem;
      AllItems.push(val.mvpDetails);
    }
    if (val.topDentDetails && val.topDentDetails != null) {
      val.topDentDetails.scrapeOnlyCronName = val.scrapeOnlyCronName;
      val.topDentDetails.isScrapeOnlyActivated = val.isScrapeOnlyActivated;
      val.topDentDetails.isBadgeItem = val.isBadgeItem;
      AllItems.push(val.topDentDetails);
    }
    if (val.firstDentDetails && val.firstDentDetails != null) {
      val.firstDentDetails.scrapeOnlyCronName = val.scrapeOnlyCronName;
      val.firstDentDetails.isScrapeOnlyActivated = val.isScrapeOnlyActivated;
      val.firstDentDetails.isBadgeItem = val.isBadgeItem;
      AllItems.push(val.firstDentDetails);
    }
  });
  AllItems.forEach(($item) => {
    $item.lastCronTime = $item.last_cron_time
      ? moment($item.last_cron_time).format("YYYY-MM-DD HH:mm:ss")
      : $item.last_cron_time;
    $item.lastUpdateTime = $item.last_update_time
      ? moment($item.last_update_time).format("YYYY-MM-DD HH:mm:ss")
      : $item.last_update_time;
    $item.lastAttemptedTime = $item.last_attempted_time
      ? moment($item.last_attempted_time).format("YYYY-MM-DD HH:mm:ss")
      : $item.last_attempted_time;
    $item.nextCronTime = $item.next_cron_time
      ? moment($item.next_cron_time).format("YYYY-MM-DD HH:mm:ss")
      : $item.next_cron_time;
    $item.badge_indicator = parseBadgeIndicator($item.badgeIndicator, "KEY");
    $item.lastUpdatedOn = $item.lastUpdatedOn
      ? moment($item.lastUpdatedOn).format("YYYY-MM-DD HH:mm:ss")
      : null;
    //$item.lastUpdatedByUser = $item.AuditInfo ? $item.AuditInfo.UpdatedBy : null;
    $item.mpid = parseInt($item.mpid);
    $item.unitPrice = $item.unitPrice ? parseFloat($item.unitPrice) : null;
    $item.floorPrice = $item.floorPrice ? parseFloat($item.floorPrice) : null;
    $item.maxPrice = $item.maxPrice ? parseFloat($item.maxPrice) : null;
    $item.priority = $item.priority ? parseInt($item.priority) : null;
    $item.requestInterval = $item.requestInterval
      ? parseInt($item.requestInterval)
      : null;
    $item.override_bulk_rule = $item.override_bulk_rule
      ? parseInt($item.override_bulk_rule)
      : null;
    $item.lastExistingPrice = `${$item.lastExistingPrice} /`;
    $item.lastSuggestedPrice = `${$item.lastSuggestedPrice} /`;
    $item.lowest_vendor_price = `${$item.lowest_vendor_price} /`;
    $item.handling_time_filter = $item.handlingTimeFilter
      ? handlingTimeGroupResx.find((x) => x.key == $item.handlingTimeFilter)!
          .value
      : null;
  });

  const workbook = new excelJs.Workbook();
  let worksheet = workbook.addWorksheet("ItemList", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  worksheet.autoFilter = "A1:BE1";
  worksheet.columns = [
    { header: "Channel Name", key: "channelName", width: 20 },
    { header: "Active - Repricer", key: "activated", width: 20 },
    { header: "MPID", key: "mpid", width: 20 },
    { header: "Channel ID", key: "channelId", width: 20 },
    { header: "Unit Price", key: "unitPrice", width: 20 },
    { header: "Floor Price", key: "floorPrice", width: 20 },
    { header: "Max Price", key: "maxPrice", width: 20 },
    { header: "NC", key: "is_nc_needed", width: 20 },
    {
      header: "Suppress Price Break if Qty 1 not updated",
      key: "suppressPriceBreakForOne",
      width: 50,
    },
    { header: "Up/Down", key: "repricingRule", width: 20 },
    { header: "Suppress Price Break", key: "suppressPriceBreak", width: 20 },
    { header: "Compete On Price Breaks Only", key: "beatQPrice", width: 50 },
    { header: "Badge Indicator", key: "badge_indicator", width: 20 },
    { header: "Cron Name", key: "cronName", width: 20 },
    { header: "Reprice - Scrape", key: "scrapeOn", width: 20 },
    { header: "Reprice", key: "allowReprice", width: 20 },
    { header: "Net32 URl", key: "net32url", width: 20 },
    { header: "ExecutionPriority", key: "executionPriority", width: 20 },
    { header: "Data - Scrape", key: "isScrapeOnlyActivated", width: 20 },
    { header: "ScrapeOnlyCronName", key: "scrapeOnlyCronName", width: 20 },
    { header: "Last CRON run at", key: "lastCronTime", width: 20 },
    { header: "Last run cron-type", key: "lastCronRun", width: 20 },
    { header: "Last updated at", key: "lastUpdateTime", width: 20 },
    { header: "Last updated cron-type", key: "lastUpdatedBy", width: 20 },
    { header: "Last Reprice Comment", key: "last_cron_message", width: 50 },
    { header: "Lowest Vendor Price", key: "lowest_vendor_price", width: 50 },
    { header: "Last Reprice Attempted", key: "lastAttemptedTime", width: 20 },
    { header: "Lowest Vendor", key: "lowest_vendor", width: 50 },
    { header: "Last Existing Price", key: "lastExistingPrice", width: 50 },
    { header: "Last Suggested Price", key: "lastSuggestedPrice", width: 50 },

    { header: "Reprice Up %", key: "percentageIncrease", width: 20 },
    { header: "Compare Q2 with Q1", key: "compareWithQ1", width: 20 },
    { header: "Compete With All Vendors", key: "competeAll", width: 50 },

    {
      header: "Reprice UP Badge Percentage %",
      key: "badgePercentage",
      width: 20,
    },
    { header: "Next Cron Time", key: "nextCronTime", width: 20 },
    // { header: "Product Name", key: "productName", width: 20 },
    // { header: "Cron Id", key: "cronId", width: 20 },

    // { header: "Request Interval", key: "requestInterval", width: 20 },
    // { header: "Request Interval Unit", key: "requestIntervalUnit", width: 20 },

    // { header: "Tags", key: "tags", width: 20 },
    // { header: "Priority", key: "priority", width: 20 },
    // { header: "Do not scrape within 422 duration", key: "wait_update_period", width: 20 },
    // { header: "Focus ID", key: "focusId", width: 20 },

    // { header: "Do not Deactivate Q break when pricing down", key: "abortDeactivatingQPriceBreak", width: 20 },
    // { header: "Own Vendor Id", key: "ownVendorId", width: 20 },
    { header: "Sister Vendor Id", key: "sisterVendorId", width: 20 },
    {
      header: "Include Inactive Vendors",
      key: "includeInactiveVendors",
      width: 20,
    },
    { header: "Inactive Vendor Id", key: "inactiveVendorId", width: 20 },
    { header: "Override Bulk Update", key: "override_bulk_update", width: 20 },
    {
      header: "Override Bulk Update Up/Down",
      key: "override_bulk_rule",
      width: 20,
    },
    { header: "Latest Price", key: "latest_price", width: 20 },

    { header: "Slow Cron Name", key: "slowCronName", width: 20 },
    // { header: "Slow Cron Id", key: "slowCronId", width: 20 },
    { header: "Is Slow Activated", key: "isSlowActivated", width: 20 },
    { header: "Last Updated By", key: "lastUpdatedByUser", width: 20 },
    { header: "Last Updated On", key: "lastUpdatedOn", width: 20 },
    { header: "Apply Buy Box", key: "applyBuyBoxLogic", width: 20 },
    { header: "Apply NC For Buy Box", key: "applyNcForBuyBox", width: 20 },
    { header: "IsBadgeItem", key: "isBadgeItem", width: 20 },
    { header: "Handling Time Group", key: "handling_time_filter", width: 20 },
    { header: "Keep Position", key: "keepPosition", width: 20 },
    {
      header: "Inventory Competition Threshold",
      key: "inventoryThreshold",
      width: 20,
    },
    { header: "Exclude Vendor(s)", key: "excludedVendors", width: 20 },
    { header: "Reprice Down %", key: "percentageDown", width: 20 },
    { header: "Reprice Down Badge %", key: "badgePercentageDown", width: 20 },
    { header: "Floor-Compete With Next", key: "competeWithNext", width: 20 },
    { header: "Triggered By Vendor", key: "triggeredByVendor", width: 20 },
    { header: "Ignore Phantom Q Break", key: "ignorePhantomQBreak", width: 20 },
    { header: "Own Vendor Threshold", key: "ownVendorThreshold", width: 20 },
  ];
  worksheet.addRows(AllItems);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=" + "itemExcel.xlsx",
  );

  return workbook.xlsx.write(res).then(function () {
    res.status(200).end();
  });
}

function parseBadgeIndicator(stringValue: any, evalType: any) {
  if (_.isEqual(evalType, "KEY")) {
    const $eval = badgeResx.find((x: any) =>
      _.isEqual(x.key, stringValue.trim().toUpperCase()),
    );
    return $eval ? $eval.value.trim() : _.first(badgeResx)!.value.trim();
  } else if (_.isEqual(evalType, "VALUE")) {
    const $eval = badgeResx.find((x) =>
      _.isEqual(x.value.toUpperCase(), stringValue.trim().toUpperCase()),
    );
    return $eval ? $eval.key : _.first(badgeResx)!.key;
  }
}

function spliceResult(arrayResult: any[], pageNo: number, pageSize: number) {
  const splicesResult = _.chunk(arrayResult, pageSize);
  return splicesResult[pageNo];
}
