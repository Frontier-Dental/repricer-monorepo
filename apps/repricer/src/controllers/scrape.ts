import excelJs from "exceljs";
import { Request, Response } from "express";
import _ from "lodash";
import moment from "moment";
import * as httpMiddleware from "../utility/http-wrappers";
import * as MapperHelper from "../middleware/mapper-helper";
import * as mongoMiddleware from "../services/mongo";
import * as sqlMiddleware from "../services/mysql";
import cronSettings from "../models/cron-settings";
import cronMapping from "../../resources/cronMapping.json";
import * as SessionHelper from "../utility/session-helper";
import { applicationConfig } from "../utility/config";

export const GetScrapeCron = async (req: Request, res: Response) => {
  let scrapeCronDetails = await mongoMiddleware.GetScrapeCrons();
  let configItems = await mongoMiddleware.GetConfigurations(true);
  for (let item of scrapeCronDetails) {
    item.lastUpdatedBy = await SessionHelper.GetAuditValue(item, "U_NAME");
    item.lastUpdatedOn = await SessionHelper.GetAuditValue(item, "U_TIME");
    item.ProxyProvider_1 = await MapperHelper.GetAlternateProxyProviderId(
      item,
      1,
    );
    item.ProxyProvider_2 = await MapperHelper.GetAlternateProxyProviderId(
      item,
      2,
    );
    item.ProxyProvider_3 = await MapperHelper.GetAlternateProxyProviderId(
      item,
      3,
    );
    item.ProxyProvider_4 = await MapperHelper.GetAlternateProxyProviderId(
      item,
      4,
    );
    item.ProxyProvider_5 = await MapperHelper.GetAlternateProxyProviderId(
      item,
      5,
    );
    item.ProxyProvider_6 = null; //await MapperHelper.GetAlternateProxyProviderId(item, 6);
  }
  res.render("pages/scrape/scrapeOnlyList", {
    configItems: configItems,
    scrapeCronData: scrapeCronDetails,
    groupName: "scraping",
    userRole: (req as any).session.users_id.userRole,
  });
};

export const ToggleCronStatus = async (req: Request, res: Response) => {
  const cronId = req.body.id;
  const cronStatus = parseInt(req.body.status);
  const jobName = cronMapping.find((x) => x.cronId == cronId)?.cronVariable;

  const response = await httpMiddleware.toggleScrapeCron({
    jobName: jobName,
    status: cronStatus,
  });
  if (response && response.status == 200) {
    await mongoMiddleware.UpdateScrapeCronDetails(cronId, {
      $set: {
        status: cronStatus == 1 ? "true" : "false",
        AuditInfo: await SessionHelper.GetAuditInfo(req),
      },
    });
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

export const UpdateScrapeCronExp = async (req: Request, res: Response) => {
  const requestedPayload = req.body;
  const updatedList: any[] = [];
  const listOfUpdatedCronKey: any[] = [];
  let scrapeCronDetails = await mongoMiddleware.GetScrapeCrons();
  const normalizedRequestPayload = await normalizePayload(requestedPayload);

  for (const en in normalizedRequestPayload.cron_id_hdn) {
    var offset = scrapeCronDetails[en].Offset
      ? scrapeCronDetails[en].Offset
      : 0;
    const proxyProvider = normalizedRequestPayload.scr_proxy_provider[en]
      ? normalizedRequestPayload.scr_proxy_provider[en]
      : scrapeCronDetails[en].ProxyProvider;
    const altProxyProviderDetails =
      await MapperHelper.MapAlternateProxyProviderDetails(
        en,
        normalizedRequestPayload,
      );

    const scrapeSettingPayload = new cronSettings(
      normalizedRequestPayload.cron_id_hdn[en],
      normalizedRequestPayload.scr_cron_name[en],
      normalizedRequestPayload.scr_cron_time_unit[en],
      normalizedRequestPayload.scr_cron_time[en],
      null as any,
      scrapeCronDetails[en].status,
      normalizedRequestPayload.scr_offset[en],
      proxyProvider,
      null as any,
      null as any,
      altProxyProviderDetails,
    );
    if (
      !_.isEqual(
        scrapeSettingPayload.CronName,
        scrapeCronDetails[en].CronName,
      ) ||
      !_.isEqual(
        scrapeSettingPayload.CronTime,
        scrapeCronDetails[en].CronTime,
      ) ||
      !_.isEqual(
        scrapeSettingPayload.CronTimeUnit,
        scrapeCronDetails[en].CronTimeUnit,
      ) ||
      !_.isEqual(scrapeSettingPayload.Offset, offset) ||
      !_.isEqual(
        scrapeSettingPayload.ProxyProvider,
        scrapeCronDetails[en].ProxyProvider,
      ) ||
      !_.isEqual(
        altProxyProviderDetails,
        scrapeCronDetails[en].AlternateProxyProvider,
      )
    ) {
      updatedList.push(scrapeSettingPayload as never);
      listOfUpdatedCronKey.push(
        cronMapping.find((c: any) => c.cronId == scrapeSettingPayload.CronId)
          ?.cronVariable as never,
      );
    }
  }

  if (updatedList.length > 0) {
    const updateResponse = await mongoMiddleware.updateScrapeCron(
      updatedList,
      req,
    );

    if (updateResponse) {
      if (listOfUpdatedCronKey.length > 0) {
        for (const jobName of listOfUpdatedCronKey) {
          await httpMiddleware.recreateScrapeCron({ jobName: jobName });
        }
      }
      return res.json({
        status: true,
        message: "Scrape Cron updated successfully.",
      });
    } else {
      return res.json({
        status: false,
        message: "Something went wrong ,Please try again.",
      });
    }
  } else {
    return res.json({
      status: true,
      message: "No Changes found to update.",
    });
  }
};

export const GetLatestPriceInfo = async (req: Request, res: Response) => {
  const focusId = req.params.identifier;
  const productFetchQuery = {
    $or: [
      {
        "tradentDetails.focusId": focusId,
      },
      {
        "frontierDetails.focusId": focusId,
      },
      {
        "mvpDetails.focusId": focusId,
      },
    ],
  };
  const productDetails =
    await mongoMiddleware.GetProductListByQuery(productFetchQuery);
  if (productDetails && productDetails.length > 0) {
    const contextProduct = _.first(productDetails);
    const mpId = (contextProduct as any).mpId;
    const sqlScrapeDetails = await sqlMiddleware.GetLastScrapeDetailsById(mpId);
    const apiResponse = await MapperHelper.MapLatestPriceInfo(
      sqlScrapeDetails,
      focusId,
    );
    if (apiResponse) {
      return res.status(200).json({
        status: true,
        priceInfo: apiResponse,
        error: null,
      });
    } else
      return res.status(206).json({
        status: false,
        priceInfo: null,
        error: `No Latest Scrape Data found for Focus Id : ${focusId} || Mpid : ${mpId}`,
      });
  }
  return res.status(502).json({
    status: false,
    priceInfo: null,
    error: `Product with FocusId : ${focusId} not found.`,
  });
};

// ----------- Products Section ----------------------------

export const GetScrapeProducts = async (req: Request, res: Response) => {
  let scrapeCronDetails = await mongoMiddleware.GetScrapeCrons();
  let pgNo = 0;
  let incomingFilter: any = null;
  let tags = "";
  if (req.query.tags) {
    incomingFilter = `${req.query.tags as string}`;
    // incomingFilter = `%${req.query.tags}%`;
    tags = req.query.tags as string;
  }
  if (req.query.pgno) {
    pgNo = req.query.pgno as any;
  }

  let pageSize = 0,
    pageNumber = 0,
    totalDocs = 0,
    totalPages = 0;
  pageSize = applicationConfig.CRON_PAGESIZE;
  pageNumber = pgNo || 1;

  let scrapeProductsDetails: any[] = [];

  if (incomingFilter != null && tags != "") {
    scrapeProductsDetails = await sqlMiddleware.GetScrapeProductListByFilter(
      incomingFilter,
      pageSize,
      pageNumber,
    );
  } else {
    scrapeProductsDetails = await sqlMiddleware.GetScrapeProductList(
      pageNumber,
      pageSize,
    );
  }

  totalDocs = await sqlMiddleware.GetNumberOfScrapeProducts();
  totalPages = Math.ceil(totalDocs / pageSize);

  //console.log("totalPages",totalPages)

  //console.log("math",Math.max(1, pageNumber - 2), Math.min(totalPages, pageNumber + 2))

  res.render("pages/scrapeProducts/scrapeOnlyProducts", {
    itemsScrape: scrapeCronDetails,
    items: scrapeProductsDetails,
    pageNumber,
    pageSize,
    tags,
    totalDocs,
    totalPages,
    groupName: "ScrapeProducts",
    userRole: (req as any).session.users_id.userRole,
  });
};

export const exportItems = async (req: Request, res: Response) => {
  let scrapeCollection = await sqlMiddleware.GetAllScrapeProductDetails();

  const workbook = new excelJs.Workbook();
  let worksheet = workbook.addWorksheet("ScrapeList", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  worksheet.autoFilter = "A1:H1";
  worksheet.columns = [
    { header: "Active", key: "Is_Active", width: 20 },
    { header: "MPID", key: "MpId", width: 20 },
    { header: "Net32 Url", key: "Net32Url", width: 20 },
    { header: "Linked Cron Name", key: "LinkedCronName", width: 20 },
    { header: "Linked Cron Id", key: "LinkedCronId", width: 20 },
    { header: "Last updated at", key: "LastUpdatedAt", width: 20 },
    { header: "Last updated by", key: "LastUpdatedBy", width: 20 },
    { header: "Last Scraped At", key: "LastScrapedDate", width: 20 },
    { header: "Is Badge Item", key: "Is_Badge", width: 20 },
  ];
  worksheet.addRows(scrapeCollection);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=" + "scrapeExcel.xlsx",
  );

  return workbook.xlsx.write(res).then(function () {
    res.status(200).end();
  });
};

export const importItems = async (req: Request, res: Response) => {
  let input = req.body;
  const auditInfo = await SessionHelper.GetAuditInfo(req);
  const scrapeCron = await mongoMiddleware.GetScrapeCrons();

  let items: any[] = [];
  for (let k = 0; k < parseInt(input.count) - 1; k++) {
    var row = input.data[k];
    let $item = {
      isActive: row[0] ? JSON.parse(row[0]) : true,
      mpId: parseInt(row[1]),
      net32Url: row[2] ? row[2] : "N/A",
      linkedCron: row[3].trim(),
      linkedCronId: row[3]
        ? scrapeCron.find((x: any) => x.CronName == row[3].trim()).CronId
        : "",
      lastUpdatedBy: auditInfo.UpdatedBy,
      lastUpdatedOn: moment(auditInfo.UpdatedOn).format("YYYY-MM-DD HH:mm:ss"),
      isBadgeItem: row[8] ? JSON.parse(row[8]) : false,
    };
    items.push($item as never);
  }
  for (const item of items as any) {
    if ((item as any).mpId != "") {
      console.log(`EXCEL-IMPORT : Inserting ${(item as any).mpId} to mySQL`);
      await sqlMiddleware.UpsertProductDetails(item);
    }
  }
  return res.json({
    status: true,
    message: `Item Chart added successfully. Count : ${input.count}`,
  });
};

export const addItems = async (req: Request, res: Response) => {
  let scrapeData: any = {};
  const auditInfo = await SessionHelper.GetAuditInfo(req);
  scrapeData.net32Url = req.body.net32_url;
  scrapeData.mpId = parseInt(req.body.mpid);
  scrapeData.isActive = req.body.activated == "on" ? true : false;
  scrapeData.linkedCron = req.body.cronName;
  scrapeData.linkedCronId = req.body.scrape_cron;
  scrapeData.lastUpdatedBy = auditInfo.UpdatedBy;
  scrapeData.isBadgeItem = req.body.is_badge_item == "on" ? true : false;
  scrapeData.lastUpdatedOn = moment(auditInfo.UpdatedOn).format(
    "YYYY-MM-DD HH:mm:ss",
  );

  let addScrapeResp = await sqlMiddleware.UpsertProductDetails(scrapeData);
  if (addScrapeResp) {
    return res.json({
      status: true,
      message: "Item added successfully.",
    });
  }
};

export const editItems = async (req: Request, res: Response) => {
  let scrapeData: any = {};
  const auditInfo = await SessionHelper.GetAuditInfo(req);
  scrapeData.net32Url = req.body.net32_url;
  scrapeData.mpId = parseInt(req.body.mpId);
  scrapeData.isActive = req.body.activated == "on" ? true : false;
  scrapeData.linkedCron = req.body.cronName;
  scrapeData.isBadgeItem = req.body.is_badge_item == "on" ? true : false;
  scrapeData.linkedCronId = req.body.scrape_cron;
  scrapeData.lastUpdatedBy = auditInfo.UpdatedBy;
  scrapeData.lastUpdatedOn = moment(auditInfo.UpdatedOn).format(
    "YYYY-MM-DD HH:mm:ss",
  );
  let editScrapeResp = await sqlMiddleware.UpsertProductDetails(scrapeData);
  if (editScrapeResp) {
    return res.json({
      status: true,
      message: "Item edited successfully.",
    });
  }
};

export const deleteItem = async (req: Request, res: Response) => {
  let id = parseInt(req.body.id);
  const item = await sqlMiddleware.DeleteScrapeProductById(parseInt(id as any));
  if (item) {
    return res.json({
      status: true,
      message: "Item Deleted successfully.",
    });
  }
};

async function normalizePayload(requestedPayload: any) {
  const normalizeToArray = (item: any) => (Array.isArray(item) ? item : [item]);
  requestedPayload.cron_id_hdn = normalizeToArray(requestedPayload.cron_id_hdn);
  requestedPayload.scr_cron_name = normalizeToArray(
    requestedPayload.scr_cron_name,
  );
  requestedPayload.scr_cron_time_unit = normalizeToArray(
    requestedPayload.scr_cron_time_unit,
  );
  requestedPayload.scr_cron_time = normalizeToArray(
    requestedPayload.scr_cron_time,
  );
  requestedPayload.scr_offset = normalizeToArray(requestedPayload.scr_offset);
  requestedPayload.scr_proxy_provider = normalizeToArray(
    requestedPayload.scr_proxy_provider,
  );
  requestedPayload.proxy_provider_1 = normalizeToArray(
    requestedPayload.proxy_provider_1,
  );
  requestedPayload.proxy_provider_2 = normalizeToArray(
    requestedPayload.proxy_provider_2,
  );
  requestedPayload.proxy_provider_3 = normalizeToArray(
    requestedPayload.proxy_provider_3,
  );
  requestedPayload.proxy_provider_4 = normalizeToArray(
    requestedPayload.proxy_provider_4,
  );
  return requestedPayload;
}
