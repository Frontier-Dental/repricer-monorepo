import excelJs from "exceljs";
import { Request, Response } from "express";
import _ from "lodash";
import moment from "moment";
import badgeResx from "../../resources/badgeIndicatorMapping.json";
import handlingTimeGroupResx from "../../resources/HandlingTimeFilterMapping.json";
import * as httpMiddleware from "../utility/http-wrappers";
import * as mapperHelper from "../middleware/mapper-helper";
import * as mongoMiddleware from "../services/mongo";
import Item from "../models/item";
import { applicationConfig } from "../utility/config";
import * as SessionHelper from "../utility/session-helper";
import { ExcelExportService } from "../services/excel-export.service";
import { GetCronSettingsList, GetEnvValueByKey, ToggleCronStatus, GetSlowCronDetails, GetScrapeCrons } from "../services/mysql-v2";

export const getMasterItemController = async (req: Request, res: Response) => {
  let query: any = {};
  let tags = "";
  if (req.query.tags) {
    tags = req.query.tags as string;
    let val = new RegExp(tags, "i");
    let tagsArr = (req.query.tags as string).split(" ");
    let tagsArrRegExp = tagsArr.map((tag) => new RegExp(tag, "i"));
    query["$or"] = [{ mpid: val }, { productName: val }, { channelName: val }, { focusId: val }, { channelId: val }, { tags: { $all: tagsArrRegExp } }];
  }

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
  totalDocs = await Item.countDocuments(query);
  totalPages = Math.ceil(totalDocs / applicationConfig.CRON_PAGESIZE);

  let masterItems = await Item.find(query)
    .skip(pageNumber * pageSize)
    .sort({ createdAt: -1 })
    .limit(pageSize);
  const cronSettings = await GetCronSettingsList();
  masterItems.forEach((_: any) => {
    _.cronSettings = cronSettings;
    _.badge_indicator = parseBadgeIndicator(_.badgeIndicator, "KEY");
    if (_.cronId) {
      _.cronName = cronSettings.find((x: any) => x.CronId == _.cronId)?.CronName;
    }
    _.lastCronTime = _.last_cron_time ? moment(_.last_cron_time).format("DD-MM-YY HH:mm:ss") : _.last_cron_time;
    _.lastUpdateTime = _.last_update_time ? moment(_.last_update_time).format("DD-MM-YY HH:mm:ss") : _.last_update_time;
    _.lastAttemptedTime = _.last_attempted_time ? moment(_.last_attempted_time).format("DD-MM-YY HH:mm:ss") : _.last_attempted_time;
    _.nextCronTime = _.next_cron_time ? moment(_.next_cron_time).format("DD-MM-YY HH:mm:ss") : _.next_cron_time;
  });
  res.render("pages/itemmaster/list", {
    items: masterItems,
    pageNumber,
    pageSize,
    totalDocs,
    totalPages,
    tags,
    groupName: "item",
    userRole: (req as any).session.users_id.userRole,
  });
};

export const addMasterItemController = async (req: Request, res: Response) => {
  const cronSettings = await GetCronSettingsList();
  res.render("pages/itemmaster/add", {
    items: cronSettings,
    groupName: "item",
    userRole: (req as any).session.users_id.userRole,
  });
};

export async function editMasterItemController(req: Request, res: Response) {
  let id = req.params.id;
  let item: any = await Item.findById(id);
  const cronSettings = await GetCronSettingsList();
  item.cronSettings = cronSettings;
  item.badge_indicator = item.badgeIndicator;
  item.cronName = item.cronId ? cronSettings.find((x: any) => x.CronId == item.cronId)?.CronName : "";
  res.render("pages/itemmaster/edit", {
    item,
    groupName: "item",
    userRole: (req as any).session.users_id.userRole,
  });
}

export async function deleteMasterItemController(req: Request, res: Response) {
  let id = req.body.rowid;
  // const item = await Item.findByIdAndDelete(id);
  const item = await mongoMiddleware.deleteById(id);
  if (item) {
    return res.json({
      status: true,
      message: "Item Deleted successfully.",
    });
  }
}

export async function addMasterItemToDatabase(req: Request, res: Response) {
  let data: any = {};
  data.cronId = req.body.cronGroup;
  data.channelName = req.body.channel_name;
  data.productName = req.body.product_name;
  data.scrapeOn = req.body.Scrape_on_off == "on" ? true : false;
  data.allowReprice = req.body.Reprice_on_off == "on" ? true : false;
  data.requestInterval = req.body.requestInterval; //getScheduleValue(req.body.Request_every);
  data.floorPrice = req.body.floor_price;
  data.net32url = req.body.net32_url;
  data.mpid = req.body.mpid;
  data.focusId = req.body.focus_id;
  data.channelId = req.body.channel_Id;
  data.unitPrice = req.body.unit_price;
  data.maxPrice = req.body.max_price;
  data.tags = req.body.tags.split(", ");
  data.activated = req.body.activated == "on" ? true : false;
  data.is_nc_needed = req.body.is_nc_needed == "on" ? true : false;
  data.repricingRule = parseInt(req.body.reprice_rule_select);
  data.suppressPriceBreak = req.body.suppressPriceBreak == "on" ? true : false;
  data.requestIntervalUnit = req.body.request_interval_unit ? req.body.request_interval_unit : "min";
  data.priority = req.body.priority;
  data.competeAll = req.body.competeAll == "on" ? true : false;
  data.suppressPriceBreakForOne = req.body.suppressPriceBreakForOne == "on" ? true : false;
  data.beatQPrice = req.body.beatQPrice == "on" ? true : false;
  data.percentageIncrease = req.body.percentageIncrease ? parseFloat(req.body.percentageIncrease) : 0;
  data.compareWithQ1 = req.body.compareWithQ1 == "on" ? true : false;
  data.wait_update_period = req.body.wait_update_period == "on" ? true : false;
  data.badgeIndicator = req.body.badgeIndicator ? req.body.badgeIndicator : (_.first(badgeResx) as any).key;
  data.badgePercentage = req.body.badgePercentage ? parseFloat(req.body.badgePercentage) : 0;
  data.abortDeactivatingQPriceBreak = req.body.abortDeactivatingQPriceBreak == "on" ? true : false;
  data.ownVendorId = req.body.ownVendorId;
  data.sisterVendorId = req.body.sisterVendorId;
  data.inactiveVendorId = req.body.inactiveVendorId;
  data.includeInactiveVendors = req.body.includeInactiveVendors == "on" ? true : false;
  data.override_bulk_update = req.body.override_bulk_update == "on" ? true : false;
  data.override_bulk_rule = req.body.override_bulk_rule ? parseInt(req.body.override_bulk_rule) : 2;
  data.latest_price = req.body.latest_price ? parseFloat(req.body.latest_price) : 0;

  const addMasterItems = await Item.create(data);

  if (addMasterItems._id) {
    return res.json({
      status: true,
      message: "Item added successfully.",
    });
  }
}

export async function updateMasterItemController(req: Request, res: Response) {
  let data: any = {};
  data.cronId = req.body.cronGroup;
  data.channelName = req.body.channel_name;
  data.productName = req.body.product_name;
  data.scrapeOn = req.body.Scrape_on_off == "on" ? true : false;
  data.allowReprice = req.body.Reprice_on_off == "on" ? true : false;
  data.requestInterval = req.body.requestInterval; //getScheduleValue(req.body.Request_every);
  data.floorPrice = req.body.floor_price;
  data.net32url = req.body.net32_url;
  data.mpid = req.body.mpid;
  data.focusId = req.body.focus_id;
  data.channelId = req.body.channel_Id;
  data.unitPrice = req.body.unit_price;
  data.maxPrice = req.body.max_price;
  data.tags = req.body.tags.split(", ");
  data.activated = req.body.activated == "on" ? true : false;
  data.is_nc_needed = req.body.is_nc_needed == "on" ? true : false;
  data.repricingRule = parseInt(req.body.reprice_rule_select);
  data.suppressPriceBreak = req.body.suppressPriceBreak == "on" ? true : false;
  data.requestIntervalUnit = req.body.request_interval_unit ? req.body.request_interval_unit : "min";
  data.priority = req.body.priority;
  data.competeAll = req.body.competeAll == "on" ? true : false;
  data.suppressPriceBreakForOne = req.body.suppressPriceBreakForOne == "on" ? true : false;
  data.beatQPrice = req.body.beatQPrice == "on" ? true : false;
  data.percentageIncrease = req.body.percentageIncrease ? parseFloat(req.body.percentageIncrease) : 0;
  data.compareWithQ1 = req.body.compareWithQ1 == "on" ? true : false;
  data.wait_update_period = req.body.wait_update_period == "on" ? true : false;
  data.badgeIndicator = req.body.badgeIndicator ? req.body.badgeIndicator : (_.first(badgeResx) as any).key;
  data.badgePercentage = req.body.badgePercentage ? parseFloat(req.body.badgePercentage) : 0;
  data.abortDeactivatingQPriceBreak = req.body.abortDeactivatingQPriceBreak == "on" ? true : false;
  data.ownVendorId = req.body.ownVendorId;
  data.sisterVendorId = req.body.sisterVendorId;
  data.inactiveVendorId = req.body.inactiveVendorId;
  data.includeInactiveVendors = req.body.includeInactiveVendors == "on" ? true : false;
  data.override_bulk_update = req.body.override_bulk_update == "on" ? true : false;
  data.override_bulk_rule = req.body.override_bulk_rule ? parseInt(req.body.override_bulk_rule) : 2;
  data.latest_price = req.body.latest_price ? parseFloat(req.body.latest_price) : 0;
  let _id = req.body.id;

  const updateMasterItems = await Item.findByIdAndUpdate(_id, data);

  if (updateMasterItems) {
    return res.json({
      status: true,
      message: "Item updated successfully.",
    });
  }
}

export async function excelDownload(req: Request, res: Response) {
  try {
    // Check if the Excel export service is available
    const serviceAvailable = await ExcelExportService.checkServiceStatus();

    if (serviceAvailable) {
      // Use the new Excel export service
      console.log("Using Excel export microservice");
      const filters = {
        tags: req.body.tags,
        activated: req.body.activated,
        cronId: req.body.cronId,
        channelName: req.body.channelName,
      };
      await ExcelExportService.downloadExcel(filters, res);
    } else {
      // Fallback to the old implementation
      console.log("Excel export service not available, using fallback implementation");

      // Use lean() to get plain objects instead of Mongoose documents (uses less memory)
      let ItemCollection: any = await Item.find();
      const cronSettings = await GetCronSettingsList();
      ItemCollection.forEach((_: any) => {
        if (_.cronId) {
          _.cronName = cronSettings.find((x: any) => x.CronId == _.cronId)?.CronName;
        }
        if (_.tags) {
          _.tags = _.tags.join(", ");
        }
      });
      ItemCollection.forEach(($item: any) => {
        $item.lastCronTime = $item.last_cron_time ? moment($item.last_cron_time).format("LLL") : $item.last_cron_time;
        $item.lastUpdateTime = $item.last_update_time ? moment($item.last_update_time).format("LLL") : $item.last_update_time;
        $item.lastAttemptedTime = $item.last_attempted_time ? moment($item.last_attempted_time).format("LLL") : $item.last_attempted_time;
        $item.nextCronTime = $item.next_cron_time ? moment($item.next_cron_time).format("LLL") : $item.next_cron_time;
        $item.badge_indicator = parseBadgeIndicator($item.badgeIndicator, "KEY");
      });

      const workbook = new excelJs.Workbook();
      const worksheet = workbook.addWorksheet("ItemList");

      worksheet.columns = [
        { header: "Channel Name", key: "channelName", width: 20 },
        { header: "Active", key: "activated", width: 20 },
        { header: "MPID", key: "mpid", width: 20 },
        { header: "Channel ID", key: "channelId", width: 20 },
        { header: "Last CRON run at", key: "lastCronTime", width: 20 },
        { header: "Last run cron-type", key: "lastCronRun", width: 20 },
        { header: "Last updated at", key: "lastUpdateTime", width: 20 },
        { header: "Last updated cron-type", key: "lastUpdatedBy", width: 20 },
        {
          header: "Last Reprice Attempted",
          key: "lastAttemptedTime",
          width: 20,
        },
        { header: "Last Reprice Comment", key: "last_cron_message", width: 50 },
        { header: "Lowest Vendor", key: "lowest_vendor", width: 50 },
        {
          header: "Lowest Vendor Price",
          key: "lowest_vendor_price",
          width: 50,
        },
        { header: "Last Existing Price", key: "lastExistingPrice", width: 50 },
        {
          header: "Last Suggested Price",
          key: "lastSuggestedPrice",
          width: 50,
        },
        { header: "Unit Price", key: "unitPrice", width: 20 },
        { header: "Floor Price", key: "floorPrice", width: 20 },
        { header: "NC", key: "is_nc_needed", width: 20 },
        { header: "Up/Down", key: "repricingRule", width: 20 },
        {
          header: "Suppress Price Break",
          key: "suppressPriceBreak",
          width: 20,
        },
        {
          header: "Suppress Price Break if Qty 1 not updated",
          key: "suppressPriceBreakForOne",
          width: 50,
        },
        {
          header: "Compete On Price Breaks Only",
          key: "beatQPrice",
          width: 50,
        },
        { header: "Reprice Up %", key: "percentageIncrease", width: 20 },
        { header: "Compare Q2 with Q1", key: "compareWithQ1", width: 20 },
        { header: "Compete With All Vendors", key: "competeAll", width: 50 },
        { header: "Badge Indicator", key: "badge_indicator", width: 20 },
        {
          header: "Reprice UP Badge Percentage %",
          key: "badgePercentage",
          width: 20,
        },
        { header: "Next Cron Time", key: "nextCronTime", width: 20 },
        { header: "Product Name", key: "productName", width: 20 },
        { header: "Cron Id", key: "cronId", width: 20 },
        { header: "Cron Name", key: "cronName", width: 20 },
        { header: "Request Interval", key: "requestInterval", width: 20 },
        {
          header: "Request Interval Unit",
          key: "requestIntervalUnit",
          width: 20,
        },
        { header: "Reprice - Scrape", key: "scrapeOn", width: 20 },
        { header: "Reprice", key: "allowReprice", width: 20 },
        { header: "Tags", key: "tags", width: 20 },
        { header: "Priority", key: "priority", width: 20 },
        {
          header: "Do not scrape within 422 duration",
          key: "wait_update_period",
          width: 20,
        },
        { header: "Max Price", key: "maxPrice", width: 20 },
        { header: "Focus ID", key: "focusId", width: 20 },
        { header: "Net32 URl", key: "net32url", width: 20 },
        {
          header: "Do not Deactivate Q break when pricing down",
          key: "abortDeactivatingQPriceBreak",
          width: 20,
        },
        { header: "Own Vendor Id", key: "ownVendorId", width: 20 },
        { header: "Sister Vendor Id", key: "sisterVendorId", width: 20 },
        {
          header: "Include Inactive Vendors",
          key: "includeInactiveVendors",
          width: 20,
        },
        { header: "Inactive Vendor Id", key: "inactiveVendorId", width: 20 },
        {
          header: "Override Bulk Update",
          key: "override_bulk_update",
          width: 20,
        },
        {
          header: "Override Bulk Update Up/Down",
          key: "override_bulk_rule",
          width: 20,
        },
        { header: "Latest Price", key: "latest_price", width: 20 },
      ];
      worksheet.addRows(ItemCollection);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=" + "itemExcel.xlsx");

      return workbook.xlsx.write(res).then(function () {
        res.status(200).end();
      });
    }
  } catch (error) {
    console.error("Error in excelDownload:", error);
    res.status(500).json({
      error: "Failed to generate Excel file",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function runAllCron(req: Request, res: Response) {
  const cronSettings = await GetCronSettingsList();
  if (cronSettings && cronSettings.length > 0) {
    for (const cron of cronSettings) {
      if (cron.IsHidden && cron.IsHidden == true) {
        // do nothing
      } else {
        await ToggleCronStatus(cron.CronId, true as any, req);
      }
    }
  }
  const runAllCronResponse = await httpMiddleware.runCron();
  if (runAllCronResponse && runAllCronResponse.status == 200) {
    return res.json({
      status: true,
      message: runAllCronResponse.data,
    });
  } else {
    return res.json({
      status: false,
      message: `Something went wrong. Please try again.`,
    });
  }
}

export async function runManualCron(req: Request, res: Response) {
  const selectedProducts = Array.isArray(req.body.mpIds) ? req.body.mpIds : [req.body.mpIds];
  if (selectedProducts && selectedProducts.length > 0) {
    let cronLogs = { time: new Date(), logs: [], type: "Manual" };
    for (const prod of selectedProducts) {
      const query = { mpid: prod };
      const itemDetails = await Item.find(query);
      const source = await GetEnvValueByKey("SOURCE"); //await mongoMiddleware.GetEnvValueByKey("SOURCE");
      const repriceResult = await httpMiddleware.runManualCron(prod, _.first(itemDetails), source);
      let prodUpdateRequest: any = {};
      prodUpdateRequest.prod = _.first(itemDetails);
      prodUpdateRequest.resultant = repriceResult ? repriceResult.data : null;
      prodUpdateRequest.cronTime = new Date().toString();
      const updateRes = await httpMiddleware.updateProductManual(prod, prodUpdateRequest);
      if (repriceResult) {
        const priceUpdatedFlag = repriceResult.data.priceUpdateResponse && JSON.stringify(repriceResult.data.priceUpdateResponse).indexOf("ERROR:422") == -1 ? true : false;
        cronLogs.logs.push({
          productId: prod,
          logs: repriceResult.data.cronResponse,
          priceUpdated: priceUpdatedFlag,
          priceUpdatedOn: new Date(),
          priceUpdateResponse: repriceResult.data.priceUpdateResponse,
        } as never);
      }
    }
    const mongoResult = await mongoMiddleware.PushManualCronLogAsync(cronLogs);
    if (mongoResult && mongoResult.insertedId) {
      console.log("Manual Log with _id " + mongoResult.insertedId.toString() + ", added successfully");
    }
    res.render("pages/cron/cronView", {
      response: "Manual repricing done",
      groupName: "item",
      userRole: (req as any).session.users_id.userRole,
    });
  }
}

export async function resetCron(req: Request, res: Response) {
  const sysDate = new Date();
  const addMasterItems = await Item.updateMany({}, { $set: { last_cron_time: sysDate } });
  if (addMasterItems) {
    res.render("pages/cron/cronView", {
      response: `Last cron time reset to present time - ${sysDate}`,
      groupName: "item",
      userRole: (req as any).session.users_id.userRole,
    });
  }
}

export async function deleteAll(req: Request, res: Response) {
  await Item.deleteMany({});
  return res.json({
    status: true,
    message: "Items deleted successfully.",
  });
}

export async function addExcelData(req: Request, res: Response) {
  let input = req.body;
  const sessionInfo = await SessionHelper.GetAuditInfo(req);
  const cronSettings = await GetCronSettingsList();
  const slowCrons = await GetSlowCronDetails();
  const combinedArray = cronSettings.concat(slowCrons);
  const scrapeOnlyCrons = await GetScrapeCrons();
  const slowCronIds = _.map(slowCrons, "CronId");
  let items: any[] = [];
  for (let k = 0; k < parseInt(input.count); k++) {
    //let key = `data[${k}][]`;
    var row = input.data[k];
    if (applicationConfig.USE_MYSQL) {
      let $item: any = {
        channelName: row[0],
        activated: row[1] != null ? JSON.parse(row[1]) : true,
        mpid: row[2],
        channelId: row[3],
        unitPrice: row[4] ? parseFloat(row[4]) : 0,
        floorPrice: row[5] ? parseFloat(row[5]) : 0,
        maxPrice: row[6] ? parseFloat(row[6]) : 9999999,
        is_nc_needed: row[7] ? JSON.parse(row[7]) : false,
        suppressPriceBreakForOne: row[8] != null ? JSON.parse(row[8]) : false,
        repricingRule: row[9] ? parseInt(row[9]) : 2,
        suppressPriceBreak: row[10] != null && row[10] != "" ? JSON.parse(row[10]) : false,
        beatQPrice: row[11] != null && row[11] != "" ? JSON.parse(row[11]) : false,
        badgeIndicator: row[12] ? parseBadgeIndicator(row[12].trim(), "VALUE") : (_.first(badgeResx) as any).key,
        cronName: row[13],
        cronId: row[13] ? combinedArray.find((x: any) => x.CronName == row[13].trim())?.CronId : "",
        scrapeOn: row[14] != null && row[14] != "" ? JSON.parse(row[14]) : true,
        allowReprice: row[15] != null && row[15] != "" ? JSON.parse(row[15]) : true,
        net32url: row[16],
        executionPriority: row[17] ? parseInt(row[17]) : null,
        isScrapeOnlyActivated: row[18] != null && row[18] != "" ? JSON.parse(row[18]) : false,
        scrapeOnlyCronName: row[19],
        scrapeOnlyCronId: row[19] ? scrapeOnlyCrons.find((x: any) => x.CronName == row[19].trim()).CronId : "",
        /***** Arranged Columns as Above *****/
        lastCronTime: row[20] && row[4] != "" ? row[20] : null,
        lastCronRun: row[21],
        lastUpdateTime: row[22] && row[22] != "" ? row[22] : null,
        lastUpdatedBy: row[23],
        last_cron_message: row[24],
        lowest_vendor_price: row[25],
        lastAttemptedTime: row[26] && row[26] != "" ? row[26] : null,
        lowest_vendor: row[27],
        lastExistingPrice: row[28],
        lastSuggestedPrice: row[29],
        percentageIncrease: row[30] ? parseFloat(row[30]) : 0,
        compareWithQ1: row[31] != null && row[31] != "" ? JSON.parse(row[31]) : false,
        competeAll: row[32] != null && row[32] != "" ? JSON.parse(row[32]) : false,
        badgePercentage: row[33] ? parseFloat(row[33]) : 0,
        nextCronTime: row[34] && row[34] != "" ? row[34] : null,
        productName: null,
        requestInterval: 1,
        requestIntervalUnit: "min",
        tags: [],
        priority: 5,
        wait_update_period: true,
        focusId: null,
        abortDeactivatingQPriceBreak: true,
        ownVendorId: null,
        sisterVendorId: row[35],
        includeInactiveVendors: row[36] != null && row[36] != "" ? JSON.parse(row[36]) : false,
        inactiveVendorId: row[37],
        override_bulk_update: row[38] != null && row[38] != "" ? JSON.parse(row[38]) : true,
        override_bulk_rule: row[39] ? parseInt(row[39]) : 2,
        latest_price: row[40] ? parseFloat(row[40]) : 0,
        slowCronName: row[41] ? row[41].trim() : null,
        slowCronId: row[41] ? slowCrons.find((x: any) => x.CronName == row[41].trim()).CronId : "", //Get Data
        isSlowActivated: row[42] != null && row[42] != "" ? JSON.parse(row[42]) : false,
        lastUpdatedByUser: sessionInfo.UpdatedBy,
        lastUpdatedOn: sessionInfo.UpdatedOn,
        applyBuyBoxLogic: row[45] != null && row[45] != "" ? JSON.parse(row[45]) : false,
        applyNcForBuyBox: row[46] != null && row[46] != "" ? JSON.parse(row[46]) : false,
        isBadgeItem: row[47] != null && row[47] != "" ? JSON.parse(row[47]) : false,
        handlingTimeFilter: row[48] ? handlingTimeGroupResx.find((x: any) => x.value == row[48].trim())!.key : "ALL",
        inventoryThreshold: row[50] ? parseInt(row[50]) : 0,
        excludedVendors: row[51],
        percentageDown: row[52] != null ? parseFloat(row[52]) : 0,
        badgePercentageDown: row[53] != null ? parseFloat(row[53]) : 0,
        competeWithNext: row[54] != null && row[54] != "" ? JSON.parse(row[54]) : false,
        ignorePhantomQBreak: row[56] != null && row[56] != "" ? JSON.parse(row[56]) : true,
        ownVendorThreshold: row[57] != null && row[57] != "" ? parseInt(row[57]) : 1,
        getBBShipping: row[59] != null && row[59] != "" ? JSON.parse(row[59]) : false,
        getBBShippingValue: row[60] != null && row[60] != "" ? parseFloat(row[60]) : 0,
        getBBBadge: row[61] != null && row[61] != "" ? JSON.parse(row[61]) : false,
        getBBBadgeValue: row[62] != null && row[62] != "" ? parseFloat(row[62]) : 0,
        qBreakCount: row[63] ? parseInt(row[63]) : null,
        qBreakDetails: row[64] ? row[64] : null,
      };
      items.push($item as never);
    } else {
      let $item: any = {
        channelName: row[0],
        activated: row[1] ? JSON.parse(row[1]) : true,
        mpid: row[2],
        channelId: row[3],
        unitPrice: row[10] ? parseFloat(row[10]) : null,
        floorPrice: row[11] ? parseFloat(row[11]) : 0,
        maxPrice: row[12] ? parseFloat(row[12]) : null,
        is_nc_needed: row[13] ? JSON.parse(row[13]) : false,
        suppressPriceBreakForOne: row[14] ? JSON.parse(row[14]) : false,
        repricingRule: row[19] ? parseInt(row[19]) : 2,
        suppressPriceBreak: row[20] ? JSON.parse(row[20]) : false,
        beatQPrice: row[21] ? JSON.parse(row[21]) : false,
        percentageIncrease: row[22] ? parseFloat(row[22]) : 0,
        compareWithQ1: row[23] ? JSON.parse(row[23]) : false,
        competeAll: row[24] ? JSON.parse(row[24]) : false,
        badgeIndicator: row[25] ? parseBadgeIndicator(row[25].trim(), "VALUE") : (_.first(badgeResx) as any).key,
        badgePercentage: row[26] ? parseFloat(row[26]) : 0,
        productName: row[28] ? row[28] : "",
        cronId: row[30] ? combinedArray.find((x: any) => x.CronName == row[30].trim())?.CronId : "",
        cronName: row[30],
        requestInterval: row[31] ? parseInt(row[31]) : 1,
        requestIntervalUnit: row[32] ? row[32] : "min",
        scrapeOn: row[33] ? JSON.parse(row[33]) : true,
        allowReprice: row[34] ? JSON.parse(row[34]) : true,
        tags: row[35] ? row[35].split(", ") : [],
        priority: row[36] ? parseInt(row[36]) : 5,
        wait_update_period: row[37] ? JSON.parse(row[37]) : true,
        focusId: row[38],
        net32url: row[39],
        abortDeactivatingQPriceBreak: row[40] ? JSON.parse(row[40]) : true,
        ownVendorId: row[41],
        sisterVendorId: row[42],
        includeInactiveVendors: row[43] ? JSON.parse(row[43]) : false,
        inactiveVendorId: row[44],
        override_bulk_update: row[45] ? JSON.parse(row[45]) : true,
        override_bulk_rule: row[46] ? row[46] : 2,
        latest_price: row[47] ? parseFloat(row[47]) : 0,
        executionPriority: row[48] ? parseInt(row[48]) : null,
        applyBuyBoxLogic: row[54] ? JSON.parse(row[54]) : false,
        applyNcForBuyBox: row[55] ? JSON.parse(row[55]) : false,
        //slowCronId: row[50].trim(),
        //slowCronName: row[49].trim()
      };
      items.push($item as never);
    }
  }
  //items = await mapperHelper.AlignCronName(items);
  let uniqueProductIds: any[] = await GetUniqueProductIds(items);
  for (const pId of uniqueProductIds) {
    let itemData: any = {};
    itemData.mpId = pId;
    itemData.tradentDetails = items.find((x: any) => x.channelName.toUpperCase() == "TRADENT" && x.mpid == pId);
    if (itemData.tradentDetails && itemData.tradentDetails.executionPriority == null) {
      itemData.tradentDetails.executionPriority = 1;
    }
    itemData.frontierDetails = items.find((x: any) => x.channelName.toUpperCase() == "FRONTIER" && x.mpid == pId);
    if (itemData.frontierDetails && itemData.frontierDetails.executionPriority == null) {
      itemData.frontierDetails.executionPriority = 2;
    }
    itemData.mvpDetails = items.find((x: any) => x.channelName.toUpperCase() == "MVP" && x.mpid == pId);
    if (itemData.mvpDetails && itemData.mvpDetails.executionPriority == null) {
      itemData.mvpDetails.executionPriority = 3;
    }
    itemData.topDentDetails = items.find((x: any) => x.channelName.toUpperCase() == "TOPDENT" && x.mpid == pId);
    if (itemData.topDentDetails && itemData.topDentDetails.executionPriority == null) {
      itemData.topDentDetails.executionPriority = 4;
    }
    itemData.firstDentDetails = items.find((x: any) => x.channelName.toUpperCase() == "FIRSTDENT" && x.mpid == pId);
    if (itemData.firstDentDetails && itemData.firstDentDetails.executionPriority == null) {
      itemData.firstDentDetails.executionPriority = 5;
    }
    itemData.triadDetails = items.find((x: any) => x.channelName && x.channelName.toUpperCase() == "TRIAD" && x.mpid == pId);
    if (itemData.triadDetails && itemData.triadDetails.executionPriority == null) {
      itemData.triadDetails.executionPriority = 6;
    }

    itemData.biteSupplyDetails = items.find((x: any) => x.channelName && x.channelName.toUpperCase() == "BITESUPPLY" && x.mpid == pId);

    if (itemData.biteSupplyDetails && itemData.biteSupplyDetails.executionPriority == null) {
      itemData.biteSupplyDetails.executionPriority = 7;
    }
    //Align Cron Details
    await mapperHelper.AlignProducts(itemData, combinedArray, slowCronIds);
    if (applicationConfig.USE_MYSQL) {
      await mapperHelper.UpsertProductDetailsInSql(itemData, pId, req);
    } else {
      await mongoMiddleware.InsertOrUpdateProductWithCronName(itemData, req);
    }
    console.log(`Updated product info for MPID : ${pId}`);
  }
  return res.json({
    status: true,
    message: `Item Chart added successfully. Count : ${input.count}`,
  });
}

async function GetUniqueProductIds(collatedList: any[]) {
  let unique_values = collatedList.map((item) => item.mpid).filter((value, index, current_value) => current_value.indexOf(value) === index);
  return _.filter(unique_values, (str) => str !== "" && str != null);
}

export async function stopAllCron(req: Request, res: Response) {
  const cronSettings = await GetCronSettingsList();
  if (cronSettings && cronSettings.length > 0) {
    for (const cron of cronSettings) {
      if (cron.IsHidden) {
        // do nothing
      } else {
        await ToggleCronStatus(cron.CronId, false as any, req);
      }
    }
  }
  var cronStopResponse: any = await httpMiddleware.stopAllCron();
  if (cronStopResponse && cronStopResponse.status == 200) {
    return res.json({
      status: true,
      message: cronStopResponse.data,
    });
  } else {
    return res.json({
      status: false,
      message: `Something went wrong. Please try again.`,
    });
  }
}

async function getProductList(dict: any) {
  let resultProducts: any = [];
  const keys = Object.keys(dict);
  if (keys) {
    for (const key of keys) {
      resultProducts.push(dict[key] as never);
    }
  }
  return resultProducts;
}

async function createDummyCronLog(item: any, updatedResponse: any) {
  let result: any = {};
  result.scrapedOn = new Date().toString();
  result.mpId = item.mpid;
  result.repriceData = {};
  result.repriceData.net32id = item.mpid;
  result.repriceData.productName = item.productName;
  result.repriceData.vendorProductId = item.channelId;
  result.repriceData.vendorId = item.channelId;
  result.repriceData.repriceDetails = {};
  result.repriceData.repriceDetails.oldPrice = "N/A";
  result.repriceData.repriceDetails.newPrice = item.maxPrice;
  result.repriceData.repriceDetails.explained = updatedResponse && updatedResponse.message ? updatedResponse.message : "Price Updated to MAX.";
  return result;
}

async function getSecretKey(_cronId: string) {
  const cronDetails = await GetCronSettingsList();
  const contextCron = cronDetails.find((x: any) => x.CronId == _cronId);
  return contextCron ? contextCron.SecretKey : null;
}

async function getPriceUpdatedField(updatedResponse: any) {
  return updatedResponse && updatedResponse.message && updatedResponse.message.toUpperCase() == "UPDATE SUCCESSFUL";
}

function parseBadgeIndicator(stringValue: any, evalType: any) {
  if (_.isEqual(evalType, "KEY")) {
    const $eval = badgeResx.find((x: any) => _.isEqual(x.key, stringValue.trim().toUpperCase()));
    return $eval ? $eval.value.trim() : _.first(badgeResx)!.value.trim();
  } else if (_.isEqual(evalType, "VALUE")) {
    const $eval = badgeResx.find((x: any) => _.isEqual(x.value.toUpperCase(), stringValue.trim().toUpperCase()));
    return $eval ? $eval.key : _.first(badgeResx)!.key;
  }
}

export async function start_override(req: Request, res: Response) {
  await httpMiddleware.StartOverride();
  res.render("pages/cron/cronView", {
    response: `Override Run Started at ${new Date()}`,
    groupName: "item",
    userRole: (req as any).session.users_id.userRole,
  });
}

export async function getAllActiveProducts(req: Request, res: Response) {
  const itemDetails = await Item.find({ activated: true });
  if (itemDetails && itemDetails.length > 0) {
    const activeProductList = _.map(itemDetails, "mpid");
    return res.json({
      productList: activeProductList,
    });
  }
}
