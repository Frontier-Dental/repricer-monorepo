import { Request, Response } from "express";
import ExcelJS from "exceljs";
import moment from "moment";
import badgeResx from "../resources/badgeIndicatorMapping.json" assert { type: "json" };
import handlingTimeGroupResx from "../resources/HandlingTimeFilterMapping.json" assert { type: "json" };
import * as mySqlHelper from "../services/mysql";
import _ from "lodash";
import * as SqlMapper from "../utility/mapper/mysql-mapper";

export async function streamProductDetails(req: Request, res: Response) {
  // MySQL streaming result set (your helper must return a stream!)
  const { stream, db } = await mySqlHelper.StreamCompleteProductDetailsAsync();

  // STREAMING ExcelJS workbook
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: res,
    useSharedStrings: true,
    useStyles: false,
  });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", "attachment; filename=itemExcel.xlsx");

  const worksheet = workbook.addWorksheet("ItemList", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  worksheet.columns = [
    { header: "Channel Name", key: "channelName", width: 20 },
    { header: "Active - Repricer", key: "activated", width: 20 },
    { header: "MPID", key: "mpid", width: 20 },
    { header: "Channel ID", key: "channelId", width: 20 },
    { header: "Unit Price", key: "unitPrice", width: 20 },
    { header: "Floor Price", key: "floorPrice", width: 20 },
    { header: "Max Price", key: "maxPrice", width: 20 },
    { header: "NC", key: "is_nc_needed", width: 20 },
    {
      header: "Suppress Price Break if Qty 1 not updated",
      key: "suppressPriceBreakForOne",
      width: 50,
    },
    { header: "Up/Down", key: "repricingRule", width: 20 },
    { header: "Suppress Price Break", key: "suppressPriceBreak", width: 20 },
    { header: "Compete On Price Breaks Only", key: "beatQPrice", width: 50 },
    { header: "Badge Indicator", key: "badge_indicator", width: 20 },
    { header: "Cron Name", key: "cronName", width: 20 },
    { header: "Reprice - Scrape", key: "scrapeOn", width: 20 },
    { header: "Reprice", key: "allowReprice", width: 20 },
    { header: "Net32 URl", key: "net32url", width: 20 },
    { header: "ExecutionPriority", key: "executionPriority", width: 20 },
    { header: "Data - Scrape", key: "isScrapeOnlyActivated", width: 20 },
    { header: "DataOnlyCronName", key: "scrapeOnlyCronName", width: 20 },
    { header: "Last CRON run at", key: "lastCronTime", width: 20 },
    { header: "Last run cron-type", key: "lastCronRun", width: 20 },
    { header: "Last updated at", key: "lastUpdateTime", width: 20 },
    { header: "Last updated cron-type", key: "lastUpdatedBy", width: 20 },
    { header: "Last Reprice Comment", key: "last_cron_message", width: 50 },
    { header: "Lowest Vendor Price", key: "lowest_vendor_price", width: 50 },
    { header: "Last Reprice Attempted", key: "lastAttemptedTime", width: 20 },
    { header: "Lowest Vendor", key: "lowest_vendor", width: 50 },
    { header: "Last Existing Price", key: "lastExistingPrice", width: 50 },
    { header: "Last Suggested Price", key: "lastSuggestedPrice", width: 50 },

    { header: "Reprice Up %", key: "percentageIncrease", width: 20 },
    { header: "Compare Q2 with Q1", key: "compareWithQ1", width: 20 },
    { header: "Compete With All Vendors", key: "competeAll", width: 50 },

    {
      header: "Reprice UP Badge Percentage %",
      key: "badgePercentage",
      width: 20,
    },
    { header: "Next Cron Time", key: "nextCronTime", width: 20 },
    // { header: "Product Name", key: "productName", width: 20 },
    // { header: "Cron Id", key: "cronId", width: 20 },

    // { header: "Request Interval", key: "requestInterval", width: 20 },
    // { header: "Request Interval Unit", key: "requestIntervalUnit", width: 20 },

    // { header: "Tags", key: "tags", width: 20 },
    // { header: "Priority", key: "priority", width: 20 },
    // { header: "Do not scrape within 422 duration", key: "wait_update_period", width: 20 },
    // { header: "Focus ID", key: "focusId", width: 20 },

    // { header: "Do not Deactivate Q break when pricing down", key: "abortDeactivatingQPriceBreak", width: 20 },
    // { header: "Own Vendor Id", key: "ownVendorId", width: 20 },
    { header: "Sister Vendor Id", key: "sisterVendorId", width: 20 },
    {
      header: "Include Inactive Vendors",
      key: "includeInactiveVendors",
      width: 20,
    },
    { header: "Inactive Vendor Id", key: "inactiveVendorId", width: 20 },
    { header: "Override Bulk Update", key: "override_bulk_update", width: 20 },
    {
      header: "Override Bulk Update Up/Down",
      key: "override_bulk_rule",
      width: 20,
    },
    { header: "Latest Price", key: "latest_price", width: 20 },

    { header: "Slow Cron Name", key: "slowCronName", width: 20 },
    // { header: "Slow Cron Id", key: "slowCronId", width: 20 },
    { header: "Is Slow Activated", key: "isSlowActivated", width: 20 },
    { header: "Last Updated By", key: "lastUpdatedByUser", width: 20 },
    { header: "Last Updated On", key: "lastUpdatedOn", width: 20 },
    { header: "Apply Buy Box", key: "applyBuyBoxLogic", width: 20 },
    { header: "Apply NC For Buy Box", key: "applyNcForBuyBox", width: 20 },
    { header: "IsBadgeItem", key: "isBadgeItem", width: 20 },
    { header: "Handling Time Group", key: "handling_time_filter", width: 20 },
    { header: "Keep Position", key: "keepPosition", width: 20 },
    {
      header: "Inventory Competition Threshold",
      key: "inventoryThreshold",
      width: 20,
    },
    { header: "Exclude Vendor(s)", key: "excludedVendors", width: 20 },
    { header: "Reprice Down %", key: "percentageDown", width: 20 },
    { header: "Reprice Down Badge %", key: "badgePercentageDown", width: 20 },
    { header: "Floor-Compete With Next", key: "competeWithNext", width: 20 },
    { header: "Triggered By Vendor", key: "triggeredByVendor", width: 20 },
    { header: "Ignore Phantom Q Break", key: "ignorePhantomQBreak", width: 20 },
    { header: "Own Vendor Threshold", key: "ownVendorThreshold", width: 20 },
    { header: "Result", key: "repriceResult", width: 20 },
    { header: "Get BB - Shipping", key: "getBBShipping", width: 20 },
    { header: "Get BB - Shipping Value", key: "getBBShippingValue", width: 20 },
    { header: "Get BB - Badge", key: "getBBBadge", width: 20 },
    { header: "Get BB - Badge Value", key: "getBBBadgeValue", width: 20 },
  ];

  worksheet.autoFilter = "A1:BK1";
  let isPaused = false;
  stream.on("data", async (row: any) => {
    if (isPaused) return;
    stream.pause();
    isPaused = true;
    try {
      const productDetails = await SqlMapper.MapProductDetailsList([row]);
      if (productDetails && productDetails.length > 0) {
        const AllItems: any[] = [];
        productDetails.map((val: any) => {
          if (val.tradentDetails && val.tradentDetails != null) {
            val.tradentDetails.scrapeOnlyCronName = val.scrapeOnlyCronName;
            val.tradentDetails.isScrapeOnlyActivated =
              val.isScrapeOnlyActivated;
            val.tradentDetails.isBadgeItem = val.isBadgeItem;
            AllItems.push(val.tradentDetails);
          }
          if (val.frontierDetails && val.frontierDetails != null) {
            val.frontierDetails.scrapeOnlyCronName = val.scrapeOnlyCronName;
            val.frontierDetails.isScrapeOnlyActivated =
              val.isScrapeOnlyActivated;
            val.frontierDetails.isBadgeItem = val.isBadgeItem;
            AllItems.push(val.frontierDetails);
          }
          if (val.mvpDetails && val.mvpDetails != null) {
            val.mvpDetails.scrapeOnlyCronName = val.scrapeOnlyCronName;
            val.mvpDetails.isScrapeOnlyActivated = val.isScrapeOnlyActivated;
            val.mvpDetails.isBadgeItem = val.isBadgeItem;
            AllItems.push(val.mvpDetails);
          }
          if (val.topDentDetails && val.topDentDetails != null) {
            val.topDentDetails.scrapeOnlyCronName = val.scrapeOnlyCronName;
            val.topDentDetails.isScrapeOnlyActivated =
              val.isScrapeOnlyActivated;
            val.topDentDetails.isBadgeItem = val.isBadgeItem;
            AllItems.push(val.topDentDetails);
          }
          if (val.firstDentDetails && val.firstDentDetails != null) {
            val.firstDentDetails.scrapeOnlyCronName = val.scrapeOnlyCronName;
            val.firstDentDetails.isScrapeOnlyActivated =
              val.isScrapeOnlyActivated;
            val.firstDentDetails.isBadgeItem = val.isBadgeItem;
            AllItems.push(val.firstDentDetails);
          }
          if (val.triadDetails && val.triadDetails != null) {
            val.triadDetails.scrapeOnlyCronName = val.scrapeOnlyCronName;
            val.triadDetails.isScrapeOnlyActivated = val.isScrapeOnlyActivated;
            val.triadDetails.isBadgeItem = val.isBadgeItem;
            AllItems.push(val.triadDetails);
          }
        });
        if (AllItems && AllItems.length > 0) {
          AllItems.forEach((data: any) => {
            const transformed = transformRow(data);
            if (transformed) {
              worksheet.addRow(transformed).commit();
            }
          });
        }
      }
    } catch (err) {}
    isPaused = false;
    stream.resume();
  });

  stream.on("end", async () => {
    try {
      await workbook.commit();
      res.end();
    } finally {
      if (db) db.destroy();
    }
  });

  stream.on("error", (err: any) => {
    try {
      if (db) db.release();
    } catch {}
    console.error("Streaming error:", err);
    res.status(500).send("Internal Error");
  });
}

/*********************** HELPERS *********************************/

function transformRow(item: any) {
  function fixTime(input: any) {
    try {
      return input ? moment(input).format("YYYY-MM - DD HH: mm:ss") : input;
    } catch (error) {
      console.error(`Error fixTime for input : ${input}`);
      return input;
    }
  }
  // flatten your nested tradent/frontier/mvp/etc the same way you do now
  // perform the same transformations as before
  if (!item) return null;
  return {
    ...item,

    lastCronTime: fixTime(item.last_cron_time),
    lastUpdateTime: fixTime(item.last_update_time),
    lastAttemptedTime: fixTime(item.last_attempted_time),
    nextCronTime: fixTime(item.next_cron_time),

    badge_indicator: parseBadge(item.badgeIndicator),

    mpid: item.mpid ? parseInt(item.mpid) : null,
    unitPrice: item.unitPrice ? parseFloat(item.unitPrice) : null,
    floorPrice: item.floorPrice ? parseFloat(item.floorPrice) : null,
    maxPrice: item.maxPrice ? parseFloat(item.maxPrice) : null,

    lastExistingPrice: `${item.lastExistingPrice} /`,
    lastSuggestedPrice: `${item.lastSuggestedPrice} /`,
    lowest_vendor_price: `${item.lowest_vendor_price} /`,

    handling_time_filter: item.handlingTimeFilter
      ? handlingTimeGroupResx.find((x) => x.key === item.handlingTimeFilter)
          ?.value
      : null,
  };
}
function parseBadge(key: string) {
  const match = badgeResx.find((x) =>
    _.isEqual(x.key, key?.trim()?.toUpperCase()),
  );
  return match ? match.value : badgeResx[0].value;
}
