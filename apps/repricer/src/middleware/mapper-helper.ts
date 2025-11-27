import _ from "lodash";
import itemMapper from "../../resources/itemMapper.json";
import badgeResx from "../../resources/badgeIndicatorMapping.json";
import FailedReport from "../models/failed-report";
import moment from "moment";
import LatestScrapeInfo from "../models/api-response/latest-scrape-info";
import * as mySqlUtility from "../services/mysql";
import MySqlProduct from "../models/sql-models/mysql-product";
import * as SessionHelper from "../utility/session-helper";
import { applicationConfig } from "../utility/config";

export function MapV2(productDetails: any[]) {
  return productDetails.map((p) => {
    let item: any = {};
    item.mpid = p.mpId;
    item.tradent = p.tradentDetails;
    item.frontier = p.frontierDetails;
    item.firstDent = p.firstDentDetails;
    item.topDent = p.topDentDetails;
    item.triad = p.triadDetails;
    item.mvp = p.mvpDetails;
    item.triad = p.triadDetails;
    item.cronName = getCommonEntityValue(item, "cronName", false);
    item.cronId = getCommonEntityValue(item, "cronId", false);
    item.net32Url = getCommonEntityValue(item, "net32url", true);
    item.slowCronName = getCommonEntityValue(item, "slowCronName", true);
    item.isScrapeOnlyActive = p.isScrapeOnlyActivated;
    item.isBadgeItem = p.isBadgeItem;
    item.algo_execution_mode = p.algo_execution_mode;
    if (item.tradent) {
      item.tradent.updatedAt = item.tradent.updatedAt
        ? moment(item.tradent.updatedAt).format("DD-MM-YY HH:mm:ss")
        : item.tradent.updatedAt;
      item.tradent.lastCronTime = item.tradent.last_cron_time
        ? moment(item.tradent.last_cron_time).format("DD-MM-YY HH:mm:ss")
        : item.tradent.last_cron_time;
      item.tradent.lastUpdateTime = item.tradent.last_update_time
        ? moment(item.tradent.last_update_time).format("DD-MM-YY HH:mm:ss")
        : item.tradent.last_update_time;
      item.tradent.lastAttemptedTime = item.tradent.last_attempted_time
        ? moment(item.tradent.last_attempted_time).format("DD-MM-YY HH:mm:ss")
        : item.tradent.last_attempted_time;
      item.tradent.tags = removeBackslashes(item.tradent.tags);
    }
    if (item.frontier) {
      item.frontier.updatedAt = item.frontier.updatedAt
        ? moment(item.frontier.updatedAt).format("DD-MM-YY HH:mm:ss")
        : item.frontier.updatedAt;
      item.frontier.lastCronTime = item.frontier.last_cron_time
        ? moment(item.frontier.last_cron_time).format("DD-MM-YY HH:mm:ss")
        : item.frontier.last_cron_time;
      item.frontier.lastUpdateTime = item.frontier.last_update_time
        ? moment(item.frontier.last_update_time).format("DD-MM-YY HH:mm:ss")
        : item.frontier.last_update_time;
      item.frontier.lastAttemptedTime = item.frontier.last_attempted_time
        ? moment(item.frontier.last_attempted_time).format("DD-MM-YY HH:mm:ss")
        : item.frontier.last_attempted_time;
      item.frontier.tags = removeBackslashes(item.frontier.tags);
    }
    if (item.mvp) {
      item.mvp.updatedAt = item.mvp.updatedAt
        ? moment(item.mvp.updatedAt).format("DD-MM-YY HH:mm:ss")
        : item.mvp.updatedAt;
      item.mvp.lastCronTime = item.mvp.last_cron_time
        ? moment(item.mvp.last_cron_time).format("DD-MM-YY HH:mm:ss")
        : item.mvp.last_cron_time;
      item.mvp.lastUpdateTime = item.mvp.last_update_time
        ? moment(item.mvp.last_update_time).format("DD-MM-YY HH:mm:ss")
        : item.mvp.last_update_time;
      item.mvp.lastAttemptedTime = item.mvp.last_attempted_time
        ? moment(item.mvp.last_attempted_time).format("DD-MM-YY HH:mm:ss")
        : item.mvp.last_attempted_time;
      item.mvp.tags = removeBackslashes(item.mvp.tags);
    }
    if (item.topDent) {
      item.topDent.updatedAt = item.topDent.updatedAt
        ? moment(item.topDent.updatedAt).format("DD-MM-YY HH:mm:ss")
        : item.topDent.updatedAt;
      item.topDent.lastCronTime = item.topDent.last_cron_time
        ? moment(item.topDent.last_cron_time).format("DD-MM-YY HH:mm:ss")
        : item.topDent.last_cron_time;
      item.topDent.lastUpdateTime = item.topDent.last_update_time
        ? moment(item.topDent.last_update_time).format("DD-MM-YY HH:mm:ss")
        : item.topDent.last_update_time;
      item.topDent.lastAttemptedTime = item.topDent.last_attempted_time
        ? moment(item.topDent.last_attempted_time).format("DD-MM-YY HH:mm:ss")
        : item.topDent.last_attempted_time;
      item.topDent.tags = removeBackslashes(item.topDent.tags);
    }
    if (item.firstDent) {
      item.firstDent.updatedAt = item.firstDent.updatedAt
        ? moment(item.firstDent.updatedAt).format("DD-MM-YY HH:mm:ss")
        : item.firstDent.updatedAt;
      item.firstDent.lastCronTime = item.firstDent.last_cron_time
        ? moment(item.firstDent.last_cron_time).format("DD-MM-YY HH:mm:ss")
        : item.firstDent.last_cron_time;
      item.firstDent.lastUpdateTime = item.firstDent.last_update_time
        ? moment(item.firstDent.last_update_time).format("DD-MM-YY HH:mm:ss")
        : item.firstDent.last_update_time;
      item.firstDent.lastAttemptedTime = item.firstDent.last_attempted_time
        ? moment(item.firstDent.last_attempted_time).format("DD-MM-YY HH:mm:ss")
        : item.firstDent.last_attempted_time;
      item.firstDent.tags = removeBackslashes(item.firstDent.tags);
    }
    if (item.triad) {
      item.triad.updatedAt = item.triad.updatedAt
        ? moment(item.triad.updatedAt).format("DD-MM-YY HH:mm:ss")
        : item.triad.updatedAt;
      item.triad.lastCronTime = item.triad.last_cron_time
        ? moment(item.triad.last_cron_time).format("DD-MM-YY HH:mm:ss")
        : item.triad.last_cron_time;
      item.triad.lastUpdateTime = item.triad.last_update_time
        ? moment(item.triad.last_update_time).format("DD-MM-YY HH:mm:ss")
        : item.triad.last_update_time;
      item.triad.lastAttemptedTime = item.triad.last_attempted_time
        ? moment(item.triad.last_attempted_time).format("DD-MM-YY HH:mm:ss")
        : item.triad.last_attempted_time;
      item.triad.tags = removeBackslashes(item.triad.tags);
    }
    return item;
  });
}

export function MapBadgeIndicator(product: any) {
  if (product.tradentDetails) {
    product.tradentDetails.badge_indicator = parseBadgeIndicator(
      product.tradentDetails.badgeIndicator,
      "KEY",
    );
  }
  if (product.frontierDetails) {
    product.frontierDetails.badge_indicator = parseBadgeIndicator(
      product.frontierDetails.badgeIndicator,
      "KEY",
    );
  }
  if (product.mvpDetails) {
    product.mvpDetails.badge_indicator = parseBadgeIndicator(
      product.mvpDetails.badgeIndicator,
      "KEY",
    );
  }
  if (product.firstDentDetails) {
    product.firstDentDetails.badge_indicator = parseBadgeIndicator(
      product.firstDentDetails.badgeIndicator,
      "KEY",
    );
  }
  if (product.topDentDetails) {
    product.topDentDetails.badge_indicator = parseBadgeIndicator(
      product.topDentDetails.badgeIndicator,
      "KEY",
    );
  }

  if (product.triadDetails) {
    product.triadDetails.badge_indicator = parseBadgeIndicator(
      product.triadDetails.badgeIndicator,
      "KEY",
    );
  }
  return product;
}

export const MapCronName = async (prod: any, cronSettings: any) => {
  if (prod.tradentDetails && prod.tradentDetails.cronId) {
    prod.tradentDetails.cronName = cronSettings.find(
      (x: any) => x.CronId == prod.tradentDetails.cronId,
    )
      ? cronSettings.find((x: any) => x.CronId == prod.tradentDetails.cronId)
          .CronName
      : "N/A";
  }
  if (prod.frontierDetails && prod.frontierDetails.cronId) {
    prod.frontierDetails.cronName = cronSettings.find(
      (x: any) => x.CronId == prod.frontierDetails.cronId,
    )
      ? cronSettings.find((x: any) => x.CronId == prod.frontierDetails.cronId)
          .CronName
      : "N/A";
  }
  if (prod.mvpDetails && prod.mvpDetails.cronId) {
    prod.mvpDetails.cronName = cronSettings.find(
      (x: any) => x.CronId == prod.mvpDetails.cronId,
    )
      ? cronSettings.find((x: any) => x.CronId == prod.mvpDetails.cronId)
          .CronName
      : "N/A";
  }
  return prod;
};

export const MapUserResponse = async (
  productDetails: any,
  updateDetails: any,
  cronSettingsResponse: any,
) => {
  // let data = {};
  productDetails.cronId = productDetails.cronId;
  productDetails.cronName = productDetails.CronName
    ? productDetails.CronName
    : productDetails.cronName;
  productDetails.channelName = updateDetails.channel_name;
  productDetails.productName = updateDetails.product_name; //Defaulted
  productDetails.scrapeOn = updateDetails.Scrape_on_off == "on" ? true : false;
  productDetails.allowReprice =
    updateDetails.Reprice_on_off == "on" ? true : false;
  productDetails.requestInterval = updateDetails.requestInterval
    ? updateDetails.requestInterval
    : 1; //Defaulted
  productDetails.floorPrice = parseFloat(productDetails.floorPrice);
  productDetails.net32url = productDetails.net32_url
    ? productDetails.net32_url
    : productDetails.net32url;
  productDetails.mpid = productDetails.mpid;
  productDetails.focusId = updateDetails.focus_id
    ? updateDetails.focus_id
    : null; //Defaulted
  productDetails.channelId = productDetails.channelId;
  productDetails.unitPrice = parseFloat(productDetails.unitPrice);
  productDetails.maxPrice = parseFloat(productDetails.maxPrice);
  productDetails.SecretKey = updateDetails.secret_key;
  productDetails.tags = []; //Defaulted
  productDetails.activated = productDetails.activated;
  productDetails.is_nc_needed = JSON.parse(productDetails.is_nc_needed);
  productDetails.repricingRule = parseInt(productDetails.repricingRule);
  productDetails.suppressPriceBreak =
    updateDetails.suppressPriceBreak == "on" ? true : false;
  productDetails.requestIntervalUnit = updateDetails.request_interval_unit
    ? updateDetails.request_interval_unit
    : "min"; //Defaulted
  productDetails.priority = updateDetails.priority ? updateDetails.priority : 5; //Defaulted
  productDetails.competeAll = updateDetails.competeAll == "on" ? true : false;
  productDetails.suppressPriceBreakForOne =
    updateDetails.suppressPriceBreakForOne == "on" ? true : false;
  productDetails.beatQPrice = updateDetails.beatQPrice == "on" ? true : false;
  productDetails.percentageIncrease = updateDetails.percentageIncrease
    ? parseFloat(updateDetails.percentageIncrease)
    : 0;
  productDetails.compareWithQ1 =
    updateDetails.compareWithQ1 == "on" ? true : false;
  productDetails.wait_update_period = true; //Defaulted
  productDetails.badgeIndicator = productDetails.badgeIndicator;
  productDetails.badgePercentage = updateDetails.badgePercentage
    ? parseFloat(updateDetails.badgePercentage)
    : 0;
  productDetails.abortDeactivatingQPriceBreak = true; //Defaulted
  productDetails.ownVendorId = updateDetails.ownVendorId;
  productDetails.sisterVendorId = updateDetails.sisterVendorId;
  productDetails.inactiveVendorId = updateDetails.inactiveVendorId;
  productDetails.includeInactiveVendors =
    updateDetails.includeInactiveVendors == "on" ? true : false;
  productDetails.override_bulk_update =
    updateDetails.override_bulk_update == "on" ? true : false;
  productDetails.override_bulk_rule = updateDetails.override_bulk_rule_select
    ? parseInt(updateDetails.override_bulk_rule_select)
    : 2;
  productDetails.latest_price = updateDetails.latest_price
    ? parseFloat(updateDetails.latest_price)
    : 0;
  productDetails.executionPriority = updateDetails.executionPriority
    ? parseInt(updateDetails.executionPriority)
    : updateDetails.executionPriority;
  productDetails.applyBuyBoxLogic =
    updateDetails.applyBuyBox == "on" ? true : false;
  productDetails.applyNcForBuyBox =
    updateDetails.applyNcForBuyBox == "on" ? true : false;
  productDetails.handlingTimeFilter = updateDetails.handling_time_filter;
  productDetails.keepPosition =
    updateDetails.keepPosition == "on" ? true : false;
  productDetails.excludedVendors = updateDetails.excludedVendors;
  productDetails.inventoryThreshold = !isNaN(
    parseInt(updateDetails.inventoryThreshold),
  )
    ? parseInt(updateDetails.inventoryThreshold)
    : 0;
  productDetails.percentageDown = !isNaN(
    parseFloat(updateDetails.percentageDown),
  )
    ? parseFloat(updateDetails.percentageDown)
    : 0;
  productDetails.badgePercentageDown = !isNaN(
    parseFloat(updateDetails.badgePercentageDown),
  )
    ? parseFloat(updateDetails.badgePercentageDown)
    : 0;
  productDetails.competeWithNext =
    updateDetails.competeWithNext == "on" ? true : false;
  productDetails.ignorePhantomQBreak =
    updateDetails.ignorePhantomQBreak == "on" ? true : false;
  productDetails.ownVendorThreshold = !isNaN(
    parseInt(updateDetails.ownVendorThreshold),
  )
    ? parseInt(updateDetails.ownVendorThreshold)
    : 1;
  productDetails.getBBBadgeValue = !isNaN(
    parseInt(updateDetails.getBBBadgeValue),
  )
    ? parseFloat(updateDetails.getBBBadgeValue)
    : 0.1;
  productDetails.getBBShippingValue = !isNaN(
    parseInt(updateDetails.getBBShippingValue),
  )
    ? parseFloat(updateDetails.getBBShippingValue)
    : 0.005;
  productDetails.getBBBadge = updateDetails.getBBBadge == "on" ? true : false;
  productDetails.getBBShipping =
    updateDetails.getBBShipping == "on" ? true : false;
  return productDetails;
};
export const MapFormData = async (
  productDetails: any,
  formData: any,
  formVendorData: any,
) => {
  productDetails.cronId = formData.cronGroup;
  productDetails.channelName = formVendorData.channel_name;
  productDetails.productName = formData.product_name; //Defaulted
  productDetails.scrapeOn = formVendorData.Scrape_on_off == "on" ? true : false;
  productDetails.allowReprice =
    formVendorData.Reprice_on_off == "on" ? true : false;
  productDetails.requestInterval = formVendorData.requestInterval
    ? formVendorData.requestInterval
    : 1; //Defaulted
  productDetails.floorPrice = parseFloat(formVendorData.floor_price);
  productDetails.net32url = formData.net32_url;
  productDetails.mpid = formData.mpid;
  productDetails.focusId = formVendorData.focus_id
    ? formVendorData.focus_id
    : null; //Defaulted
  productDetails.channelId = formVendorData.channel_Id;
  productDetails.unitPrice = parseFloat(formVendorData.unit_price);
  productDetails.maxPrice = parseFloat(formVendorData.max_price);
  productDetails.SecretKey = formData.secret_key ? formData.secret_key : null;
  productDetails.tags = []; //Defaulted
  productDetails.activated = formVendorData.activated;
  productDetails.is_nc_needed = formVendorData.is_nc_needed;
  productDetails.repricingRule = parseInt(formVendorData.reprice_rule_select);
  productDetails.suppressPriceBreak =
    formVendorData.suppressPriceBreak == "on" ? true : false;
  productDetails.requestIntervalUnit = formVendorData.request_interval_unit
    ? formVendorData.request_interval_unit
    : "min"; //Defaulted
  productDetails.priority = formVendorData.priority
    ? formVendorData.priority
    : 5; //Defaulted
  productDetails.competeAll = formVendorData.competeAll == "on" ? true : false;
  productDetails.suppressPriceBreakForOne =
    formVendorData.suppressPriceBreakForOne == "on" ? true : false;
  productDetails.beatQPrice = formVendorData.beatQPrice == "on" ? true : false;
  productDetails.percentageIncrease = formVendorData.percentageIncrease
    ? parseFloat(formVendorData.percentageIncrease)
    : 0;
  productDetails.compareWithQ1 =
    formVendorData.compareWithQ1 == "on" ? true : false;
  productDetails.wait_update_period = true; //Defaulted
  productDetails.badgeIndicator = formVendorData.badgeIndicator;
  productDetails.badgePercentage = formVendorData.badgePercentage
    ? parseFloat(formVendorData.badgePercentage)
    : 0;
  productDetails.abortDeactivatingQPriceBreak = true; //Defaulted
  productDetails.ownVendorId = formVendorData.ownVendorId
    ? formVendorData.ownVendorId
    : null;
  productDetails.sisterVendorId = formVendorData.sisterVendorId;
  productDetails.inactiveVendorId = formVendorData.inactiveVendorId;
  productDetails.includeInactiveVendors =
    formVendorData.includeInactiveVendors == "on" ? true : false;
  productDetails.override_bulk_update =
    formVendorData.override_bulk_update == "on" ? true : false;
  productDetails.override_bulk_rule = formVendorData.override_bulk_rule_select
    ? parseInt(formVendorData.override_bulk_rule_select)
    : 2;
  productDetails.latest_price = formVendorData.latest_price
    ? parseFloat(formVendorData.latest_price)
    : 0;
  productDetails.executionPriority = formVendorData.executionPriority
    ? parseInt(formVendorData.executionPriority)
    : formVendorData.executionPriority;
  productDetails.applyBuyBoxLogic =
    formVendorData.applyBuyBox == "on" ? true : false;
  productDetails.applyNcForBuyBox =
    formVendorData.applyNcForBuyBox == "on" ? true : false;
  productDetails.handlingTimeFilter = formVendorData.handling_time_filter;
  productDetails.keepPosition =
    formVendorData.keepPosition == "on" ? true : false;
  productDetails.ownVendorThreshold = formVendorData.ownVendorThreshold
    ? parseInt(formVendorData.ownVendorThreshold)
    : 1;
  productDetails.getBBBadgeValue = !isNaN(
    parseInt(formVendorData.getBBBadgeValue),
  )
    ? parseFloat(formVendorData.getBBBadgeValue)
    : 0.1;
  productDetails.getBBShippingValue = !isNaN(
    parseInt(formVendorData.getBBShippingValue),
  )
    ? parseFloat(formVendorData.getBBShippingValue)
    : 0.005;
  productDetails.getBBBadge = formVendorData.getBBBadge == "on" ? true : false;
  productDetails.getBBShipping =
    formVendorData.getBBShipping == "on" ? true : false;
  return productDetails;
};
export const AlignCronName = async (productList: any) => {
  let alignedProduct: any[] = [];
  for (var product of productList) {
    if (!_.includes(alignedProduct, product.mpid)) {
      const listOfRelatedProducts = productList.find(
        (x: any) =>
          x.mpid == product.mpid &&
          x.channelName.toLowerCase() != product.channelName.toLowerCase(),
      );
      if (listOfRelatedProducts && listOfRelatedProducts.length > 0) {
        const contextCronName = (_.last(listOfRelatedProducts) as any).cronName;
        const contextCronId = (_.last(listOfRelatedProducts) as any).cronId;
        _.forEach(listOfRelatedProducts, (p: any) => {
          p.cronName = contextCronName;
          p.cronId = contextCronId;
        });
      }
      alignedProduct.push(product.mpid as never);
    }
  }
  return productList;
};

export const MapScrapedFailedResults = async (cronLogs: any) => {
  let result: any[] = [];
  const error_one = applicationConfig.ERROR_ONE;
  const error_two = applicationConfig.ERROR_TWO;
  for (const $ of cronLogs) {
    if ($.logs && $.logs.length > 0) {
      for (const $l of $.logs) {
        if ($l.length > 0) {
          _.forEach($l, (x) => {
            if (x.logs && x.logs.length > 0) {
              if (x.logs == error_one || x.logs == error_two) {
                const report = new FailedReport(
                  x.productId,
                  x.vendor,
                  x.logs,
                  $.cronId,
                  moment(new Date($.time)).format("DD-MM-YY HH:mm:ss") as any,
                );
                result.push(report as never);
              }
            }
          });
        }
      }
    }
  }
  return result;
};

export const AlignProducts = async (
  product: any,
  allCronList: any,
  slowCronIds: any,
) => {
  //Get Excel CronId for the Product
  let currentCronId = getContextItem(product, "cronId");
  let currentCronName = getContextItem(product, "cronName");
  const dbProductDetailsArray = await mySqlUtility.GetFullProductDetailsById(
    parseInt(product.mpId as any),
  ); //await mongoUtility.FindProductById(product.mpId);
  const dbProductDetails = _.first(dbProductDetailsArray);
  if (dbProductDetails) {
    //Get DB CronId for the Product
    //const dbContextCronId = getContextItem(dbProductDetails, "cronId");
    //const dbContextCronName = getContextItem(dbProductDetails, "cronName");
    const dbSlowCronId =
      dbProductDetails.isSlowActivated == true
        ? getContextItem(dbProductDetails, "slowCronId")
        : null;
    const dbSlowCronName =
      dbProductDetails.isSlowActivated == true
        ? getContextItem(dbProductDetails, "slowCronName")
        : null;

    if (product.tradentDetails) {
      product.tradentDetails.cronId = currentCronId;
      product.tradentDetails.cronName = currentCronName;
      if (dbProductDetails.isSlowActivated == true) {
        product.tradentDetails.slowCronId = dbSlowCronId;
        product.tradentDetails.slowCronName = dbSlowCronName;
      }
    }
    if (product.frontierDetails) {
      product.frontierDetails.cronId = currentCronId;
      product.frontierDetails.cronName = currentCronName;
      if (dbProductDetails.isSlowActivated == true) {
        product.frontierDetails.slowCronId = dbSlowCronId;
        product.frontierDetails.slowCronName = dbSlowCronName;
      }
    }
    if (product.mvpDetails) {
      product.mvpDetails.cronId = currentCronId;
      product.mvpDetails.cronName = currentCronName;
      if (dbProductDetails.isSlowActivated == true) {
        product.mvpDetails.slowCronId = dbSlowCronId;
        product.mvpDetails.slowCronName = dbSlowCronName;
      }
    }
    if (product.firstDentDetails) {
      product.firstDentDetails.cronId = currentCronId;
      product.firstDentDetails.cronName = currentCronName;
      if (dbProductDetails.isSlowActivated == true) {
        product.firstDentDetails.slowCronId = dbSlowCronId;
        product.firstDentDetails.slowCronName = dbSlowCronName;
      }
    }
    if (product.topDentDetails) {
      product.topDentDetails.cronId = currentCronId;
      product.topDentDetails.cronName = currentCronName;
      if (dbProductDetails.isSlowActivated == true) {
        product.topDentDetails.slowCronId = dbSlowCronId;
        product.topDentDetails.slowCronName = dbSlowCronName;
      }
    }
    if (product.triadDetails) {
      product.triadDetails.cronId = currentCronId;
      product.triadDetails.cronName = currentCronName;
      if (dbProductDetails.isSlowActivated == true) {
        product.triadDetails.slowCronId = dbSlowCronId;
        product.triadDetails.slowCronName = dbSlowCronName;
      }
    }
  }
};

export const GetAlternateProxyProviderId = async (
  details: any,
  sequence: any,
) => {
  if (details.AlternateProxyProvider) {
    const linkedProvider = details.AlternateProxyProvider.find(
      (x: any) => x.Sequence == sequence,
    );
    return linkedProvider ? linkedProvider.ProxyProvider : 99;
  }
  return 99;
};

export const GetIsStepReached = async (details: any, stepCount: any) => {
  if (details.AlternateProxyProvider) {
    const listOfThresholdProvider = _.find(
      details.AlternateProxyProvider,
      (x: any) => x.Sequence == stepCount,
    );
    return (
      listOfThresholdProvider &&
      listOfThresholdProvider.ProxyProvider == details.ProxyProvider
    );
  }
  return false;
};

export const MapAlternateProxyProviderDetails = async (
  idx: any,
  payload: any,
) => {
  let alternateResults: any[] = [];
  for (let i = 1; i <= 6; i++) {
    let info: any = {};
    info.Sequence = i;
    const keyToGetValue =
      idx == 999 ? `proxy_provider_422_alternate_${i}` : `proxy_provider_${i}`;
    info.ProxyProvider =
      idx == 999
        ? parseInt(payload[keyToGetValue])
        : parseInt(payload[keyToGetValue][idx]);
    alternateResults.push(info as never);
  }

  return alternateResults;
};

export const MapSqlToCronLog = async (runInfo: any, _idx: any) => {
  let cronLog: any = {};
  cronLog.index = _idx;
  cronLog.logTime = runInfo.RunStartTime ? runInfo.RunStartTime : "-";
  cronLog.keyRef = runInfo.KeyGenId;
  cronLog.cronId = runInfo.CronId;
  cronLog.productCount = runInfo.ProductCount;
  cronLog.type = runInfo.RunType;
  cronLog.completionTime = runInfo.RunEndTime ? runInfo.RunEndTime : "-";
  cronLog.EligibleCount = runInfo.EligibleCount;
  cronLog.logData = {};
  cronLog.logData._id = runInfo.RunId;
  cronLog.logData.type = runInfo.RunType;
  cronLog.cronName = runInfo.CronName;
  cronLog.productIds = "-";
  cronLog.repricedProductCount = "-";
  cronLog.successScrapeCount = runInfo.ScrapedSuccessCount;
  cronLog.failureScrapeCount = runInfo.ScrapedFailureCount;
  cronLog.totalActiveCount = runInfo.EligibleCount;
  cronLog.repriceFailure422Count = "-";
  cronLog.repriceFailureOtherCount = "-";
  return cronLog;
};

export const MapLatestPriceInfo = async (scrapeList: any, focusId: any) => {
  const contextPriceInfo = _.filter(scrapeList, (x) => {
    return x.MinQty == 1;
  });
  if (contextPriceInfo && contextPriceInfo.length > 0) {
    let competitorPriceInfo = _.filter(contextPriceInfo, ($) => {
      return $.IsOwnVendor == 0;
    });
    if (competitorPriceInfo && competitorPriceInfo.length > 0) {
      competitorPriceInfo = _.orderBy(competitorPriceInfo, "ItemRank", "asc");
      var scrapeInfo = new LatestScrapeInfo(
        _.first(competitorPriceInfo),
        focusId,
      );
      return scrapeInfo;
    }
  }
  return null;
};

export const UpsertProductDetailsInSql = async (
  payload: any,
  mpid: any,
  req: any,
) => {
  console.log("UpsertProductDetailsInSql", payload);
  const sqlProductDetailsList =
    await mySqlUtility.GetFullProductDetailsById(mpid);
  let sqlProductDetails = _.first(sqlProductDetailsList);
  const AuditInfo = await SessionHelper.GetAuditInfo(req);
  if (payload && payload.tradentDetails) {
    if (sqlProductDetails != null && sqlProductDetails.tradentDetails) {
      payload.tradentDetails = mapUserDataToDbData(
        payload.tradentDetails,
        sqlProductDetails.tradentDetails,
        AuditInfo,
      );
      await mySqlUtility.UpdateVendorData(payload.tradentDetails, "TRADENT");
      console.log(`Updated Tradent Info for ${mpid} at ${new Date()}`);
    } else {
      if (!sqlProductDetails) {
        sqlProductDetails = {};
      }
      payload.tradentDetails.updatedBy = AuditInfo.UpdatedBy;
      payload.tradentDetails.updatedAt = moment(AuditInfo.UpdatedOn).format(
        "YYYY-MM-DD HH:mm:ss",
      );
      sqlProductDetails.tradentLinkInfo = await mySqlUtility.UpsertVendorData(
        payload.tradentDetails,
        "TRADENT",
      );
      console.log(
        `Inserted Tradent Info for ${mpid} with insertId : ${sqlProductDetails.tradentLinkInfo}`,
      );
    }
  }
  if (payload && payload.frontierDetails) {
    if (sqlProductDetails != null && sqlProductDetails.frontierDetails) {
      payload.frontierDetails = mapUserDataToDbData(
        payload.frontierDetails,
        sqlProductDetails.frontierDetails,
        AuditInfo,
      );
      await mySqlUtility.UpdateVendorData(payload.frontierDetails, "FRONTIER");
      console.log(`Updated Frontier Info for ${mpid} at ${new Date()}`);
    } else {
      if (!sqlProductDetails) {
        sqlProductDetails = {};
      }
      payload.frontierDetails.updatedBy = AuditInfo.UpdatedBy;
      payload.frontierDetails.updatedAt = moment(AuditInfo.UpdatedOn).format(
        "YYYY-MM-DD HH:mm:ss",
      );
      sqlProductDetails.frontierLinkInfo = await mySqlUtility.UpsertVendorData(
        payload.frontierDetails,
        "FRONTIER",
      );
      console.log(
        `Inserted Frontier Info for ${mpid} with insertId : ${sqlProductDetails.frontierLinkInfo}`,
      );
    }
  }
  if (payload && payload.mvpDetails) {
    if (sqlProductDetails != null && sqlProductDetails.mvpDetails) {
      payload.mvpDetails = mapUserDataToDbData(
        payload.mvpDetails,
        sqlProductDetails.mvpDetails,
        AuditInfo,
      );
      await mySqlUtility.UpdateVendorData(payload.mvpDetails, "MVP");
      console.log(`Updated MVP Info for ${mpid} at ${new Date()}`);
    } else {
      if (!sqlProductDetails) {
        sqlProductDetails = {};
      }
      payload.mvpDetails.updatedBy = AuditInfo.UpdatedBy;
      payload.mvpDetails.updatedAt = moment(AuditInfo.UpdatedOn).format(
        "YYYY-MM-DD HH:mm:ss",
      );
      sqlProductDetails.mvpLinkInfo = await mySqlUtility.UpsertVendorData(
        payload.mvpDetails,
        "MVP",
      );
      console.log(
        `Inserted MVP Info for ${mpid} with insertId : ${sqlProductDetails.mvpLinkInfo}`,
      );
    }
  }
  if (payload && payload.firstDentDetails) {
    if (sqlProductDetails != null && sqlProductDetails.firstDentDetails) {
      payload.firstDentDetails = mapUserDataToDbData(
        payload.firstDentDetails,
        sqlProductDetails.firstDentDetails,
        AuditInfo,
      );
      await mySqlUtility.UpdateVendorData(
        payload.firstDentDetails,
        "FIRSTDENT",
      );
      console.log(`Updated FirstDent Info for ${mpid} at ${new Date()}`);
    } else {
      if (!sqlProductDetails) {
        sqlProductDetails = {};
      }
      payload.firstDentDetails.updatedBy = AuditInfo.UpdatedBy;
      payload.firstDentDetails.updatedAt = moment(AuditInfo.UpdatedOn).format(
        "YYYY-MM-DD HH:mm:ss",
      );
      sqlProductDetails.firstDentLinkInfo = await mySqlUtility.UpsertVendorData(
        payload.firstDentDetails,
        "FIRSTDENT",
      );
      console.log(
        `Inserted FirstDent Info for ${mpid} with insertId : ${sqlProductDetails.firstDentLinkInfo}`,
      );
    }
  }
  if (payload && payload.topDentDetails) {
    if (sqlProductDetails != null && sqlProductDetails.topDentDetails) {
      payload.topDentDetails = mapUserDataToDbData(
        payload.topDentDetails,
        sqlProductDetails.topDentDetails,
        AuditInfo,
      );
      await mySqlUtility.UpdateVendorData(payload.topDentDetails, "TOPDENT");
      console.log(`Updated TopDent Info for ${mpid} at ${new Date()}`);
    } else {
      if (!sqlProductDetails) {
        sqlProductDetails = {};
      }
      payload.topDentDetails.updatedBy = AuditInfo.UpdatedBy;
      payload.topDentDetails.updatedAt = moment(AuditInfo.UpdatedOn).format(
        "YYYY-MM-DD HH:mm:ss",
      );
      sqlProductDetails.topDentLinkInfo = await mySqlUtility.UpsertVendorData(
        payload.topDentDetails,
        "TOPDENT",
      );
      console.log(
        `Inserted TopDent Info for ${mpid} with insertId : ${sqlProductDetails.topDentLinkInfo}`,
      );
    }
  }

  if (payload && payload.triadDetails) {
    if (sqlProductDetails != null && sqlProductDetails.triadDetails) {
      payload.triadDetails = mapUserDataToDbData(
        payload.triadDetails,
        sqlProductDetails.triadDetails,
        AuditInfo,
      );
      await mySqlUtility.UpdateVendorData(payload.triadDetails, "TRIAD");
      console.log(`Updated Triad Info for ${mpid} at ${new Date()}`);
    } else {
      if (!sqlProductDetails) {
        sqlProductDetails = {};
      }
      payload.triadDetails.updatedBy = AuditInfo.UpdatedBy;
      payload.triadDetails.updatedAt = moment(AuditInfo.UpdatedOn).format(
        "YYYY-MM-DD HH:mm:ss",
      );
      sqlProductDetails.triadLinkInfo = await mySqlUtility.UpsertVendorData(
        payload.triadDetails,
        "TRIAD",
      );
      console.log(
        `Inserted Triad Info for ${mpid} with insertId : ${sqlProductDetails.triadLinkInfo}`,
      );
    }
  }

  await mySqlUtility.UpsertProductDetailsV2(
    new MySqlProduct(payload, sqlProductDetails, mpid, AuditInfo),
  );
};
export const GetAlternateProxyProviderName = async (
  details: any,
  providerId: any,
) => {
  if (details && details.length > 0) {
    const linkedProvider = details.find(
      (x: any) => x.proxyProvider == providerId,
    );

    return linkedProvider
      ? linkedProvider.method
        ? `${linkedProvider.proxyProviderName} - ${linkedProvider.method}`
        : `${linkedProvider.proxyProviderName}`
      : null;
  }
  return "";
};

/************************* PRIVATE FUNCTIONS *********************/
function getMappedDetails(product: any, fieldName: any) {
  let res = "";
  const keyValue = itemMapper.find(
    (x) => x.field.toLowerCase() == fieldName.toLowerCase(),
  )!.key;
  if (product.tradentDetails) {
    res = res + `TRADENT : ${product.tradentDetails[keyValue]} | `;
  }
  if (product.frontierDetails) {
    res = res + `FRONTIER : ${product.frontierDetails[keyValue]}  | `;
  }
  if (product.mvpDetails) {
    res = res + `MVP : ${product.mvpDetails[keyValue]}  | `;
  }
  if (product.triadDetails) {
    res = res + `TRIAD : ${product.triadDetails[keyValue]}  | `;
  }
  return res;
}

function parseBadgeIndicator(stringValue: any, evalType: any) {
  if (_.isEqual(evalType, "KEY")) {
    const $eval = badgeResx.find((x) =>
      _.isEqual(x.key, stringValue.trim().toUpperCase()),
    );
    return $eval && $eval.value
      ? $eval.value.trim()
      : (_.first(badgeResx) as any).value.trim();
  } else if (_.isEqual(evalType, "VALUE")) {
    const $eval = badgeResx.find((x) =>
      _.isEqual(x.value.toUpperCase(), stringValue.trim().toUpperCase()),
    );
    return $eval ? $eval.key : (_.first(badgeResx) as any).key;
  }
}

function removeBackslashes(obj: any) {
  if (obj && typeof obj === "object") {
    for (const key in obj) {
      if (obj[key]) {
        if (typeof obj[key] === "string") {
          obj[key] = obj[key].replace(/\\/g, "");
        } else if (typeof obj[key] === "object") {
          obj[key] = removeBackslashes(obj[key]);
        }
      }
    }
  }
  return obj;
}

function getCommonEntityValue(item: any, keyType: any, checkAll: any) {
  if (checkAll == true) {
    if (item.tradent && item.tradent[keyType]) {
      return item.tradent[keyType];
    }
    if (item.frontier && item.frontier[keyType]) {
      return item.frontier[keyType];
    }
    if (item.mvp && item.mvp[keyType]) {
      return item.mvp[keyType];
    }
    if (item.triad && item.triad[keyType]) {
      return item.triad[keyType];
    }
  } else if (checkAll == false) {
    if (item.tradent) {
      return item.tradent[keyType];
    }
    if (item.frontier) {
      return item.frontier[keyType];
    }
    if (item.mvp) {
      return item.mvp[keyType];
    }
    if (item.triad) {
      return item.triad[keyType];
    }
  }
  return null;
}

function getContextItem(product: any, key: any) {
  let contextData = null;
  if (product.tradentDetails) {
    contextData = product.tradentDetails[key];
  }
  if (product.frontierDetails && !contextData) {
    contextData = product.frontierDetails[key];
  }
  if (product.mvpDetails && !contextData) {
    contextData = product.mvpDetails[key];
  }
  if (product.topDentDetails && !contextData) {
    contextData = product.topDentDetails[key];
  }
  if (product.firstDentDetails && !contextData) {
    contextData = product.firstDentDetails[key];
  }
  if (product.triadDetails && !contextData) {
    contextData = product.triadDetails[key];
  }
  return contextData;
}

function mapUserDataToDbData(userData: any, dbData: any, AuditInfo: any) {
  userData.lastCronTime = dbData.last_cron_time
    ? moment(dbData.last_cron_time).format("YYYY-MM-DD HH:mm:ss")
    : null;
  userData.lastCronRun = dbData.lastCronRun;
  userData.lastUpdateTime = dbData.last_update_time
    ? moment(dbData.last_update_time).format("YYYY-MM-DD HH:mm:ss")
    : null;
  userData.lastUpdatedBy = dbData.lastUpdatedBy;
  userData.last_cron_message = dbData.last_cron_message;
  userData.lowest_vendor_price = dbData.lowest_vendor_price;
  userData.lastAttemptedTime = dbData.last_attempted_time
    ? moment(dbData.last_attempted_time).format("YYYY-MM-DD HH:mm:ss")
    : null;
  userData.lowest_vendor = dbData.lowest_vendor;
  userData.lastExistingPrice = dbData.lastExistingPrice;
  userData.lastSuggestedPrice = dbData.lastSuggestedPrice;
  userData.nextCronTime = dbData.next_cron_time
    ? moment(dbData.next_cron_time).format("YYYY-MM-DD HH:mm:ss")
    : null;
  userData.slowCronName =
    userData.isSlowActivated == true ? dbData.slowCronName : null;
  userData.slowCronId =
    userData.isSlowActivated == true ? dbData.slowCronId : null;
  userData.isSlowActivated =
    userData.isSlowActivated == true
      ? dbData.isSlowActivated
      : userData.isSlowActivated;
  userData.lastUpdatedByUser = AuditInfo.UpdatedBy;
  userData.lastUpdatedOn = moment(AuditInfo.UpdatedOn).format(
    "YYYY-MM-DD HH:mm:ss",
  );
  return userData;
}
