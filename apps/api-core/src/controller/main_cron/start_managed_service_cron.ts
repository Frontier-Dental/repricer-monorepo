import { Request, Response } from "express";
import * as _codes from "http-status-codes";
import * as axiosHelper from "../../utility/axiosHelper";
import { schedule, ScheduledTask } from "node-cron";
import { applicationConfig } from "../../utility/config";

let managedCron: ScheduledTask | null = null;

export async function startManagedServiceCronHandler(
  req: Request,
  res: Response,
): Promise<any> {
  if (applicationConfig.IS_SCRAPER) {
    console.log(
      `Started Managed Service Cron with ${applicationConfig.MANAGED_CRON_EXP}`,
    );
    managedCron = schedule(
      applicationConfig.MANAGED_CRON_EXP,
      async () => {
        const url = applicationConfig.COLLATE_DATA_URL;
        console.log(
          `Running Managed Service Cron on ${url} at Time :  ${new Date()}`,
        );
        await axiosHelper.native_get(url!);
      },
      { scheduled: true },
    );
  }
  return res
    .status(_codes.StatusCodes.OK)
    .send(`Managed Service Cron started.`);
}
