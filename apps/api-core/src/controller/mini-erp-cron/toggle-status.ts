import { Request, Response } from "express";
import * as _codes from "http-status-codes";
import { miniErpCrons, toggleCronStatus } from "./shared";

export async function toggleMiniErpCronStatusHandler(
  req: Request,
  res: Response,
): Promise<any> {
  const { jobName, status } = req.body;
  const logAction = parseInt(status) == 0 ? `stopped` : `started`;
  toggleCronStatus(miniErpCrons[jobName], status, jobName);
  return res
    .status(_codes.StatusCodes.OK)
    .send(`Cron ${logAction} successfully for jobName : ${jobName}`);
}
