import { Request, Response } from "express";
import * as _codes from "http-status-codes";
import * as dbHelper from "../../utility/mongo/db-helper";
import { setCronAndStart, stopAllMainCrons } from "./shared";

export async function startAllCronHandler(
  req: Request,
  res: Response,
): Promise<any> {
  await startAllCronLogic();
  return res.status(_codes.StatusCodes.OK).send("Cron started.");
}

export async function startAllCronLogic() {
  await dbHelper.ResetPendingCronLogs();
  stopAllMainCrons();
  const cronSettingsResponse = await dbHelper.GetCronSettings();
  for (const cronSetting of cronSettingsResponse.filter((x) => !x.IsHidden)) {
    const cronName = cronSetting.CronName;
    setCronAndStart(cronName, cronSetting);
  }
}
