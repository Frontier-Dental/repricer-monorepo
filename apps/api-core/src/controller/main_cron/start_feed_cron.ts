import { Request, Response } from "express";
import * as _codes from "http-status-codes";
import * as keyGenHelper from "../../utility/keyGenHelper";
import { ScheduledTask, schedule } from "node-cron";
import * as _ from "lodash";
import {
  calculateNextCronTime,
  getLastCronMessage,
  getNextCronTime,
  IsChunkNeeded,
  updateCronBasedDetails,
  updateLowestVendor,
} from "./shared";
import * as mongoHelper from "../../utility/mongo/mongoHelper";
import CronStatusModel from "../../model/cronStatusModel";
import { ErrorItemModel } from "../../model/errorItemModel";
import * as axiosHelper from "../../utility/axiosHelper";

let feedCron: ScheduledTask | null = null;

export async function startFeedCronHandler(
  req: Request,
  res: Response,
): Promise<any> {
  console.log(`Started Feed Cron with details ${process.env.FEED_CRON_EXP}`);
  feedCron = schedule(
    process.env.FEED_CRON_EXP!,
    async () => {
      const eligibleProductList = await getFeedEligibleList();
      console.log(
        `Feed Cron running on ${new Date()} with Eligible Products Count : ${eligibleProductList.length}`,
      );
      if (!eligibleProductList || eligibleProductList.length === 0) {
        return;
      }
      const keyGen = keyGenHelper.Generate();
      const isChunkNeeded = await IsChunkNeeded(
        eligibleProductList,
        null,
        "REGULAR",
      );
      if (isChunkNeeded) {
        let chunkedList = _.chunk(
          eligibleProductList,
          parseInt(process.env.BATCH_SIZE!),
        );
        for (let chunk of chunkedList) {
          await repriceFeed(keyGen, chunk, new Date());
        }
      } else {
        await repriceFeed(keyGen, eligibleProductList, new Date());
      }
    },
    { scheduled: true },
  );

  return res.status(_codes.StatusCodes.OK).send(`Feed Cron started.`);
}

async function getFeedEligibleList() {
  const globalConfig = await mongoHelper.GetGlobalConfig();
  if (globalConfig && globalConfig.source != "FEED") {
    return [];
  }
  return mongoHelper.GetItemList();
}

async function repriceFeed(keyGen: any, productList: any, cronInitTime: any) {
  const productCount = productList.length;
  const feedName = "FEED_RUN";
  let cronLogs: any = {
    time: cronInitTime,
    keyGen: keyGen,
    logs: [] as any[],
    cronId: "N/A",
    totalCount: productCount,
    type: feedName,
  };
  let cronProdCounter = 1;
  let _contextCronStatus = new CronStatusModel(
    cronInitTime,
    0,
    _.filter(
      productList,
      (p) => p.scrapeOn == true && p.activated == true,
    ).length,
    "In-Progress",
    feedName,
    keyGen,
  );
  await initCronStatus(_contextCronStatus);
  for (let prod of productList) {
    prod.last_cron_time = new Date();
    let isPriceUpdated = false;
    if (prod.scrapeOn == true) {
      _contextCronStatus.SetProductCount(cronProdCounter);
      mongoHelper.UpdateCronStatusAsync(_contextCronStatus);
      const postUrl = process.env.FEED_REPRICER_OWN_URL!.replace(
        "{mpId}",
        prod.mpid,
      );
      console.log(
        `${feedName} : Cron Key : ${keyGen} : Requesting Reprice info for ${prod.mpid}  on ${postUrl} at Time :  ${new Date()}`,
      );
      prod.last_attempted_time = new Date();
      prod.lastCronRun = `${feedName}`;
      const repriceResult = await axiosHelper.postAsync(prod, postUrl);
      if (repriceResult && repriceResult.data) {
        if (
          repriceResult.data.priceUpdateResponse &&
          repriceResult.data.priceUpdateResponse != null
        ) {
          if (
            JSON.stringify(repriceResult.data.priceUpdateResponse).indexOf(
              "ERROR:422",
            ) == -1
          ) {
            cronLogs.logs.push({
              productId: prod.mpid,
              logs: repriceResult.data.cronResponse,
              priceUpdated: true,
              priceUpdatedOn: new Date(),
              priceUpdateResponse: repriceResult.data.priceUpdateResponse,
            } as any);
            prod.last_update_time = new Date();
            isPriceUpdated = true;
            if (prod.wait_update_period == true) {
              // Add the product to Error Item Table and update nextCronTime as +12 Hrs
              prod.next_cron_time = calculateNextCronTime(new Date(), 12);
              const priceUpdatedItem = new ErrorItemModel(
                prod.mpid,
                prod.next_cron_time,
                true,
                prod.cronId,
                "PRICE_UPDATE",
                undefined,
              );
              await mongoHelper.UpsertErrorItemLog(priceUpdatedItem);
              console.log({
                message: `${prod.mpid} moved to ${process.env.CRON_NAME_422}`,
                obj: JSON.stringify(priceUpdatedItem),
              });
            } else {
              prod.next_cron_time = null;
            }
          } else {
            prod.next_cron_time = getNextCronTime(
              repriceResult.data.priceUpdateResponse,
            );
            // Add the product to Error Item Table.
            const errorItem = new ErrorItemModel(
              prod.mpid,
              prod.next_cron_time,
              true,
              prod.cronId,
              "422_ERROR",
              undefined,
            );
            await mongoHelper.UpsertErrorItemLog(errorItem);
            console.log({
              message: `${prod.mpid} moved to ${process.env.CRON_NAME_422}`,
              obj: JSON.stringify(errorItem),
            });
            cronLogs.logs.push({
              productId: prod.mpid,
              logs: repriceResult.data.cronResponse,
              priceUpdated: false,
              priceUpdateResponse: repriceResult.data.priceUpdateResponse,
            });
          }
        } else {
          cronLogs.logs.push({
            productId: prod.mpid,
            logs: repriceResult.data.cronResponse,
          });
        }
      } else if (
        repriceResult &&
        (repriceResult.status == _codes.StatusCodes.BAD_REQUEST ||
          repriceResult.status == _codes.StatusCodes.IM_A_TEAPOT)
      ) {
        cronLogs.logs.push({
          productId: prod.mpid,
          logs: `Error: ${repriceResult.data}`,
        });
      } else {
        cronLogs.logs.push({
          productId: prod.mpid,
          logs: "Some error occurred while repricing",
        });
      }
      // Add Last_Cron_Reprice_Message
      prod.last_cron_message = getLastCronMessage(repriceResult);
      prod = updateLowestVendor(repriceResult, prod);
      prod = updateCronBasedDetails(repriceResult, prod, isPriceUpdated);
      mongoHelper.UpdateProductAsync(prod, isPriceUpdated);
      cronProdCounter++;
    }
  }
  //Update End Time
  cronLogs.completionTime = new Date();
  const logInDb = await mongoHelper.PushLogsAsync(cronLogs);

  _contextCronStatus.SetStatus("Complete");
  mongoHelper.UpdateCronStatusAsync(_contextCronStatus);

  if (logInDb) {
    console.log(
      `Successfully logged Cron Logs in DB at ${cronLogs.time} || Id : ${logInDb}`,
    );
  }
}

async function initCronStatus(_contextCronStatus: any) {
  await mongoHelper.InitCronStatusAsync(_contextCronStatus);
}
