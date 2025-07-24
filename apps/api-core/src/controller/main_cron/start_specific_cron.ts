import { Request, Response } from "express";
import * as _codes from "http-status-codes";
import * as _ from "lodash";
import * as keyGenHelper from "../../utility/keyGenHelper";
import * as dbHelper from "../../utility/mongo/dbHelper";
import * as repriceBase from "../../utility/repriceBase";
import {
  getCronEligibleProductsV3,
  IsChunkNeeded,
  logBlankCronDetailsV3,
  runCoreCronLogicFor422,
} from "./shared";
import { applicationConfig } from "../../utility/config";

export async function startSpecificCronHandler(
  req: Request,
  res: Response,
): Promise<any> {
  const cronName = req.params.key;
  const cronDetails: any[] =
    await dbHelper.GetCronSettingsDetailsByName(cronName);
  console.log(`Starting Manually the cron ${cronName} at ${new Date()}`);
  if (cronDetails && _.first(cronDetails).IsHidden == true) {
    runCoreCronLogicFor422();
  } else await runCoreCronLogic(_.first(cronDetails));
  return res
    .status(_codes.StatusCodes.OK)
    .send(`Executed ${cronName} at ${new Date()}.`);
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
