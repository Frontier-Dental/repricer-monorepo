import ExcelJS from "exceljs";
import moment from "moment";
import Item, { IItem } from "../models/item";
import { GetCronSettingsList } from "./mysql";
import { parseBadgeIndicator } from "../utils/badge-helper";

export interface ExcelColumn {
  header: string;
  key: string;
  width: number;
}

export class ExcelService {
  private static formatItemData(items: any[], cronSettings: any[]) {
    return items.map((item: any) => {
      const formattedItem = { ...item };

      if (item.cronId && cronSettings) {
        formattedItem.cronName = cronSettings.find(
          (x: any) => x.CronId === item.cronId,
        )?.CronName;
      }

      if (item.tags && Array.isArray(item.tags)) {
        formattedItem.tags = item.tags.join(", ");
      }

      formattedItem.lastCronTime = item.last_cron_time
        ? moment(item.last_cron_time).format("LLL")
        : item.last_cron_time;

      formattedItem.lastUpdateTime = item.last_update_time
        ? moment(item.last_update_time).format("LLL")
        : item.last_update_time;

      formattedItem.lastAttemptedTime = item.last_attempted_time
        ? moment(item.last_attempted_time).format("LLL")
        : item.last_attempted_time;

      formattedItem.nextCronTime = item.next_cron_time
        ? moment(item.next_cron_time).format("LLL")
        : item.next_cron_time;

      formattedItem.badge_indicator = parseBadgeIndicator(
        item.badgeIndicator,
        "KEY",
      );

      return formattedItem;
    });
  }

  private static getExcelColumns(): ExcelColumn[] {
    return [
      { header: "Channel Name", key: "channelName", width: 20 },
      { header: "Active", key: "activated", width: 20 },
      { header: "MPID", key: "mpid", width: 20 },
      { header: "Channel ID", key: "channelId", width: 20 },
      { header: "Last CRON run at", key: "lastCronTime", width: 20 },
      { header: "Last run cron-type", key: "lastCronRun", width: 20 },
      { header: "Last updated at", key: "lastUpdateTime", width: 20 },
      { header: "Last updated cron-type", key: "lastUpdatedBy", width: 20 },
      { header: "Last Reprice Attempted", key: "lastAttemptedTime", width: 20 },
      { header: "Last Reprice Comment", key: "last_cron_message", width: 50 },
      { header: "Lowest Vendor", key: "lowest_vendor", width: 50 },
      { header: "Lowest Vendor Price", key: "lowest_vendor_price", width: 50 },
      { header: "Last Existing Price", key: "lastExistingPrice", width: 50 },
      { header: "Last Suggested Price", key: "lastSuggestedPrice", width: 50 },
      { header: "Unit Price", key: "unitPrice", width: 20 },
      { header: "Floor Price", key: "floorPrice", width: 20 },
      { header: "NC", key: "is_nc_needed", width: 20 },
      { header: "Up/Down", key: "repricingRule", width: 20 },
      { header: "Suppress Price Break", key: "suppressPriceBreak", width: 20 },
      {
        header: "Suppress Price Break if Qty 1 not updated",
        key: "suppressPriceBreakForOne",
        width: 50,
      },
      { header: "Compete On Price Breaks Only", key: "beatQPrice", width: 50 },
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
  }

  public static async generateItemsExcel(
    query: any = {},
  ): Promise<ExcelJS.Workbook> {
    const items = await Item.find(query).lean();
    const cronSettings = await GetCronSettingsList();

    const formattedItems = this.formatItemData(items, cronSettings);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("ItemList");

    worksheet.columns = this.getExcelColumns();
    worksheet.addRows(formattedItems);

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    return workbook;
  }

  public static async generateFilteredExcel(filters: {
    tags?: string;
    activated?: boolean;
    cronId?: string;
    channelName?: string;
  }): Promise<ExcelJS.Workbook> {
    let query: any = {};

    if (filters.tags) {
      const tagsArr = filters.tags.split(" ");
      const tagsArrRegExp = tagsArr.map((tag) => new RegExp(tag, "i"));
      query.tags = { $all: tagsArrRegExp };
    }

    if (filters.activated !== undefined) {
      query.activated = filters.activated;
    }

    if (filters.cronId) {
      query.cronId = filters.cronId;
    }

    if (filters.channelName) {
      query.channelName = new RegExp(filters.channelName, "i");
    }

    return this.generateItemsExcel(query);
  }
}
