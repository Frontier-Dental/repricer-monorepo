import { Request, Response } from "express";
import * as dbHelper from "../../utility/mongo/dbHelper";
import { scrapeProductList } from "./shared";
import * as _codes from "http-status-codes";
import * as mySqlHelper from "../../utility/mySqlHelper";
import * as scrapeHelper from "../../utility/scrapeHelper";
import { ScrapeCronDetail } from "../../utility/mongo/types";

export async function runCron(req: Request, res: Response): Promise<any> {
  const requestedCron = req.params.cronName;
  const scrapeCronDetails = await dbHelper.GetScrapeCronDetails();
  const contextCronDetails = scrapeCronDetails.find(
    (x: any) => x.CronName == requestedCron,
  );
  await scrapeProductList(contextCronDetails);
  return res.status(_codes.StatusCodes.OK).send(`Done at ${new Date()}`);
}

export async function runProduct(req: Request, res: Response): Promise<any> {
  const requestedCron = req.params.cronName;
  const productId = req.params.product;
  const scrapeCronDetails = await dbHelper.GetScrapeCronDetails();
  const contextCronDetails = scrapeCronDetails.find(
    (x: any) => x.CronName == requestedCron,
  );
  await scrapeProductListForProduct(contextCronDetails!, productId);
  return res.status(_codes.StatusCodes.OK).send(`Done at ${new Date()}`);
}

async function scrapeProductListForProduct(
  cronSettingsResponse: ScrapeCronDetail,
  productId: string,
) {
  const scrapeProductList =
    await mySqlHelper.GetScrapeProductDetailsByIdAndCron(
      cronSettingsResponse.CronId,
      productId,
    );
  await scrapeHelper.Execute(scrapeProductList, cronSettingsResponse);
}
