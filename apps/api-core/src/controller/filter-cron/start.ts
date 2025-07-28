import { Request, Response } from "express";
import * as dbHelper from "../../utility/mongo/db-helper";
import * as filterMapper from "../../utility/filter-mapper";
import { filterCrons } from "./shared";
import { schedule } from "node-cron";
import * as _codes from "http-status-codes";

export async function startAllFilterCronHandler(
  req: Request,
  res: Response,
): Promise<any> {
  await startFilterCronLogic();
  return res.status(_codes.StatusCodes.OK).send(`Cron started successfully`);
}

export async function startFilterCronLogic() {
  const filterCronDetails = await dbHelper.GetFilterCronDetails();
  for (const cronDetails of filterCronDetails) {
    filterCrons[cronDetails.cronName] = schedule(
      cronDetails.cronExpression,
      async () => {
        await filterMapper.FilterProducts(cronDetails);
      },
      { scheduled: JSON.parse(cronDetails.status) },
    );
    console.log(
      `Started ${cronDetails.cronName} at ${new Date()} with expression ${cronDetails.cronExpression}`,
    );
  }
}
