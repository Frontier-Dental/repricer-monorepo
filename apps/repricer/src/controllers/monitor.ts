import { Request, Response } from "express";
import moment from "moment";
import * as httpMiddleware from "../middleware/http-wrappers";
import * as mongoMiddleware from "../middleware/mongo";
import * as SessionHelper from "../utility/session-helper";
import { applicationConfig } from "../utility/config";

export async function GetInprogressCron(req: Request, res: Response) {
  const cronSettings = await mongoMiddleware.GetCronSettingsList();
  const slowCrons = await mongoMiddleware.GetSlowCronDetails();
  const combinedArrayOfCrons = cronSettings.concat(slowCrons);
  let inProgressCrons = await mongoMiddleware.GetLatestCronStatus();
  for (let $ of inProgressCrons) {
    $.cronName = combinedArrayOfCrons.find(
      (x: any) => x.CronId == $.cronId,
    ).CronName;
    if (
      $.productsCount == 0 &&
      Math.round((new Date().getTime() - $.cronTime.getTime()) / 1000) > 120
    ) {
      //If Cron is more than 120 seconds & still Product Count is 0 -> IGNORE the CRON STATUS LOG
      await mongoMiddleware.IgnoreCronStatusLog($.cronId, $.keyGenId);
    }
  }
  return res.json({
    status: true,
    data: inProgressCrons,
  });
}

export async function Get422ProductDetails(req: Request, res: Response) {
  let productsCount: any = {};
  productsCount.products422Error =
    await mongoMiddleware.Get422ProductCountByType("422_ERROR");
  productsCount.priceUpdateProducts =
    await mongoMiddleware.Get422ProductCountByType("PRICE_UPDATE");
  productsCount.eligibleProducts =
    await mongoMiddleware.GetContextErrorItemsCount(true);
  productsCount.time = moment(new Date()).format("DD-MM-YYYY HH:mm:ss");
  return res.json({
    status: true,
    data: productsCount,
  });
}

export async function GetProductsBelowFloor(req: Request, res: Response) {
  httpMiddleware.native_get(
    applicationConfig.REPRICER_API_BASE_URL +
      applicationConfig.GET_422_BELOW_PRODUCTS_ENDPOINT,
  );
  return res.json({
    status: true,
    data: `Job Started at ${new Date()}`,
  });
}

export async function LoadScrapeOnlyProducts(req: Request, res: Response) {
  const pageNo = req.params.pageNo;
  const pageSize = req.params.pageSize;
  const productsList = await mongoMiddleware.GetAllProductDetailsV2(
    {},
    parseInt(pageNo),
    parseFloat(pageSize),
  );
  console.log(
    `Got ${productsList.length} products to insert in Scrape Only Collection`,
  );
  const auditInfo = await SessionHelper.GetAuditInfo(req);
  if (productsList && productsList.length > 0) {
    for (let [index, prod] of productsList.entries()) {
      if (prod && prod.mpId) {
        const scrapeItemToLoad = {
          mpId: parseInt(prod.mpId),
          isActive: true,
          net32Url: await getNet32Url(prod),
          AuditInfo: auditInfo,
        };
        await mongoMiddleware.InsertOrUpdateScrapeOnlyProduct(scrapeItemToLoad);
        console.log(
          `INSERT ${index} : Inserted ${prod.mpId} into Scrape Only Collection`,
        );
      }
    }
  }
  return res.json({
    status: true,
    data: `Inserted Scrape Only products at ${new Date()} || Count : ${productsList.length}`,
  });
}

async function getNet32Url(prod: any) {
  if (prod.tradentDetails) {
    return prod.tradentDetails.net32url;
  }
  if (prod.frontierDetails) {
    return prod.frontierDetails.net32url;
  }
  if (prod.mvpDetails) {
    return prod.mvpDetails.net32url;
  }
  return "";
}
