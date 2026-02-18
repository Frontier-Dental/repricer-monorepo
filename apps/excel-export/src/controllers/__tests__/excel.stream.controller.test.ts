import { Request, Response } from "express";

const mockStreamCompleteProductDetailsAsync = jest.fn();
const mockMapProductDetailsList = jest.fn();

const MOMENT_THROW_INPUT = "MOMENT_THROW_FIXTIME";
jest.mock("moment", () => {
  const actual = jest.requireActual<typeof import("moment")>("moment");
  return function (input: import("moment").MomentInput) {
    if (input === MOMENT_THROW_INPUT) {
      return {
        format: () => {
          throw new Error("fixTime error");
        },
      };
    }
    return actual(input);
  };
});

jest.mock("../../services/mysql", () => ({
  StreamCompleteProductDetailsAsync: (...args: unknown[]) => mockStreamCompleteProductDetailsAsync(...args),
}));
jest.mock("../../utility/mapper/mysql-mapper", () => ({
  MapProductDetailsList: (...args: unknown[]) => mockMapProductDetailsList(...args),
}));
let mockAddRow: jest.Mock;
let mockCommit: jest.Mock;
jest.mock("exceljs", () => {
  mockCommit = jest.fn().mockResolvedValue(undefined);
  mockAddRow = jest.fn().mockReturnValue({ commit: mockCommit });
  const addWorksheet = jest.fn().mockReturnValue({
    columns: [],
    addRow: mockAddRow,
    commit: mockCommit,
    autoFilter: "",
  });
  return {
    __esModule: true,
    default: {
      stream: {
        xlsx: {
          WorkbookWriter: function WorkbookWriter() {
            return { addWorksheet, addRow: mockAddRow, commit: mockCommit };
          },
        },
      },
    },
  };
});

import { streamProductDetails } from "../excel.stream.controller";

describe("excel.stream.controller", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response> & {
    setHeader: jest.Mock;
    end: jest.Mock;
    status: jest.Mock;
    send: jest.Mock;
    once: jest.Mock;
    pipe: jest.Mock;
  };
  let mockStreamOn: jest.Mock;
  let mockStreamPause: jest.Mock;
  let mockStreamResume: jest.Mock;
  let mockDbDestroy: jest.Mock;
  let mockDbRelease: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMapProductDetailsList.mockImplementation((rows: unknown[]) =>
      rows && rows.length
        ? [
            {
              tradentDetails: { channelName: "TRADENT", mpid: 1, last_cron_time: null, last_update_time: null, last_attempted_time: null, next_cron_time: null, badgeIndicator: "ALL_ZERO", lastExistingPrice: "", lastSuggestedPrice: "", lowest_vendor_price: "", handlingTimeFilter: null },
              frontierDetails: null,
              mvpDetails: null,
              topDentDetails: null,
              firstDentDetails: null,
              triadDetails: null,
              biteSupplyDetails: null,
            },
          ]
        : []
    );
    mockStreamPause = jest.fn();
    mockStreamResume = jest.fn();
    mockStreamOn = jest.fn();
    mockDbDestroy = jest.fn();
    mockDbRelease = jest.fn();
    mockRes = {
      setHeader: jest.fn(),
      end: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      pipe: jest.fn(),
      write: jest.fn(),
    };
    mockReq = {};
  });

  describe("streamProductDetails", () => {
    it("should set correct HTTP headers for Excel download", async () => {
      const mockStream = {
        on: mockStreamOn,
        pause: mockStreamPause,
        resume: mockStreamResume,
      };
      const mockDb = { destroy: mockDbDestroy, release: mockDbRelease };
      mockStreamCompleteProductDetailsAsync.mockResolvedValue({ stream: mockStream, db: mockDb });

      streamProductDetails(mockReq as Request, mockRes as Response);

      await new Promise((r) => setImmediate(r));

      expect(mockStreamCompleteProductDetailsAsync).toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Disposition", "attachment; filename=itemExcel.xlsx");
    });

    it("should handle stream end and destroy db", async () => {
      const mockStream = {
        on: mockStreamOn,
        pause: mockStreamPause,
        resume: mockStreamResume,
      };
      const mockDb = { destroy: mockDbDestroy, release: mockDbRelease };
      mockStreamCompleteProductDetailsAsync.mockResolvedValue({ stream: mockStream, db: mockDb });

      streamProductDetails(mockReq as Request, mockRes as Response);
      await new Promise((r) => setImmediate(r));

      expect(mockStreamOn).toHaveBeenCalledWith("data", expect.any(Function));
      expect(mockStreamOn).toHaveBeenCalledWith("end", expect.any(Function));
      expect(mockStreamOn).toHaveBeenCalledWith("error", expect.any(Function));

      const endCb = mockStreamOn.mock.calls.find((c: string[]) => c[0] === "end")?.[1];
      expect(endCb).toBeDefined();
      await (endCb as () => Promise<void>)();
      expect(mockDbDestroy).toHaveBeenCalled();
      expect(mockRes.end).toHaveBeenCalled();
    });

    it("should handle stream error and send 500 and release db", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const mockStream = {
        on: mockStreamOn,
        pause: mockStreamPause,
        resume: mockStreamResume,
      };
      const mockDb = { destroy: mockDbDestroy, release: mockDbRelease };
      mockStreamCompleteProductDetailsAsync.mockResolvedValue({ stream: mockStream, db: mockDb });

      streamProductDetails(mockReq as Request, mockRes as Response);
      await new Promise((r) => setImmediate(r));

      const errorCb = mockStreamOn.mock.calls.find((c: string[]) => c[0] === "error")?.[1];
      expect(errorCb).toBeDefined();
      (errorCb as (err: Error) => void)(new Error("Stream failed"));
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith("Internal Error");
      expect(mockDbRelease).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should handle StreamCompleteProductDetailsAsync rejection", async () => {
      mockStreamCompleteProductDetailsAsync.mockRejectedValue(new Error("Connection failed"));
      await expect(streamProductDetails(mockReq as Request, mockRes as Response)).rejects.toThrow("Connection failed");
    });

    it("should process stream data and add rows for all vendor detail types", async () => {
      const baseDetail = {
        channelName: "CH",
        mpid: 1,
        last_cron_time: "2024-01-01T12:00:00Z",
        last_update_time: "2024-01-02T12:00:00Z",
        last_attempted_time: "2024-01-03T12:00:00Z",
        next_cron_time: "2024-01-04T12:00:00Z",
        badgeIndicator: "ALL_ZERO",
        lastExistingPrice: "10",
        lastSuggestedPrice: "11",
        lowest_vendor_price: "9",
        handlingTimeFilter: "FAST_SHIPPING",
        unitPrice: "19.99",
        floorPrice: "9.99",
        maxPrice: "29.99",
      };
      mockMapProductDetailsList.mockImplementation(() => [
        {
          scrapeOnlyCronName: "Cron",
          isScrapeOnlyActivated: true,
          isBadgeItem: false,
          tradentDetails: { ...baseDetail, channelName: "TRADENT" },
          frontierDetails: { ...baseDetail, channelName: "FRONTIER" },
          mvpDetails: { ...baseDetail, channelName: "MVP" },
          topDentDetails: { ...baseDetail, channelName: "TOPDENT" },
          firstDentDetails: { ...baseDetail, channelName: "FIRSTDENT" },
          triadDetails: { ...baseDetail, channelName: "TRIAD" },
          biteSupplyDetails: { ...baseDetail, channelName: "BITESUPPLY" },
        },
      ]);

      const mockStream = {
        on: mockStreamOn,
        pause: mockStreamPause,
        resume: mockStreamResume,
      };
      const mockDb = { destroy: mockDbDestroy, release: mockDbRelease };
      mockStreamCompleteProductDetailsAsync.mockResolvedValue({ stream: mockStream, db: mockDb });

      streamProductDetails(mockReq as Request, mockRes as Response);
      await new Promise((r) => setImmediate(r));

      const dataCb = mockStreamOn.mock.calls.find((c: string[]) => c[0] === "data")?.[1];
      expect(dataCb).toBeDefined();
      (dataCb as (row: unknown) => void)({ raw: "row" });
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));

      expect(mockMapProductDetailsList).toHaveBeenCalledWith([{ raw: "row" }]);
      expect(mockAddRow).toHaveBeenCalledTimes(7);
      expect(mockStreamPause).toHaveBeenCalled();
      expect(mockStreamResume).toHaveBeenCalled();
    });

    it("should transform row with handlingTimeFilter and badgeIndicator", async () => {
      mockMapProductDetailsList.mockImplementation(() => [
        {
          scrapeOnlyCronName: "Cron",
          isScrapeOnlyActivated: false,
          isBadgeItem: false,
          tradentDetails: {
            channelName: "TRADENT",
            mpid: 42,
            last_cron_time: null,
            last_update_time: null,
            last_attempted_time: null,
            next_cron_time: null,
            badgeIndicator: "UNKNOWN_BADGE",
            lastExistingPrice: "5",
            lastSuggestedPrice: "6",
            lowest_vendor_price: "4",
            handlingTimeFilter: "STOCKED",
            unitPrice: "12.5",
            floorPrice: "5",
            maxPrice: "20",
          },
          frontierDetails: null,
          mvpDetails: null,
          topDentDetails: null,
          firstDentDetails: null,
          triadDetails: null,
          biteSupplyDetails: null,
        },
      ]);

      const mockStream = {
        on: mockStreamOn,
        pause: mockStreamPause,
        resume: mockStreamResume,
      };
      const mockDb = { destroy: mockDbDestroy, release: mockDbRelease };
      mockStreamCompleteProductDetailsAsync.mockResolvedValue({ stream: mockStream, db: mockDb });

      streamProductDetails(mockReq as Request, mockRes as Response);
      await new Promise((r) => setImmediate(r));

      const dataCb = mockStreamOn.mock.calls.find((c: string[]) => c[0] === "data")?.[1];
      (dataCb as (row: unknown) => void)({});
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));

      expect(mockAddRow).toHaveBeenCalledTimes(1);
      const addedRow = mockAddRow.mock.calls[0][0];
      expect(addedRow).toMatchObject({
        channelName: "TRADENT",
        mpid: 42,
        unitPrice: 12.5,
        floorPrice: 5,
        maxPrice: 20,
        lastExistingPrice: "5 /",
        lastSuggestedPrice: "6 /",
        lowest_vendor_price: "4 /",
      });
      expect(addedRow.handling_time_filter).toBe("1-5 days (Stocked)");
      expect(addedRow.badge_indicator).toBeDefined();
    });

    it("should not add rows when MapProductDetailsList returns empty", async () => {
      mockMapProductDetailsList.mockImplementation(() => []);

      const mockStream = {
        on: mockStreamOn,
        pause: mockStreamPause,
        resume: mockStreamResume,
      };
      const mockDb = { destroy: mockDbDestroy, release: mockDbRelease };
      mockStreamCompleteProductDetailsAsync.mockResolvedValue({ stream: mockStream, db: mockDb });

      streamProductDetails(mockReq as Request, mockRes as Response);
      await new Promise((r) => setImmediate(r));

      const dataCb = mockStreamOn.mock.calls.find((c: string[]) => c[0] === "data")?.[1];
      (dataCb as (row: unknown) => void)({});
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));

      expect(mockAddRow).not.toHaveBeenCalled();
    });

    it("should handle fixTime error and return input when moment throws", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockMapProductDetailsList.mockImplementation(() => [
        {
          scrapeOnlyCronName: "Cron",
          isScrapeOnlyActivated: false,
          isBadgeItem: false,
          tradentDetails: {
            channelName: "TRADENT",
            mpid: 1,
            last_cron_time: MOMENT_THROW_INPUT,
            last_update_time: null,
            last_attempted_time: null,
            next_cron_time: null,
            badgeIndicator: "ALL_ZERO",
            lastExistingPrice: "",
            lastSuggestedPrice: "",
            lowest_vendor_price: "",
            handlingTimeFilter: null,
            unitPrice: null,
            floorPrice: null,
            maxPrice: null,
          },
          frontierDetails: null,
          mvpDetails: null,
          topDentDetails: null,
          firstDentDetails: null,
          triadDetails: null,
          biteSupplyDetails: null,
        },
      ]);

      const mockStream = {
        on: mockStreamOn,
        pause: mockStreamPause,
        resume: mockStreamResume,
      };
      const mockDb = { destroy: mockDbDestroy, release: mockDbRelease };
      mockStreamCompleteProductDetailsAsync.mockResolvedValue({ stream: mockStream, db: mockDb });

      streamProductDetails(mockReq as Request, mockRes as Response);
      await new Promise((r) => setImmediate(r));

      const dataCb = mockStreamOn.mock.calls.find((c: string[]) => c[0] === "data")?.[1];
      (dataCb as (row: unknown) => void)({});
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));

      expect(mockAddRow).toHaveBeenCalledTimes(1);
      expect(mockAddRow.mock.calls[0][0].lastCronTime).toBe(MOMENT_THROW_INPUT);
      consoleSpy.mockRestore();
    });
  });
});
