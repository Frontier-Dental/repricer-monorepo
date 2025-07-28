import { Request, Response } from "express";
import {
  getScrapeCronNameFromJobName,
  scrapeCrons,
  toggleCronStatus,
} from "./shared";
import * as _codes from "http-status-codes";

export async function toggleStatus(req: Request, res: Response): Promise<any> {
  const { jobName, status } = req.body;
  const logAction = parseInt(status) == 0 ? `stopped` : `started`;
  const cronName = getScrapeCronNameFromJobName(jobName);
  toggleCronStatus(scrapeCrons[cronName], status, jobName);
  return res
    .status(_codes.StatusCodes.OK)
    .send(`Cron ${logAction} successfully for jobName : ${jobName}`);
}
