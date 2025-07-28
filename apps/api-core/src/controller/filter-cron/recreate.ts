import { Request, Response } from "express";
import * as dbHelper from "../../utility/mongo/db-helper";
import * as filterMapper from "../../utility/filter-mapper";
import { filterCrons, getCronNameByJobName } from "./shared";
import { toggleCronStatus } from "../scrape-cron/shared";
import * as _codes from "http-status-codes";
import { schedule } from "node-cron";

export async function recreateFilterCronHandler(
  req: Request,
  res: Response,
): Promise<any> {
  const { jobName } = req.body;
  const filterCronDetails = await dbHelper.GetFilterCronDetails(true);
  const cronName = getCronNameByJobName(jobName);
  const details = filterCronDetails.find((cron) => cron.cronName === cronName);
  if (!details) {
    return res
      .status(_codes.StatusCodes.NOT_FOUND)
      .send(`Cron not found for jobName : ${jobName}`);
  }
  filterCrons[cronName].stop();
  delete filterCrons[cronName];
  filterCrons[cronName] = schedule(
    details.cronExpression,
    async () => {
      await filterMapper.FilterProducts(details);
    },
    { scheduled: JSON.parse(details.status) },
  );
  console.log(`Re-created ${cronName} with new details at ${new Date()}`);
  return res
    .status(_codes.StatusCodes.OK)
    .send(`Cron re-started successfully for jobName : ${jobName}`);
}
