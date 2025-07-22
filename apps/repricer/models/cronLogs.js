const moment = require("moment");
const _ = require("lodash");
function getProductLists(logList) {
  let productList = [];
  for (const log of logList) {
    if (log && log.length > 0) {
      productList.push(_.first(log).productId);
    }
  }
  return productList.join(",");
}

function getProductCount(logList) {
  return logList.length;
}

class CronLogs {
  constructor(rawLog, index) {
    this.index = index + 1;
    this.logTime = rawLog.time
      ? moment(rawLog.time).format("DD-MM-YY HH:mm:ss")
      : "-";
    this.keyRef = rawLog.keyGen ? rawLog.keyGen : "-";
    this.completionTime = rawLog.completionTime
      ? moment(rawLog.completionTime).format("DD-MM-YY HH:mm:ss")
      : "-";
    this.productIds = getProductLists(rawLog.logs);
    this.logData = rawLog;
    this.productCount = getProductCount(rawLog.logs);
    this.repricedProductCount = `N/A`;
    this.successScrapeCount = 0;
    this.failureScrapeCount = 0;
    this.totalActiveCount = rawLog.totalCount ? rawLog.totalCount : "-";
  }
}
module.exports = CronLogs;
