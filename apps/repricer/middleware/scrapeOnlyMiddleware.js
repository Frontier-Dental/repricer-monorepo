const _ = require("lodash");
const sqlMiddleware = require("../middleware/mySQLMiddleware");
const mapperHelper = require("../middleware/mapperHelper");

module.exports.GetRunInfo = async (noOfRecords, startDate, endDate) => {
  let logResult = [];
  try {
    const sqlRunInfoResult = await sqlMiddleware.GetLatestRunInfo(
      parseInt(noOfRecords),
      startDate,
      endDate,
    );
    if (sqlRunInfoResult && sqlRunInfoResult.length > 0) {
      const sqlRunDetails = _.first(sqlRunInfoResult);
      for (const [index, runInfo] of sqlRunDetails.entries()) {
        logResult.push(await mapperHelper.MapSqlToCronLog(runInfo, index + 1));
      }
    }
  } catch (exception) {
    console.log(`Exception in GetRunInfo : ${exception}`);
  }
  return logResult;
};

module.exports.GetRunInfoByCron = async (
  noOfRecords,
  startDate,
  endDate,
  cronId,
) => {
  let logResult = [];
  try {
    const sqlRunInfoResult = await sqlMiddleware.GetLatestRunInfoForCron(
      parseInt(noOfRecords),
      startDate,
      endDate,
      cronId,
    );
    if (sqlRunInfoResult && sqlRunInfoResult.length > 0) {
      const sqlRunDetails = _.first(sqlRunInfoResult);
      for (const [index, runInfo] of sqlRunDetails.entries()) {
        logResult.push(await mapperHelper.MapSqlToCronLog(runInfo, index + 1));
      }
    }
  } catch (exception) {
    console.log(`Exception in GetRunInfo : ${exception}`);
  }
  return logResult;
};
