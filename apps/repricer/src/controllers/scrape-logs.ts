import { Request, Response } from "express";
import _ from "lodash";
import * as mongoMiddleware from "../services/mongo";
import { applicationConfig } from "../utility/config";

export async function showLogHistory(req: Request, res: Response) {
  let pgNo = 0;
  if (req.query.pgno) {
    pgNo = (req.query.pgno as any) - 1;
  }
  let pageSize = 0,
    pageNumber = 0,
    totalDocs = 0,
    totalPages = 0;
  pageSize = applicationConfig.CRON_PAGESIZE;
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
    userRole: (req as any).session.users_id.userRole,
  });
}

export async function logsHistoryList(req: Request, res: Response) {
  const id = req.params.id;
  let pgNo = 0;
  if (req.query.pgno) {
    pgNo = (req.query.pgno as any) - 1;
  }
  let pageSize = 0,
    pageNumber = 0,
    totalDocs = 0,
    totalPages = 0;
  pageSize = applicationConfig.CRON_PAGESIZE;
  pageNumber = pgNo || 0;
  let scrapeLogsDetails = await mongoMiddleware.GetScrapeLogsList(id);
  totalDocs = (_.first(scrapeLogsDetails) as any).scrapeData.length;
  totalPages = Math.ceil(totalDocs / pageSize);
  (_.first(scrapeLogsDetails) as any).scrapeData.forEach((item: any) => {
    item.vendors = [];
    item.logs.forEach((items: any) => {
      item.vendors.push(items.vendorName);
      items = JSON.stringify(items);
    });
  });

  res.render("pages/scrapeHistory/historyList", {
    items: (_.first(scrapeLogsDetails) as any).scrapeData,
    pageNumber,
    pageSize,
    totalDocs,
    totalPages,
    groupName: "ScrapeLogs",
    id: id,
    userRole: (req as any).session.users_id.userRole,
  });
}
