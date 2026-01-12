import { AxiosResponse } from "axios";
import { Request, Response } from "express";
import * as _codes from "http-status-codes";
import _ from "lodash";
import { Net32Product } from "../../types/net32";
import * as axiosHelper from "../../utility/axios-helper";
import { applicationConfig } from "../../utility/config";
import * as feedHelper from "../../utility/feed-helper";
import * as mongoHelper from "../../utility/mongo/db-helper";
import * as sqlHelper from "../../utility/mysql/mysql-helper";
import { ProductDetailsListItem } from "../../utility/mysql/mySql-mapper";
import * as repriceBase from "../../utility/reprice-algo/reprice-base";
import { repriceProductV2Wrapper } from "../../utility/reprice-algo/v2/wrapper";
import * as requestGenerator from "../../utility/request-generator";
import { getContextCronId, proceedNext } from "./shared";
import { v4 } from "uuid";
import { AlgoExecutionMode } from "@repricer-monorepo/shared";
import { GetCronSettingsDetailsById } from "../../utility/mysql/mysql-v2";

export async function manualRepriceHandler(req: Request<{ id: string }, any, any, any>, res: Response): Promise<any> {
  const mpid = req.params.id;
  console.log(`Running Manual Reprice for ${mpid} at ${new Date()}`);
  const jobId = v4();
  const isOverrideRun = false;
  let prod: ProductDetailsListItem | undefined = await sqlHelper.GetItemListById(mpid);

  if (!prod) {
    return res.status(_codes.StatusCodes.BAD_REQUEST).json("No product found");
  }
  const contextCronId = getContextCronId(prod);
  let productLogs = [];
  const searchRequest = applicationConfig.GET_SEARCH_RESULTS.replace("{mpId}", mpid);
  const cronSetting = await GetCronSettingsDetailsById(contextCronId);
  let cronLogs = {
    time: new Date(),
    keyGen: jobId,
    logs: [] as any[],
    cronId: contextCronId,
    type: "Manual",
  };
  const isSlowCronRun = prod.isSlowActivated;
  prod = feedHelper.SetSkipReprice([prod], false)[0];
  const contextErrorDetails = await mongoHelper.GetEligibleContextErrorItems(true, mpid, null);
  const prioritySequence = await requestGenerator.GetPrioritySequence(prod, contextErrorDetails, true);
  const seqString = `SEQ : ${prioritySequence.map((p) => p.name).join(", ")}`;
  if (prioritySequence && prioritySequence.length > 0) {
    const cronIdForScraping = isSlowCronRun == true ? (prod as any)[prioritySequence[0].value].slowCronId : (prod as any)[prioritySequence[0].value].cronId;
    const net32resp: AxiosResponse<Net32Product[]> = await axiosHelper.getAsync(searchRequest, cronIdForScraping, mpid, seqString);
    if (prod.algo_execution_mode === AlgoExecutionMode.V2_ONLY || prod.algo_execution_mode === AlgoExecutionMode.V2_EXECUTE_V1_DRY || prod.algo_execution_mode === AlgoExecutionMode.V1_EXECUTE_V2_DRY) {
      await repriceProductV2Wrapper(net32resp.data, prod, "MANUAL", isSlowCronRun, contextCronId);
    }

    if (prod.algo_execution_mode === AlgoExecutionMode.V1_ONLY || prod.algo_execution_mode === AlgoExecutionMode.V1_EXECUTE_V2_DRY || prod.algo_execution_mode === AlgoExecutionMode.V2_EXECUTE_V1_DRY) {
      for (let idx = 0; idx < prioritySequence.length; idx++) {
        const proceedNextVendor = proceedNext(prod!, prioritySequence[idx].value);
        const isVendorActivated = (prod as any)[prioritySequence[idx].value].activated;
        if (proceedNextVendor && isVendorActivated) {
          let repriceResponse = await repriceBase.repriceWrapper(net32resp, prod!, cronSetting!, isOverrideRun, jobId, prioritySequence, idx, true, isSlowCronRun);
          //eligibleCount++;
          if (repriceResponse) {
            cronLogs.logs.push(repriceResponse.cronLogs);
            (prod as any)[prioritySequence[idx].value] = repriceResponse.prod;
            if (repriceResponse.skipNextVendor) {
              break;
            }
          }
        }
      }
    }
  }
  (cronLogs as any).completionTime = new Date();
  const logInDb = await mongoHelper.PushLogsAsync(cronLogs);
  if (logInDb) {
    console.log(`Successfully logged Cron Logs in DB at ${cronLogs.time} || Id : ${logInDb}`);
  }
  return res.status(_codes.StatusCodes.OK).json({ success: true, logId: logInDb });
}
