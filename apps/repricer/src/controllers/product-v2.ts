import axios from "axios";
import { Request, Response } from "express";
import _ from "lodash";
import moment from "moment";
import apiMapping from "../../resources/apiMapping.json";
import badgeResx from "../../resources/badgeIndicatorMapping.json";
import handlingTimeGroupResx from "../../resources/HandlingTimeFilterMapping.json";
import * as mapper from "../middleware/mapper-helper";
import * as productHelper from "../middleware/product-helper";
import * as mongoMiddleware from "../services/mongo";
import * as mySqlHelper from "../services/mysql";
import { applicationConfig } from "../utility/config";
import * as httpHelper from "../utility/http-wrappers";
import * as SessionHelper from "../utility/session-helper";
import { GetCronSettingsList, GetSlowCronDetails, GetScrapeCrons } from "../services/mysql-v2";

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
  totalDocs = await mySqlHelper.GetNumberOfRepriceEligibleProductCount(); //await mongoMiddleware.GetProductCount(query);
  totalPages = Math.ceil(totalDocs / pageSize);
  let masterItems = [];
  if (req.query.mpid || req.query.channelId) {
    masterItems = await mySqlHelper.GetAllRepriceEligibleProductByTag(req.query.mpid, req.query.channelId);
    totalDocs = masterItems.length;
    masterItems = spliceResult(masterItems, pageNumber, pageSize);
  } else {
    masterItems = await mySqlHelper.GetAllRepriceEligibleProductByFilter(pageNumber, pageSize);
  }
  if (masterItems && masterItems.length > 0) {
    for (let prod of masterItems) {
      prod = await mapper.MapBadgeIndicator(prod);
    }
  }
  const productDetailsViewModel = mapper.MapV2(masterItems || []);

  res.render("pages/products/get_all", {
    items: productDetailsViewModel,
    pageNumber,
    pageSize,
    totalDocs,
    totalPages,
    groupName: "Products",
    userRole: (req.session as any).users_id?.userRole,
    mpid: req.query.mpid || "",
    channelId: req.query.channelId || "",
    isDev: applicationConfig.IS_DEV,
  });
}

export async function updateProductQuantity(req: Request, res: Response) {
  const mpid = req.body.mpid;
  const vendorData = req.body.vendorData || [];

  try {
    const config = {
      method: "POST",
      url: `${applicationConfig.REPRICER_API_BASE_URL}/data/UpdateProductQuantity`,
      headers: {
        "Content-Type": "application/json",
      },
      data: {
        mpid: mpid,
        vendorData: vendorData,
      },
    };

    const headers: any = {
      headers: config.headers,
      "axios-retry": {
        retries: 0,
      },
    };

    const response: any = await axios.post(config.url, config.data, headers);

    return res.json({
      status: true,
      message: response.message,
      data: response.data,
    });
  } catch (error: any) {
    console.error("Error calling API:", error);
    return res.status(500).json({
      status: false,
      message: error?.response?.data?.message || `Error updating product quantity for mpid ${mpid}`,
    });
  }
}

export async function collateProducts(req: Request, res: Response) {
  const _urlForActiveTradentProducts = apiMapping.find((x) => x.vendorId == "17357")!.activeListUrl;
  const tradentActiveProducts = await httpHelper.native_get(_urlForActiveTradentProducts);
  if (tradentActiveProducts && tradentActiveProducts.data && tradentActiveProducts.data.productList.length > 0) {
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
  let cronSettingsResponse = await GetCronSettingsList();
  const slowCronSettings = await GetSlowCronDetails();
  cronSettingsResponse = _.concat(cronSettingsResponse, slowCronSettings);
  _.first(productDetails).cronSettings = cronSettingsResponse.filter((x: any) => x.IsHidden != true);
  _.first(productDetails).scrapeOnlyCrons = await GetScrapeCrons();

  res.render("pages/products/index", {
    model: _.first(productDetails),
    groupName: "Products",
    userRole: (req as any).session.users_id?.userRole,
  });
}

export async function updateProductDetails(req: Request, res: Response) {
  var details = req.body;
  //const scrapeOnlyCronSettings = await mongoMiddleware.GetScrapeCrons();
  let cronSettingsResponse = await GetCronSettingsList();
  const slowCronSettingsResponse = await GetSlowCronDetails();
  cronSettingsResponse = _.concat(cronSettingsResponse, slowCronSettingsResponse);
  let productDetails = _.first(await mySqlHelper.GetFullProductDetailsById(details.mpid)); //await mongoMiddleware.FindProductById(details.mpid);
  if (details.channel_name.toUpperCase() == "TRADENT") {
    productDetails.tradentDetails = await mapper.MapUserResponse(productDetails.tradentDetails, details, cronSettingsResponse);
    productDetails.tradentDetails.isScrapeOnlyActivated = productDetails.isScrapeOnlyActivated;
    productDetails.tradentDetails.scrapeOnlyCronId = productDetails.scrapeOnlyCronId;
    productDetails.tradentDetails.scrapeOnlyCronName = productDetails.scrapeOnlyCronName;
    productDetails.tradentDetails.isBadgeItem = productDetails.isBadgeItem;
    productDetails.frontierDetails = null;
    productDetails.mvpDetails = null;
    productDetails.firstDentDetails = null;
    productDetails.topDentDetails = null;
    productDetails.triadDetails = null;
    productDetails.biteSupplyDetails = null;
  }
  if (details.channel_name.toUpperCase() == "FRONTIER") {
    productDetails.frontierDetails = await mapper.MapUserResponse(productDetails.frontierDetails, details, cronSettingsResponse);
    productDetails.frontierDetails.isScrapeOnlyActivated = productDetails.isScrapeOnlyActivated;
    productDetails.frontierDetails.scrapeOnlyCronId = productDetails.scrapeOnlyCronId;
    productDetails.frontierDetails.scrapeOnlyCronName = productDetails.scrapeOnlyCronName;
    productDetails.frontierDetails.isBadgeItem = productDetails.isBadgeItem;
    productDetails.tradentDetails = null;
    productDetails.mvpDetails = null;
    productDetails.firstDentDetails = null;
    productDetails.topDentDetails = null;
    productDetails.triadDetails = null;
    productDetails.biteSupplyDetails = null;
  }
  if (details.channel_name.toUpperCase() == "MVP") {
    productDetails.mvpDetails = await mapper.MapUserResponse(productDetails.mvpDetails, details, cronSettingsResponse);
    productDetails.mvpDetails.isScrapeOnlyActivated = productDetails.isScrapeOnlyActivated;
    productDetails.mvpDetails.scrapeOnlyCronId = productDetails.scrapeOnlyCronId;
    productDetails.mvpDetails.scrapeOnlyCronName = productDetails.scrapeOnlyCronName;
    productDetails.mvpDetails.isBadgeItem = productDetails.isBadgeItem;
    productDetails.frontierDetails = null;
    productDetails.tradentDetails = null;
    productDetails.firstDentDetails = null;
    productDetails.topDentDetails = null;
    productDetails.triadDetails = null;
    productDetails.biteSupplyDetails = null;
  }
  if (details.channel_name.toUpperCase() == "FIRSTDENT") {
    productDetails.firstDentDetails = await mapper.MapUserResponse(productDetails.firstDentDetails, details, cronSettingsResponse);
    productDetails.firstDentDetails.isScrapeOnlyActivated = productDetails.isScrapeOnlyActivated;
    productDetails.firstDentDetails.scrapeOnlyCronId = productDetails.scrapeOnlyCronId;
    productDetails.firstDentDetails.scrapeOnlyCronName = productDetails.scrapeOnlyCronName;
    productDetails.firstDentDetails.isBadgeItem = productDetails.isBadgeItem;
    productDetails.frontierDetails = null;
    productDetails.tradentDetails = null;
    productDetails.mvpDetails = null;
    productDetails.topDentDetails = null;
    productDetails.triadDetails = null;
    productDetails.biteSupplyDetails = null;
  }
  if (details.channel_name.toUpperCase() == "TOPDENT") {
    productDetails.topDentDetails = await mapper.MapUserResponse(productDetails.topDentDetails, details, cronSettingsResponse);
    productDetails.topDentDetails.isScrapeOnlyActivated = productDetails.isScrapeOnlyActivated;
    productDetails.topDentDetails.scrapeOnlyCronId = productDetails.scrapeOnlyCronId;
    productDetails.topDentDetails.scrapeOnlyCronName = productDetails.scrapeOnlyCronName;
    productDetails.topDentDetails.isBadgeItem = productDetails.isBadgeItem;
    productDetails.frontierDetails = null;
    productDetails.tradentDetails = null;
    productDetails.mvpDetails = null;
    productDetails.firstDentDetails = null;
    productDetails.triadDetails = null;
    productDetails.biteSupplyDetails = null;
  }
  if (details.channel_name.toUpperCase() == "TRIAD") {
    productDetails.triadDetails = await mapper.MapUserResponse(productDetails.triadDetails, details, cronSettingsResponse);
    productDetails.triadDetails.isScrapeOnlyActivated = productDetails.isScrapeOnlyActivated;
    productDetails.triadDetails.scrapeOnlyCronId = productDetails.scrapeOnlyCronId;
    productDetails.triadDetails.scrapeOnlyCronName = productDetails.scrapeOnlyCronName;
    productDetails.triadDetails.isBadgeItem = productDetails.isBadgeItem;
    productDetails.frontierDetails = null;
    productDetails.tradentDetails = null;
    productDetails.mvpDetails = null;
    productDetails.firstDentDetails = null;
    productDetails.topDentDetails = null;
    productDetails.biteSupplyDetails = null;
  }
  if (details.channel_name.toUpperCase() == "BITESUPPLY") {
    productDetails.biteSupplyDetails = await mapper.MapUserResponse(productDetails.biteSupplyDetails, details, cronSettingsResponse);
    productDetails.biteSupplyDetails.isScrapeOnlyActivated = productDetails.isScrapeOnlyActivated;
    productDetails.biteSupplyDetails.scrapeOnlyCronId = productDetails.scrapeOnlyCronId;
    productDetails.biteSupplyDetails.scrapeOnlyCronName = productDetails.scrapeOnlyCronName;
    productDetails.biteSupplyDetails.isBadgeItem = productDetails.isBadgeItem;
    productDetails.frontierDetails = null;
    productDetails.tradentDetails = null;
    productDetails.mvpDetails = null;
    productDetails.firstDentDetails = null;
    productDetails.topDentDetails = null;
    productDetails.triadDetails = null;
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
  let cronSettingsResponse = await GetCronSettingsList();
  const slowCronSettings = await GetSlowCronDetails();
  cronSettingsResponse = _.concat(cronSettingsResponse, slowCronSettings);
  productDetails.cronSettings = cronSettingsResponse.filter((x: any) => x.IsHidden != true);
  productDetails.slowCrons = slowCronSettings.filter((x: any) => x.IsHidden != true);
  productDetails.scrapeOnlyCrons = await GetScrapeCrons();
  res.render("pages/products/add", {
    model: productDetails,
    groupName: "item",
    userRole: (req as any).session.users_id.userRole,
  });
}

export async function addItemToDatabase(req: Request, res: Response) {
  var details = req.body;
  let productDetails: any = {};
  const scrapeOnlyCronSettings = await GetScrapeCrons();
  if (details.tradentDetails && details.tradentDetails != null) {
    productDetails.tradentDetails = {};
    productDetails.tradentDetails = await mapper.MapFormData(productDetails.tradentDetails, details, details.tradentDetails);
    productDetails.tradentDetails.isScrapeOnlyActivated = details.isScrapeOnlyActivated == "on" ? true : false;
    productDetails.tradentDetails.scrapeOnlyCronId = details.scrapeOnlyCron;
    productDetails.tradentDetails.scrapeOnlyCronName = scrapeOnlyCronSettings.find((x: any) => (x.CronId = details.scrapeOnlyCron)).CronName;
    productDetails.tradentDetails.isBadgeItem = details.isBadgeItem == "on" ? true : false;
  }
  if (details.frontierDetails && details.frontierDetails != null) {
    productDetails.frontierDetails = {};
    productDetails.frontierDetails = await mapper.MapFormData(productDetails.frontierDetails, details, details.frontierDetails);
    productDetails.frontierDetails.isScrapeOnlyActivated = details.isScrapeOnlyActivated == "on" ? true : false;
    productDetails.frontierDetails.scrapeOnlyCronId = details.scrapeOnlyCron;
    productDetails.frontierDetails.scrapeOnlyCronName = scrapeOnlyCronSettings.find((x: any) => (x.CronId = details.scrapeOnlyCron)).CronName;
    productDetails.frontierDetails.isBadgeItem = details.isBadgeItem == "on" ? true : false;
  }
  if (details.mvpDetails && details.mvpDetails != null) {
    productDetails.mvpDetails = {};
    productDetails.mvpDetails = await mapper.MapFormData(productDetails.mvpDetails, details, details.mvpDetails);
    productDetails.mvpDetails.isScrapeOnlyActivated = details.isScrapeOnlyActivated == "on" ? true : false;
    productDetails.mvpDetails.scrapeOnlyCronId = details.scrapeOnlyCron;
    productDetails.mvpDetails.scrapeOnlyCronName = scrapeOnlyCronSettings.find((x: any) => (x.CronId = details.scrapeOnlyCron)).CronName;
    productDetails.mvpDetails.isBadgeItem = details.isBadgeItem == "on" ? true : false;
  }
  if (details.firstDentDetails && details.firstDentDetails != null) {
    productDetails.firstDentDetails = {};
    productDetails.firstDentDetails = await mapper.MapFormData(productDetails.firstDentDetails, details, details.firstDentDetails);
    productDetails.firstDentDetails.isScrapeOnlyActivated = details.isScrapeOnlyActivated == "on" ? true : false;
    productDetails.firstDentDetails.scrapeOnlyCronId = details.scrapeOnlyCron;
    productDetails.firstDentDetails.scrapeOnlyCronName = scrapeOnlyCronSettings.find((x: any) => (x.CronId = details.scrapeOnlyCron)).CronName;
    productDetails.firstDentDetails.isBadgeItem = details.isBadgeItem == "on" ? true : false;
  }
  if (details.topDentDetails && details.topDentDetails != null) {
    productDetails.topDentDetails = {};
    productDetails.topDentDetails = await mapper.MapFormData(productDetails.topDentDetails, details, details.topDentDetails);
    productDetails.topDentDetails.isScrapeOnlyActivated = details.isScrapeOnlyActivated == "on" ? true : false;
    productDetails.topDentDetails.scrapeOnlyCronId = details.scrapeOnlyCron;
    productDetails.topDentDetails.scrapeOnlyCronName = scrapeOnlyCronSettings.find((x: any) => (x.CronId = details.scrapeOnlyCron)).CronName;
    productDetails.topDentDetails.isBadgeItem = details.isBadgeItem == "on" ? true : false;
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
  const selectedProducts = Array.isArray(req.body.mpIds) ? req.body.mpIds : [req.body.mpIds];
  let failedIds: any[] = [];
  if (selectedProducts && selectedProducts.length > 0) {
    for (const prod of selectedProducts) {
      const manualRepriceUrl = `${applicationConfig.REPRICER_API_BASE_URL}${applicationConfig.MANUAL_REPRICER_ENDPOINT}/${prod}`;
      const repriceResult = await httpHelper.native_get(manualRepriceUrl);
      if (repriceResult && repriceResult.status == 200 && repriceResult.data && repriceResult.data.logId) {
        console.log("Manual Log with _id " + repriceResult.data.logId + ", added successfully");
      } else {
        failedIds.push(prod);
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
  const vendorIdentifier = ["tradentDetails", "frontierDetails", "mvpDetails", "topDentDetails", "firstDentDetails", "triadDetails", "biteSupplyDetails"];
  const productDetailsUrl = applicationConfig.PROD_SYNC_URL!.replace("{productId}", idx);
  const headers = {
    oprType: "DEV_SYNC",
    apiKey: "gMoRUrPRDdQVuDRPBzO3wo3rcSaSdhlqpi8vR2QMsrRtg2yvhotES0DLd60VR3YIlyEYfmybIa6Du5NM1UbzcG57jCPN9SZFDbI7GbmCZO2KSlR7fcnWYODoChyKA3jr",
  };
  const getProdResponse = await httpHelper.native_get_V2(productDetailsUrl, headers);
  if (getProdResponse && getProdResponse.data.message != null && getProdResponse.data.message.length > 0) {
    let productDetails: any = _.first(getProdResponse.data.message);
    for (const vId of vendorIdentifier) {
      if (productDetails[vId] != null) {
        productDetails[vId]["isScrapeOnlyActivated"] = productDetails.isScrapeOnlyActivated;
        productDetails[vId]["scrapeOnlyCronName"] = productDetails.scrapeOnlyCronName;
        productDetails[vId]["scrapeOnlyCronId"] = productDetails.scrapeOnlyCronId;
        productDetails[vId]["isSlowActivated"] = false;
        productDetails[vId]["isBadgeItem"] = productDetails.isBadgeItem;
      }
    }
    await mapper.UpsertProductDetailsInSql(_.first(getProdResponse.data.message), idx, req);
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
  const selectedProducts = Array.isArray(req.body.mpIds) ? req.body.mpIds : [req.body.mpIds];

  if (selectedProducts && selectedProducts.length > 0) {
    await mongoMiddleware.Update422StatusById(parseInt(selectedProducts[0]), false);
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
    let activatedResponse = await mySqlHelper.ToggleDataScrapeForId(parseInt(req.body.mpid.trim()), JSON.parse(req.body.state), AuditInfo);
    if (activatedResponse) {
      const returnState = JSON.parse(req.body.state) == true ? "activated" : "de-activated";
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

  const regularCronSettingsDetails = await GetCronSettingsList();
  const scrapeOnlyCronSettingsDetails = await GetScrapeCrons();
  const linkedRegularCronName = regularCronSettingsDetails.find((x: any) => x.CronId == rootDetailsForPayload.cronGroup)?.CronName;
  const scrapeOnlyCronName = scrapeOnlyCronSettingsDetails.find((x: any) => x.CronId == rootDetailsForPayload.scrapeOnlyCron).CronName;
  const query = `UPDATE ${applicationConfig.SQL_SCRAPEPRODUCTLIST} SET Net32Url=?,RegularCronId=?,RegularCronName=?,LinkedCronId=?,LinkedCronName=?,IsBadgeItem=?,IsActive=? WHERE MpId=?`;
  const params = [rootDetailsForPayload.net32Url, rootDetailsForPayload.cronGroup, linkedRegularCronName, rootDetailsForPayload.scrapeOnlyCron, scrapeOnlyCronName, JSON.parse(rootDetailsForPayload.isBadgeItem), JSON.parse(rootDetailsForPayload.isScrapeOnlyActivated), mpidTrimmed];
  await mySqlHelper.ExecuteQuery(query, params);
  return res.json({
    status: true,
    message: `${mpidTrimmed} saved successfully.`,
  });
}

export async function activateProductForAll(req: Request, res: Response) {
  if (req.body.mpid) {
    let activatedResponse = await mySqlHelper.ChangeProductActivation(parseInt(req.body.mpid.trim()), true); //await mongoMiddleware.ActivateProductModel(req.body.mpid.trim());
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
    const removeItems = await mySqlHelper.ChangeProductActivation(parseInt(req.body.mpid.trim()), false); //await mongoMiddleware.DeactivateProductModel(req.body.mpid.trim());
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
  const { mpid, tradentDetails, frontierDetails, mvpDetails, topDentDetails, firstDentDetails, triadDetails, biteSupplyDetails } = req.body;

  // Ensure only specific missing detail objects are initialized without overwriting existing objects
  const existingProduct = _.first(await mySqlHelper.GetFullProductDetailsById(mpidTrimmed)); //await mongoMiddleware.FindOneProductModel({ mpId: mpidTrimmed });

  const updateInitialization: any = {};
  if (!existingProduct.tradentDetails && tradentDetails && Object.keys(tradentDetails).length > 0) {
    updateInitialization.tradentDetails = {};
  }
  if (!existingProduct.frontierDetails && frontierDetails && Object.keys(frontierDetails).length > 0) {
    updateInitialization.frontierDetails = {};
  }
  if (!existingProduct.mvpDetails && mvpDetails && Object.keys(mvpDetails).length > 0) {
    updateInitialization.mvpDetails = {};
  }
  if (!existingProduct.topDentDetails && topDentDetails && Object.keys(topDentDetails).length > 0) {
    updateInitialization.topDentDetails = {};
  }
  if (!existingProduct.firstDentDetails && firstDentDetails && Object.keys(firstDentDetails).length > 0) {
    updateInitialization.firstDentDetails = {};
  }
  if (!existingProduct.triadDetails && triadDetails && Object.keys(triadDetails).length > 0) {
    updateInitialization.triadDetails = {};
  }
  if (!existingProduct.biteSupplyDetails && biteSupplyDetails && Object.keys(biteSupplyDetails).length > 0) {
    updateInitialization.biteSupplyDetails = {};
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
    await mySqlHelper.UpdateBranchDataForVendor(mpidTrimmed, "TRADENT", updateData["tradentDetails"]);
  }

  if (frontierDetails && Object.keys(frontierDetails).length > 0) {
    updateData[`frontierDetails`] = {};
    for (const key in frontierDetails) {
      if (frontierDetails[key] !== null && frontierDetails[key] !== undefined) {
        updateData[`frontierDetails`][`${key}`] = frontierDetails[key];
      }
    }
    await mySqlHelper.UpdateBranchDataForVendor(mpidTrimmed, "FRONTIER", updateData["frontierDetails"]);
  }

  if (mvpDetails && Object.keys(mvpDetails).length > 0) {
    updateData[`mvpDetails`] = {};
    for (const key in mvpDetails) {
      if (mvpDetails[key] !== null && mvpDetails[key] !== undefined) {
        updateData[`mvpDetails`][`${key}`] = mvpDetails[key];
      }
    }
    await mySqlHelper.UpdateBranchDataForVendor(mpidTrimmed, "MVP", updateData["mvpDetails"]);
  }
  if (topDentDetails && Object.keys(topDentDetails).length > 0) {
    updateData[`topDentDetails`] = {};
    for (const key in topDentDetails) {
      if (topDentDetails[key] !== null && topDentDetails[key] !== undefined) {
        updateData[`topDentDetails`][`${key}`] = topDentDetails[key];
      }
    }
    await mySqlHelper.UpdateBranchDataForVendor(mpidTrimmed, "TOPDENT", updateData["topDentDetails"]);
  }
  if (firstDentDetails && Object.keys(firstDentDetails).length > 0) {
    updateData[`firstDentDetails`] = {};
    for (const key in firstDentDetails) {
      if (firstDentDetails[key] !== null && firstDentDetails[key] !== undefined) {
        updateData[`firstDentDetails`][`${key}`] = firstDentDetails[key];
      }
    }
    await mySqlHelper.UpdateBranchDataForVendor(mpidTrimmed, "FIRSTDENT", updateData["firstDentDetails"]);
  }

  if (triadDetails && Object.keys(triadDetails).length > 0) {
    updateData[`triadDetails`] = {};
    for (const key in triadDetails) {
      if (triadDetails[key] !== null && triadDetails[key] !== undefined) {
        updateData[`triadDetails`][`${key}`] = triadDetails[key];
      }
    }
    await mySqlHelper.UpdateBranchDataForVendor(mpidTrimmed, "TRIAD", updateData["triadDetails"]);
  }

  if (biteSupplyDetails && Object.keys(biteSupplyDetails).length > 0) {
    updateData[`biteSupplyDetails`] = {};
    for (const key in biteSupplyDetails) {
      if (biteSupplyDetails[key] !== null && biteSupplyDetails[key] !== undefined) {
        updateData[`biteSupplyDetails`][`${key}`] = biteSupplyDetails[key];
      }
    }
    await mySqlHelper.UpdateBranchDataForVendor(mpidTrimmed, "BITESUPPLY", updateData["biteSupplyDetails"]);
  }

  console.log(`Updating product with specific branch fields for MPID ${mpidTrimmed}:`, updateData);

  // Apply the update with specific fields if there are any updates
  return res.json({
    status: true,
    message: `${mpidTrimmed} branches saved successfully.`,
  });
}

export async function updateToMax(req: Request, res: Response) {
  const selectedProducts = Array.isArray(req.body.mpIds) ? req.body.mpIds : [req.body.mpIds];
  let failedIds: any[] = [];
  if (selectedProducts && selectedProducts.length > 0) {
    for (const prod of selectedProducts) {
      const updateToMaxResponse = `${applicationConfig.REPRICER_API_BASE_URL}${applicationConfig.MAX_UPDATE_REPRICER_ENDPOINT}/${prod.trim()}`;
      const repriceResult = await httpHelper.native_get(updateToMaxResponse);
      if (repriceResult && repriceResult.status == 200 && repriceResult.data && repriceResult.data.logId) {
        console.log("Manual Log with _id " + repriceResult.data.logId + ", added successfully");
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
  try {
    // Proxy the request to the excel-export service
    // In Digital Ocean App Platform, services communicate via internal service names
    const excelServiceUrl = process.env.EXCEL_SERVICE_URL || (process.env.NODE_ENV === "production" ? "http://excel-export:3003" : "http://localhost:3003");
    const response = await axios.get(`${excelServiceUrl}/api/excel/download/all_items`, {
      responseType: "stream",
      params: req.query,
    });

    // Forward the response headers
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=" + "itemExcel.xlsx");

    // Pipe the response from excel-export service to the client
    response.data.pipe(res);
  } catch (error: any) {
    console.error("Error proxying to excel-export service:", error);
    res.status(500).json({
      error: "Failed to export Excel file",
      details: error?.message || "Unknown error occurred",
    });
  }
}

function parseBadgeIndicator(stringValue: any, evalType: any) {
  if (_.isEqual(evalType, "KEY")) {
    const $eval = badgeResx.find((x: any) => _.isEqual(x.key, stringValue.trim().toUpperCase()));
    return $eval ? $eval.value.trim() : _.first(badgeResx)!.value.trim();
  } else if (_.isEqual(evalType, "VALUE")) {
    const $eval = badgeResx.find((x) => _.isEqual(x.value.toUpperCase(), stringValue.trim().toUpperCase()));
    return $eval ? $eval.key : _.first(badgeResx)!.key;
  }
}

function spliceResult(arrayResult: any[], pageNo: number, pageSize: number) {
  const splicesResult = _.chunk(arrayResult, pageSize);
  return splicesResult[pageNo];
}
