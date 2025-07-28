import _ from "lodash";
import uuid from "uuid";
import moment from "moment";
import * as axiosHelper from "./axios-helper";
import * as mySqlHelper from "./mysql/mysql-helper";
import { Generate } from "./key-gen-helper";
import { RunInfo } from "../model/sql-models/run-info";
import { ProductInfo } from "../model/sql-models/product-info";
import { PriceBreakInfo } from "../model/sql-models/price-break-info";
import { RunCompletionStatus } from "../model/sql-models/run-completion-status";
import { applicationConfig } from "./config";

export async function Execute(
  productList: any[],
  cronSetting: any,
): Promise<void> {
  if (productList && productList.length > 0) {
    const keyGen = Generate();
    mySqlHelper.InsertRunCompletionStatus(
      new RunCompletionStatus(keyGen, "SCRAPE_ONLY", false),
    );
    const isChunkNeeded = await IsChunkNeeded(productList);
    if (isChunkNeeded == true) {
      let chunkedList = _.chunk(productList, 2000);
      for (let chunk of chunkedList) {
        await executeScrapeLogic(keyGen, chunk, cronSetting);
      }
    } else await executeScrapeLogic(keyGen, productList, cronSetting);
    mySqlHelper.UpdateRunCompletionStatus(
      new RunCompletionStatus(keyGen, "SCRAPE_ONLY", true),
    );
  }
}

async function executeScrapeLogic(
  keyGen: string,
  productList: any[],
  cronSetting: any,
): Promise<void> {
  let runInfo = new RunInfo(
    cronSetting.CronName,
    cronSetting.CronId,
    uuid.v4().toString().replaceAll("-", ""),
    keyGen,
    "SCRAPE_ONLY",
    productList.length,
    productList.length,
    0,
    0,
  );
  const ownVendorListEnv = applicationConfig.OWN_VENDOR_LIST || "";
  const onwVendorList = ownVendorListEnv.split(";");
  const runInfoResult = await mySqlHelper.InsertRunInfo(runInfo);
  if (runInfoResult && (runInfoResult as any).insertId) {
    for (let prod of productList) {
      console.log(`SCRAPE-ONLY : Scraping started for ${prod.MpId}`);
      const scrapeStartTime = new Date();
      const getSearchResultsEnv = applicationConfig.GET_SEARCH_RESULTS || "";
      const searchRequest = getSearchResultsEnv.replace("{mpId}", prod.MpId);
      const net32resp = await axiosHelper.getAsyncProxy(
        searchRequest,
        cronSetting,
      );
      if (net32resp && net32resp.data) {
        await mySqlHelper.UpdateLastScrapeInfo(
          prod.MpId,
          moment(scrapeStartTime).format("YYYY-MM-DD HH:mm:ss"),
        );
        for (const [index, resp] of net32resp.data.entries()) {
          const isOwnVendor = _.includes(
            onwVendorList,
            resp.vendorId.toString(),
          );
          const productInfo = new ProductInfo(
            prod.MpId,
            resp,
            (runInfoResult as any).insertId,
            index + 1,
            isOwnVendor,
          );
          productInfo.addStartTime(scrapeStartTime);
          productInfo.addEndTime(new Date());
          const productInfoResult =
            await mySqlHelper.InsertProductInfo(productInfo);
          console.log(
            `SCRAPE-ONLY : ${cronSetting.CronName} : ${keyGen} : Inserted Product Info for MPID : ${prod.MpId} | VENDOR : ${productInfo.VendorId}`,
          );
          if (
            productInfoResult &&
            productInfoResult.insertId &&
            resp.priceBreaks
          ) {
            for (const pb of resp.priceBreaks) {
              const priceBreakInfo = new PriceBreakInfo(
                productInfoResult.insertId,
                pb,
              );
              await mySqlHelper.InsertPriceBreakInfo(priceBreakInfo);
            }
          }
        }
        runInfo.UpdateSuccessCount();
      }
    }
    runInfo.UpdateFailureCount(
      runInfo.EligibleCount - runInfo.ScrapedSuccessCount,
    );
    runInfo.UpdateEndTime();
    await mySqlHelper.UpdateRunInfo(
      runInfo.GetSuccessCountQuery((runInfoResult as any).insertId),
    );
    await mySqlHelper.UpdateRunInfo(
      runInfo.GetFailureCountQuery((runInfoResult as any).insertId),
    );
    await mySqlHelper.UpdateRunInfo(
      runInfo.GetRunEndTimeQuery((runInfoResult as any).insertId),
    );
  }
  console.log(
    `SCRAPE-ONLY : Successfully scraped  ${runInfo.ScrapedSuccessCount} products || total Count : ${productList.length} || Cron Name : ${cronSetting.CronName} || KeyGen : ${keyGen}`,
  );
}

const IsChunkNeeded = async (list: any[]): Promise<boolean> => {
  return list.length > 2000;
};
