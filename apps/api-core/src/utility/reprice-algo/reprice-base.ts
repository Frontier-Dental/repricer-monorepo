import { AxiosResponse } from "axios";
import fs from "fs";
import * as _codes from "http-status-codes";
import _ from "lodash";
import { CronStatusModel } from "../../model/cron-status";
import { ErrorItemModel } from "../../model/error-item";
import { RepriceAsyncResponse } from "../../model/reprice-async-response";
import { CronSettings } from "../../types/cron-settings";
import { FrontierProduct } from "../../types/frontier";
import { Net32Product, Net32Response } from "../../types/net32";
import { RepriceProductHttpResponse } from "../../types/reprice-product-http-response";
import * as axiosHelper from "../axios-helper";
import { applicationConfig } from "../config";
import * as mongoHelper from "../mongo/db-helper";
import * as sqlHelper from "../mysql/mysql-helper";
import { ProductDetailsListItem } from "../mysql/mySql-mapper";
import * as requestGenerator from "../request-generator";
import { repriceProduct } from "./v1/algo-v1";
import { AlgoExecutionMode, VendorName } from "@repricer-monorepo/shared";
import { repriceProductV2Wrapper } from "./v2/wrapper";

export async function Execute(
  jobId: string,
  productList: any[],
  cronInitTime: any,
  cronSetting: any,
  isSlowCronRun: boolean = false,
) {
  const cronId = cronSetting != null ? cronSetting.CronId : "N/A";
  let cronLogs: any = {
    time: cronInitTime,
    keyGen: jobId,
    logs: [],
    cronId: cronId,
    totalCount: productList.length,
  };
  const isOverrideRun = false;
  if (isSlowCronRun) {
    cronLogs.type = "SLOWCRON";
    cronLogs.cronId = cronSetting.CronId;
  }

  let cronProdCounter = 1;
  let _contextCronStatus = new CronStatusModel(
    cronInitTime,
    0,
    productList.length,
    "In-Progress",
    cronSetting != null ? cronSetting.CronId : "OVERRIDE_RUN",
    jobId,
  );
  await initCronStatus(_contextCronStatus);
  let eligibleCount = 0;
  let repricedProductCount = 0;
  let productIndex = 0;
  for (let prod of productList) {
    //Set cronSetting if it is Null
    console.log(
      `Repricing product: ${prod.mpId} (${productIndex + 1}/${productList.length}). Cron name: ${cronSetting != null ? cronSetting.CronName : "N/A"}`,
    );
    try {
      if (!cronSetting) {
        cronSetting = _.first(
          await mongoHelper.GetCronSettingsDetailsByName(prod.cronName),
        );
      }
      let isProceed = true;
      if (!isOverrideRun) {
        isProceed = await proceedWithExecution(cronSetting.CronId);
      }
      if (!isProceed) break;

      _contextCronStatus.SetProductCount(cronProdCounter);
      await mongoHelper.UpdateCronStatusAsync(_contextCronStatus);
      const prioritySequence = await requestGenerator.GetPrioritySequence(
        prod,
        null,
        false,
      );
      const seqString = `SEQ : ${prioritySequence.map((p) => p.name).join(", ")}`;
      let productLogs = [];
      let net32resp: AxiosResponse<Net32Product[]>;
      const searchRequest = applicationConfig.GET_SEARCH_RESULTS.replace(
        "{mpId}",
        prod.mpId,
      );
      if (prioritySequence && prioritySequence.length > 0) {
        const cronIdForScraping = isSlowCronRun
          ? prod[prioritySequence[0].value].slowCronId
          : prod[prioritySequence[0].value].cronId;
        net32resp = await axiosHelper.getAsync(
          searchRequest,
          cronIdForScraping,
          seqString,
        );
        if (
          prod.algo_execution_mode === AlgoExecutionMode.V2_ONLY ||
          prod.algo_execution_mode === AlgoExecutionMode.V2_EXECUTE_V1_DRY ||
          prod.algo_execution_mode === AlgoExecutionMode.V1_EXECUTE_V2_DRY
        ) {
          await repriceProductV2Wrapper(
            net32resp.data,
            prod,
            prioritySequence,
            cronSetting ? cronSetting.CronName : "MANUAL",
          );
        }
        if (
          prod.algo_execution_mode === AlgoExecutionMode.V1_ONLY ||
          prod.algo_execution_mode === AlgoExecutionMode.V1_EXECUTE_V2_DRY ||
          prod.algo_execution_mode === AlgoExecutionMode.V2_EXECUTE_V1_DRY
        ) {
          for (let idx = 0; idx < prioritySequence.length; idx++) {
            const proceedNextVendor = proceedNext(
              prod,
              prioritySequence[idx].value,
            );
            const isVendorActivated =
              prod[prioritySequence[idx].value].activated;
            if (proceedNextVendor && isVendorActivated) {
              let repriceResponse = await repriceWrapper(
                net32resp,
                prod,
                cronSetting,
                isOverrideRun,
                jobId,
                prioritySequence,
                idx,
              );
              eligibleCount++;
              if (repriceResponse) {
                productLogs = repriceResponse.cronLogs;
                prod[prioritySequence[idx].value] = repriceResponse.prod;
                if (repriceResponse.isPriceUpdated) {
                  repricedProductCount++;
                }

                if (repriceResponse.skipNextVendor) {
                  break;
                }
              }
            }
          }
        }
      } else {
        console.log(
          "Skipping product: ",
          prod.mpId,
          " because no vendors are enabled.",
        );
      }
      if (productLogs.length > 0) {
        cronLogs.logs.push(productLogs);
      }
      cronProdCounter++;
    } catch (error) {
      console.log(
        `Exception while repricing product: ${prod.mpId}. Error: ${error}`,
      );
      console.error(error);
      cronLogs.logs.push({
        productId: prod.mpId,
        logs: error,
        vendor: "UNKNOWN",
      });
    } finally {
      console.log(`Repricing product ${prod.mpId} completed`);
    }
    productIndex++;
  }

  //Update End Time
  cronLogs.completionTime = new Date();
  cronLogs.EligibleCount = eligibleCount;
  cronLogs.RepricedProductCount = repricedProductCount;
  const logInDb = await mongoHelper.PushLogsAsync(cronLogs);
  if (logInDb) {
    console.log(
      `Successfully logged Cron Logs in DB at ${cronLogs.time} || Id : ${logInDb}`,
    );
  }
  _contextCronStatus.SetStatus("Complete");
  await mongoHelper.UpdateCronStatusAsync(_contextCronStatus);
}

export async function RepriceErrorItem(
  details: any,
  cronInitTime: any,
  cronSetting: any,
  _contextVendor: string,
) {
  let cronLogs: any = {
    time: cronInitTime,
    logs: [] as any[],
    cronId: cronSetting.CronId,
    type: "422Error",
  };
  const contextErrorDetails = await mongoHelper.GetEligibleContextErrorItems(
    true,
    details.mpId,
    _contextVendor,
  );
  const prioritySequence = await requestGenerator.GetPrioritySequence(
    details,
    contextErrorDetails,
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
      "DUMMY-422-Error",
      seqString,
    );
    let isPriceUpdatedForVendor = false;
    for (const seq of prioritySequence) {
      if (isPriceUpdatedForVendor == false) {
        const contextVendor = seq.name;
        let prod = await getProductDetailsByVendor(details, contextVendor);
        let tempProd = _.cloneDeep(prod);
        prod.last_cron_time = new Date();
        let isPriceUpdated = false;
        if (prod.scrapeOn == true && prod.activated == true) {
          const postUrl = applicationConfig.REPRICE_OWN_URL.replace(
            "{mpId}",
            prod.mpid,
          );
          console.log(
            `REPRICE : Cron-422 : ${details.insertReason} : ${contextVendor} : Requesting Reprice info for ${prod.mpid}  on ${postUrl} at Time :  ${new Date()}`,
          );
          prod.last_attempted_time = new Date();
          prod.lastCronRun = `Cron-422`;
          tempProd.cronName = applicationConfig.CRON_NAME_422;
          tempProd.contextVendor = contextVendor;
          tempProd.contextCronName = `ExpressCron`;
          let data: any = {};
          data.result = net32result ? net32result.data : [];
          data.prod = tempProd;
          data.contextVendor = contextVendor;
          const repriceResult: AxiosResponse<RepriceProductHttpResponse> =
            await axiosHelper.postAsync(data, postUrl);
          if (repriceResult && repriceResult.data) {
            if (
              repriceResult.data.priceUpdateResponse &&
              repriceResult.data.priceUpdateResponse != null
            ) {
              if (
                JSON.stringify(repriceResult.data.priceUpdateResponse).indexOf(
                  "ERROR:422",
                ) == -1 &&
                JSON.stringify(repriceResult.data.priceUpdateResponse).indexOf(
                  "ERROR:429",
                ) == -1 &&
                JSON.stringify(repriceResult.data.priceUpdateResponse).indexOf(
                  "ERROR:404",
                ) == -1 &&
                JSON.stringify(repriceResult.data.priceUpdateResponse).indexOf(
                  "ERROR:",
                ) == -1
              ) {
                cronLogs.logs.push([
                  {
                    productId: prod.mpid,
                    logs: repriceResult.data.cronResponse,
                    vendor: contextVendor,
                    priceUpdated: true,
                    priceUpdatedOn: new Date(),
                    priceUpdateResponse: repriceResult.data.priceUpdateResponse,
                  },
                ]);
                prod.last_update_time = new Date();
                isPriceUpdated = true;
                prod.lastUpdatedBy = `Cron-422`;
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
                  await mongoHelper.UpsertErrorItemLog(priceUpdatedItem);
                  console.log({
                    message: `${prod.mpid} moved to ${applicationConfig.CRON_NAME_422}`,
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
                  await mongoHelper.UpsertErrorItemLog(priceUpdatedItem);
                  console.log(`GHOST : ${prod.mpid} - ${contextVendor}`);
                }
              } else if (
                JSON.stringify(repriceResult.data.priceUpdateResponse).indexOf(
                  "ERROR:422",
                ) > -1
              ) {
                prod.next_cron_time = await getNextCronTime(
                  repriceResult.data.priceUpdateResponse,
                );
                // Add the product to Error Item Table.
                const errorItem = new ErrorItemModel(
                  prod.mpid,
                  prod.next_cron_time,
                  true,
                  prod.cronId,
                  "422_ERROR",
                  contextVendor,
                );
                await mongoHelper.UpsertErrorItemLog(errorItem);
                console.log({
                  message: `${prod.mpid} moved to ${applicationConfig.CRON_NAME_422}`,
                  obj: JSON.stringify(errorItem),
                });
                cronLogs.logs.push([
                  {
                    productId: prod.mpid,
                    logs: repriceResult.data.cronResponse,
                    vendor: contextVendor,
                    priceUpdated: false,
                    priceUpdateResponse: repriceResult.data.priceUpdateResponse,
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
                await mongoHelper.UpsertErrorItemLog(priceUpdatedItem);
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
              await mongoHelper.UpsertErrorItemLog(errorItem);
              cronLogs.logs.push([
                {
                  productId: prod.mpid,
                  vendor: contextVendor,
                  logs: repriceResult.data.cronResponse,
                },
              ]);
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
            await mongoHelper.UpsertErrorItemLog(errorItem);
            cronLogs.logs.push([
              {
                productId: prod.mpid,
                vendor: contextVendor,
                logs: repriceResult.data.cronResponse,
              },
            ]);
          }
          // Add Last_Cron_Reprice_Message
          prod.last_cron_message = getLastCronMessage(repriceResult as any);

          // Update History With Proper Message
          if (
            repriceResult &&
            repriceResult.data &&
            repriceResult.data.historyIdentifier &&
            repriceResult.data.historyIdentifier != null
          ) {
            await sqlHelper.UpdateHistoryWithMessage(
              repriceResult.data.historyIdentifier,
              prod.last_cron_message,
            );
            console.log(
              `History Updated for ${prod.mpid} with Identifier : ${repriceResult.data.historyIdentifier} and Message : ${prod.last_cron_message}`,
            );
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
          await mongoHelper.UpsertErrorItemLog(errorItem);
          await sqlHelper.UpdateProductAsync(
            prod,
            isPriceUpdated,
            contextVendor,
          ); //dbHelper.UpdateProductAsync(prod, isPriceUpdated, contextVendor);
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
    if (productUpdateNeeded == true) {
      details.isSlowActivated = false;
      await sqlHelper.UpdateCronForProductAsync(details); //await dbHelper.UpdateCronForProductAsync(details);
      console.log(`MOVEMENT(CRON-422) : Product : ${details.mpId}`);
    }
  }
  // if (cronLogs.logs && cronLogs.logs.length > 0) {
  //     cronLogs.completionTime = new Date();
  //     dbHelper.PushLogsAsync(cronLogs);
  // }
  // Extra code to Ignore 422 Items if context vendor is null or is deactivated.
  alignErrorItems(details, _contextVendor);
  return cronLogs;
}

export async function CheckReprice(
  net32resp: any,
  prod: any,
  cronSetting: any,
  isOverrideRun: boolean,
  keyGen: string,
  contextVendor: string,
) {
  return repriceSingleVendor(
    net32resp,
    prod,
    cronSetting,
    isOverrideRun,
    keyGen,
    contextVendor,
  );
}

export async function RepriceErrorItemV2(
  productList: any[],
  cronInitTime: any,
  keyGen: string,
) {
  let cronLogs: any = {
    time: cronInitTime,
    keyGen: keyGen,
    logs: [],
    cronId: "DUMMY-422-Error",
    type: "422Error",
    EligibleCount: productList.length,
  };
  let _contextCronStatus = new CronStatusModel(
    cronInitTime,
    0,
    productList.length,
    "In-Progress",
    "DUMMY-422-Error",
    keyGen,
  );
  await initCronStatus(_contextCronStatus);
  var deltaList = await filterDeltaProducts(productList, keyGen);
  productList = await scanDeltaListOfProducts(productList, deltaList!);
  let cronProdCounter = 1;
  for (let prod of productList) {
    console.log(`422_ERROR: Repricing ${prod.mpId} for 422 at ${new Date()}`);
    const repriceErrorItemResponse = await RepriceErrorItem(
      prod,
      cronInitTime,
      prod.cronSettingsResponse,
      prod.contextVendor,
    );
    if (
      repriceErrorItemResponse &&
      repriceErrorItemResponse.logs &&
      repriceErrorItemResponse.logs.length > 0
    ) {
      if (repriceErrorItemResponse.logs.length == 1) {
        cronLogs.logs.push(_.first(repriceErrorItemResponse.logs));
      } else if (repriceErrorItemResponse.logs.length > 1) {
        const tempLog = [];
        for (const $ of repriceErrorItemResponse.logs) {
          tempLog.push(_.first($));
        }
        cronLogs.logs.push(tempLog);
      }
    }
    _contextCronStatus.SetProductCount(cronProdCounter);
    await mongoHelper.UpdateCronStatusAsync(_contextCronStatus);
    cronProdCounter++;
  }
  if (cronLogs.logs && cronLogs.logs.length > 0) {
    cronLogs.completionTime = new Date();
    await mongoHelper.Push422LogsAsync(cronLogs);
  }
  _contextCronStatus.SetStatus("Complete");
  await mongoHelper.UpdateCronStatusAsync(_contextCronStatus);
  cleanActiveProductList(keyGen);
}

export async function UpdateToMax(
  cronLogs: any,
  net32resp: any,
  prod: any,
  cronSetting: any,
  keyGen: string,
  contextVendor: string,
  postUrl: string,
) {
  let isPriceUpdated = false;
  let skipNextVendor = false;
  prod.secretKey = cronSetting.SecretKey;
  prod.last_attempted_time = new Date();
  prod.lastCronRun = `Manual`;
  prod.last_cron_time = new Date();
  prod.cronName = cronSetting.CronName;
  let data: any = {};
  data.result = net32resp ? net32resp.data : net32resp;
  data.prod = prod;
  data.contextVendor = contextVendor;
  const repriceResult = await axiosHelper.postAsync(data, postUrl);
  if (repriceResult && repriceResult.data) {
    if (
      repriceResult.data.priceUpdateResponse &&
      repriceResult.data.priceUpdateResponse != null
    ) {
      skipNextVendor = true;
      if (
        JSON.stringify(repriceResult.data.priceUpdateResponse).indexOf(
          "ERROR:422",
        ) == -1
      ) {
        cronLogs.push({
          productId: prod.mpid,
          vendor: contextVendor,
          logs: repriceResult.data.cronResponse,
          priceUpdated: true,
          priceUpdatedOn: new Date(),
          priceUpdateResponse: repriceResult.data.priceUpdateResponse,
        });
        prod.last_update_time = new Date();
        isPriceUpdated = true;
        prod.lastUpdatedBy = `Manual`;
        if (prod.wait_update_period == true) {
          // Add the product to Error Item Table and update nextCronTime as +12 Hrs
          prod.next_cron_time = await calculateNextCronTime(new Date(), 12);
          const priceUpdatedItem = new ErrorItemModel(
            prod.mpid,
            prod.next_cron_time,
            true,
            prod.cronId,
            "PRICE_UPDATE",
            contextVendor,
          );
          await mongoHelper.UpsertErrorItemLog(priceUpdatedItem);
          console.log({
            message: `${prod.mpid} moved to ${applicationConfig.CRON_NAME_422}`,
            obj: JSON.stringify(priceUpdatedItem),
          });
        } else {
          prod.next_cron_time = null;
          console.log(`GHOST : ${prod.mpid} - ${contextVendor} - ${keyGen}`);
        }
      } else {
        prod.next_cron_time = await getNextCronTime(
          repriceResult.data.priceUpdateResponse,
        );
        // Add the product to Error Item Table.
        const errorItem = new ErrorItemModel(
          prod.mpid,
          prod.next_cron_time,
          true,
          prod.cronId,
          "422_ERROR",
          contextVendor,
        );
        await mongoHelper.UpsertErrorItemLog(errorItem);
        console.log({
          message: `${prod.mpid} moved to ${applicationConfig.CRON_NAME_422}`,
          obj: JSON.stringify(errorItem),
        });
        cronLogs.push({
          productId: prod.mpid,
          vendor: contextVendor,
          logs: repriceResult.data.cronResponse,
          priceUpdated: false,
          priceUpdateResponse: repriceResult.data.priceUpdateResponse,
        });
      }
    } else {
      cronLogs.push({
        productId: prod.mpid,
        vendor: contextVendor,
        logs: repriceResult.data.cronResponse,
      });
    }
  } else if (
    repriceResult &&
    (repriceResult.status == _codes.StatusCodes.BAD_REQUEST ||
      repriceResult.status == _codes.StatusCodes.IM_A_TEAPOT)
  ) {
    cronLogs.push({
      productId: prod.mpid,
      vendor: contextVendor,
      logs: `Error: ${repriceResult.data}`,
    });
  } else {
    cronLogs.push({
      productId: prod.mpid,
      vendor: contextVendor,
      logs: "Some error occurred while repricing",
    });
  }
  // Add Last_Cron_Reprice_Message
  prod.last_cron_message = await getLastCronMessage(repriceResult as any);
  prod.last_cron_message = prod.last_cron_message + " #MANUAL";
  prod = await updateLowestVendor((repriceResult as any)!, prod);
  prod = await updateCronBasedDetails(repriceResult, prod, false);
  await sqlHelper.UpdateProductAsync(prod, isPriceUpdated, contextVendor);
  return {
    cronLogs: cronLogs,
    prod: prod,
    isPriceUpdated: isPriceUpdated,
    skipNextVendor: skipNextVendor,
  };
}

async function initCronStatus(_contextCronStatus: any) {
  await mongoHelper.InitCronStatusAsync(_contextCronStatus);
}

async function proceedWithExecution(cronId: string) {
  let cronSettingDetails = await mongoHelper.GetCronSettingsList();
  const slowCronDetails = await mongoHelper.GetSlowCronDetails();
  cronSettingDetails = _.concat(cronSettingDetails, slowCronDetails);
  if (cronSettingDetails) {
    const contextCron = cronSettingDetails.find((x: any) => x.CronId == cronId);
    return contextCron ? contextCron.CronStatus : false;
  } else return false;
}

async function repriceSingleVendor(
  net32resp: Net32Response,
  prod: ProductDetailsListItem,
  cronSetting: CronSettings,
  isOverrideRun: boolean,
  keyGen: string,
  contextVendor: string,
  isManualRun = false,
) {
  const cronLogs: any[] = [];
  let isPriceUpdated = false;
  let skipNextVendor = false;
  console.log(
    `REPRICE : ${cronSetting.CronName} : Cron Key : ${keyGen} : Vendor : ${contextVendor} : Requesting Reprice info for ${prod.mpid} at Time :  ${new Date()}`,
  );
  prod.secretKey = cronSetting.SecretKey;
  prod.last_attempted_time = new Date();
  prod.lastCronRun = isManualRun ? "Manual" : `${cronSetting.CronName}`;
  prod.last_cron_time = new Date();
  prod.cronName = cronSetting.CronName;
  prod.contextCronName = cronSetting.CronName;
  //Add isOverrideRun if sent as True to Payload
  if (isOverrideRun) {
    prod.isOverrideRun = isOverrideRun;
  }

  const repriceResult = await repriceProduct(
    prod.mpid!,
    net32resp.data.filter((p) => p.priceBreaks !== undefined),
    prod as unknown as FrontierProduct,
    contextVendor,
  );
  if (!repriceResult) {
    cronLogs.push({
      productId: prod.mpid,
      vendor: contextVendor,
      logs: "Some error occurred while repricing",
    });
  } else if (
    repriceResult.priceUpdateResponse &&
    repriceResult.priceUpdateResponse != null
  ) {
    skipNextVendor = true;
    if (
      JSON.stringify(repriceResult.priceUpdateResponse).indexOf("ERROR:422") ==
      -1
    ) {
      cronLogs.push({
        productId: prod.mpid,
        vendor: contextVendor,
        logs: repriceResult.cronResponse,
        priceUpdated: true,
        priceUpdatedOn: new Date(),
        priceUpdateResponse: repriceResult.priceUpdateResponse,
      });
      prod.last_update_time = new Date();
      isPriceUpdated = true;
      prod.lastUpdatedBy =
        isManualRun == true ? "Manual" : `${cronSetting.CronName}`;
      if (prod.wait_update_period == true) {
        // Add the product to Error Item Table and update nextCronTime as +12 Hrs
        prod.next_cron_time = calculateNextCronTime(new Date(), 12);
        const priceUpdatedItem = new ErrorItemModel(
          prod.mpid!,
          prod.next_cron_time,
          true,
          prod.cronId!,
          "PRICE_UPDATE",
          contextVendor,
        );
        await mongoHelper.UpsertErrorItemLog(priceUpdatedItem);
        console.log({
          message: `${prod.mpid} moved to ${applicationConfig.CRON_NAME_422}`,
          obj: JSON.stringify(priceUpdatedItem),
        });
      } else {
        prod.next_cron_time = null;
        console.log(`GHOST : ${prod.mpid} - ${contextVendor} - ${keyGen}`);
      }
    } else {
      prod.next_cron_time = getNextCronTime(repriceResult.priceUpdateResponse);
      // Add the product to Error Item Table.
      const errorItem = new ErrorItemModel(
        prod.mpid!,
        prod.next_cron_time,
        true,
        prod.cronId,
        "422_ERROR",
        contextVendor,
      );
      await mongoHelper.UpsertErrorItemLog(errorItem);
      console.log({
        message: `${prod.mpid} moved to ${applicationConfig.CRON_NAME_422}`,
        obj: JSON.stringify(errorItem),
      });
      cronLogs.push({
        productId: prod.mpid,
        vendor: contextVendor,
        logs: repriceResult.cronResponse,
        priceUpdated: false,
        priceUpdateResponse: repriceResult.priceUpdateResponse,
      });
    }
  } else {
    cronLogs.push({
      productId: prod.mpid,
      vendor: contextVendor,
      logs: repriceResult.cronResponse,
    });
  }

  // Add Last_Cron_Reprice_Message
  prod.last_cron_message = getLastCronMessage(repriceResult);
  if (isManualRun == true) {
    prod.last_cron_message = prod.last_cron_message + " #MANUAL";
  }

  // Update History With Proper Message
  if (
    repriceResult &&
    repriceResult.historyIdentifier &&
    repriceResult.historyIdentifier != null
  ) {
    await sqlHelper.UpdateHistoryWithMessage(
      repriceResult.historyIdentifier,
      prod.last_cron_message,
    );
    console.log(
      `History Updated for ${prod.mpid} with Identifier : ${repriceResult.historyIdentifier} and Message : ${prod.last_cron_message}`,
    );
  }
  prod = updateLowestVendor(repriceResult!, prod);
  prod = updateCronBasedDetails(repriceResult, prod, false);
  await sqlHelper.UpdateProductAsync(
    prod as any,
    isPriceUpdated,
    contextVendor,
  ); //await dbHelper.UpdateProductAsync(prod, isPriceUpdated, contextVendor);
  return {
    cronLogs: cronLogs,
    prod: prod,
    isPriceUpdated: isPriceUpdated,
    skipNextVendor: skipNextVendor,
  };
}

function getLastCronMessage(
  repriceResult:
    | {
        cronResponse: RepriceAsyncResponse;
        priceUpdateResponse: any;
        historyIdentifier: any;
      }
    | undefined,
) {
  let resultStr = "";
  if (
    repriceResult &&
    repriceResult.cronResponse &&
    repriceResult.cronResponse.repriceData
  ) {
    if (repriceResult.cronResponse.repriceData.repriceDetails) {
      resultStr =
        repriceResult.cronResponse.repriceData.repriceDetails.explained || "";
    } else if (
      repriceResult.cronResponse.repriceData.listOfRepriceDetails &&
      repriceResult.cronResponse.repriceData.listOfRepriceDetails.length > 0
    ) {
      for (const rep of repriceResult.cronResponse.repriceData
        .listOfRepriceDetails) {
        resultStr += `${rep.minQty}@${rep.explained}/`;
      }
    }
  } else {
    resultStr = `Reprice Result is empty`;
  }
  return resultStr;
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

function proceedNext(prod: any, key: string) {
  return (
    prod[key] && prod[key].scrapeOn == true && prod[key].skipReprice == false
  );
}

export async function repriceWrapper(
  net32resp: Net32Response,
  prod: ProductDetailsListItem,
  cronSetting: CronSettings,
  isOverrideRun: boolean,
  keyGen: string,
  prioritySequence: { name: string; value: string }[],
  idx: number,
  isManualRun = false,
) {
  return repriceSingleVendor(
    net32resp,
    (prod as any)[prioritySequence[idx].value],
    cronSetting,
    isOverrideRun,
    keyGen,
    prioritySequence[idx].name,
    isManualRun,
  );
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
    await mongoHelper.UpsertErrorItemLog(errorItem);
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
