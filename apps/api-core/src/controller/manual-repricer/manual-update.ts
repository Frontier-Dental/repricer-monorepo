import { Request, Response } from "express";
import * as _codes from "http-status-codes";
import _ from "lodash";
import * as axiosHelper from "../../utility/axios-helper";
import * as dbHelper from "../../utility/mongo/db-helper";
import * as repriceBase from "../../utility/reprice-algo/reprice-base";
import * as requestGenerator from "../../utility/request-generator";
import * as sqlHelper from "../../utility/mysql/mysql-helper";
import * as feedHelper from "../../utility/feed-helper";
import { Net32Product, Net32Response } from "../../types/net32";
import { getContextCronId } from "./shared";
import { proceedNext } from "./shared";
import { AxiosResponse } from "axios";
import { ProductDetailsListItem } from "../../utility/mysql/mySql-mapper";
import { applicationConfig } from "../../utility/config";
import { VendorId } from "../../utility/reprice-algo/v2/types";
import { repriceProductV2 } from "../../utility/reprice-algo/v2/v2";
import {
  getInternalProducts,
  getAllOwnVendorIds,
  getAllOwnVendorNames,
  getPriceSolutionStringRepresentation,
} from "../../utility/reprice-algo/v2/utility";
import { insertV2AlgoExecution } from "../../utility/mysql/v2-algo-execution";

export async function manualUpdate(
  req: Request<{ id: string }, any, any, { isV2Algorithm: string }>,
  res: Response,
): Promise<any> {
  const mpid = req.params.id;
  console.log(`Running Manual Reprice for ${mpid} at ${new Date()}`);
  const keyGen = "N/A";
  const isOverrideRun = false;
  let prod: ProductDetailsListItem | undefined =
    await sqlHelper.GetItemListById(mpid);

  if (!prod) {
    return res.status(_codes.StatusCodes.BAD_REQUEST).json("No product found");
  }
  const contextCronId = getContextCronId(prod);
  let productLogs = [];
  const searchRequest = applicationConfig.GET_SEARCH_RESULTS.replace(
    "{mpId}",
    mpid,
  );
  const cronSetting = _.first(
    await dbHelper.GetCronSettingsDetailsById(contextCronId),
  );
  let cronLogs = {
    time: new Date(),
    keyGen: keyGen,
    logs: [] as any[],
    cronId: contextCronId,
    type: "Manual",
  };
  const isSlowCronRun = prod.isSlowActivated;
  prod = feedHelper.SetSkipReprice([prod], false)[0];
  const contextErrorDetails = await dbHelper.GetEligibleContextErrorItems(
    true,
    mpid,
    null,
  );
  const prioritySequence = await requestGenerator.GetPrioritySequence(
    prod,
    contextErrorDetails,
    true,
  );
  const seqString = `SEQ : ${prioritySequence.map((p) => p.name).join(", ")}`;
  if (prioritySequence && prioritySequence.length > 0) {
    const cronIdForScraping =
      isSlowCronRun == true
        ? (prod as any)[prioritySequence[0].value].slowCronId
        : (prod as any)[prioritySequence[0].value].cronId;
    const net32resp: AxiosResponse<Net32Product[]> = await axiosHelper.getAsync(
      searchRequest,
      cronIdForScraping,
      seqString,
    );
    const v2AlgoResult = repriceProductV2(
      net32resp.data.map((p) => ({
        ...p,
        vendorId: parseInt(p.vendorId as string),
      })),
      getInternalProducts(prod, prioritySequence),
      getAllOwnVendorIds(),
    );
    await insertV2AlgoExecution({
      scrape_product_id: prod.productIdentifier,
      time: new Date(),
      chain_of_thought_html: Buffer.from(v2AlgoResult.html),
      comment: getPriceSolutionStringRepresentation(
        v2AlgoResult.priceSolutions,
      ),
    });
    console.log("V2 Algo Executed and Inserted");
    for (let idx = 0; idx < prioritySequence.length; idx++) {
      const proceedNextVendor = proceedNext(prod!, prioritySequence[idx].value);
      const isVendorActivated = (prod as any)[prioritySequence[idx].value]
        .activated;
      if (proceedNextVendor && isVendorActivated) {
        let repriceResponse = await repriceBase.repriceWrapper(
          net32resp,
          prod!,
          cronSetting!,
          isOverrideRun,
          keyGen,
          prioritySequence,
          idx,
          true,
        );
        //eligibleCount++;
        if (repriceResponse) {
          productLogs = repriceResponse.cronLogs;
          (prod as any)[prioritySequence[idx].value] = repriceResponse.prod;
          if (repriceResponse.skipNextVendor) {
            break;
          }
        }
      }
    }
  }

  if (productLogs.length > 0) {
    cronLogs.logs.push(productLogs);
  }
  (cronLogs as any).completionTime = new Date();
  const logInDb = await dbHelper.PushLogsAsync(cronLogs);
  if (logInDb) {
    console.log(
      `Successfully logged Cron Logs in DB at ${cronLogs.time} || Id : ${logInDb}`,
    );
  }
  return res
    .status(_codes.StatusCodes.OK)
    .json({ success: true, logId: logInDb });
}
