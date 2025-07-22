import { Request, Response } from "express";
import * as _codes from "http-status-codes";
import * as dbHelper from "../../utility/mongo/dbHelper";
import { setError422CronAndStart } from "./shared";

export async function start422Handler(
  req: Request,
  res: Response,
): Promise<any> {
  console.log(`Cron-422 started on ${new Date()}`);
  const cronSettings = await dbHelper.GetCronSettingsList();
  setError422CronAndStart(cronSettings);
  return res
    .status(_codes.StatusCodes.OK)
    .send(`${process.env.CRON_NAME_422} started.`);
}
