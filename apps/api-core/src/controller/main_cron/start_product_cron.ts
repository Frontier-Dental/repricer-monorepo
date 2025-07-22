import { Request, Response } from "express";
import * as _codes from "http-status-codes";
import * as axiosHelper from "../../utility/axiosHelper";
import { schedule, ScheduledTask } from "node-cron";

let productCron: ScheduledTask | null = null;

export async function startProductCronHandler(
  req: Request,
  res: Response,
): Promise<any> {
  console.log(`Started Product Cron with ${process.env.PRODUCT_CRON_EXP}`);
  productCron = schedule(
    process.env.PRODUCT_CRON_EXP!,
    async () => {
      const url = process.env.PRODUCT_REPRICER_URL;
      await axiosHelper.asyncProductData(url!);
      console.log(`Requesting Product info on ${url} at Time :  ${new Date()}`);
    },
    { scheduled: true },
  );
  return res.status(_codes.StatusCodes.OK).send(`Product Cron started.`);
}
