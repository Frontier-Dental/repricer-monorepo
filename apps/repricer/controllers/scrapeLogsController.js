const _ = require("lodash");
const asyncHandler = require("express-async-handler");
const mongoMiddleware = require("../middleware/mongoMiddleware");

const showLogHistory = asyncHandler(async (req, res) => {
  let pgNo = 0;
  if (req.query.hasOwnProperty("pgno")) {
    pgNo = req.query.pgno - 1;
  }
  let pageSize = 0,
    pageNumber = 0,
    totalDocs = 0,
    totalPages = 0;
  pageSize = parseInt(process.env.CRON_PAGESIZE);
  pageNumber = pgNo || 0;
  totalDocs = await mongoMiddleware.GetScrapeLogsCount();
  totalPages = Math.ceil(totalDocs / pageSize);
  let scrapeLogsDetails = await mongoMiddleware.GetScrapeLogs(
    pageNumber,
    pageSize,
  );

  res.render("pages/scrapeHistory/scrapeLogsHistory", {
    items: scrapeLogsDetails,
    pageNumber,
    pageSize,
    totalDocs,
    totalPages,
    groupName: "ScrapeLogs",
    userRole: req.session.users_id.userRole,
  });
});

const logsHistoryList = asyncHandler(async (req, res) => {
  const id = req.params.id;
  let pgNo = 0;
  if (req.query.hasOwnProperty("pgno")) {
    pgNo = req.query.pgno - 1;
  }
  let pageSize = 0,
    pageNumber = 0,
    totalDocs = 0,
    totalPages = 0;
  pageSize = parseInt(process.env.CRON_PAGESIZE);
  pageNumber = pgNo || 0;
  let scrapeLogsDetails = await mongoMiddleware.GetScrapeLogsList(id);
  totalDocs = _.first(scrapeLogsDetails).scrapeData.length;
  totalPages = Math.ceil(totalDocs / pageSize);
  _.first(scrapeLogsDetails).scrapeData.forEach((item) => {
    item.vendors = [];
    item.logs.forEach((items, i) => {
      item.vendors.push(items.vendorName);
      items = JSON.stringify(items);
    });
  });

  res.render("pages/scrapeHistory/historyList", {
    items: _.first(scrapeLogsDetails).scrapeData,
    pageNumber,
    pageSize,
    totalDocs,
    totalPages,
    groupName: "ScrapeLogs",
    id: id,
    userRole: req.session.users_id.userRole,
  });
});

module.exports = { showLogHistory, logsHistoryList };
