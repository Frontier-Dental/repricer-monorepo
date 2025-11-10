import fs from "fs";
import _ from "lodash";
import { CronStatusModel } from "../../model/cron-status";
import { ErrorItemModel } from "../../model/error-item";
import { RepriceAsyncResponse } from "../../model/reprice-async-response";
import { FrontierProduct } from "../../types/frontier";
import * as axiosHelper from "../axios-helper";
import { applicationConfig } from "../config";
import * as dbHelper from "../mongo/db-helper";
import * as sqlHelper from "../mysql/mysql-helper";
import * as requestGenerator from "../request-generator";
import { repriceProduct } from "./v1/algo-v1";
import { AlgoExecutionMode, VendorName } from "@repricer-monorepo/shared";
import { repriceProductV2Wrapper } from "./v2/wrapper";
import * as filterMapper from "../filter-mapper";
import { ProductDetailsListItem } from "../mysql/mySql-mapper";

export async function RepriceOpportunityItemV2(
  productList: any[],
  cronInitTime: any,
  keyGen: string,
) {
  let cronLogs: any = {
    time: cronInitTime,
    keyGen: keyGen,
    logs: [],
    cronId: "DUMMY-OPPORTUNITY",
    type: "OpportunityItem",
    EligibleCount: productList.length,
  };
  let _contextCronStatus = new CronStatusModel(
    cronInitTime,
    0,
    productList.length,
    "In-Progress",
    "DUMMY-OPPORTUNITY",
    keyGen,
  );
  await initCronStatus(_contextCronStatus);
  var deltaList = await filterDeltaProducts(productList, keyGen);
  productList = await scanDeltaListOfProducts(productList, deltaList!);
  let cronProdCounter = 1;
  for (let prod of productList) {
    console.log(
      `OPPORTUNITY: Processing ${prod.mpId} for opportunity at ${new Date()}`,
    );
    const repriceOpportunityItemResponse = await RepriceOpportunityItem(
      prod,
      cronInitTime,
      prod.cronSettingsResponse,
      prod.contextVendor,
    );
    if (
      repriceOpportunityItemResponse &&
      repriceOpportunityItemResponse.logs &&
      repriceOpportunityItemResponse.logs.length > 0
    ) {
      if (repriceOpportunityItemResponse.logs.length == 1) {
        cronLogs.logs.push(_.first(repriceOpportunityItemResponse.logs));
      } else if (repriceOpportunityItemResponse.logs.length > 1) {
        const tempLog = [];
        for (const $ of repriceOpportunityItemResponse.logs) {
          tempLog.push(_.first($));
        }
        cronLogs.logs.push(tempLog);
      }
    }
    _contextCronStatus.SetProductCount(cronProdCounter);
    await dbHelper.UpdateCronStatusAsync(_contextCronStatus);
    cronProdCounter++;
  }
  if (cronLogs.logs && cronLogs.logs.length > 0) {
    cronLogs.completionTime = new Date();
    await dbHelper.PushLogsAsync(cronLogs);
  }
  _contextCronStatus.SetStatus("Complete");
  await dbHelper.UpdateCronStatusAsync(_contextCronStatus);
  cleanActiveProductList(keyGen);
}

async function initCronStatus(_contextCronStatus: any) {
  await dbHelper.InitCronStatusAsync(_contextCronStatus);
}

function updateLowestVendor(
  repriceResult: {
    cronResponse: RepriceAsyncResponse;
    priceUpdateResponse: any;
    historyIdentifier: any;
  },
  prod: ProductDetailsListItem,
) {
  const newProduct: any = { ...prod };
  if (repriceResult.cronResponse && repriceResult.cronResponse.repriceData) {
    if (repriceResult.cronResponse.repriceData.repriceDetails) {
      newProduct.lowest_vendor =
        repriceResult.cronResponse.repriceData.repriceDetails.lowestVendor;
      newProduct.lowest_vendor_price =
        repriceResult.cronResponse.repriceData.repriceDetails.lowestVendorPrice;
    } else if (
      repriceResult.cronResponse.repriceData.listOfRepriceDetails &&
      repriceResult.cronResponse.repriceData.listOfRepriceDetails.length > 0
    ) {
      newProduct.lowest_vendor = "";
      newProduct.lowest_vendor_price = "";
      for (const rep of repriceResult.cronResponse.repriceData
        .listOfRepriceDetails) {
        newProduct.lowest_vendor += `${rep.minQty}@${rep.lowestVendor} / `;
        newProduct.lowest_vendor_price += `${rep.minQty}@${rep.lowestVendorPrice} / `;
      }
    }
  }
  return prod;
}

export async function RepriceOpportunityItem(
  details: any,
  cronInitTime: any,
  cronSetting: any,
  _contextVendor: string,
) {
  let cronLogs: any = {
    time: cronInitTime,
    logs: [] as any[],
    cronId: cronSetting.CronId,
    type: "OpportunityItem",
  };
  const contextOpportunityDetails =
    await dbHelper.GetEligibleContextOpportunityItems(
      true,
      details.mpId,
      _contextVendor,
    );
  const prioritySequence = await requestGenerator.GetPrioritySequence(
    details,
    contextOpportunityDetails,
    true,
  );
  const seqString = `SEQ : ${prioritySequence.map((p) => p.name).join(", ")}`;
  if (prioritySequence && prioritySequence.length > 0) {
    const searchRequest = applicationConfig.GET_SEARCH_RESULTS.replace(
      "{mpId}",
      details.mpId,
    );
    var net32result = await axiosHelper.getAsync(
      searchRequest,
      "DUMMY-OPPORTUNITY",
      seqString,
    );
    let isPriceUpdatedForVendor = false;
    if (
      details.algo_execution_mode === AlgoExecutionMode.V2_ONLY ||
      details.algo_execution_mode === AlgoExecutionMode.V2_EXECUTE_V1_DRY ||
      details.algo_execution_mode === AlgoExecutionMode.V1_EXECUTE_V2_DRY
    ) {
      await repriceProductV2Wrapper(
        net32result.data,
        details,
        cronSetting ? cronSetting.CronName : "ExpressCron",
        false,
      );
    }
    if (
      details.algo_execution_mode === AlgoExecutionMode.V1_ONLY ||
      details.algo_execution_mode === AlgoExecutionMode.V1_EXECUTE_V2_DRY ||
      details.algo_execution_mode === AlgoExecutionMode.V2_EXECUTE_V1_DRY
    ) {
      for (const seq of prioritySequence) {
        if (!isPriceUpdatedForVendor) {
          const contextVendor = seq.name;
          let prod = await filterMapper.GetProductDetailsByVendor(
            details,
            contextVendor,
          );
          let tempProd = _.cloneDeep(prod);
          prod.last_cron_time = new Date();
          let isPriceUpdated = false;
          if (prod.scrapeOn == true && prod.activated == true) {
            // const postUrl = applicationConfig.REPRICE_OWN_URL.replace(
            //   "{mpId}",
            //   prod.mpid,
            // );
            console.log(
              `REPRICE : Opportunity : ${details.insertReason} : ${contextVendor} : Requesting Reprice info for ${prod.mpid} at Time :  ${new Date().toISOString()}`,
            );
            prod.last_attempted_time = new Date();
            prod.lastCronRun = `Opportunity-Cron`;
            tempProd.cronName =
              applicationConfig.CRON_NAME_OPPORTUNITY || "Opportunity-Cron";
            tempProd.contextVendor = contextVendor;
            tempProd.contextCronName = `ExpressCron`;
            let data: any = {};
            data.result = net32result ? net32result.data : [];
            data.prod = tempProd;
            data.contextVendor = contextVendor;
            const repriceResult = await repriceProduct(
              prod.mpid!,
              net32result.data.filter((p: any) => p.priceBreaks !== undefined),
              tempProd as unknown as FrontierProduct,
              contextVendor,
            );
            // const repriceResult: AxiosResponse<RepriceProductHttpResponse> =
            // await axiosHelper.postAsync(data, postUrl);
            if (repriceResult) {
              if (
                repriceResult.priceUpdateResponse &&
                repriceResult.priceUpdateResponse != null
              ) {
                if (
                  JSON.stringify(repriceResult.priceUpdateResponse).indexOf(
                    "ERROR:422",
                  ) == -1 &&
                  JSON.stringify(repriceResult.priceUpdateResponse).indexOf(
                    "ERROR:429",
                  ) == -1 &&
                  JSON.stringify(repriceResult.priceUpdateResponse).indexOf(
                    "ERROR:404",
                  ) == -1 &&
                  JSON.stringify(repriceResult.priceUpdateResponse).indexOf(
                    "ERROR:",
                  ) == -1
                ) {
                  cronLogs.logs.push([
                    {
                      productId: prod.mpid,
                      logs: repriceResult.cronResponse,
                      vendor: contextVendor,
                      priceUpdated: true,
                      priceUpdatedOn: new Date(),
                      priceUpdateResponse: repriceResult.priceUpdateResponse,
                    },
                  ]);
                  prod.last_update_time = new Date();
                  isPriceUpdated = true;
                  prod.lastUpdatedBy = `Opportunity-Cron`;
                  isPriceUpdatedForVendor = true;
                  if (prod.wait_update_period == true) {
                    prod.next_cron_time = calculateNextCronTime(new Date(), 12);
                    const priceUpdatedItem = new ErrorItemModel(
                      prod.mpid,
                      prod.next_cron_time,
                      true,
                      prod.cronId,
                      "PRICE_UPDATE",
                      contextVendor,
                    );
                    await dbHelper.UpsertOpportunityItemLog(priceUpdatedItem);
                    console.log({
                      message: `${prod.mpid} processed by Opportunity Cron`,
                      obj: JSON.stringify(priceUpdatedItem),
                    });
                  } else {
                    prod.next_cron_time = null;
                    const priceUpdatedItem = new ErrorItemModel(
                      prod.mpid,
                      prod.next_cron_time,
                      false,
                      prod.cronId,
                      "IGNORE",
                      contextVendor,
                    );
                    await dbHelper.UpsertOpportunityItemLog(priceUpdatedItem);
                    console.log(`GHOST : ${prod.mpid} - ${contextVendor}`);
                  }
                } else if (
                  JSON.stringify(repriceResult.priceUpdateResponse).indexOf(
                    "ERROR:422",
                  ) > -1
                ) {
                  prod.next_cron_time = await getNextCronTime(
                    repriceResult.priceUpdateResponse,
                  );
                  // Add the product to Error Item Table.
                  const errorItem = new ErrorItemModel(
                    prod.mpid,
                    prod.next_cron_time,
                    true,
                    prod.cronId,
                    "OPPORTUNITY_ERROR",
                    contextVendor,
                  );
                  await dbHelper.UpsertOpportunityItemLog(errorItem);
                  console.log({
                    message: `${prod.mpid} encountered error in Opportunity Cron`,
                    obj: JSON.stringify(errorItem),
                  });
                  cronLogs.logs.push([
                    {
                      productId: prod.mpid,
                      logs: repriceResult.cronResponse,
                      vendor: contextVendor,
                      priceUpdated: false,
                      priceUpdateResponse: repriceResult.priceUpdateResponse,
                    },
                  ]);
                } else {
                  prod.next_cron_time = null;
                  const priceUpdatedItem = new ErrorItemModel(
                    prod.mpid,
                    prod.next_cron_time,
                    false,
                    prod.cronId,
                    "IGNORE",
                    contextVendor,
                  );
                  await dbHelper.UpsertOpportunityItemLog(priceUpdatedItem);
                  console.log(
                    `ERROR WHILE PRICE UPDATE : ${prod.mpid} - ${contextVendor}`,
                  );
                }
              } else {
                prod.next_cron_time = null;
                const errorItem = new ErrorItemModel(
                  prod.mpid,
                  null,
                  false,
                  prod.cronId,
                  `IGNORE`,
                  contextVendor,
                );
                await dbHelper.UpsertOpportunityItemLog(errorItem);
                cronLogs.logs.push([
                  {
                    productId: prod.mpid,
                    vendor: contextVendor,
                    logs: repriceResult.cronResponse,
                  },
                ]);
              }
            }
            // Add Last_Cron_Reprice_Message
            prod.last_cron_message = filterMapper.GetLastCronMessageSimple(
              repriceResult as any,
            );

            // Update History With Proper Message
            if (
              repriceResult &&
              repriceResult.historyIdentifier &&
              repriceResult.historyIdentifier.length > 0
            ) {
              for (const histItem of repriceResult.historyIdentifier) {
                const errorMessage = await getErrorMessage(
                  repriceResult,
                  histItem.minQty,
                );
                await sqlHelper.UpdateHistoryWithMessage(
                  histItem.historyIdentifier,
                  prod.last_cron_message,
                );
                console.log(
                  `History Updated for ${prod.mpid} with Identifier : ${histItem.historyIdentifier} and Message : ${prod.last_cron_message}`,
                );
              }
            }
            prod = updateLowestVendor(repriceResult as any, prod);
            prod = updateCronBasedDetails(repriceResult, prod, false);
            await sqlHelper.UpdateProductAsync(
              prod,
              isPriceUpdated,
              contextVendor,
            );
            //dbHelper.UpdateProductAsync(prod, isPriceUpdated, contextVendor);
          } else {
            prod.next_cron_time = null;
            const errorItem = new ErrorItemModel(
              prod.mpid,
              null,
              false,
              prod.cronId,
              "IGNORE",
              contextVendor,
            );
            await dbHelper.UpsertOpportunityItemLog(errorItem);
            await sqlHelper.UpdateProductAsync(
              prod,
              isPriceUpdated,
              contextVendor,
            ); //dbHelper.UpdateProductAsync(prod, isPriceUpdated, contextVendor);
          }
        }
      }
    }
  }
  if (applicationConfig.ENABLE_SLOW_CRON_FEATURE) {
    let productUpdateNeeded = false;
    if (details.tradentDetails) {
      details.tradentDetails.slowCronId = null;
      details.tradentDetails.slowCronName = null;
      productUpdateNeeded = true;
    }
    if (details.frontierDetails) {
      details.frontierDetails.slowCronId = null;
      details.frontierDetails.slowCronName = null;
      productUpdateNeeded = true;
    }
    if (details.mvpDetails) {
      details.mvpDetails.slowCronId = null;
      details.mvpDetails.slowCronName = null;
      productUpdateNeeded = true;
    }
    if (details.topDentDetails) {
      details.topDentDetails.slowCronId = null;
      details.topDentDetails.slowCronName = null;
      productUpdateNeeded = true;
    }
    if (details.firstDentDetails) {
      details.firstDentDetails.slowCronId = null;
      details.firstDentDetails.slowCronName = null;
      productUpdateNeeded = true;
    }
    if (details.triadDetails) {
      details.triadDetails.slowCronId = null;
      details.triadDetails.slowCronName = null;
      productUpdateNeeded = true;
    }
    if (productUpdateNeeded) {
      details.isSlowActivated = false;
      await sqlHelper.UpdateCronForProductAsync(details); //await dbHelper.UpdateCronForProductAsync(details);
      console.log(`MOVEMENT(OPPORTUNITY-CRON) : Product : ${details.mpId}`);
    }
  }
  // if (cronLogs.logs && cronLogs.logs.length > 0) {
  //     cronLogs.completionTime = new Date();
  //     dbHelper.PushLogsAsync(cronLogs);
  // }
  // Extra code to Ignore Opportunity Items if context vendor is null or is deactivated.
  alignErrorItems(details, _contextVendor);
  return cronLogs;
}

function getNextCronTime(priceUpdateResponse: any) {
  const messageText = priceUpdateResponse.message;
  if (messageText && typeof messageText == "string") {
    const timeStr = messageText.split("this time:")[1];
    return timeStr
      ? new Date(timeStr.trim())
      : calculateNextCronTime(new Date(), 12);
  } else return calculateNextCronTime(new Date(), 12);
}

function updateCronBasedDetails(
  repriceResult: any,
  prod: any,
  isPriceUpdated: boolean,
) {
  if (
    repriceResult &&
    repriceResult.data &&
    repriceResult.data.cronResponse &&
    repriceResult.data.cronResponse.repriceData
  ) {
    if (repriceResult.data.cronResponse.repriceData.repriceDetails) {
      prod.lastExistingPrice =
        repriceResult.data.cronResponse.repriceData.repriceDetails.oldPrice.toString();
      prod.lastSuggestedPrice = repriceResult.data.cronResponse.repriceData
        .repriceDetails.goToPrice
        ? repriceResult.data.cronResponse.repriceData.repriceDetails.goToPrice
        : repriceResult.data.cronResponse.repriceData.repriceDetails.newPrice;
    } else if (
      repriceResult.data.cronResponse.repriceData.listOfRepriceDetails &&
      repriceResult.data.cronResponse.repriceData.listOfRepriceDetails.length >
        0
    ) {
      prod.lastExistingPrice = "";
      prod.lastSuggestedPrice = "";
      for (const rep of repriceResult.data.cronResponse.repriceData
        .listOfRepriceDetails) {
        prod.lastExistingPrice += `${rep.minQty}@${rep.oldPrice} / `;
        prod.lastSuggestedPrice += rep.goToPrice
          ? `${rep.minQty}@${rep.goToPrice} / `
          : `${rep.minQty}@${rep.newPrice} / `;
      }
    }
  }
  if (isPriceUpdated && isPriceUpdated == true) {
    prod.latest_price = prod.lastSuggestedPrice;
  }
  return prod;
}

function calculateNextCronTime(currentTime: Date, hoursToAdd: number) {
  return new Date(currentTime.setHours(currentTime.getHours() + hoursToAdd));
}

function getProductDetailsByVendor(details: any, contextVendor: string) {
  if (contextVendor === VendorName.TRADENT) {
    return details.tradentDetails;
  }
  if (contextVendor === VendorName.FRONTIER) {
    return details.frontierDetails;
  }
  if (contextVendor === VendorName.MVP) {
    return details.mvpDetails;
  }
  if (contextVendor === VendorName.TOPDENT) {
    return details.topDentDetails;
  }
  if (contextVendor === VendorName.FIRSTDENT) {
    return details.firstDentDetails;
  }
  if (contextVendor == VendorName.TRIAD) {
    return details.triadDetails;
  }
}

async function alignErrorItems(details: any, _contextVendor: string) {
  const productDetails = getProductDetailsByVendor(details, _contextVendor);
  if (
    (productDetails && productDetails.activated == false) ||
    !productDetails ||
    productDetails == null
  ) {
    const errorItem = new ErrorItemModel(
      details.mpId,
      null,
      false,
      null,
      "IGNORE",
      _contextVendor,
    );
    await dbHelper.UpsertOpportunityItemLog(errorItem);
  }
}

function filterDeltaProducts(productList: any[], keygen: string) {
  let finalList = productList;
  if (!productList || productList == null || productList.length == 0)
    return productList;
  const freshProducts = _.map(productList, (i) => ({
    mpId: i.mpId,
    contextVendor: i.contextVendor,
  }));
  if (freshProducts && freshProducts.length > 0) {
    //Read Existing Active Products
    const filePath = "./activeProducts.json";
    let contentsToWrite = [{ key: keygen, products: freshProducts }];
    let activeProducts: any[] = [];
    let details = fs.readFileSync(filePath, "utf8");
    let fileContent = JSON.parse(details);

    if (fileContent && fileContent.length > 0) {
      _.forEach(fileContent, (item) => {
        activeProducts = activeProducts.concat(item.products);
      });
    }
    //Find the delta

    const fieldsToCompare = ["mpId", "contextVendor"];
    const pickFields = (obj: any) => _.pick(obj, fieldsToCompare);
    finalList = _.differenceWith(freshProducts, activeProducts, (a, b) =>
      _.isEqual(pickFields(a), pickFields(b)),
    );
    if (finalList && finalList.length > 0) {
      fileContent.push({ key: keygen, products: finalList });
      contentsToWrite = fileContent;
      console.log(
        `Delta Found for KeyGen : ${keygen} : Fresh Products : ${freshProducts.length} || Active Products : ${activeProducts.length} || Delta Products : ${finalList.length}`,
      );
      //Write in Existing File
      fs.writeFileSync(filePath, JSON.stringify(contentsToWrite));
    }
  }
}

function cleanActiveProductList(keyGen: string) {
  const filePath = "./activeProducts.json";
  let details = fs.readFileSync(filePath, "utf8");
  let fileContent = JSON.parse(details);
  if (fileContent && fileContent.length > 0) {
    var contextItem = fileContent.filter((t: any) => t.key == keyGen);
    if (contextItem && contextItem.length > 0) {
      _.remove(fileContent, (t: any) => t.key == keyGen);
      //Write in Existing File
      fs.writeFileSync(filePath, JSON.stringify(fileContent));
    }
  }
}

function scanDeltaListOfProducts(productList: any[], deltaList: any[]) {
  var filterDeltaProducts: any[] = [];
  if (deltaList == null || deltaList.length == 0) return productList;
  _.forEach(productList, (p) => {
    const linkedDelta = deltaList.filter(
      (x) => x.mpId == p.mpId && x.contextVendor == p.contextVendor,
    );
    if (linkedDelta && linkedDelta.length > 0) {
      filterDeltaProducts.push(p);
    }
  });
  return filterDeltaProducts;
}

async function getErrorMessage(repriceResult: any, minQty: any) {
  let resultStr = "";
  if (
    repriceResult &&
    repriceResult.data &&
    repriceResult.data.cronResponse &&
    repriceResult.data.cronResponse.repriceData
  ) {
    if (repriceResult.data.cronResponse.repriceData.repriceDetails) {
      resultStr =
        repriceResult.data.cronResponse.repriceData.repriceDetails.explained;
    } else if (
      repriceResult.data.cronResponse.repriceData.listOfRepriceDetails &&
      repriceResult.data.cronResponse.repriceData.listOfRepriceDetails.length >
        0
    ) {
      const contextData =
        repriceResult.data.cronResponse.repriceData.listOfRepriceDetails.find(
          (x: { minQty: any }) => x.minQty === minQty,
        );
      resultStr = contextData.explained;
    }
  }
  return resultStr;
}
