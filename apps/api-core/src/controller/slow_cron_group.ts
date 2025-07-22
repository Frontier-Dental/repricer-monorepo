import express, { Request, Response } from "express";
import _ from "lodash";
import cron from "node-cron";
import * as dbHelper from "../utility/mongo/dbHelper";
import * as responseUtility from "../utility/responseUtility";
import * as feedHelper from "../utility/feedHelper";
import * as keyGenHelper from "../utility/keyGenHelper";
import * as mySqlHelper from "../utility/mySqlHelper";
import * as _codes from "http-status-codes";
import * as repriceBase from "../utility/repriceBase";

//FilterCron Variables
let _SCG1Cron: any = null;
let _SCG2Cron: any = null;
let _SCG3Cron: any = null;

export const slowCronController = express.Router();

slowCronController.get(
  "/slow_cron/start_cron",
  async (req: Request, res: Response) => {
    const slowCronDetails = await dbHelper.GetSlowCronDetails();
    if (slowCronDetails && slowCronDetails.length > 0) {
      if (slowCronDetails[0]) {
        const cronExpression = await responseUtility.GetCronGeneric(
          slowCronDetails[0].CronTimeUnit,
          slowCronDetails[0].CronTime,
          slowCronDetails[0].Offset,
        );
        console.log(
          `Initializing ${slowCronDetails[0].CronName} with Expression ${cronExpression} at ${new Date()}`,
        );
        _SCG1Cron = cron.schedule(
          cronExpression,
          async () => {
            await runCoreCronLogic(slowCronDetails[0]);
          },
          { scheduled: JSON.parse(slowCronDetails[0].CronStatus) },
        );
      }
      if (slowCronDetails[1]) {
        const cronExpression = await responseUtility.GetCronGeneric(
          slowCronDetails[1].CronTimeUnit,
          slowCronDetails[1].CronTime,
          slowCronDetails[1].Offset,
        );
        console.log(
          `Initializing ${slowCronDetails[1].CronName} with Expression ${cronExpression} at ${new Date()}`,
        );
        _SCG2Cron = cron.schedule(
          cronExpression,
          async () => {
            await runCoreCronLogic(slowCronDetails[1]);
          },
          { scheduled: JSON.parse(slowCronDetails[1].CronStatus) },
        );
      }
      if (slowCronDetails[2]) {
        const cronExpression = await responseUtility.GetCronGeneric(
          slowCronDetails[2].CronTimeUnit,
          slowCronDetails[2].CronTime,
          slowCronDetails[2].Offset,
        );
        console.log(
          `Initializing ${slowCronDetails[2].CronName} with Expression ${cronExpression} at ${new Date()}`,
        );
        _SCG3Cron = cron.schedule(
          cronExpression,
          async () => {
            await runCoreCronLogic(slowCronDetails[2]);
          },
          { scheduled: JSON.parse(slowCronDetails[2].CronStatus) },
        );
      }
    }
  },
);

slowCronController.post(
  "/slow_cron/RecreateSlowCron",
  async (req: Request, res: Response) => {
    const { jobName } = req.body;
    const slowCronDetails = await dbHelper.GetSlowCronDetails(true);
    switch (jobName) {
      case "_SCG1Cron":
        if (slowCronDetails && slowCronDetails.length > 0) {
          if (slowCronDetails[0]) {
            //Stop the Existing Cron.
            await toggleCronStatus(_SCG1Cron, 0, jobName);
            //Dispose the Existing Cron.
            _SCG1Cron = null;
            //Recreate the Cron with New Details
            const cronExpression = await responseUtility.GetCronGeneric(
              slowCronDetails[0].CronTimeUnit,
              slowCronDetails[0].CronTime,
              slowCronDetails[0].Offset,
            );
            _SCG1Cron = cron.schedule(
              cronExpression,
              async () => {
                await runCoreCronLogic(slowCronDetails[0]);
              },
              { scheduled: JSON.parse(slowCronDetails[0].CronStatus) },
            );
            console.log(
              `Re-created ${jobName} with new details at ${new Date()}`,
            );
          }
        }
        break;
      case "_SCG2Cron":
        if (slowCronDetails && slowCronDetails.length > 0) {
          if (slowCronDetails[1]) {
            //Stop the Existing Cron.
            await toggleCronStatus(_SCG2Cron, 0, jobName);
            //Dispose the Existing Cron.
            _SCG2Cron = null;
            //Recreate the Cron with New Details
            const cronExpression = await responseUtility.GetCronGeneric(
              slowCronDetails[1].CronTimeUnit,
              slowCronDetails[1].CronTime,
              slowCronDetails[1].Offset,
            );
            _SCG2Cron = cron.schedule(
              cronExpression,
              async () => {
                await runCoreCronLogic(slowCronDetails[1]);
              },
              { scheduled: JSON.parse(slowCronDetails[1].CronStatus) },
            );
            console.log(
              `Re-created ${jobName} with new details at ${new Date()}`,
            );
          }
        }
        break;
      case "_SCG3Cron":
        if (slowCronDetails && slowCronDetails.length > 0) {
          if (slowCronDetails[2]) {
            //Stop the Existing Cron.
            await toggleCronStatus(_SCG3Cron, 0, jobName);
            //Dispose the Existing Cron.
            _SCG3Cron = null;
            //Recreate the Cron with New Details
            const cronExpression = await responseUtility.GetCronGeneric(
              slowCronDetails[2].CronTimeUnit,
              slowCronDetails[2].CronTime,
              slowCronDetails[2].Offset,
            );
            _SCG3Cron = cron.schedule(
              cronExpression,
              async () => {
                await runCoreCronLogic(slowCronDetails[2]);
              },
              { scheduled: JSON.parse(slowCronDetails[2].CronStatus) },
            );
            console.log(
              `Re-created ${jobName} with new details at ${new Date()}`,
            );
          }
        }
        break;
      default:
        break;
    }
    res
      .status(_codes.StatusCodes.OK)
      .send(`Cron re-started successfully for jobName : ${jobName}`);
  },
);

slowCronController.post(
  "/slow_cron/ToggleCronStatus",
  async (req: Request, res: Response) => {
    const { jobName, status } = req.body;
    const logAction = parseInt(status) == 0 ? `stopped` : `started`;
    switch (jobName) {
      case "_SCG1Cron":
        await toggleCronStatus(_SCG1Cron, status, jobName);
        break;
      case "_SCG2Cron":
        await toggleCronStatus(_SCG2Cron, status, jobName);
        break;
      case "_SCG3Cron":
        await toggleCronStatus(_SCG3Cron, status, jobName);
        break;
      default:
        break;
    }
    res
      .status(_codes.StatusCodes.OK)
      .send(`Cron ${logAction} successfully for jobName : ${jobName}`);
  },
);

slowCronController.get(
  "/slow_cron/start_specific_cron/:key",
  async (req: Request, res: Response) => {
    const cronName = req.params.key;
    const slowCronDetails = await dbHelper.GetSlowCronDetails();
    console.log(`Executing Manually the cron ${cronName} at ${new Date()}`);
    await runCoreCronLogic(
      slowCronDetails.find((x: any) => x.CronName == cronName),
    );
    res
      .status(_codes.StatusCodes.OK)
      .send(`Executed ${cronName} at ${new Date()}.`);
  },
);

async function runCoreCronLogic(cronSettingsResponse: any) {
  const initTime = new Date();
  const eligibleProductList = await getSlowCronEligibleProductsV3(
    cronSettingsResponse.CronId,
  );
  if (eligibleProductList && eligibleProductList.length > 0) {
    const keyGen = keyGenHelper.Generate();
    console.log(
      `${cronSettingsResponse.CronName} running on ${initTime} with Eligible Product count : ${eligibleProductList.length}  || Key : ${keyGen}`,
    );
    const isChunkNeeded = await IsChunkNeeded(eligibleProductList);
    if (isChunkNeeded == true) {
      let chunkedList = _.chunk(
        eligibleProductList,
        parseInt(process.env.BATCH_SIZE!),
      );
      for (let chunk of chunkedList) {
        await repriceBase.Execute(
          keyGen,
          chunk,
          new Date(),
          cronSettingsResponse,
          true,
        );
      }
    } else
      repriceBase.Execute(
        keyGen,
        eligibleProductList,
        initTime,
        cronSettingsResponse,
        true,
      );
  } else {
    console.log(
      `No eligible products found for ${cronSettingsResponse.CronName} at ${new Date()}`,
    );
  }
}

async function getSlowCronEligibleProductsV3(cronId: any) {
  let eligibleProductList: any[] = [];
  eligibleProductList = await mySqlHelper.GetActiveProductListByCronId(
    cronId,
    true,
  ); //await dbHelper.GetActiveProductList(cronId, true);
  eligibleProductList = await feedHelper.FilterEligibleProducts(
    eligibleProductList,
    cronId,
    true,
  );
  return eligibleProductList;
}

async function IsChunkNeeded(list: any[]) {
  return list.length > parseInt(process.env.BATCH_SIZE!);
}

async function toggleCronStatus(cronObject: any, status: any, cronName: any) {
  switch (parseInt(status)) {
    case 0:
      if (cronObject) {
        cronObject.stop();
        console.log(`${cronName} cron stopped successfully at ${new Date()} `);
      }
      break;
    case 1:
      if (cronObject) {
        cronObject.start();
        console.log(`${cronName} cron started successfully at ${new Date()} `);
      }
      break;
    default:
      break;
  }
}
