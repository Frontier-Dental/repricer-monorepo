import _ from "lodash";
import { v4 as uuid } from "uuid";
import moment from "moment";
import * as axiosHelper from "./axios-helper";
import * as mySqlHelper from "./mysql/mysql-helper";
import { Generate } from "./job-id-helper";
import { RunInfo } from "../model/sql-models/run-info";
import { ProductInfo } from "../model/sql-models/product-info";
import { PriceBreakInfo } from "../model/sql-models/price-break-info";
import { RunCompletionStatus } from "../model/sql-models/run-completion-status";
import { applicationConfig } from "./config";
import { HistoryModel } from "../model/sql-models/history";

export async function Execute(productList: any[], cronSetting: any): Promise<void> {
  if (productList && productList.length > 0) {
    const keyGen = Generate();
    await mySqlHelper.InsertRunCompletionStatus(new RunCompletionStatus(keyGen, "SCRAPE_ONLY", false));
    const isChunkNeeded = await IsChunkNeeded(productList);
    if (isChunkNeeded) {
      let chunkedList = _.chunk(productList, 2000);
      for (let chunk of chunkedList) {
        await executeScrapeLogic(keyGen, chunk, cronSetting);
      }
    } else await executeScrapeLogic(keyGen, productList, cronSetting);
    await mySqlHelper.UpdateRunCompletionStatus(new RunCompletionStatus(keyGen, "SCRAPE_ONLY", true));
  }
}

async function executeScrapeLogic(keyGen: string, productList: any[], cronSetting: any): Promise<void> {
  const runId: string = uuid();

  let runInfo = new RunInfo(cronSetting.CronName, cronSetting.CronId, runId.replaceAll("-", ""), keyGen, "SCRAPE_ONLY", productList.length, productList.length, 0, 0);
  const ownVendorListEnv = applicationConfig.OWN_VENDOR_LIST || "";
  const ownVendorList = ownVendorListEnv.split(";");
  const runInfoResult = await mySqlHelper.InsertRunInfo(runInfo);
  let productCounter = 0;
  const insertId = Array.isArray(runInfoResult) ? runInfoResult[0] : (runInfoResult as any)?.insertId;
  if (runInfoResult) {
    for (let prod of productList) {
      console.log(`SCRAPE-ONLY : Scraping started for ${prod.MpId}`);
      const scrapeStartTime = new Date();
      const getSearchResultsEnv = applicationConfig.GET_SEARCH_RESULTS || "";
      const searchRequest = getSearchResultsEnv.replace("{mpId}", prod.MpId);
      const net32resp = await axiosHelper.getAsyncProxy(searchRequest, cronSetting, prod.MpId);
      if (net32resp && net32resp.data) {
        await mySqlHelper.UpdateLastScrapeInfo(prod.MpId, moment(scrapeStartTime).format("YYYY-MM-DD HH:mm:ss"));
        const allowHistoryLoggingEnv = applicationConfig.SCRAPE_ONLY_LOGGING;
        const allowRunInfoLoggingEnv = applicationConfig.SCRAPE_RUN_LOGGING;
        if (allowHistoryLoggingEnv) {
          console.log(`SCRAPE-ONLY : Logging in history for ${prod.MpId} started at ${scrapeStartTime}`);
          const apiResponseLinkedId = await mySqlHelper.InsertHistoricalApiResponse(net32resp.data, scrapeStartTime);
          let historyList: any[] = [];
          if (prod.LinkedTradentDetailsInfo > 0) {
            historyList = historyList.concat(await GetHistoryModel(prod, net32resp.data, apiResponseLinkedId, scrapeStartTime, "TRADENT"));
          }
          if (prod.LinkedFrontiersDetailsInfo > 0) {
            historyList = historyList.concat(await GetHistoryModel(prod, net32resp.data, apiResponseLinkedId, scrapeStartTime, "FRONTIER"));
          }
          if (prod.LinkedMvpDetailsInfo > 0) {
            historyList = historyList.concat(await GetHistoryModel(prod, net32resp.data, apiResponseLinkedId, scrapeStartTime, "MVP"));
          }
          if (prod.LinkedTopDentDetailsInfo > 0) {
            historyList = historyList.concat(await GetHistoryModel(prod, net32resp.data, apiResponseLinkedId, scrapeStartTime, "TOPDENT"));
          }
          if (prod.LinkedFirstDentDetailsInfo > 0) {
            historyList = historyList.concat(await GetHistoryModel(prod, net32resp.data, apiResponseLinkedId, scrapeStartTime, "FIRSTDENT"));
          }
          if (prod.LinkedTriadDetailsInfo > 0) {
            historyList = historyList.concat(await GetHistoryModel(prod, net32resp.data, apiResponseLinkedId, scrapeStartTime, "TRIAD"));
          }
          if (prod.LinkedBiteSupplyDetailsInfo > 0) {
            historyList = historyList.concat(await GetHistoryModel(prod, net32resp.data, apiResponseLinkedId, scrapeStartTime, "BITESUPPLY"));
          }
          if (historyList && historyList.length > 0) {
            for (const historyItem of historyList) {
              await mySqlHelper.InsertHistory(historyItem, scrapeStartTime);
            }
          }
        }
        if (allowRunInfoLoggingEnv) {
          console.log(`SCRAPE-ONLY : Logging in run info for ${prod.MpId} started at ${scrapeStartTime}`);
          for (const [index, resp] of net32resp.data.entries()) {
            const isOwnVendor = _.includes(ownVendorList, resp.vendorId.toString());

            // Conversion needs to be done from boolean to number for the InsertProductInfo function
            if (resp.isFulfillmentPolicyStock === "true" || resp.isFulfillmentPolicyStock === true) {
              resp.isFulfillmentPolicyStock = 1;
            } else if (resp.isFulfillmentPolicyStock === "false" || resp.isFulfillmentPolicyStock === false) {
              resp.isFulfillmentPolicyStock = 0;
            }

            const productInfo = new ProductInfo(prod.MpId, resp, insertId, index + 1, isOwnVendor);
            productInfo.addStartTime(scrapeStartTime);
            productInfo.addEndTime(new Date());
            const productInfoResult = await mySqlHelper.InsertProductInfo(productInfo);
            console.log(`SCRAPE-ONLY : ${cronSetting.CronName} : ${keyGen} : Inserted Product Info for MPID : ${prod.MpId} | VENDOR : ${productInfo.VendorId}`);

            // Update vendor detail tables with market state for our own vendor
            if (isOwnVendor) {
              try {
                // Determine which vendor detail table to update based on the response vendorId
                const vendorIdStr = resp.vendorId.toString();
                let vendorName = "";

                // Match the response vendorId to the correct vendor name
                switch (vendorIdStr) {
                  case "17357":
                    vendorName = "TRADENT";
                    break;
                  case "20722":
                    vendorName = "FRONTIER";
                    break;
                  case "20755":
                    vendorName = "MVP";
                    break;
                  case "20727":
                    vendorName = "TOPDENT";
                    break;
                  case "20533":
                    vendorName = "FIRSTDENT";
                    break;
                  case "5":
                    vendorName = "TRIAD";
                    break;
                  case "10":
                    vendorName = "BITESUPPLY";
                    break;
                }

                if (vendorName) {
                  // Use the new function that ONLY updates market state columns

                  // Get price from priceBreaks for minQty=1
                  const basePrice = resp.priceBreaks?.find((pb: { minQty: number }) => pb.minQty === 1)?.unitPrice;

                  const marketData = {
                    inStock: resp.inStock === "true" || resp.inStock === true,
                    inventory: parseInt(resp.inventory) || 0,
                    ourPrice: basePrice ? parseFloat(basePrice) : undefined,
                    badgeId: resp.badgeId != null ? parseInt(resp.badgeId) > 0 : undefined,
                  };

                  await mySqlHelper.UpdateMarketStateOnly(prod.MpId, vendorName, marketData);

                  console.log(`SCRAPE-ONLY : Updated market state for ${vendorName} - MPID: ${prod.MpId}, InStock: ${resp.inStock}, Inventory: ${resp.inventory}, Price: ${resp.price}, Badge: ${marketData.badgeId}`);
                }
              } catch (error) {
                // Log error but don't stop scraping process
                console.error(`SCRAPE-ONLY : Failed to update market state for MPID: ${prod.MpId}`, error);
              }
            }

            if (productInfoResult && productInfoResult[0] && resp.priceBreaks) {
              for (const pb of resp.priceBreaks) {
                const priceBreakInfo = new PriceBreakInfo(productInfoResult[0], pb);
                await mySqlHelper.InsertPriceBreakInfo(priceBreakInfo);
              }
            }
          }
        }
        runInfo.UpdateSuccessCount();
      }
      await mySqlHelper.UpdateRunInfo(runInfo.GetCompletedProductCountQuery(), [productCounter + 1, insertId]);
      productCounter++;
    }
    runInfo.UpdateFailureCount(runInfo.EligibleCount - runInfo.ScrapedSuccessCount);
    runInfo.UpdateEndTime();
    await mySqlHelper.UpdateRunInfo(runInfo.GetSuccessCountQuery(), [runInfo.ScrapedSuccessCount, insertId]);
    await mySqlHelper.UpdateRunInfo(runInfo.GetFailureCountQuery(), [runInfo.ScrapedFailureCount, insertId]);
    await mySqlHelper.UpdateRunInfo(runInfo.GetRunEndTimeQuery(), [moment(runInfo.RunEndTime).format("DD-MM-YYYY HH:mm:ss"), insertId]);
  }
  console.log(`SCRAPE-ONLY : Successfully scraped  ${runInfo.ScrapedSuccessCount} products || total Count : ${productList.length} || Cron Name : ${cronSetting.CronName} || KeyGen : ${keyGen}`);
}

const IsChunkNeeded = async (list: any[]): Promise<boolean> => {
  return list.length > 2000;
};

async function GetHistoryModel(vendorDetails: any, apiResponse: any, apiResponseLinkedId: any, refTime: any, vendorName: string): Promise<any[]> {
  let listOfHistory: any[] = [];
  const ownVendorProductId = getOwnVendorId(vendorName);
  if (!ownVendorProductId) {
    console.log(`No own vendor found for ${vendorName}`);
    return listOfHistory;
  }
  const ownVendorDetails = apiResponse.find((x: any) => {
    return x.vendorId.toString() == ownVendorProductId;
  });
  if (!ownVendorDetails) {
    console.log(`No own vendor details found for ${vendorName}`);
    return listOfHistory;
  }
  if (ownVendorDetails.priceBreaks && ownVendorDetails.priceBreaks.length > 0) {
    ownVendorDetails.priceBreaks = _.sortBy(ownVendorDetails.priceBreaks, ["minQty"]);
    _.forEach(ownVendorDetails.priceBreaks, (priceBreak) => {
      const contextMinQty = parseInt(priceBreak.minQty);
      const existingPrice = parseFloat(priceBreak.unitPrice);

      let eligibleVendors: any[] = [];
      apiResponse.forEach((element: { priceBreaks: any[]; inStock: boolean }) => {
        if (element.priceBreaks) {
          element.priceBreaks.forEach((p: { minQty: number }) => {
            if (p.minQty == contextMinQty) {
              eligibleVendors.push(element);
            }
          });
        }
      });
      const rank: number = eligibleVendors.findIndex((vendor) => vendor.vendorId.toString() == ownVendorProductId);
      eligibleVendors = _.sortBy(eligibleVendors, [
        (prod) => {
          const match = _.find(prod.priceBreaks, (x) => x?.minQty === contextMinQty);
          return match ? match.unitPrice : Infinity;
        },
      ]);
      const lowestPrice = _.first(eligibleVendors)?.priceBreaks?.find((x: { minQty: number }) => x.minQty === contextMinQty)?.unitPrice ?? null;
      const maxVendorPrice = _.last(eligibleVendors)?.priceBreaks?.find((x: { minQty: number }) => x.minQty === contextMinQty)?.unitPrice ?? null;
      const history = {
        vendorName: vendorName,
        existingPrice: existingPrice,
        minQty: contextMinQty,
        rank: rank,
        lowestVendor: _.first(eligibleVendors)?.vendorName ?? null,
        lowestPrice: lowestPrice,
        suggestedPrice: "N/A",
        repriceComment: "N/A",
        maxVendor: _.last(eligibleVendors)?.vendorName ?? null,
        maxVendorPrice: maxVendorPrice,
        otherVendorList: "N/A",
        contextCronName: "SCRAPE-ONLY",
        apiResponse: apiResponse,
        triggeredByVendor: null,
        repriceResult: null, // Merging with repricer-api-core - is this correct?
        getOtherVendorList: () => "N/A", // Merging with repricer-api-core - is this correct?
      };
      listOfHistory.push(new HistoryModel(history, vendorDetails.MpId, refTime, apiResponseLinkedId));
    });
  }
  return listOfHistory;
}

function getOwnVendorId(vendorName: string): string | null {
  let vendorId = null;
  switch (
    vendorName.toUpperCase() //17357;20722;20755;20533;20727
  ) {
    case "TRADENT":
      vendorId = "17357";
      break;
    case "FRONTIER":
      vendorId = "20722";
      break;
    case "MVP":
      vendorId = "20755";
      break;
    case "TOPDENT":
      vendorId = "20533";
      break;
    case "FIRSTDENT":
      vendorId = "20727";
      break;
    case "TRIAD":
      vendorId = "5";
      break;
    case "BITESUPPLY":
      vendorId = "10";
      break;
    default:
      break;
  }
  return vendorId;
}
