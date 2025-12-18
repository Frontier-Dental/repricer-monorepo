import { Request, Response } from "express";
import * as _codes from "http-status-codes";
import _ from "lodash";
import * as axiosHelper from "../../utility/axios-helper";
import * as dbHelper from "../../utility/mongo/db-helper";
import * as repriceBase from "../../utility/reprice-algo/reprice-base";
import * as requestGenerator from "../../utility/request-generator";
import * as sqlHelper from "../../utility/mysql/mysql-helper";
import * as feedHelper from "../../utility/feed-helper";
import { getContextCronId } from "./shared";
import { proceedNext } from "./shared";
import { applicationConfig } from "../../utility/config";
import { GetCronSettingsDetailsById } from "../../utility/mysql/mysql-v2";

export async function updateToMax(req: Request<{ id: string }, any, any>, res: Response): Promise<any> {
  const mpid = req.params.id;
  console.log(`Running Update To Max for ${mpid} at ${new Date()}`);
  const keyGen = "N/A";
  let prod = await sqlHelper.GetItemListById(mpid); //await dbHelper.FindProductById(mpid);
  if (!prod) {
    return res.status(_codes.StatusCodes.BAD_REQUEST).json("No product found");
  }
  const contextCronId = getContextCronId(prod);
  let productLogs = [];
  let net32resp = null;
  const searchRequest = applicationConfig.GET_SEARCH_RESULTS.replace("{mpId}", mpid);
  const cronSetting = _.first(await GetCronSettingsDetailsById(contextCronId));
  let cronLogs: any = {
    time: new Date(),
    keyGen: keyGen,
    logs: [] as any[],
    cronId: contextCronId,
    type: "Manual",
  };
  const isSlowCronRun = prod.isSlowActivated;
  prod = _.first(feedHelper.SetSkipReprice([prod], false));
  const contextErrorDetails = await dbHelper.GetEligibleContextErrorItems(true, mpid, null);
  const prioritySequence = await requestGenerator.GetPrioritySequence(prod!, contextErrorDetails, true);
  const seqString = `SEQ : ${prioritySequence.map((p) => p.name).join(", ")}`;
  if (prioritySequence && prioritySequence.length > 0) {
    const cronIdForScraping = isSlowCronRun == true ? (prod as any)[prioritySequence[0].value].slowCronId : (prod as any)[prioritySequence[0].value].cronId;
    net32resp = await axiosHelper.getAsync(searchRequest, cronIdForScraping, seqString);
    for (let idx = 0; idx < prioritySequence.length; idx++) {
      const proceedNextVendor = proceedNext(prod!, prioritySequence[idx].value);
      const isVendorActivated = (prod as any)[prioritySequence[idx].value].activated;
      if (proceedNextVendor == true && isVendorActivated == true) {
        let repriceResponse = await repriceBase.UpdateToMax(productLogs, net32resp, (prod as any)[prioritySequence[idx].value], cronSetting, keyGen, prioritySequence[idx].name);
        if (repriceResponse && repriceResponse != null) {
          productLogs = repriceResponse.cronLogs;
          (prod as any)[prioritySequence[idx].value] = repriceResponse.prod;
          if (repriceResponse.skipNextVendor == true) {
            break;
          }
        }
      }
    }
  }

  if (productLogs.length > 0) {
    cronLogs.logs.push(productLogs);
  }
  cronLogs.completionTime = new Date();
  const logInDb = await dbHelper.PushLogsAsync(cronLogs);
  if (logInDb) {
    console.log(`Successfully logged Cron Logs in DB at ${cronLogs.time} || Id : ${logInDb}`);
  }
  return res.status(_codes.StatusCodes.OK).json({ success: true, logId: logInDb });
}
