import { Request, Response } from "express";
import * as _codes from "http-status-codes";
import * as axiosHelper from "../../utility/axios-helper";
import { schedule, ScheduledTask } from "node-cron";
import { applicationConfig } from "../../utility/config";

let productCron: ScheduledTask | null = null;

export async function startProductCronHandler(
  req: Request,
  res: Response,
): Promise<any> {
  console.log(
    `Started Product Cron with ${applicationConfig.PRODUCT_CRON_EXP}`,
  );
  productCron = schedule(applicationConfig.PRODUCT_CRON_EXP, async () => {
    try {
      const url = applicationConfig.PRODUCT_REPRICER_URL;
      await axiosHelper.asyncProductData(url!);
      console.log(`Requesting Product info on ${url} at Time :  ${new Date()}`);
    } catch (error) {
      console.error(`Error running Product Cron:`, error);
    }
  });
  return res.status(_codes.StatusCodes.OK).send(`Product Cron started.`);
}
