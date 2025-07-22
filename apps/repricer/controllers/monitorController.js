//  1api will give the number of inprogress crons at any given time
//  2nd api will return me the no of 422error products,no of price update products and no of eligible products
const _codes = require("http-status-codes");
const asyncHandler = require("express-async-handler");
const moment = require("moment");
const mongoMiddleware = require("../middleware/mongoMiddleware");
const httpMiddleware = require("../middleware/httpMiddleware");
const SessionHelper = require("../Utility/SessionHelper");

const GetInprogressCron = asyncHandler(async (req, res) => {
  try {
    const cronSettings = await mongoMiddleware.GetCronSettingsList();
    const slowCrons = await mongoMiddleware.GetSlowCronDetails();
    const combinedArrayOfCrons = cronSettings.concat(slowCrons);
    let inProgressCrons = await mongoMiddleware.GetLatestCronStatus();
    for (let $ of inProgressCrons) {
      $.cronName = combinedArrayOfCrons.find(
        (x) => x.CronId == $.cronId,
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
  } catch (exception) {
    return res.json({
      status: false,
      data: `Error ${exception.message}`,
    });
  }
});

const Get422ProductDetails = asyncHandler(async (req, res) => {
  try {
    let productsCount = {};
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
  } catch (exception) {
    return res.json({
      status: false,
      data: `Error ${exception.message}`,
    });
  }
});

const GetProductsBelowFloor = asyncHandler(async (req, res) => {
  try {
    httpMiddleware.native_get(process.env.GET_422_BELOW_PRODUCTS);
    return res.json({
      status: true,
      data: `Job Started at ${new Date()}`,
    });
  } catch (exception) {
    return res.json({
      status: false,
      data: `Error ${exception.message}`,
    });
  }
});

const LoadScrapeOnlyProducts = asyncHandler(async (req, res) => {
  try {
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
          await mongoMiddleware.InsertOrUpdateScrapeOnlyProduct(
            scrapeItemToLoad,
          );
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
  } catch (exception) {
    return res.json({
      status: false,
      data: `Error ${exception.message}`,
    });
  }
});

async function getNet32Url(prod) {
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

module.exports = {
  GetInprogressCron,
  Get422ProductDetails,
  GetProductsBelowFloor,
  LoadScrapeOnlyProducts,
};
