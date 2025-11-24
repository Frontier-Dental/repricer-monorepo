import { Request, Response } from "express";
import {
  getMainCronNameFromJobName,
  setCronAndStart,
  startCron,
  startError422Cron,
  setOpportunityCronAndStart,
} from "./shared";
import {
  GetCronSettingsDetailsByName,
  GetCronSettingsList,
} from "../../utility/mysql/mysql-v2";
import * as _codes from "http-status-codes";
import { BadRequest } from "http-errors";
import { UpdateCronSettings } from "../../utility/mysql/mysql-v2";

export async function startCronHandler(
  req: Request,
  res: Response,
): Promise<any> {
  const { jobName, cronId } = req.body;
  if (jobName === "Cron-422") {
    startError422Cron();
    return res
      .status(_codes.StatusCodes.OK)
      .send(`Cron job started successfully for jobName : ${jobName}`);
  }
  if (jobName === "Cron-Opportunity") {
    const cronSettings = await GetCronSettingsList();
    setOpportunityCronAndStart(cronSettings);
    return res
      .status(_codes.StatusCodes.OK)
      .send(`Cron job started successfully for jobName : ${jobName}`);
  }
  const cronName = getMainCronNameFromJobName(jobName);
  if (!cronName) {
    throw BadRequest(`Invalid Job Name: ${jobName}`);
  }
  const settings = await GetCronSettingsDetailsByName(cronName);
  if (!settings) {
    throw BadRequest(`Cron settings not found for ${cronName}`);
  }
  setCronAndStart(cronName, settings);
  await UpdateCronSettings(cronId);
  return res
    .status(_codes.StatusCodes.OK)
    .send(`Cron job started successfully for jobName : ${jobName}`);
}
