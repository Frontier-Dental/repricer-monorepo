import { Request, Response } from "express";
import * as _codes from "http-status-codes";
import { slowCrons, getCronNameByJobName, toggleCronStatus } from "./shared";

export async function toggleSlowCronStatusHandler(req: Request, res: Response): Promise<any> {
  const { jobName, status } = req.body;
  const logAction = parseInt(status) == 0 ? `stopped` : `started`;
  const cronName = getCronNameByJobName(jobName);
  await toggleCronStatus(slowCrons[cronName], status, jobName);
  return res.status(_codes.StatusCodes.OK).send(`Cron ${logAction} successfully for jobName : ${jobName}`);
}
