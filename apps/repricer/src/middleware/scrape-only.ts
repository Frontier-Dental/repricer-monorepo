import _ from "lodash";
import * as sqlMiddleware from "../services/mysql";
import * as mapperHelper from "./mapper-helper";

export async function GetRunInfo(
  noOfRecords: any,
  startDate: any,
  endDate: any,
) {
  let logResult: any[] = [];
  const sqlRunInfoResult = await sqlMiddleware.GetLatestRunInfo(
    parseInt(noOfRecords),
    startDate,
    endDate,
  );
  if (sqlRunInfoResult && sqlRunInfoResult.length > 0) {
    const sqlRunDetails: any = _.first(sqlRunInfoResult);
    for (const [index, runInfo] of sqlRunDetails.entries()) {
      logResult.push(
        (await mapperHelper.MapSqlToCronLog(runInfo, index + 1)) as never,
      );
    }
  }
  return logResult;
}

export async function GetRecentInProgressScrapeRuns() {
  let logResult: any[] = [];
  const sqlRunInfoResult =
    await sqlMiddleware.GetRecentInProgressScrapeOnlyRuns();
  if (sqlRunInfoResult && sqlRunInfoResult.length > 0) {
    const sqlRunDetails: any = _.first(sqlRunInfoResult);
    for (const [index, runInfo] of sqlRunDetails.entries()) {
      logResult.push(
        (await mapperHelper.MapSqlToCronLog(runInfo, index + 1)) as never,
      );
    }
  }
  return logResult;
}

export async function GetRunInfoByCron(
  noOfRecords: any,
  startDate: any,
  endDate: any,
  cronId: any,
) {
  let logResult: any[] = [];
  const sqlRunInfoResult = await sqlMiddleware.GetLatestRunInfoForCron(
    parseInt(noOfRecords),
    startDate,
    endDate,
    cronId,
  );
  if (sqlRunInfoResult && sqlRunInfoResult.length > 0) {
    const sqlRunDetails = _.first(sqlRunInfoResult) as any;
    for (const [index, runInfo] of sqlRunDetails.entries()) {
      logResult.push(
        (await mapperHelper.MapSqlToCronLog(runInfo, index + 1)) as never,
      );
    }
  }
  return logResult;
}
