import { Request, Response } from "express";
import { scrapeProductList } from "./shared";
import * as _codes from "http-status-codes";
import * as mySqlHelper from "../../utility/mysql/mysql-helper";
import * as scrapeHelper from "../../utility/scrape-helper";
import { ScrapeCronDetail } from "../../utility/mongo/types";
import { GetScrapeCronDetails } from "../../utility/mysql/mysql-v2";

export async function runCron(req: Request, res: Response): Promise<any> {
  const requestedCron = req.params.cronName;
  const scrapeCronDetails = await GetScrapeCronDetails();
  const contextCronDetails = scrapeCronDetails.find((x: any) => x.CronName == requestedCron);
  await scrapeProductList(contextCronDetails);
  return res.status(_codes.StatusCodes.OK).send(`Done at ${new Date()}`);
}

export async function runProduct(req: Request, res: Response): Promise<any> {
  const requestedCron = req.params.cronName;
  const productId = req.params.product as string;
  const scrapeCronDetails = await GetScrapeCronDetails();
  const contextCronDetails = scrapeCronDetails.find((x: any) => x.CronName == requestedCron);
  await scrapeProductListForProduct(contextCronDetails!, productId);
  return res.status(_codes.StatusCodes.OK).send(`Done at ${new Date()}`);
}

async function scrapeProductListForProduct(cronSettingsResponse: ScrapeCronDetail, productId: string) {
  const scrapeProductList = (await mySqlHelper.GetItemListById(productId)) as any;
  if (scrapeProductList) {
    scrapeProductList.MpId = scrapeProductList.mpId;
    scrapeProductList.LinkedTradentDetailsInfo = scrapeProductList.tradentLinkInfo;
    await scrapeHelper.Execute([scrapeProductList], cronSettingsResponse);
  }
}
