import _ from "lodash";
import cron from "node-cron";
import express, { Request, Response } from "express";
export const filterCronController = express.Router();
import * as _codes from "http-status-codes";
import * as dbHelper from "../utility/mongo/db-helper";
import * as filterMapper from "../utility/filter-mapper";

//FilterCron Variables
let _FC1Cron: any = null;
let _FC2Cron: any = null;
let _FC3Cron: any = null;

filterCronController.get(
  "/filter/StartFilterCron",
  async (req: Request, res: Response): Promise<any> => {
    const filterCronDetails = await dbHelper.GetFilterCronDetails();
    if (filterCronDetails && filterCronDetails.length > 0) {
      if (filterCronDetails[0]) {
        _FC1Cron = cron.schedule(
          filterCronDetails[0].cronExpression,
          async () => {
            await filterMapper.FilterProducts(filterCronDetails[0]);
          },
          { scheduled: JSON.parse(filterCronDetails[0].status) },
        );
        console.log(
          `Started ${filterCronDetails[0].cronName} at ${new Date()} with expression ${filterCronDetails[0].cronExpression}`,
        );
      }
      if (filterCronDetails[1]) {
        _FC2Cron = cron.schedule(
          filterCronDetails[1].cronExpression,
          async () => {
            await filterMapper.FilterProducts(filterCronDetails[1]);
          },
          { scheduled: JSON.parse(filterCronDetails[1].status) },
        );
        console.log(
          `Started ${filterCronDetails[1].cronName} at ${new Date()} with expression ${filterCronDetails[1].cronExpression}`,
        );
      }
      if (filterCronDetails[2]) {
        _FC3Cron = cron.schedule(
          filterCronDetails[2].cronExpression,
          async () => {
            await filterMapper.FilterProducts(filterCronDetails[2]);
          },
          { scheduled: JSON.parse(filterCronDetails[2].status) },
        );
        console.log(
          `Started ${filterCronDetails[2].cronName} at ${new Date()} with expression ${filterCronDetails[2].cronExpression}`,
        );
      }
    }
  },
);

filterCronController.post(
  "/filter/RecreateFilterCron",
  async (req: Request, res: Response): Promise<any> => {
    const { jobName } = req.body;
    const filterCronDetails = await dbHelper.GetFilterCronDetails(true);
    switch (jobName) {
      case "_FC1Cron":
        if (filterCronDetails && filterCronDetails.length > 0) {
          if (filterCronDetails[0]) {
            //Stop the Existing Cron.
            await toggleCronStatus(_FC1Cron, 0, jobName);
            //Dispose the Existing Cron.
            _FC1Cron = null;
            //Recreate the Cron with New Details
            _FC1Cron = cron.schedule(
              filterCronDetails[0].cronExpression,
              async () => {
                await filterMapper.FilterProducts(filterCronDetails[0]);
              },
              { scheduled: JSON.parse(filterCronDetails[0].status) },
            );
            console.log(
              `Re-created ${jobName} with new details at ${new Date()}`,
            );
          }
        }
        break;
      case "_FC2Cron":
        if (filterCronDetails && filterCronDetails.length > 0) {
          if (filterCronDetails[1]) {
            //Stop the Existing Cron.
            await toggleCronStatus(_FC2Cron, 0, jobName);
            //Dispose the Existing Cron.
            _FC2Cron = null;
            //Recreate the Cron with New Details
            _FC2Cron = cron.schedule(
              filterCronDetails[1].cronExpression,
              async () => {
                await filterMapper.FilterProducts(filterCronDetails[1]);
              },
              { scheduled: JSON.parse(filterCronDetails[1].status) },
            );
            console.log(
              `Re-created ${jobName} with new details at ${new Date()}`,
            );
          }
        }
        break;
      case "_FC3Cron":
        if (filterCronDetails && filterCronDetails.length > 0) {
          if (filterCronDetails[2]) {
            //Stop the Existing Cron.
            await toggleCronStatus(_FC3Cron, 0, jobName);
            //Dispose the Existing Cron.
            _FC3Cron = null;
            //Recreate the Cron with New Details
            _FC3Cron = cron.schedule(
              filterCronDetails[2].cronExpression,
              async () => {
                await filterMapper.FilterProducts(filterCronDetails[2]);
              },
              { scheduled: JSON.parse(filterCronDetails[2].status) },
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
    return res
      .status(_codes.StatusCodes.OK)
      .send(`Cron re-started successfully for jobName : ${jobName}`);
  },
);

filterCronController.post(
  "/filter/toggleCronStatus",
  async (req: Request, res: Response): Promise<any> => {
    const { jobName, status } = req.body;
    const logAction = parseInt(status) == 0 ? `stopped` : `started`;
    switch (jobName) {
      case "_FC1Cron":
        await toggleCronStatus(_FC1Cron, status, jobName);
        break;
      case "_FC2Cron":
        await toggleCronStatus(_FC2Cron, status, jobName);
        break;
      case "_FC3Cron":
        await toggleCronStatus(_FC3Cron, status, jobName);
        break;
      default:
        break;
    }
    return res
      .status(_codes.StatusCodes.OK)
      .send(`Cron ${logAction} successfully for jobName : ${jobName}`);
  },
);

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
