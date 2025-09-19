import { Request, Response } from "express";
import * as _codes from "http-status-codes";
import { filterCrons, getCronNameByJobName } from "./shared";
import { toggleCronStatus } from "../scrape-cron/shared";

export async function toggleFilterCronStatusHandler(
  req: Request,
  res: Response,
): Promise<any> {
  const { jobName, status } = req.body;
  const logAction = parseInt(status) == 0 ? `stopped` : `started`;
  const cronName = getCronNameByJobName(jobName);
  toggleCronStatus(filterCrons[cronName], status, jobName);
  return res
    .status(_codes.StatusCodes.OK)
    .send(`Cron ${logAction} successfully for jobName : ${jobName}`);
}
