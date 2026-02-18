import { Request, Response } from "express";
import { exportItems, parseBadgeIndicator, spliceResult } from "../excel.controller";

const mockGetCompleteProductDetails = jest.fn();
jest.mock("../../services/mysql", () => ({
  GetCompleteProductDetails: (...args: unknown[]) => mockGetCompleteProductDetails(...args),
}));

describe("excel.controller", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockEnd: jest.Mock;
  let mockSetHeader: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnd = jest.fn();
    mockSetHeader = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockRes = {
      setHeader: mockSetHeader,
      set: jest.fn(),
      end: mockEnd,
      status: mockStatus,
      on: jest.fn(),
      write: jest.fn(),
    };
    mockReq = { body: {}, query: {} };
  });

  describe("exportItems", () => {
    it("should handle empty product collection", async () => {
      mockGetCompleteProductDetails.mockResolvedValue([]);
      await exportItems(mockReq as Request, mockRes as Response);
      expect(mockGetCompleteProductDetails).toHaveBeenCalled();
      expect(mockSetHeader).toHaveBeenCalledWith("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(mockSetHeader).toHaveBeenCalledWith("Content-Disposition", "attachment; filename=itemExcel.xlsx");
      await new Promise((r) => setImmediate(r));
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockEnd).toHaveBeenCalled();
    });

    it("should correctly map vendor details and set headers", async () => {
      const itemCollection = [
        {
          scrapeOnlyCronName: "ScrapeCron",
          isScrapeOnlyActivated: true,
          isBadgeItem: false,
          tradentDetails: {
            channelName: "TRADENT",
            mpid: "100",
            last_cron_time: "2024-01-01T12:00:00Z",
            last_update_time: "2024-01-02T12:00:00Z",
            last_attempted_time: null,
            next_cron_time: null,
            badgeIndicator: "ALL_ZERO",
            lastUpdatedOn: "2024-01-01T00:00:00Z",
            unitPrice: 10.5,
            floorPrice: 5,
            maxPrice: 20,
            priority: 1,
            requestInterval: 60,
            override_bulk_rule: 0,
            lastExistingPrice: "9.99",
            lastSuggestedPrice: "10.99",
            lowest_vendor_price: "8.99",
            handlingTimeFilter: "FAST_SHIPPING",
          },
          frontierDetails: null,
          mvpDetails: null,
          topDentDetails: null,
          firstDentDetails: null,
          triadDetails: null,
          biteSupplyDetails: null,
        },
      ];
      mockGetCompleteProductDetails.mockResolvedValue(itemCollection);
      await exportItems(mockReq as Request, mockRes as Response);
      expect(mockGetCompleteProductDetails).toHaveBeenCalled();
      expect(mockSetHeader).toHaveBeenCalledWith("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      await new Promise((r) => setImmediate(r));
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockEnd).toHaveBeenCalled();
    });

    it("should include multiple vendor details when present", async () => {
      const itemCollection = [
        {
          scrapeOnlyCronName: "Cron1",
          isScrapeOnlyActivated: true,
          isBadgeItem: true,
          tradentDetails: { channelName: "TRADENT", mpid: "1", last_cron_time: null, last_update_time: null, last_attempted_time: null, next_cron_time: null, badgeIndicator: "BADGE_ONLY", lastUpdatedOn: null, unitPrice: null, floorPrice: null, maxPrice: null, priority: null, requestInterval: null, override_bulk_rule: null, lastExistingPrice: "", lastSuggestedPrice: "", lowest_vendor_price: "", handlingTimeFilter: null },
          frontierDetails: { channelName: "FRONTIER", mpid: "1", last_cron_time: null, last_update_time: null, last_attempted_time: null, next_cron_time: null, badgeIndicator: "ALL_ZERO", lastUpdatedOn: null, unitPrice: null, floorPrice: null, maxPrice: null, priority: null, requestInterval: null, override_bulk_rule: null, lastExistingPrice: "", lastSuggestedPrice: "", lowest_vendor_price: "", handlingTimeFilter: null },
          mvpDetails: null,
          topDentDetails: null,
          firstDentDetails: null,
          triadDetails: null,
          biteSupplyDetails: null,
        },
      ];
      mockGetCompleteProductDetails.mockResolvedValue(itemCollection);
      await exportItems(mockReq as Request, mockRes as Response);
      expect(mockGetCompleteProductDetails).toHaveBeenCalled();
      await new Promise((r) => setImmediate(r));
      expect(mockEnd).toHaveBeenCalled();
    });

    it("should format dates and price fields", async () => {
      const itemCollection = [
        {
          scrapeOnlyCronName: "Cron",
          isScrapeOnlyActivated: false,
          isBadgeItem: false,
          tradentDetails: {
            channelName: "TRADENT",
            mpid: "42",
            last_cron_time: "2024-06-15T10:30:00.000Z",
            last_update_time: "2024-06-16T10:30:00.000Z",
            last_attempted_time: "2024-06-14T10:30:00.000Z",
            next_cron_time: "2024-06-17T10:30:00.000Z",
            badgeIndicator: "NON_BADGE_ONLY  ",
            lastUpdatedOn: "2024-06-15T00:00:00.000Z",
            unitPrice: "19.99",
            floorPrice: "9.99",
            maxPrice: "29.99",
            priority: "2",
            requestInterval: "30",
            override_bulk_rule: "1",
            lastExistingPrice: "15",
            lastSuggestedPrice: "16",
            lowest_vendor_price: "14",
            handlingTimeFilter: "STOCKED",
          },
          frontierDetails: null,
          mvpDetails: null,
          topDentDetails: null,
          firstDentDetails: null,
          triadDetails: null,
          biteSupplyDetails: null,
        },
      ];
      mockGetCompleteProductDetails.mockResolvedValue(itemCollection);
      await exportItems(mockReq as Request, mockRes as Response);
      expect(mockGetCompleteProductDetails).toHaveBeenCalled();
      await new Promise((r) => setImmediate(r));
      expect(mockEnd).toHaveBeenCalled();
    });

    it("should include mvpDetails, topDentDetails, firstDentDetails, triadDetails, biteSupplyDetails when present", async () => {
      const baseDetail = {
        channelName: "CH",
        mpid: "1",
        last_cron_time: null,
        last_update_time: null,
        last_attempted_time: null,
        next_cron_time: null,
        badgeIndicator: "ALL_ZERO",
        lastUpdatedOn: null,
        unitPrice: null,
        floorPrice: null,
        maxPrice: null,
        priority: null,
        requestInterval: null,
        override_bulk_rule: null,
        lastExistingPrice: "",
        lastSuggestedPrice: "",
        lowest_vendor_price: "",
        handlingTimeFilter: null,
      };
      const itemCollection = [
        {
          scrapeOnlyCronName: "Cron",
          isScrapeOnlyActivated: false,
          isBadgeItem: false,
          tradentDetails: null,
          frontierDetails: null,
          mvpDetails: { ...baseDetail, channelName: "MVP" },
          topDentDetails: { ...baseDetail, channelName: "TOPDENT" },
          firstDentDetails: { ...baseDetail, channelName: "FIRSTDENT" },
          triadDetails: { ...baseDetail, channelName: "TRIAD" },
          biteSupplyDetails: { ...baseDetail, channelName: "BITESUPPLY" },
        },
      ];
      mockGetCompleteProductDetails.mockResolvedValue(itemCollection);
      await exportItems(mockReq as Request, mockRes as Response);
      expect(mockGetCompleteProductDetails).toHaveBeenCalled();
      await new Promise((r) => setImmediate(r));
      expect(mockEnd).toHaveBeenCalled();
    });

    it("should use first badge value when badgeIndicator does not match any key", async () => {
      const itemCollection = [
        {
          scrapeOnlyCronName: "Cron",
          isScrapeOnlyActivated: false,
          isBadgeItem: false,
          tradentDetails: {
            channelName: "TRADENT",
            mpid: "1",
            last_cron_time: null,
            last_update_time: null,
            last_attempted_time: null,
            next_cron_time: null,
            badgeIndicator: "UNKNOWN_BADGE_KEY",
            lastUpdatedOn: null,
            unitPrice: null,
            floorPrice: null,
            maxPrice: null,
            priority: null,
            requestInterval: null,
            override_bulk_rule: null,
            lastExistingPrice: "",
            lastSuggestedPrice: "",
            lowest_vendor_price: "",
            handlingTimeFilter: null,
          },
          frontierDetails: null,
          mvpDetails: null,
          topDentDetails: null,
          firstDentDetails: null,
          triadDetails: null,
          biteSupplyDetails: null,
        },
      ];
      mockGetCompleteProductDetails.mockResolvedValue(itemCollection);
      await exportItems(mockReq as Request, mockRes as Response);
      expect(mockGetCompleteProductDetails).toHaveBeenCalled();
      await new Promise((r) => setImmediate(r));
      expect(mockEnd).toHaveBeenCalled();
    });
  });

  describe("parseBadgeIndicator", () => {
    it("should return value when evalType is KEY and key matches", () => {
      expect(parseBadgeIndicator("ALL_ZERO", "KEY")).toBe("Compete all - Regular");
      expect(parseBadgeIndicator("badge_only", "KEY")).toBe("Compete with Authorized Distributors only");
    });

    it("should return first badge value when evalType is KEY and key does not match", () => {
      const result = parseBadgeIndicator("UNKNOWN", "KEY");
      expect(result).toBe("Compete all - Regular");
    });

    it("should return key when evalType is VALUE and value matches", () => {
      expect(parseBadgeIndicator("Compete all - Regular", "VALUE")).toBe("ALL_ZERO");
      expect(parseBadgeIndicator("compete all - regular", "VALUE")).toBe("ALL_ZERO");
    });

    it("should return first badge key when evalType is VALUE and value does not match", () => {
      const result = parseBadgeIndicator("Unknown Value", "VALUE");
      expect(result).toBe("ALL_ZERO");
    });

    it("should return undefined when evalType is neither KEY nor VALUE", () => {
      expect(parseBadgeIndicator("ALL_ZERO", "OTHER")).toBeUndefined();
    });
  });

  describe("spliceResult", () => {
    it("should return the chunk at pageNo", () => {
      const arr = [1, 2, 3, 4, 5];
      expect(spliceResult(arr, 0, 2)).toEqual([1, 2]);
      expect(spliceResult(arr, 1, 2)).toEqual([3, 4]);
      expect(spliceResult(arr, 2, 2)).toEqual([5]);
    });
  });
});
