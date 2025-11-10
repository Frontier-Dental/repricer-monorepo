import { Request, Response } from "express";
import * as _codes from "http-status-codes";
import * as dbHelper from "../../utility/mongo/db-helper";
import { setOpportunityCronAndStart } from "./shared";
import { applicationConfig } from "../../utility/config";

export async function startOpportunityHandler(
  req: Request,
  res: Response,
): Promise<any> {
  console.log(`Opportunity Cron started due to Opportunity Handler Request`);
  await startOpportunityLogic();
  return res
    .status(_codes.StatusCodes.OK)
    .send(`${applicationConfig.CRON_NAME_OPPORTUNITY} started.`);
}

export async function startOpportunityLogic() {
  console.info("Initializing Opportunity Cron...");
  const cronSettings = await dbHelper.GetCronSettingsList();
  setOpportunityCronAndStart(cronSettings);
  console.info("Opportunity Cron initialization complete");
}
