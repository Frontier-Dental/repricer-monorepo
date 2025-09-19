import { Request, Response } from "express";
import * as _codes from "http-status-codes";
import { ErrorItemModel } from "../../model/error-item";
import * as filterMapper from "../../utility/filter-mapper";
import * as mongoHelper from "../../utility/mongo/mongo-helper";

import { applicationConfig } from "../../utility/config";
import {
  calculateNextCronTime,
  getNextCronTime,
  updateCronBasedDetails,
  updateLowestVendor,
} from "./shared";

export async function updateProductManualHandler(
  req: Request,
  res: Response,
): Promise<any> {
  let { prod, resultant, cronTime } = req.body;
  prod.last_cron_time = new Date(cronTime);
  let isPriceUpdated = false;
  if (resultant) {
    if (
      resultant.priceUpdateResponse &&
      resultant.priceUpdateResponse != null
    ) {
      if (
        JSON.stringify(resultant.priceUpdateResponse).indexOf("ERROR:422") ==
          -1 &&
        JSON.stringify(resultant.priceUpdateResponse).indexOf("ERROR:429") ==
          -1 &&
        JSON.stringify(resultant.priceUpdateResponse).indexOf("ERROR:404") ==
          -1 &&
        JSON.stringify(resultant.priceUpdateResponse).indexOf("ERROR:") == -1
      ) {
        prod.last_update_time = new Date(cronTime);
        isPriceUpdated = true;
        prod.lastUpdatedBy = `MANUAL-CRON`;
        prod.next_cron_time = calculateNextCronTime(new Date(cronTime), 12);
        const priceUpdatedItem = new ErrorItemModel(
          prod.mpid,
          prod.next_cron_time,
          true,
          prod.cronId,
          "PRICE_UPDATE",
          undefined,
        );
        await mongoHelper.UpsertErrorItemLog(priceUpdatedItem);
        console.log({
          message: `${prod.mpid} moved to ${applicationConfig.CRON_NAME_422}`,
          obj: JSON.stringify(priceUpdatedItem),
        });
      } else {
        prod.next_cron_time = getNextCronTime(resultant.priceUpdateResponse);
      }
    }
    let tempData: any = {};
    tempData.data = resultant;

    prod.lastCronRun = `MANUAL-CRON`;
    prod.last_attempted_time = new Date(cronTime);
    prod = updateLowestVendor(tempData, prod);
    prod = await updateCronBasedDetails(tempData, prod, isPriceUpdated);
    prod.last_cron_message = await filterMapper.GetLastCronMessage(
      tempData,
      prod.mpid,
      "UNKNOWN",
    );
  }
  await mongoHelper.UpdateProductAsync(prod, isPriceUpdated);
  return res.status(_codes.StatusCodes.OK).send("Success!");
}
