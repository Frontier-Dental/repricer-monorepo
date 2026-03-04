import { Request, Response } from "express";
import * as filterMapper from "../../utility/filter-mapper";
import { filterCrons } from "./shared";
import { schedule } from "node-cron";
import * as _codes from "http-status-codes";
import { GetFilteredCrons } from "../../utility/mysql/mysql-v2";
import logger from "../../utility/logger";

export async function startAllFilterCronHandler(req: Request, res: Response): Promise<any> {
  await startFilterCronLogic();
  return res.status(_codes.StatusCodes.OK).send(`Cron started successfully`);
}

export async function startFilterCronLogic() {
  const filterCronDetails = await GetFilteredCrons();
  for (const cronDetails of filterCronDetails) {
    try {
      filterCrons[cronDetails.cronName] = schedule(
        cronDetails.cronExpression,
        async () => {
          try {
            await filterMapper.FilterProducts(cronDetails);
          } catch (error) {
            logger.info(`Error running ${cronDetails.cronName}:`, error);
          }
        },
        { scheduled: JSON.parse(cronDetails.status) }
      );
      if (JSON.parse(cronDetails.status)) {
        logger.info(`Started ${cronDetails.cronName} at ${new Date()} with expression ${cronDetails.cronExpression}`);
      }
    } catch (exception) {
      logger.error(`Error initializing ${cronDetails.cronName} || ${exception}`);
    }
  }
}
