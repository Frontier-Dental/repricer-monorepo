const asyncHandler = require("express-async-handler");
const mongoHelper = require("../middleware/mongoMiddleware");
const mapperHelper = require("../middleware/mapperHelper");
const _ = require("lodash");
const excelJs = require("exceljs");

const GetFailedRepriceDetails = asyncHandler(async (req, res) => {
  const failedResults = await getScrapedFailureReport();
  return res.json({
    status: true,
    message: failedResults,
  });
});

const ExportScrapeFailure = asyncHandler(async (req, res) => {
  const failedResults = await getScrapedFailureReport();
  const workbook = new excelJs.Workbook();
  const worksheet = workbook.addWorksheet("ItemList");
  worksheet.columns = [
    { header: "Product Id", key: "mpId", width: 20 },
    { header: "Vendor Name", key: "vendor", width: 20 },
    { header: "Cron Run Id", key: "cronRunId", width: 30 },
    { header: "Cron Run Time", key: "cronTime", width: 20 },
    { header: "Failure Reason", key: "error", width: 30 },
  ];
  worksheet.addRows(failedResults);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=" + "ScrapeFailure.xlsx",
  );
  return workbook.xlsx.write(res).then(function () {
    res.status(200).end();
  });
});

async function getScrapedFailureReport() {
  const queryToExecute = await getQuery();
  const cronLogs = await mongoHelper.GetLogsBasedOnQuery(queryToExecute);
  let failedResults = [];
  if (cronLogs) {
    failedResults = await mapperHelper.MapScrapedFailedResults(cronLogs);
  }
  return failedResults;
}

async function getQuery() {
  const error_one = process.env.ERROR_ONE;
  const error_two = process.env.ERROR_TWO;
  let finalQuery = {
    $or: [
      {
        "logs.0.logs": error_one,
      },
      {
        "logs.1.logs": error_one,
      },
      {
        "logs.2.logs": error_one,
      },
      {
        "logs.0.logs": error_two,
      },
      {
        "logs.1.logs": error_two,
      },
      {
        "logs.2.logs": error_two,
      },
    ],
  };
  //console.log(`FINAL QUERY AT ${new Date()} : ${JSON.stringify(finalQuery)}`);
  return finalQuery;
}
module.exports = { GetFailedRepriceDetails, ExportScrapeFailure };
