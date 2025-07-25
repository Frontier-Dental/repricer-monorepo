import moment from "moment";
import _ from "lodash";

function getProductLists(logList: any) {
  let productList: any[] = [];
  for (const log of logList) {
    if (log && log.length > 0) {
      productList.push((_.first(log) as any)?.productId);
    }
  }
  return productList.join(",");
}

function getProductCount(logList: any) {
  return logList.length;
}

export default class CronLogs {
  index: number;
  logTime: string;
  keyRef: string;
  completionTime: string;
  productIds: string;
  logData: any;
  productCount: number;
  repricedProductCount: string;
  successScrapeCount: number;
  failureScrapeCount: number;
  totalActiveCount: string;
  constructor(rawLog: any, index: number) {
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
