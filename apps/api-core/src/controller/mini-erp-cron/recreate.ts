import { schedule } from "node-cron";
import { Request, Response } from "express";
import { GetMiniErpCronDetails } from "../../utility/mysql/mysql-v2";
import * as responseUtility from "../../utility/response-utility";
import * as _codes from "http-status-codes";
import { miniErpCrons } from "./shared";
import { updateNet32Stock } from "../../services/net32-stock-update";
import { getProductsFromMiniErp } from "../../utility/mini-erp/min-erp-helper";
import logger from "../../utility/logger";
import { NotFoundError } from "../../errors/custom-errors";

export async function recreateMiniErpCronHandler(req: Request, res: Response): Promise<any> {
  const { jobName } = req.body;
  const cronDetails = await GetMiniErpCronDetails(true);
  const details = cronDetails.find((cron: any) => cron.CronName === jobName);
  if (!details) {
    throw new NotFoundError(`Cron for jobName ${jobName}`);
  }
  if (miniErpCrons.hasOwnProperty(jobName)) {
    miniErpCrons[jobName].stop();
    delete miniErpCrons[jobName];
  }
  miniErpCrons[jobName] = schedule(
    responseUtility.GetCronGeneric(details.CronTimeUnit, details.CronTime, parseInt(details.Offset)),
    async () => {
      try {
        switch (details.CronName) {
          case "MiniErpFetchCron":
            await getProductsFromMiniErp();
            break;
          case "StockUpdateCron":
            await updateNet32Stock();
            break;
          default:
            logger.error(`Cron ${details.CronName} not found`);
            break;
        }
      } catch (error) {
        logger.error(`Error running ${details.CronName}:`, error);
      }
    },
    { scheduled: JSON.parse(details.CronStatus) }
  );
  logger.info(`Re-created ${details.CronName} with new details. Status: ${JSON.parse(details.CronStatus)}`);
  return res.status(_codes.StatusCodes.OK).send(`Cron re-started successfully for jobName : ${jobName}`);
}
