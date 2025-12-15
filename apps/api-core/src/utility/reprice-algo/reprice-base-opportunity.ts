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
    cronId: "Cron-Opportunity",
    type: "OpportunityItem",
    EligibleCount: productList.length,
  };

  let _contextCronStatus = new CronStatusModel(
    cronInitTime,
    0,
    productList.length,
    "In-Progress",
    "Cron-Opportunity",
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

/**
 * Reprices a single product from the Opportunity Cron queue.
 * This is a "one-shot" cron - products are processed once and then removed from the queue.
 *
 * @param details - Product details including mpId and vendor-specific info
 * @param cronInitTime - When this cron run started
 * @param cronSetting - Cron configuration settings
 * @param _contextVendor - The vendor to reprice for (e.g., "FRONTIER", "TRADENT")
 */
export async function RepriceOpportunityItem(
  details: any,
  cronInitTime: any,
  cronSetting: any,
  _contextVendor: string,
) {
  // ============================================================================
  // STEP 1: Initialize cron logs for tracking this product's processing
  // ============================================================================
  let cronLogs: any = {
    time: cronInitTime,
    logs: [] as any[],
    cronId: cronSetting.CronId,
    type: "OpportunityItem",
  };

  // ============================================================================
  // STEP 2: Get existing opportunity items for this product/vendor from MongoDB
  // ============================================================================
  const contextOpportunityDetails =
    await dbHelper.GetEligibleContextOpportunityItems(
      true,
      details.mpId,
      _contextVendor,
    );

  console.log("contextOpportunityDetails", contextOpportunityDetails);

  // ============================================================================
  // STEP 3: Determine vendor priority sequence for repricing
  // This decides which vendors to try repricing with and in what order
  // ============================================================================
  const prioritySequence = await requestGenerator.GetPrioritySequence(
    details,
    contextOpportunityDetails,
    true,
  );

  const seqString = `SEQ : ${prioritySequence.map((p) => p.name).join(", ")}`;

  if (prioritySequence && prioritySequence.length > 0) {
    // ==========================================================================
    // STEP 4: Fetch current market prices from Net32 API
    // ==========================================================================
    const searchRequest = applicationConfig.GET_SEARCH_RESULTS.replace(
      "{mpId}",
      details.mpId,
    );

    var net32result = await axiosHelper.getAsync(
      searchRequest,
      "Cron-Opportunity",
      seqString,
    );

    let isPriceUpdatedForVendor = false;

    // ==========================================================================
    // STEP 5: Run V2 Algorithm (if configured)
    // V2 is the newer repricing algorithm
    // ==========================================================================
    if (
      details.algo_execution_mode === AlgoExecutionMode.V2_ONLY ||
      details.algo_execution_mode === AlgoExecutionMode.V2_EXECUTE_V1_DRY ||
      details.algo_execution_mode === AlgoExecutionMode.V1_EXECUTE_V2_DRY
    ) {
      await repriceProductV2Wrapper(
        net32result.data,
        details,
        cronSetting ? cronSetting.CronName : "Cron-Opportunity",
        false,
      );
    }

    // ==========================================================================
    // STEP 6: Run V1 Algorithm (if configured)
    // V1 is the original repricing algorithm - iterates through vendors
    // ==========================================================================
    if (
      details.algo_execution_mode === AlgoExecutionMode.V1_ONLY ||
      details.algo_execution_mode === AlgoExecutionMode.V1_EXECUTE_V2_DRY ||
      details.algo_execution_mode === AlgoExecutionMode.V2_EXECUTE_V1_DRY
    ) {
      // Loop through each vendor in priority order
      for (const seq of prioritySequence) {
        // Stop if we already updated price for one vendor (only update once per product)
        if (!isPriceUpdatedForVendor) {
          const contextVendor = seq.name;

          // Get vendor-specific product details
          let prod = await filterMapper.GetProductDetailsByVendor(
            details,
            contextVendor,
          );

          let tempProd = _.cloneDeep(prod);
          prod.last_cron_time = new Date();
          let isPriceUpdated = false;

          // ====================================================================
          // STEP 6a: Check if product is eligible for repricing
          // Must have scrapeOn=true AND activated=true
          // ====================================================================
          if (prod.scrapeOn == true && prod.activated == true) {
            console.log(
              `REPRICE : Opportunity : ${details.insertReason} : ${contextVendor} : Requesting Reprice info for ${prod.mpid} at Time :  ${new Date().toISOString()}`,
            );

            // Set up product metadata for repricing
            prod.last_attempted_time = new Date();
            prod.lastCronRun = `Cron-Opportunity`;
            tempProd.cronName =
              applicationConfig.CRON_NAME_OPPORTUNITY || "Cron-Opportunity";
            tempProd.contextVendor = contextVendor;
            tempProd.contextCronName = `Cron-Opportunity`;
            let data: any = {};
            data.result = net32result ? net32result.data : [];
            data.prod = tempProd;
            data.contextVendor = contextVendor;

            // ==================================================================
            // STEP 6b: Execute the repricing algorithm
            // This calculates the optimal price and attempts to update it
            // ==================================================================
            const repriceResult = await repriceProduct(
              prod.mpid!,
              net32result.data.filter((p: any) => p.priceBreaks !== undefined),
              tempProd as unknown as FrontierProduct,
              contextVendor,
            );

            console.log(
              "repriceResult.priceUpdateResponse",
              repriceResult.priceUpdateResponse,
            );

            if (repriceResult) {
              // ================================================================
              // STEP 6c: Handle repricing result - price update was ATTEMPTED
              // ================================================================
              if (
                repriceResult.priceUpdateResponse &&
                repriceResult.priceUpdateResponse != null
              ) {
                // Check if update was successful (no errors)
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
                  // ==============================================================
                  // SUCCESS: Price was updated successfully
                  // - Log the successful update
                  // - Move product to Express Cron (422 cron) for 12-hour monitoring
                  // - Remove from Opportunity Cron
                  // ==============================================================
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
                  prod.lastUpdatedBy = `Cron-Opportunity`;
                  isPriceUpdatedForVendor = true;
                  prod.next_cron_time = calculateNextCronTime(new Date(), 12);

                  // Add to Express/422 Cron for monitoring (runs again in 12 hours)
                  const expressItem = new ErrorItemModel(
                    prod.mpid,
                    prod.next_cron_time,
                    true,
                    prod.cronId,
                    "PRICE_UPDATE",
                    contextVendor,
                  );

                  await dbHelper.UpsertErrorItemLog(expressItem);
                  console.log({
                    message: `${prod.mpid} moved to Express Cron from Opportunity Cron`,
                    obj: JSON.stringify(expressItem),
                  });

                  // Remove from Opportunity cron (mark as processed)
                  const opportunityItem = new ErrorItemModel(
                    prod.mpid,
                    null,
                    false,
                    prod.cronId,
                    "PROCESSED",
                    contextVendor,
                  );

                  await dbHelper.UpsertOpportunityItemLog(opportunityItem);
                  console.log(
                    `[OPPORTUNITY-CRON] Product ${prod.mpid} (${contextVendor}): REPRICED SUCCESSFULLY - moved to Express Cron`,
                  );
                } else if (
                  JSON.stringify(repriceResult.priceUpdateResponse).indexOf(
                    "ERROR:422",
                  ) > -1
                ) {
                  // ==============================================================
                  // 422 ERROR: Rate limited by Net32
                  // - Remove from Opportunity Cron
                  // - Product will be picked up by 422 Cron automatically
                  // ==============================================================
                  const opportunityItem = new ErrorItemModel(
                    prod.mpid,
                    null,
                    false,
                    prod.cronId,
                    "422_ERROR",
                    contextVendor,
                  );

                  await dbHelper.UpsertOpportunityItemLog(opportunityItem);
                  console.log(
                    `[OPPORTUNITY-CRON] Product ${prod.mpid} (${contextVendor}): 422 ERROR - moved to 422 Cron`,
                  );

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
                  // ==============================================================
                  // OTHER ERROR: 429 (too many requests), 404 (not found), etc.
                  // - Remove from Opportunity Cron
                  // - Don't retry automatically
                  // ==============================================================
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
                    `[OPPORTUNITY-CRON] Product ${prod.mpid} (${contextVendor}): OTHER ERROR - removed from Opportunity Cron`,
                  );
                }
              }

              // ================================================================
              // STEP 6d: Handle repricing result - NO price update was needed
              // The algorithm determined the current price is optimal
              // ================================================================
              else {
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
                console.log(
                  `[OPPORTUNITY-CRON] Product ${prod.mpid} (${contextVendor}): NO REPRICE NEEDED - removed from Opportunity Cron`,
                );

                cronLogs.logs.push([
                  {
                    productId: prod.mpid,
                    vendor: contextVendor,
                    logs: repriceResult.cronResponse,
                  },
                ]);
              }
            }

            // ==================================================================
            // STEP 6e: Update product metadata after repricing attempt
            // ==================================================================

            // Set the last cron message (human-readable result)
            prod.last_cron_message = filterMapper.GetLastCronMessageSimple(
              repriceResult as any,
            );

            // Update price history records with the result message
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

            // Update lowest vendor info and cron-based details
            prod = updateLowestVendor(repriceResult as any, prod);
            prod = updateCronBasedDetails(repriceResult, prod, false);

            // Save updated product to MySQL
            await sqlHelper.UpdateProductAsync(
              prod,
              isPriceUpdated,
              contextVendor,
            );
          } else {
            // ==================================================================
            // STEP 6f: Product is NOT eligible for repricing
            // Either scrapeOn=false or activated=false
            // ==================================================================
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
            console.log(
              `[OPPORTUNITY-CRON] Product ${prod.mpid} (${contextVendor}): SKIPPED - scrapeOn=${prod.scrapeOn}, activated=${prod.activated}`,
            );
            await sqlHelper.UpdateProductAsync(
              prod,
              isPriceUpdated,
              contextVendor,
            );
          }
        }
      }
    }
  }

  // ============================================================================
  // STEP 7: Clean up Slow Cron assignments (if feature is enabled)
  // Remove this product from any slow cron queues since it's been processed
  // ============================================================================
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
      await sqlHelper.UpdateCronForProductAsync(details);
      console.log(`MOVEMENT(CRON-OPPORTUNITY) : Product : ${details.mpId}`);
    }
  }

  // ============================================================================
  // STEP 8: Final cleanup - ensure product is removed from Opportunity Cron
  // This is a "one-shot" cron, so always mark as inactive when done
  // ============================================================================
  const finalOpportunityItem = new ErrorItemModel(
    details.mpId,
    null,
    false,
    details.cronId || null,
    "PROCESSED",
    _contextVendor,
  );

  await dbHelper.UpsertOpportunityItemLog(finalOpportunityItem);
  console.log(
    `${details.mpId} - ${_contextVendor} removed from Opportunity Cron (one-shot complete)`,
  );
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
    const filePath = "./activeOpportunityProducts.json";
    let contentsToWrite = [{ key: keygen, products: freshProducts }];
    let activeProducts: any[] = [];
    let details = fs.readFileSync(filePath, "utf8");
    let fileContent = JSON.parse(details);

    if (fileContent && fileContent.length > 0) {
      _.forEach(fileContent, (item) => {
        activeProducts = activeProducts.concat(item.products);
      });
    }

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
      fs.writeFileSync(filePath, JSON.stringify(contentsToWrite));
    }
  }
  return finalList;
}

function cleanActiveProductList(keyGen: string) {
  const filePath = "./activeOpportunityProducts.json";
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
