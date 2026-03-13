import { GetMiniErpCronDetails } from "../../utility/mysql/mysql-v2";
import { Request, Response } from "express";
import * as _codes from "http-status-codes";
import * as responseUtility from "../../utility/response-utility";
import cron from "node-cron";
import { getProductsFromMiniErp } from "../../utility/mini-erp/min-erp-helper";
import { updateNet32Stock } from "../../services/net32-stock-update";
import { miniErpCrons } from "./shared";
import logger from "../../utility/logger";

export async function startMiniErpCron(req: Request, res: Response): Promise<any> {
  await startMiniErpCronLogic();
  return res.status(_codes.StatusCodes.OK).send(`Cron started successfully`);
}

export async function startMiniErpCronLogic() {
  logger.info("Starting mini erp cron logic at", new Date());
  const miniErpCronDetails = await GetMiniErpCronDetails();

  if (miniErpCronDetails && miniErpCronDetails.length > 0) {
    for (var i = 0; i < miniErpCronDetails.length; i++) {
      if (miniErpCronDetails[i]) {
        const cronDetail = miniErpCronDetails[i];
        miniErpCrons[cronDetail.CronName] = cron.schedule(
          responseUtility.GetCronGeneric(cronDetail.CronTimeUnit, cronDetail.CronTime, parseInt(cronDetail.Offset)),
          async () => {
            try {
              switch (cronDetail.CronName) {
                case "MiniErpFetchCron":
                  await getProductsFromMiniErp();
                  break;
                case "StockUpdateCron":
                  await updateNet32Stock();
                  break;
                default:
                  logger.error(`Cron ${cronDetail.CronName} not found`);
                  break;
              }
            } catch (error) {
              logger.error(`Error running ${cronDetail.CronName}:`, error);
            }
          },
          { scheduled: JSON.parse(cronDetail.CronStatus) }
        );
        if (JSON.parse(cronDetail.CronStatus)) {
          logger.info(`Started ${cronDetail.CronName}`);
        }
      }
    }
  }
}
