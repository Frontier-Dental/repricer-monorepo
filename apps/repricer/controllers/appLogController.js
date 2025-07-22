const axios = require("axios");
const { param } = require("../routes");
require("dotenv").config();
const excelJs = require("exceljs");

// export logs in excel
exports.excelExport = async (req, res) => {
  const workbook = new excelJs.Workbook();
  try {
    let url = process.env.APP_LOG_PATH;

    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const logLevel = req.query.logLevel;
    const page = parseInt(req.query.page) || 1;
    const keyWord = req.query.keyWord;
    const pageSize = parseInt(req.query.pageSize) || 50;

    const params = {
      startDate:
        startDate == undefined ? today.toISOString().slice(0, 10) : startDate,
      endDate:
        endDate == undefined ? today.toISOString().slice(0, 10) : endDate,
      logLevel: logLevel,
      page: page,
      keyWord: keyWord,
      pageSize: pageSize,
    };

    let appLogs = [];
    appLogs = await axios.get(url, { params }).catch((error) => {
      console.log(error);
    });
    appLogs = appLogs.data;
    let paginate = await paginateData(appLogs, page, pageSize);
    let logsData = paginate.data;

    const worksheet = workbook.addWorksheet("appLogs");

    worksheet.columns = [
      { header: "Level", key: "level", width: 10 },
      { header: "Date", key: "dateTime", width: 20 },
      { header: "Message", key: "message", width: 20 },
      { header: "Scrape Time", key: "timeTaken", width: 10 },
      { header: "Module", key: "module", width: 10 },
    ];
    worksheet.addRows(logsData);
  } catch (error) {
    console.log(error);
  }

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=" + "appLogs.xlsx",
  );

  return workbook.xlsx.write(res).then(function () {
    res.status(200).end();
  });
};

// archive logs
exports.clearLogs = async (req, res) => {
  try {
    const url = process.env.CLEAR_LOG_PATH;
    console.log(url);

    logsData = await axios.get(url).catch((error) => {
      console.log(error);
    });
  } catch (exception) {
    console.log("APPLOG", exception);
  }

  res.redirect("/logs");
};

// render app logs
exports.GetAppLogs = async (req, res) => {
  const today = new Date();
  let validationErrors = [];
  let url = process.env.APP_LOG_PATH;

  const startDate = req.query.startDate;
  const endDate = req.query.endDate;
  const logLevel = req.query.logLevel;
  const page = parseInt(req.query.page) || 1;
  const keyWord = req.query.keyWord;
  const pageSize = parseInt(req.query.pageSize) || 50;

  const load_data = req.query.load_data == undefined ? true : false;

  const params = {
    startDate:
      startDate == undefined ? today.toISOString().slice(0, 16) : startDate,
    endDate: endDate == undefined ? today.toISOString().slice(0, 16) : endDate,
    logLevel: logLevel == undefined ? "error" : logLevel,
    page: page,
    keyWord: keyWord,
    pageSize: pageSize,
  };

  if (!params.startDate) validationErrors.push("startDate is required");
  if (!params.endDate) validationErrors.push("endDate is required");

  let appLogs = [];
  let paginatedLogsData = [];
  let logsPagination = {};
  try {
    if (load_data != false) {
      if (validationErrors.length < 1) {
        appLogs = await axios.get(url, { params }).catch((error) => {
          console.log(error);
        });
        appLogs = appLogs.data;
      }

      let paginate = await paginateData(appLogs, page, pageSize);

      paginatedLogsData = paginate.data;
      logsPagination = {
        currentPage: paginate.currentPage,
        totalPages: paginate.totalPages,
        hasNextPage: paginate.currentPage < paginate.totalPages,
        hasPrevPage: paginate.currentPage > 1,
        nextPage: paginate.currentPage + 1,
        prevPage: paginate.currentPage - 1,
      };
    }
  } catch (exception) {
    console.log(exception);
  }

  res.render("pages/appLogs", {
    groupName: "logs",
    logs: paginatedLogsData,
    currentDate: today.toISOString().slice(0, 10),
    logsURL: url,
    params: params,
    errors: validationErrors,
    pagination: logsPagination,
    userRole: req.session.users_id.userRole,
  });
};

// paginate the data
async function paginateData(logsData, page, pageLimit) {
  let paginatedData = {};

  const pageSize = pageLimit; // Number of items per page
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  // paginatedData = logsData.slice(startIndex, endIndex);
  const totalPages = Math.ceil(logsData.length / pageSize);

  paginatedData = {
    data: logsData.slice(startIndex, endIndex),
    currentPage: page,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    nextPage: page + 1,
    prevPage: page - 1,
  };

  return paginatedData;
}
