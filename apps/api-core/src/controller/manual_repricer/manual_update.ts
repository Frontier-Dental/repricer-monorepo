import { Request, Response } from "express";
import * as _codes from "http-status-codes";
import _ from "lodash";
import * as axiosHelper from "../../utility/axiosHelper";
import * as dbHelper from "../../utility/mongo/dbHelper";
import * as repriceBase from "../../utility/repriceBase";
import * as requestGenerator from "../../utility/requestGenerator";
import * as sqlHelper from "../../utility/mySqlHelper";
import * as feedHelper from "../../utility/feedHelper";
import { Net32Product, Net32Response } from "../../types/net32";
import { getContextCronId } from "./shared";
import { proceedNext } from "./shared";
import { AxiosResponse } from "axios";
import { ProductDetailsListItem } from "../../utility/mySqlMapper";

export async function manualUpdate(
  req: Request<{ id: string }, any, any, { isV2Algorithm: string }>,
  res: Response,
): Promise<any> {
  const mpid = req.params.id;
  const isV2Algorithm = req.query.isV2Algorithm === "true" ? true : false;
  console.log(
    `Running Manual Reprice for ${mpid} at ${new Date()}. Using new algorithm: ${isV2Algorithm}`,
  );
  const keyGen = "N/A";
  const isOverrideRun = false;
  let prod: ProductDetailsListItem | undefined =
    await sqlHelper.GetItemListById(mpid);

  if (!prod) {
    return res.status(_codes.StatusCodes.BAD_REQUEST).json("No product found");
  }
  const contextCronId = getContextCronId(prod);
  let productLogs = [];
  const searchRequest = process.env.GET_SEARCH_RESULTS!.replace("{mpId}", mpid);
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
          isV2Algorithm,
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
