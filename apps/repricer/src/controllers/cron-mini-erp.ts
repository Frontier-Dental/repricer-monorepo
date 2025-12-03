import _ from "lodash";
import { Request, Response } from "express";
import cronMapping from "../../resources/cronMapping.json";
import * as httpMiddleware from "../utility/http-wrappers";
import {
  GetMiniErpCronDetails,
  ToggleCronStatus,
  UpdateCronSettingsList,
} from "../services/mysql-v2";
import cacheClient, { GetCacheClientOptions } from "../client/cacheClient";
import { applicationConfig } from "../utility/config";
import { CacheKey } from "@repricer-monorepo/shared";
import cronSettings from "../models/cron-settings";

export const toggleCronStatus = async (req: Request, res: Response) => {
  const cronId = req.body.id;
  const cronStatus = parseInt(req.body.status);
  const jobName = cronMapping.find((x) => x.cronId == cronId)?.cronVariable;
  const action = cronStatus == 1 ? "true" : "false";

  await ToggleCronStatus(cronId, action, req);

  const response = await httpMiddleware.toggleMiniErpCron({
    jobName: jobName,
    status: cronStatus,
  });
  if (response && response.status == 200) {
    return res.json({
      status: true,
      message: response.data,
    });
  } else {
    return res.json({
      status: false,
      message: `Sorry some error occurred!! Please try again...`,
    });
  }
};

export const RecreateCron = async (req: Request, res: Response) => {
  const jobName = req.body.jobName;
  const response = await httpMiddleware.recreateMiniErpCron({
    jobName: jobName,
  });
  if (response && response.status == 200) {
    return res.json({
      status: true,
      message: response.data,
    });
  } else {
    return res.json({
      status: false,
      message: `Sorry some error occurred!! Please try again...`,
    });
  }
};

export async function UpdateMiniErpCronExpression(req: Request, res: Response) {
  console.log("UpdateMiniErpCronExpression", req.body);
  const payload = req.body;
  const miniErpCronResponse = await GetMiniErpCronDetails();
  if (!miniErpCronResponse || miniErpCronResponse.length === 0) {
    return res.json({
      status: false,
      message: "No Mini ERP cron details found.",
    });
  }
  const miniErpCronIds = _.map(miniErpCronResponse, "CronId");
  let updatedList: any[] = [];
  let recreatePayload: any[] = [];
  for (const [index, cId] of miniErpCronIds.entries()) {
    const cronName = payload[`me_cron_name_${cId}`]
      ? payload[`me_cron_name_${cId}`]
      : miniErpCronResponse[index].CronName;
    const cronTimeUnit = payload[`me_cron_time_unit_${cId}`]
      ? payload[`me_cron_time_unit_${cId}`]
      : miniErpCronResponse[index].CronTimeUnit;
    const cronTime = payload[`me_cron_time_${cId}`]
      ? payload[`me_cron_time_${cId}`]
      : miniErpCronResponse[index].CronTime;
    const offset = payload[`me_offset_${cId}`]
      ? payload[`me_offset_${cId}`]
      : miniErpCronResponse[index].Offset;

    const cronSettingPayload: any = new cronSettings(
      cId,
      cronName,
      cronTimeUnit,
      cronTime,
      null as any,
      miniErpCronResponse[index].CronStatus,
      offset,
      miniErpCronResponse[index].IpType,
      miniErpCronResponse[index].FixedIp,
      miniErpCronResponse[index].AlternateProxyProvider || [],
    );

    if (
      !_.isEqual(
        cronSettingPayload.CronName,
        miniErpCronResponse[index].CronName,
      ) ||
      !_.isEqual(
        cronSettingPayload.CronTime,
        miniErpCronResponse[index].CronTime,
      ) ||
      !_.isEqual(
        cronSettingPayload.CronTimeUnit,
        miniErpCronResponse[index].CronTimeUnit,
      ) ||
      !_.isEqual(cronSettingPayload.Offset, miniErpCronResponse[index].Offset)
    ) {
      updatedList.push(cronSettingPayload as unknown as never);
    }
    if (
      !_.isEqual(
        cronSettingPayload.CronTime,
        miniErpCronResponse[index].CronTime,
      ) ||
      !_.isEqual(
        cronSettingPayload.CronTimeUnit,
        miniErpCronResponse[index].CronTimeUnit,
      ) ||
      !_.isEqual(cronSettingPayload.Offset, miniErpCronResponse[index].Offset)
    ) {
      recreatePayload.push(cronSettingPayload.CronId as unknown as never);
    }
  }

  if (updatedList.length > 0) {
    await UpdateCronSettingsList(updatedList, req);
    if (recreatePayload.length > 0) {
      for (const cronId of recreatePayload) {
        const jobName = cronMapping.find(
          (x) => x.cronId == cronId,
        )?.cronVariable;
        await httpMiddleware.recreateMiniErpCron({ jobName: jobName });
      }
    }
    await cacheClient
      .getInstance(GetCacheClientOptions(applicationConfig))
      .delete(CacheKey.MINI_ERP_CRON_DETAILS);
    return res.json({
      status: true,
      message: "Mini ERP Cron updated successfully.",
    });
  } else {
    return res.json({
      status: true,
      message: "No Changes found to update.",
    });
  }
}
