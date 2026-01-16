import { Request, Response } from "express";
import * as _codes from "http-status-codes";
import * as _ from "lodash";
import { applicationConfig } from "../../utility/config";
import * as keyGenHelper from "../../utility/job-id-helper";
import * as dbHelper from "../../utility/mongo/db-helper";
import * as repriceBase from "../../utility/reprice-algo/reprice-base";
import { startAllCronAsIs, stopAllMainCrons } from "./shared";
import { GetCronSettingsList, UpdateCronDetailsByCronId } from "../../utility/mysql/mysql-v2";

export async function startOverrideHandler(req: Request, res: Response): Promise<any> {
  //Update All Cron to Stop
  const cronDetails = await GetCronSettingsList();
  const existingCronConfig = _.cloneDeep(cronDetails);
  if (cronDetails && cronDetails.length > 0) {
    for (const cron of cronDetails) {
      await UpdateCronDetailsByCronId(cron.CronId, false);
    }
  }
  //Wait for 15seconds for all Running Cron to Stop
  await delay(applicationConfig.OVERRIDE_DELAY);
  //Call stopAllCronV3()
  stopAllMainCrons();
  // Get List of Products with override_bulk_update == true
  let listOfOverrideProducts = await dbHelper.GetListOfOverrideProducts();
  //Do logic same as Cron Method and Call Reprice V3
  if (listOfOverrideProducts && listOfOverrideProducts.length > 0) {
    const keyGen = keyGenHelper.Generate();
    const initTime = new Date();
    console.log(`Override Bulk Update Process running on ${initTime} with Eligible Product count : ${listOfOverrideProducts.length}  || Key : ${keyGen}`);
    let chunkedList = _.chunk(listOfOverrideProducts, applicationConfig.BATCH_SIZE);
    for (let chunk of chunkedList) {
      await repriceBase.Execute(keyGen, chunk, new Date(), null, true);
    }
  }

  //Set Cron Status to Old Status
  if (existingCronConfig && existingCronConfig.length > 0) {
    for (const cron of existingCronConfig) {
      await UpdateCronDetailsByCronId(cron.CronId, cron.CronStatus);
    }
  }

  //Start All Cron
  await startAllCronAsIs(existingCronConfig);

  return res.status(_codes.StatusCodes.OK).send("Success!");
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
