import { Request, Response } from "express";
import * as _codes from "http-status-codes";
import { setError422CronAndStart } from "./shared";
import { applicationConfig } from "../../utility/config";
import { GetCronSettingsList } from "../../utility/mysql/mysql-v2";

export async function start422Handler(
  req: Request,
  res: Response,
): Promise<any> {
  console.log(`Cron-422 started due to 422 Handler Request`);
  await start422Logic();
  return res
    .status(_codes.StatusCodes.OK)
    .send(`${applicationConfig.CRON_NAME_422} started.`);
}

export async function start422Logic() {
  const cronSettings = await GetCronSettingsList();
  try {
    setError422CronAndStart(cronSettings);
  } catch (exception) {
    console.error(`Error initialising 422 Cron || ${exception}`);
  }
}
