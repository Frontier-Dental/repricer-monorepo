import { Request, Response } from "express";
import * as _codes from "http-status-codes";
import * as dbHelper from "../../utility/mongo/db-helper";
import { setCronAndStart, stopAllMainCrons } from "./shared";
import { GetCronSettingsList } from "../../utility/mysql/mysql-v2";

export async function startAllCronHandler(req: Request, res: Response): Promise<any> {
  await startAllCronLogic();
  return res.status(_codes.StatusCodes.OK).send("Cron started.");
}

export async function startAllCronLogic() {
  await dbHelper.ResetPendingCronLogs();
  stopAllMainCrons();
  const cronSettingsResponse = await GetCronSettingsList();
  for (const cronSetting of cronSettingsResponse.filter((x: any) => !x.IsHidden)) {
    const cronName = cronSetting.CronName;
    try {
      setCronAndStart(cronName, cronSetting);
    } catch (exception) {
      console.error(`Exception while initializing Cron : ${cronName} || ${exception}`);
    }
  }
}
