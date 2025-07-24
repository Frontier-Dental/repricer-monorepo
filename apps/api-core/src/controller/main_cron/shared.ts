import { ScheduledTask, schedule } from "node-cron";
import { CronSettingsDetail } from "../../utility/mongo/types";
import * as responseUtility from "../../utility/responseUtility";
import * as keyGenHelper from "../../utility/keyGenHelper";
import * as dbHelper from "../../utility/mongo/dbHelper";
import * as repriceBase from "../../utility/repriceBase";
import * as mySqlHelper from "../../utility/mySqlHelper";
import * as feedHelper from "../../utility/feedHelper";
import * as mongoHelper from "../../utility/mongo/mongoHelper";
import * as _ from "lodash";
import { CacheKeyName } from "../../resources/cacheKeyName";
import * as cacheHelper from "../../utility/cacheHelper";
import { VendorName } from "../../utility/reprice_algo/v2/types";
import { applicationConfig } from "../../utility/config";

const mainCrons: Record<string, ScheduledTask> = {};
let error422Cron: ScheduledTask | null = null;

export function stopAllMainCrons() {
  Object.values(mainCrons).forEach((cron) => {
    if (cron) {
      cron.stop();
    }
  });
}

export function setError422CronAndStart(cronSettings: CronSettingsDetail[]) {
  const _422CronSetting = cronSettings.find(
    (x) => x.CronName == applicationConfig.CRON_NAME_422,
  );
  if (!_422CronSetting) {
    throw new Error("422 Cron setting not found");
  }
  const cronString = responseUtility.GetCronGeneric(
    _422CronSetting.CronTimeUnit,
    _422CronSetting.CronTime,
    parseInt(_422CronSetting.Offset),
  );

  error422Cron = schedule(
    cronString,
    async () => {
      await runCoreCronLogicFor422();
    },
    { scheduled: false },
  );
  if (_422CronSetting.CronStatus) {
    error422Cron.start();
  }
}

async function IsCacheValid(cacheKey: any, sysTime: any) {
  if (cacheHelper.Has(cacheKey)) {
    const result = cacheHelper.Get(cacheKey);
    const differenceInTime = sysTime.getTime() - result.initTime.getTime();
    const differenceInMinutes = Math.round(differenceInTime / 60000);
    const envVariables = await dbHelper.GetGlobalConfig();
    const thresholdValue =
      envVariables != null && envVariables.expressCronOverlapThreshold != null
        ? envVariables.expressCronOverlapThreshold
        : applicationConfig._422_CACHE_VALID_PERIOD;
    console.log(
      `Checking 422 Cron Validity for Threshold : ${thresholdValue} || Duration : ${differenceInMinutes} at ${new Date()}`,
    );
    if (
      typeof thresholdValue === "string"
        ? parseFloat(thresholdValue!)
        : thresholdValue < differenceInMinutes
    )
      return false;
    else return true;
  }
  return false;
}

export async function runCoreCronLogicFor422() {
  const cacheKey = CacheKeyName._422_RUNNING_CACHE;
  const isCacheValid = await IsCacheValid(cacheKey, new Date());
  if (!isCacheValid) {
    console.log(`Getting List of Eligible Products for Cron-422`);
    const runningCacheObj: any = {};
    runningCacheObj.cronRunning = true;
    runningCacheObj.initTime = new Date();
    cacheHelper.Set(cacheKey, runningCacheObj);
    const eligibleProductList = await get422EligibleProducts();
    const keyGen = keyGenHelper.Generate();
    console.log(
      `Cron-422 running on ${new Date()} with Eligible Products Count : ${eligibleProductList.length} with KeyGen : ${keyGen}`,
    );
    if (eligibleProductList.length > 0) {
      const envVariables = await dbHelper.GetGlobalConfig();
      const isChunkNeeded = await IsChunkNeeded(
        eligibleProductList,
        envVariables,
        "EXPRESS",
      );
      if (isChunkNeeded) {
        let chunkedList = _.chunk(
          eligibleProductList,
          parseInt(envVariables.expressCronBatchSize!),
        );
        let chunkedBatch = _.chunk(
          chunkedList,
          parseInt(envVariables.expressCronInstanceLimit!),
        );
        let batchCount = 1;
        for (let itemList of chunkedBatch) {
          if (itemList.length > 0) {
            await ParallelExecute(
              itemList,
              new Date(),
              `${keyGen}-${batchCount}`,
            );
            batchCount++;
          }
        }
      } else {
        await repriceBase.RepriceErrorItemV2(
          eligibleProductList,
          new Date(),
          keyGen,
        );
      }
    }
    cacheHelper.DeleteCacheByKey(cacheKey);
  } else {
    const runningCronDetails = await cacheHelper.Get(cacheKey);
    console.log(
      `Skipped Cron-422 as another 422 cron is already running. CURR_TIME : ${new Date()} || RUNNING_CRON_TIME : ${runningCronDetails.initTime}`,
    );
  }
}

export async function ParallelExecute(
  itemList: any,
  initTime: any,
  keyGen: any,
) {
  if (itemList && itemList.length > 0) {
    const tasks = itemList.map((item: any, index: any) =>
      repriceBase.RepriceErrorItemV2(item, initTime, `${keyGen}-${index}`),
    );
    await Promise.all(tasks);
    console.log(
      `PARALLEL EXECUTION : ${keyGen} All tasks completed at ${new Date()}`,
    );
  }
}

async function get422EligibleProducts() {
  const globalConfig = await dbHelper.GetGlobalConfig();
  if (globalConfig && globalConfig.source == "FEED") {
    return [];
  }
  let cronSettingDetailsResponse = await dbHelper.GetCronSettingsList();
  let slowCronDetails = await dbHelper.GetSlowCronDetails();
  cronSettingDetailsResponse = _.concat(
    cronSettingDetailsResponse,
    slowCronDetails,
  );
  const mongoResponse = await mongoHelper.GetContextErrorItems(true);
  let resultantOutput = [];
  if (mongoResponse && mongoResponse.length > 0) {
    for (const errItem of mongoResponse) {
      let productDetails = await mySqlHelper.GetItemListById(errItem.mpId); //await mongoHelper.GetItemListById(errItem.mpId);
      if (productDetails) {
        const contextCronId = await getContextCronId(
          productDetails,
          errItem.vendorName,
        );
        if (contextCronId) {
          (productDetails as any).cronSettingsResponse =
            cronSettingDetailsResponse.find(
              (x: any) => x.CronId == contextCronId,
            );
          (productDetails as any).insertReason = errItem.insertReason;
          (productDetails as any).contextVendor = errItem.vendorName;
          resultantOutput.push(productDetails);
        }
      }
    }
  }
  resultantOutput = feedHelper.SetSkipReprice(resultantOutput, false);
  return resultantOutput;
}

export async function getContextCronId(productDetails: any, vendorName: any) {
  switch (vendorName) {
    case VendorName.TRADENT:
      return productDetails.tradentDetails
        ? productDetails.tradentDetails.cronId
        : null;
    case VendorName.FRONTIER:
      return productDetails.frontierDetails
        ? productDetails.frontierDetails.cronId
        : null;
    case VendorName.MVP:
      return productDetails.mvpDetails
        ? productDetails.mvpDetails.cronId
        : null;
    case VendorName.TOPDENT:
      return productDetails.topDentDetails
        ? productDetails.topDentDetails.cronId
        : null;
    case VendorName.FIRSTDENT:
      return productDetails.firstDentDetails
        ? productDetails.firstDentDetails.cronId
        : null;
    default:
      throw new Error(`Invalid vendor name: ${vendorName}`);
  }
}

export function setCronAndStart(
  cronName: string,
  cronSetting: CronSettingsDetail,
) {
  const cronString = responseUtility.GetCronGeneric(
    cronSetting.CronTimeUnit,
    cronSetting.CronTime,
    parseInt(cronSetting.Offset),
  );
  mainCrons[cronName] = schedule(
    cronString,
    async () => {
      await runCoreCronLogic(cronSetting);
    },
    { scheduled: true },
  );
  if (cronSetting.CronStatus) {
    mainCrons[cronName].start();
  }
}

async function runCoreCronLogic(cronSettingsResponse: any) {
  const initTime = new Date();
  const eligibleProductList = await getCronEligibleProductsV3(
    cronSettingsResponse.CronId,
  );
  if (eligibleProductList && eligibleProductList.length > 0) {
    const keyGen = keyGenHelper.Generate();
    console.log(
      `${cronSettingsResponse.CronName} running on ${initTime} with Eligible Product count : ${eligibleProductList.length}  || Key : ${keyGen}`,
    );
    const isChunkNeeded = await IsChunkNeeded(
      eligibleProductList,
      null,
      "REGULAR",
    );
    if (isChunkNeeded) {
      let chunkedList = _.chunk(
        eligibleProductList,
        applicationConfig.BATCH_SIZE,
      );
      for (let chunk of chunkedList) {
        await repriceBase.Execute(
          keyGen,
          chunk,
          new Date(),
          cronSettingsResponse,
        );
      }
    } else
      repriceBase.Execute(
        keyGen,
        eligibleProductList,
        initTime,
        cronSettingsResponse,
      );
  } else {
    await logBlankCronDetailsV3(cronSettingsResponse.CronId);
    console.log(
      `No eligible products found for ${cronSettingsResponse.CronName} at ${new Date()}`,
    );
  }
}

export async function logBlankCronDetailsV3(cronId: any) {
  let cronLogs = { time: new Date(), logs: [], cronId: cronId };
  const logInDb = await mongoHelper.PushLogsAsync(cronLogs);
  if (logInDb) {
    console.log(
      `Successfully logged blank reprice data at ${cronLogs.time} for cron ${cronId}`,
    );
  }
}

export async function IsChunkNeeded(list: any, envVariables: any, type: any) {
  switch (type) {
    case "EXPRESS":
      if (envVariables && envVariables.expressCronBatchSize) {
        return list.length > parseInt(envVariables.expressCronBatchSize);
      }
    default:
      return list.length > applicationConfig.BATCH_SIZE;
  }
}

export async function getCronEligibleProductsV3(cronId: any) {
  let eligibleProductList: any[] = [];
  const globalConfig = await dbHelper.GetGlobalConfig();
  if (globalConfig && globalConfig.source == "FEED") {
    return eligibleProductList;
  }
  eligibleProductList = await mySqlHelper.GetActiveProductListByCronId(cronId); //await dbHelper.GetActiveProductList(cronId);
  eligibleProductList = await feedHelper.FilterEligibleProducts(
    eligibleProductList,
    cronId,
    false,
  );
  return eligibleProductList;
}

export function stopCron(cronName: string) {
  if (mainCrons[cronName]) {
    mainCrons[cronName].stop();
  }
}

export function getMainCronNameFromJobName(jobName: string): string | null {
  const match = jobName.match(/^_E(\d+)Cron$/);
  if (match) {
    return `Cron-${match[1]}`;
  }
  return null;
}

export function startCron(cronName: string) {
  if (mainCrons[cronName]) {
    mainCrons[cronName].start();
  } else {
    throw new Error(`Cron ${cronName} not found`);
  }
}

export function startError422Cron() {
  if (error422Cron) {
    error422Cron.start();
  } else {
    throw new Error("Error422Cron not found");
  }
}

export function stop422Cron() {
  if (error422Cron) {
    error422Cron.stop();
  } else {
    throw new Error("Error422Cron not found");
  }
}

export async function startAllCronAsIs(cronSettings: CronSettingsDetail[]) {
  for (const cronSetting of cronSettings) {
    if (mainCrons[cronSetting.CronName] && cronSetting.CronStatus) {
      mainCrons[cronSetting.CronName].start();
    }
  }
}

export function calculateNextCronTime(currentTime: Date, hoursToAdd: number) {
  return new Date(currentTime.setHours(currentTime.getHours() + hoursToAdd));
}

export function getNextCronTime(priceUpdateResponse: any) {
  const messageText = priceUpdateResponse.message;
  if (messageText && typeof messageText == "string") {
    const timeStr = messageText.split("this time:")[1];
    return timeStr
      ? new Date(timeStr.trim())
      : calculateNextCronTime(new Date(), 12);
  } else {
    throw new Error("Invalid price update response");
  }
}

export function updateLowestVendor(repriceResult: any, prod: any) {
  if (
    repriceResult &&
    repriceResult.data &&
    repriceResult.data.cronResponse &&
    repriceResult.data.cronResponse.repriceData
  ) {
    if (repriceResult.data.cronResponse.repriceData.repriceDetails) {
      prod.lowest_vendor =
        repriceResult.data.cronResponse.repriceData.repriceDetails.lowestVendor;
      prod.lowest_vendor_price =
        repriceResult.data.cronResponse.repriceData.repriceDetails.lowestVendorPrice;
    } else if (
      repriceResult.data.cronResponse.repriceData.listOfRepriceDetails &&
      repriceResult.data.cronResponse.repriceData.listOfRepriceDetails.length >
        0
    ) {
      prod.lowest_vendor = "";
      prod.lowest_vendor_price = "";
      for (const rep of repriceResult.data.cronResponse.repriceData
        .listOfRepriceDetails) {
        prod.lowest_vendor += `${rep.minQty}@${rep.lowestVendor} / `;
        prod.lowest_vendor_price += `${rep.minQty}@${rep.lowestVendorPrice} / `;
      }
    }
  }
  return prod;
}

export function getLastCronMessage(repriceResult: any) {
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
      for (const rep of repriceResult.data.cronResponse.repriceData
        .listOfRepriceDetails) {
        resultStr += `${rep.minQty}@${rep.explained}/`;
      }
    }
  } else {
    resultStr = `Reprice Result is empty`;
  }
  return resultStr;
}

export function updateCronBasedDetails(
  repriceResult: any,
  prod: any,
  isPriceUpdated: any,
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
