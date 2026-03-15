import { Request, Response } from "express";
import * as _codes from "http-status-codes";
import * as axiosHelper from "../../utility/axios-helper";
import { schedule, ScheduledTask } from "node-cron";
import { applicationConfig } from "../../utility/config";
import logger from "../../utility/logger";

let productCron: ScheduledTask | null = null;

export async function startProductCronHandler(req: Request, res: Response): Promise<any> {
  logger.info(`Started Product Cron with ${applicationConfig.PRODUCT_CRON_EXP}`);
  productCron = schedule(applicationConfig.PRODUCT_CRON_EXP, async () => {
    try {
      const url = applicationConfig.PRODUCT_REPRICER_URL;
      await axiosHelper.asyncProductData(url!);
      logger.info(`Requesting Product info on ${url} at Time :  ${new Date()}`);
    } catch (error) {
      logger.error(`Error running Product Cron:`, error);
    }
  });
  return res.status(_codes.StatusCodes.OK).send(`Product Cron started.`);
}
