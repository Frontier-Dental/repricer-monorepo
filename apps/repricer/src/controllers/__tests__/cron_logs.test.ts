import { Request, Response } from "express";
import * as cronLogs from "../cron_logs";
import * as mongoMiddleware from "../../services/mongo";
import * as httpMiddleware from "../../utility/http-wrappers";
import { GetCronSettingsList, GetSlowCronDetails, GetFilteredCrons, GetScrapeCrons, GetExportFileNamesByStatus, GetExportFileStatus } from "../../services/mysql-v2";
import * as ftpMiddleware from "../../services/ftp";
import * as scrapeOnlyMiddleware from "../../middleware/scrape-only";
import * as cronMiddleware from "../../services/cron";
import CronLogsModel from "../../models/cron-logs";
import EnvSettings from "../../models/env-settings";
import Exports from "../../models/exports";
import { applicationConfig } from "../../utility/config";

jest.mock("../../services/mongo");
jest.mock("../../utility/http-wrappers");
jest.mock("../../services/mysql-v2");
jest.mock("../../services/ftp");
jest.mock("../../middleware/scrape-only");
jest.mock("../../services/cron");
jest.mock("../../models/cron-logs");
jest.mock("../../models/env-settings");
jest.mock("../../models/exports");
jest.mock("../../utility/config", () => ({
  applicationConfig: { FILTER_CRON_LOGS_LIMIT: 10 },
}));

const mockGetCronLogs = mongoMiddleware.GetCronLogs as jest.MockedFunction<typeof mongoMiddleware.GetCronLogs>;
const mockGetCronLogsV2 = mongoMiddleware.GetCronLogsV2 as jest.MockedFunction<typeof mongoMiddleware.GetCronLogsV2>;
const mockGetLatestCronStatus = mongoMiddleware.GetLatestCronStatus as jest.MockedFunction<typeof mongoMiddleware.GetLatestCronStatus>;
const mockGetFilterCronLogsByLimit = mongoMiddleware.GetFilterCronLogsByLimit as jest.MockedFunction<typeof mongoMiddleware.GetFilterCronLogsByLimit>;
const mockGetLogsById = mongoMiddleware.GetLogsById as jest.MockedFunction<typeof mongoMiddleware.GetLogsById>;
const mockGetItemList = mongoMiddleware.GetItemList as jest.MockedFunction<typeof mongoMiddleware.GetItemList>;
const mockUpdateCronLogPostPriceUpdate = mongoMiddleware.UpdateCronLogPostPriceUpdate as jest.MockedFunction<typeof mongoMiddleware.UpdateCronLogPostPriceUpdate>;
const mockCheckInProgressExport = mongoMiddleware.CheckInProgressExport as jest.MockedFunction<typeof mongoMiddleware.CheckInProgressExport>;
const mockFetchQueuedExport = mongoMiddleware.FetchQueuedExport as jest.MockedFunction<typeof mongoMiddleware.FetchQueuedExport>;
const mockUpdateExportStatus = mongoMiddleware.UpdateExportStatus as jest.MockedFunction<typeof mongoMiddleware.UpdateExportStatus>;

const mockUpdatePrice = httpMiddleware.updatePrice as jest.MockedFunction<typeof httpMiddleware.updatePrice>;
const mockGetAllFileDetails = ftpMiddleware.GetAllFileDetails as jest.MockedFunction<typeof ftpMiddleware.GetAllFileDetails>;
const mockGetRecentInProgressScrapeRuns = scrapeOnlyMiddleware.GetRecentInProgressScrapeRuns as jest.MockedFunction<typeof scrapeOnlyMiddleware.GetRecentInProgressScrapeRuns>;
const mockGetRunInfoByCron = scrapeOnlyMiddleware.GetRunInfoByCron as jest.MockedFunction<typeof scrapeOnlyMiddleware.GetRunInfoByCron>;
const mockGetRunInfo = scrapeOnlyMiddleware.GetRunInfo as jest.MockedFunction<typeof scrapeOnlyMiddleware.GetRunInfo>;
const mockCreateUpdatePriceCron = cronMiddleware.CreateUpdatePriceCron as jest.MockedFunction<typeof cronMiddleware.CreateUpdatePriceCron>;

const mockWriteResolve = jest.fn().mockResolvedValue(undefined);
const mockAddRows = jest.fn();
const mockWorksheet = {
  columns: undefined as any,
  addRows: mockAddRows,
};
const mockAddWorksheet = jest.fn().mockReturnValue(mockWorksheet);
const mockWorkbook = {
  addWorksheet: mockAddWorksheet,
  xlsx: { write: mockWriteResolve, writeFile: jest.fn().mockResolvedValue(undefined) },
};
jest.mock("exceljs", () => ({
  __esModule: true,
  default: {
    Workbook: jest.fn().mockImplementation(() => mockWorkbook),
  },
}));

const fs = require("fs");
jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  unlink: jest.fn((path: string, cb: (err: Error | null) => void) => cb(null)),
  writeFile: jest.fn((path: string, data: string, cb: (err: Error | null) => void) => cb(null)),
  promises: {
    readFile: jest.fn().mockResolvedValue(JSON.stringify([])),
  },
}));

describe("Cron-Logs Controller", () => {
  let mockReq: Partial<Request> & { session?: any; body?: any; params?: any; query?: any };
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let renderMock: jest.Mock;
  let setHeaderMock: jest.Mock;
  let statusMock: jest.Mock;
  let endMock: jest.Mock;
  let downloadMock: jest.Mock;
  let redirectMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn().mockReturnThis();
    renderMock = jest.fn();
    setHeaderMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnThis();
    endMock = jest.fn();
    downloadMock = jest.fn((path: string, cb?: (err: Error) => void) => {
      if (typeof cb === "function") cb(undefined as any);
    });
    redirectMock = jest.fn();
    mockRes = {
      json: jsonMock,
      render: renderMock,
      setHeader: setHeaderMock,
      status: statusMock,
      end: endMock,
      download: downloadMock,
      redirect: redirectMock,
    };
    mockReq = {
      body: {},
      params: {},
      query: {},
      session: { users_id: { userRole: "admin", userName: "testuser" } } as any,
    };
    mockWriteResolve.mockResolvedValue(undefined);
    (CronLogsModel as jest.Mock).mockImplementation((raw: any, idx: number) => ({
      index: idx + 1,
      logTime: raw?.time ? "formatted" : "-",
      keyRef: raw?.keyGen || "-",
      completionTime: raw?.completionTime ? "formatted" : "-",
      productIds: "",
      logData: raw,
      productCount: 0,
      repricedProductCount: "N/A",
      successScrapeCount: 0,
      failureScrapeCount: 0,
      totalActiveCount: raw?.totalCount ?? "-",
    }));
  });

  describe("getCronLogs", () => {
    it("should render dashboard with logs, cron status and filter logs", async () => {
      const cronSettings = [{ CronId: "c1", CronName: "Cron1" }];
      const slowCronSettings: any[] = [];
      const mongoResult = [
        {
          _id: "log1",
          time: new Date(),
          cronId: "c1",
          logs: [[{ productId: "p1", priceUpdated: true }]],
          RepricedProductCount: 2,
        },
      ];
      mockGetCronLogs.mockResolvedValue({
        mongoResult,
        pageNumber: 0,
        pageSize: 10,
        totalDocs: 1,
        totalPages: 1,
      } as any);
      (GetCronSettingsList as jest.Mock).mockResolvedValue(cronSettings);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue(slowCronSettings);
      mockGetLatestCronStatus.mockResolvedValue([{ cronId: "c1" }] as any);
      mockGetFilterCronLogsByLimit.mockResolvedValue([
        {
          filterDate: new Date(),
          startTime: new Date(),
          endTime: new Date(),
          contextCronId: "fc1",
        },
      ] as any);
      (GetFilteredCrons as jest.Mock).mockResolvedValue([{ cronId: "fc1", cronName: "FilterCron1" }]);

      await cronLogs.getCronLogs(mockReq as Request, mockRes as Response);

      expect(renderMock).toHaveBeenCalledWith(
        "pages/dashboard/list",
        expect.objectContaining({
          groupName: "dashboard",
          userRole: "admin",
          items: expect.any(Array),
          cronStatus: expect.any(Array),
          filterLogs: expect.any(Array),
          pageNumber: 0,
          totalDocs: 1,
        })
      );
    });

    it("should use pgno, fromDate, toDate and type from query", async () => {
      (GetCronSettingsList as jest.Mock).mockResolvedValue([]);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      mockGetCronLogs.mockResolvedValue({
        mongoResult: [],
        pageNumber: 1,
        pageSize: 10,
        totalDocs: 0,
        totalPages: 0,
      } as any);
      mockGetLatestCronStatus.mockResolvedValue([]);
      mockGetFilterCronLogsByLimit.mockResolvedValue([]);
      (GetFilteredCrons as jest.Mock).mockResolvedValue([]);
      mockReq.query = { pgno: "2", fromDate: "2025-01-01", toDate: "2025-01-02", type: "Regular" };

      await cronLogs.getCronLogs(mockReq as Request, mockRes as Response);

      expect(mockGetCronLogs).toHaveBeenCalledWith(1, "Regular", "", { fromDate: "2025-01-01", toDate: "2025-01-02" });
    });

    it("should resolve cronId from group query when group matches CronName", async () => {
      const cronSettings = [{ CronId: "cid-1", CronName: "MyGroup" }];
      (GetCronSettingsList as jest.Mock).mockResolvedValue(cronSettings);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      mockGetCronLogs.mockResolvedValue({
        mongoResult: [],
        pageNumber: 0,
        pageSize: 10,
        totalDocs: 0,
        totalPages: 0,
      } as any);
      mockGetLatestCronStatus.mockResolvedValue([]);
      mockGetFilterCronLogsByLimit.mockResolvedValue([]);
      (GetFilteredCrons as jest.Mock).mockResolvedValue([]);
      mockReq.query = { group: "MyGroup" };

      await cronLogs.getCronLogs(mockReq as Request, mockRes as Response);

      expect(mockGetCronLogs).toHaveBeenCalledWith(0, "", "cid-1", expect.any(Object));
    });

    it("should set cronName on cronStatus from cronSettings and handle exception", async () => {
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ CronId: "c1", CronName: "Cron1" }]);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      mockGetCronLogs.mockResolvedValue({
        mongoResult: [],
        pageNumber: 0,
        pageSize: 10,
        totalDocs: 0,
        totalPages: 0,
      } as any);
      const cronStatus = [{ cronId: "c1", cronTime: new Date() }];
      mockGetLatestCronStatus.mockResolvedValue(cronStatus as any);
      mockGetFilterCronLogsByLimit.mockResolvedValue([]);
      (GetFilteredCrons as jest.Mock).mockResolvedValue([]);

      await cronLogs.getCronLogs(mockReq as Request, mockRes as Response);

      expect(cronStatus[0]).toHaveProperty("cronName", "Cron1");
    });

    it("should compute repricer and scrape counts from log structure", async () => {
      const cronSettings = [{ CronId: "c1", CronName: "Cron1" }];
      const mongoResult = [
        {
          _id: "log2",
          time: new Date(),
          cronId: "c1",
          logs: [
            [
              {
                productId: "p1",
                priceUpdated: true,
                logs: { repriceData: { repriceDetails: {} } },
                priceUpdateResponse: null,
              },
              {
                productId: "p2",
                priceUpdated: false,
                logs: {},
                priceUpdateResponse: { message: "ERROR:422 something" },
              },
              {
                productId: "p3",
                logs: { listOfRepriceDetails: [] },
                priceUpdateResponse: { message: "Error 500" },
              },
            ],
          ],
        },
      ];
      mockGetCronLogs.mockResolvedValue({
        mongoResult,
        pageNumber: 0,
        pageSize: 10,
        totalDocs: 1,
        totalPages: 1,
      } as any);
      (GetCronSettingsList as jest.Mock).mockResolvedValue(cronSettings);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      mockGetLatestCronStatus.mockResolvedValue([]);
      mockGetFilterCronLogsByLimit.mockResolvedValue([]);
      (GetFilteredCrons as jest.Mock).mockResolvedValue([]);

      await cronLogs.getCronLogs(mockReq as Request, mockRes as Response);

      expect(renderMock).toHaveBeenCalledWith(
        "pages/dashboard/list",
        expect.objectContaining({
          items: expect.any(Array),
          totalDocs: 1,
        })
      );
      const items = (renderMock.mock.calls[0] as any)[1].items;
      expect(items.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getLogsDetails", () => {
    it("should render logViewer with filtered logs (excluding UNKNOWN vendor)", async () => {
      const rawLog = {
        _id: "lid",
        time: new Date(),
        logs: [[{ productId: "p1", vendor: "V1", logs: {} }], [{ productId: "p2", vendor: "UNKNOWN", logs: {} }]],
      };
      mockGetLogsById.mockResolvedValue([rawLog] as any);
      mockReq.params = { id: "lid" };

      await cronLogs.getLogsDetails(mockReq as Request, mockRes as Response);

      expect(mockGetLogsById).toHaveBeenCalledWith("lid");
      expect(renderMock).toHaveBeenCalledWith(
        "pages/dashboard/logViewer",
        expect.objectContaining({
          items: expect.any(Object),
          groupName: "dashboard",
          userRole: "admin",
        })
      );
    });
  });

  describe("getRawJson", () => {
    it("should render rawJson when log found for mpId and vendor", async () => {
      const vendorLog = {
        productId: "mp123",
        vendor: "V1",
        logs: { scrapedOn: new Date().toISOString() },
      };
      const rawLog = {
        _id: "idx1",
        time: new Date(),
        logs: [[vendorLog]],
      };
      mockGetLogsById.mockResolvedValue([rawLog] as any);
      mockReq.params = { mpId: "mp123", idx: "idx1", vendor: "V1" };

      await cronLogs.getRawJson(mockReq as Request, mockRes as Response);

      expect(renderMock).toHaveBeenCalledWith(
        "pages/dashboard/rawJson",
        expect.objectContaining({
          item: expect.objectContaining({
            productId: "mp123",
            vendor: "V1",
            serializedData: expect.any(String),
            parentIndex: "idx1",
          }),
          groupName: "dashboard",
          userRole: "admin",
        })
      );
    });
  });

  describe("downloadLog", () => {
    it("should write file and call res.download then unlink", async () => {
      const vendorLog = {
        productId: "mp99",
        vendor: "V2",
        logs: { scrapedOn: new Date().toISOString() },
      };
      const rawLog = { _id: "idx2", time: new Date(), logs: [[vendorLog]] };
      mockGetLogsById.mockResolvedValue([rawLog] as any);
      mockReq.params = { mpId: "mp99", idx: "idx2", vendor: "V2" };
      await cronLogs.getRawJson(mockReq as Request, mockRes as Response);

      mockReq.params = {};
      await cronLogs.downloadLog(mockReq as Request, mockRes as Response);

      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(downloadMock).toHaveBeenCalled();
      expect(fs.unlinkSync).toHaveBeenCalled();
    });
  });

  describe("exportData", () => {
    it("should build workbook and stream xlsx with item collection", async () => {
      const rawLog = {
        _id: "ex1",
        time: new Date(),
        logs: [
          [
            {
              productId: "p1",
              logs: {
                repriceData: {
                  vendorProductId: "vp1",
                  repriceDetails: {
                    oldPrice: 10,
                    newPrice: 12,
                    explained: "ok",
                  },
                },
              },
              priceUpdated: true,
            },
          ],
        ],
      };
      mockGetLogsById.mockResolvedValue([rawLog] as any);
      mockGetItemList.mockResolvedValue([{ productName: "Prod1", channelId: "ch1", mpid: "p1" }] as any);
      mockReq.params = { idx: "ex1" };

      await cronLogs.exportData(mockReq as Request, mockRes as Response);

      expect(mockAddWorksheet).toHaveBeenCalledWith("ItemList");
      expect(setHeaderMock).toHaveBeenCalledWith("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(mockWriteResolve).toHaveBeenCalledWith(mockRes);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(endMock).toHaveBeenCalled();
    });
    it("should handle getExcelItemCollection with listOfRepriceDetails (multi-price)", async () => {
      const rawLog = {
        _id: "ex2",
        time: new Date(),
        logs: [
          [
            {
              productId: "p2",
              logs: {
                repriceData: {
                  vendorProductId: "vp2",
                  listOfRepriceDetails: [{ minQty: 1, oldPrice: 10, newPrice: 12, explained: "ok" }],
                },
              },
              priceUpdated: true,
            },
          ],
        ],
      };
      mockGetLogsById.mockResolvedValue([rawLog] as any);
      mockGetItemList.mockResolvedValue([{ productName: "Prod2", channelId: "ch2", mpid: "p2" }] as any);
      mockReq.params = { idx: "ex2" };

      await cronLogs.exportData(mockReq as Request, mockRes as Response);

      expect(mockAddRows).toHaveBeenCalled();
      expect(mockWriteResolve).toHaveBeenCalledWith(mockRes);
    });
    it("should skip rows when GetItemList returns empty", async () => {
      const rawLog = {
        _id: "ex3",
        time: new Date(),
        logs: [
          [
            {
              productId: "p3",
              logs: { repriceData: { repriceDetails: { oldPrice: 1, newPrice: 2, explained: "x" } } },
              priceUpdated: false,
            },
          ],
        ],
      };
      mockGetLogsById.mockResolvedValue([rawLog] as any);
      mockGetItemList.mockResolvedValue([]);
      mockReq.params = { idx: "ex3" };

      await cronLogs.exportData(mockReq as Request, mockRes as Response);

      expect(mockAddWorksheet).toHaveBeenCalledWith("ItemList");
      expect(mockWriteResolve).toHaveBeenCalledWith(mockRes);
    });
  });

  describe("exportBulkData", () => {
    it("should create queued export and render msgDisplay", async () => {
      (Exports.create as jest.Mock).mockResolvedValue({ _id: "export-id" });
      mockReq.params = { from: "2025-01-01", to: "2025-01-02" };

      await cronLogs.exportBulkData(mockReq as Request, mockRes as Response);

      expect(Exports.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: expect.stringContaining("Export_"),
          status: "Queued",
          fromDate: new Date("2025-01-01"),
          toDate: new Date("2025-01-02"),
        })
      );
      expect(renderMock).toHaveBeenCalledWith(
        "pages/msgDisplay",
        expect.objectContaining({
          response: expect.stringContaining("export will finish shortly"),
          groupName: "item",
          userRole: "admin",
        })
      );
    });
  });

  describe("listDownloads", () => {
    it("should render exports page with files from FTP and in-progress", async () => {
      mockGetAllFileDetails.mockResolvedValue([{ name: "file1.xlsx" }] as any);
      (GetExportFileStatus as jest.Mock).mockResolvedValue({
        createdTime: new Date(),
        updatedTime: new Date(),
        status: "Done",
        requestedBy: "user1",
      });
      (GetExportFileNamesByStatus as jest.Mock).mockResolvedValue([]);

      await cronLogs.listDownloads(mockReq as Request, mockRes as Response);

      expect(renderMock).toHaveBeenCalledWith(
        "pages/downloads/exports",
        expect.objectContaining({
          files: expect.any(Array),
          groupName: "downloads",
          userRole: "admin",
        })
      );
    });
    it("should render with empty files when no FTP files and no in-progress", async () => {
      mockGetAllFileDetails.mockResolvedValue([]);
      (GetExportFileStatus as jest.Mock).mockResolvedValue(null);
      (GetExportFileNamesByStatus as jest.Mock).mockResolvedValue([]);

      await cronLogs.listDownloads(mockReq as Request, mockRes as Response);

      expect(renderMock).toHaveBeenCalledWith(
        "pages/downloads/exports",
        expect.objectContaining({
          files: [],
          groupName: "downloads",
        })
      );
    });
  });

  describe("downloadFile", () => {
    it("should call res.download with filename", async () => {
      mockReq.params = { file: "my-export" };
      await cronLogs.downloadFile(mockReq as Request, mockRes as Response);
      expect(downloadMock).toHaveBeenCalledWith(expect.stringContaining("my-export.xlsx"), expect.any(Function));
    });
  });

  describe("deleteFile", () => {
    it("should unlink file and delete from Exports then redirect", async () => {
      (Exports.findByIdAndDelete as jest.Mock).mockResolvedValue({});
      mockReq.params = { id: "export-id", file: "myfile" };
      await cronLogs.deleteFile(mockReq as Request, mockRes as Response);
      expect(fs.unlink).toHaveBeenCalled();
      expect(Exports.findByIdAndDelete).toHaveBeenCalledWith("export-id");
      expect(redirectMock).toHaveBeenCalledWith("/downloads/list_downloads");
    });
  });

  describe("updatePrice", () => {
    it("should update price via http and UpdateCronLogPostPriceUpdate then return json", async () => {
      (EnvSettings.findOne as jest.Mock).mockResolvedValue({ ownVendorId: "own1" });
      const productLog = {
        productId: "mp1",
        logs: {
          repriceData: {
            vendorProductCode: "vpc",
            repriceDetails: { newPrice: "15" },
          },
          sourceResult: [{ vendorId: "own1", inventory: "10" }],
        },
      };
      const rawLog = { _id: "up1", time: new Date(), logs: [productLog] };
      mockGetLogsById.mockResolvedValue([rawLog] as any);
      mockUpdatePrice.mockResolvedValue({ success: true } as any);
      mockUpdateCronLogPostPriceUpdate.mockResolvedValue(undefined as any);
      mockReq.params = { mpId: "mp1", idx: "up1" };
      await cronLogs.updatePrice(mockReq as Request, mockRes as Response);
      expect(mockUpdatePrice).toHaveBeenCalled();
      expect(mockUpdateCronLogPostPriceUpdate).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: expect.stringContaining("Price updated successfully"),
      });
    });
  });

  describe("updateAll", () => {
    it("should collect products with new price and call CreateUpdatePriceCron", async () => {
      (EnvSettings.findOne as jest.Mock).mockResolvedValue({ ownVendorId: "v1" });
      const productLog = {
        productId: "mp2",
        logs: {
          repriceData: {
            vendorProductCode: "vpc2",
            repriceDetails: { oldPrice: "10", newPrice: "12" },
          },
          sourceResult: [{ vendorId: "v1", inventory: "5" }],
        },
      };
      const rawLog = { _id: "ua1", time: new Date(), logs: [productLog] };
      mockGetLogsById.mockResolvedValue([rawLog] as any);
      mockUpdateCronLogPostPriceUpdate.mockResolvedValue(undefined as any);
      mockReq.params = { idx: "ua1" };
      await cronLogs.updateAll(mockReq as Request, mockRes as Response);
      expect(mockCreateUpdatePriceCron).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: expect.stringContaining("Price updated successfully for all"),
      });
    });
  });

  describe("updatePriceExternal", () => {
    it("should call updatePrice with body and return json", async () => {
      mockUpdatePrice.mockResolvedValue({ data: "ok" } as any);
      mockReq.body = { payload: { cronName: "ExtCron" } };
      await cronLogs.updatePriceExternal(mockReq as Request, mockRes as Response);
      expect(mockUpdatePrice).toHaveBeenCalledWith(mockReq.body);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: { data: "ok" },
      });
    });
  });

  describe("exportDataV2", () => {
    it("should build workbook with getExcelItemCollectionV2 and stream xlsx", async () => {
      const rawLog = {
        _id: "ev2",
        time: new Date(),
        logs: [
          [
            {
              productId: "p1",
              vendor: "V1",
              logs: {
                repriceData: {
                  vendorProductId: "vp1",
                  productName: "Prod1",
                  repriceDetails: { oldPrice: 10, newPrice: 12, explained: "ok" },
                },
              },
              priceUpdated: true,
            },
          ],
        ],
      };
      mockGetLogsById.mockResolvedValue([rawLog] as any);
      mockReq.params = { idx: "ev2" };
      await cronLogs.exportDataV2(mockReq as Request, mockRes as Response);
      expect(mockAddWorksheet).toHaveBeenCalledWith("ItemList");
      expect(mockAddRows).toHaveBeenCalled();
      expect(setHeaderMock).toHaveBeenCalledWith("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(statusMock).toHaveBeenCalledWith(200);
    });
    it("should handle getExcelItemCollectionV2 with listOfRepriceDetails", async () => {
      const rawLog = {
        _id: "ev3",
        time: new Date(),
        logs: [
          [
            {
              productId: "p2",
              vendor: "V2",
              logs: {
                repriceData: {
                  vendorProductId: "vp2",
                  productName: "P2",
                  listOfRepriceDetails: [{ minQty: 1, oldPrice: 8, newPrice: 9, explained: "multi" }],
                },
              },
              priceUpdated: false,
            },
          ],
        ],
      };
      mockGetLogsById.mockResolvedValue([rawLog] as any);
      mockReq.params = { idx: "ev3" };
      await cronLogs.exportDataV2(mockReq as Request, mockRes as Response);
      expect(mockAddRows).toHaveBeenCalled();
    });
  });

  describe("getFilterCronLogsByLimit", () => {
    it("should return json with filter cron logs", async () => {
      mockGetFilterCronLogsByLimit.mockResolvedValue([
        {
          filterDate: new Date(),
          startTime: new Date(),
          endTime: new Date(),
          contextCronId: "fc1",
        },
      ] as any);
      (GetFilteredCrons as jest.Mock).mockResolvedValue([{ cronId: "fc1", cronName: "Filter1" }]);
      mockReq.params = { noOfLogs: "5" };
      await cronLogs.getFilterCronLogsByLimit(mockReq as Request, mockRes as Response);
      expect(mockGetFilterCronLogsByLimit).toHaveBeenCalledWith(5);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        cronLogs: expect.any(Array),
      });
    });
    it("should return empty cronLogs when GetFilterCronLogsByLimit returns empty", async () => {
      mockGetFilterCronLogsByLimit.mockResolvedValue([]);
      mockReq.params = { noOfLogs: "10" };
      await cronLogs.getFilterCronLogsByLimit(mockReq as Request, mockRes as Response);
      expect(jsonMock).toHaveBeenCalledWith({ status: true, cronLogs: [] });
    });
  });

  describe("getInProgressRegularCrons", () => {
    it("should return json with cron status", async () => {
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ CronId: "c1", CronName: "RegularCron" }]);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      const cronStatus = [{ cronId: "c1", cronTime: new Date("2025-02-24T12:00:00Z") }];
      mockGetLatestCronStatus.mockResolvedValue(cronStatus as any);
      await cronLogs.getInProgressRegularCrons(mockReq as Request, mockRes as Response);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        cronStatus: expect.any(Array),
      });
      expect(cronStatus[0]).toHaveProperty("cronName", "RegularCron");
    });
    it("should return status false on error", async () => {
      mockGetLatestCronStatus.mockRejectedValue(new Error("mongo error"));
      await cronLogs.getInProgressRegularCrons(mockReq as Request, mockRes as Response);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: false,
          cronStatus: [],
          error: expect.any(Error),
        })
      );
    });
    it("should return empty cronStatus when GetLatestCronStatus returns empty", async () => {
      (GetCronSettingsList as jest.Mock).mockResolvedValue([]);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      mockGetLatestCronStatus.mockResolvedValue([]);
      await cronLogs.getInProgressRegularCrons(mockReq as Request, mockRes as Response);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        cronStatus: [],
      });
    });
  });

  describe("getCurrentTasks", () => {
    it("should render currentTasks with cron status", async () => {
      (GetCronSettingsList as jest.Mock).mockResolvedValue([]);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      mockGetLatestCronStatus.mockResolvedValue([]);
      await cronLogs.getCurrentTasks(mockReq as Request, mockRes as Response);
      expect(renderMock).toHaveBeenCalledWith(
        "pages/dashboard/currentTasks",
        expect.objectContaining({
          cronStatus: expect.any(Array),
          groupName: "tasks",
          userRole: "admin",
        })
      );
    });
  });

  describe("getInProgressScrapeCrons", () => {
    it("should return json with enriched scrape cron status", async () => {
      mockGetRecentInProgressScrapeRuns.mockResolvedValue([
        {
          CronStartTime: "2025-02-24 12:00:00",
          KeyGenId: "kg1",
          CronName: "ScrapeCron",
          EligibleCount: 100,
          CompletedProductCount: 50,
          Status: "Running",
        },
      ] as any);
      await cronLogs.getInProgressScrapeCrons(mockReq as Request, mockRes as Response);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        scrapeCronStatus: expect.any(Array),
      });
    });
    it("should return status false on error", async () => {
      mockGetRecentInProgressScrapeRuns.mockRejectedValue(new Error("sql error"));
      await cronLogs.getInProgressScrapeCrons(mockReq as Request, mockRes as Response);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: false,
          scrapeCronStatus: [],
          error: expect.any(Error),
        })
      );
    });
  });

  describe("getCronHistoryLogs", () => {
    it("should render cronHistory on initial load with empty items", async () => {
      (GetCronSettingsList as jest.Mock).mockResolvedValue([]);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      (GetScrapeCrons as jest.Mock).mockResolvedValue([]);
      await cronLogs.getCronHistoryLogs(mockReq as Request, mockRes as Response);
      expect(renderMock).toHaveBeenCalledWith(
        "pages/dashboard/cronHistory",
        expect.objectContaining({
          items: [],
          showSearchMessage: true,
          totalDocs: 0,
        })
      );
    });
    it("should fetch and render logs when search params provided", async () => {
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ CronId: "c1", CronName: "C1" }]);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      (GetScrapeCrons as jest.Mock).mockResolvedValue([]);
      mockGetLatestCronStatus.mockResolvedValue([]);
      mockGetCronLogsV2.mockResolvedValue({
        mongoResult: [
          {
            _id: "h1",
            time: new Date(),
            cronId: "c1",
            logs: [
              [
                {
                  productId: "p1",
                  logs: { repriceData: { repriceDetails: {} } },
                  priceUpdateResponse: null,
                },
              ],
            ],
          },
        ],
        pageNumber: 0,
        pageSize: 10,
        totalDocs: 1,
        totalPages: 1,
      } as any);
      mockGetFilterCronLogsByLimit.mockResolvedValue([]);
      (GetFilteredCrons as jest.Mock).mockResolvedValue([]);
      mockReq.query = {
        fromDate: "2025-02-24",
        toDate: "2025-02-24",
        pgno: "1",
        cronId: "c1",
        cronType: "Regular",
        totalRecords: "25",
      };
      await cronLogs.getCronHistoryLogs(mockReq as Request, mockRes as Response);
      expect(mockGetCronLogsV2).toHaveBeenCalled();
      expect(renderMock).toHaveBeenCalledWith(
        "pages/dashboard/cronHistory",
        expect.objectContaining({
          items: expect.any(Array),
          showSearchMessage: false,
          totalDocs: 1,
        })
      );
    });
    it("should use SCRAPE_ONLY and GetRunInfo when cronType is SCRAPE_ONLY", async () => {
      (GetCronSettingsList as jest.Mock).mockResolvedValue([]);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      (GetScrapeCrons as jest.Mock).mockResolvedValue([]);
      mockGetLatestCronStatus.mockResolvedValue([]);
      mockGetRunInfo.mockResolvedValue([] as any);
      mockGetFilterCronLogsByLimit.mockResolvedValue([]);
      (GetFilteredCrons as jest.Mock).mockResolvedValue([]);
      mockReq.query = {
        fromDate: "2025-02-24",
        toDate: "2025-02-24",
        cronType: "SCRAPE_ONLY",
        totalRecords: "25",
      };
      await cronLogs.getCronHistoryLogs(mockReq as Request, mockRes as Response);
      expect(mockGetRunInfo).toHaveBeenCalled();
      expect(renderMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ items: [], type: "SCRAPE_ONLY" }));
    });
    it("should use GetRunInfoByCron when SCRAPE_ONLY and cronId provided", async () => {
      (GetCronSettingsList as jest.Mock).mockResolvedValue([]);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      (GetScrapeCrons as jest.Mock).mockResolvedValue([]);
      mockGetLatestCronStatus.mockResolvedValue([]);
      mockGetRunInfoByCron.mockResolvedValue([] as any);
      mockGetFilterCronLogsByLimit.mockResolvedValue([]);
      (GetFilteredCrons as jest.Mock).mockResolvedValue([]);
      mockReq.query = {
        fromDate: "2025-02-24",
        toDate: "2025-02-24",
        cronType: "SCRAPE_ONLY",
        cronId: "scrape-cron-1",
        totalRecords: "25",
      };
      await cronLogs.getCronHistoryLogs(mockReq as Request, mockRes as Response);
      expect(mockGetRunInfoByCron).toHaveBeenCalledWith("25", expect.any(String), expect.any(String), "scrape-cron-1");
    });
    it("should clamp negative pgno to 0", async () => {
      (GetCronSettingsList as jest.Mock).mockResolvedValue([]);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      (GetScrapeCrons as jest.Mock).mockResolvedValue([]);
      mockGetLatestCronStatus.mockResolvedValue([]);
      mockGetCronLogsV2.mockResolvedValue({
        mongoResult: [],
        pageNumber: 0,
        pageSize: 10,
        totalDocs: 0,
        totalPages: 0,
      } as any);
      mockGetFilterCronLogsByLimit.mockResolvedValue([]);
      (GetFilteredCrons as jest.Mock).mockResolvedValue([]);
      mockReq.query = {
        fromDate: "2025-02-24",
        toDate: "2025-02-24",
        pgno: "-1",
        cronType: "Regular",
        totalRecords: "25",
      };
      await cronLogs.getCronHistoryLogs(mockReq as Request, mockRes as Response);
      expect(mockGetCronLogsV2).toHaveBeenCalledWith(0, "Regular", "", expect.any(Object), "25");
    });
  });

  describe("getCustomCronDetails", () => {
    it("should return json with log view model", async () => {
      mockGetCronLogsV2.mockResolvedValue({
        mongoResult: [
          {
            _id: "cc1",
            time: new Date(),
            cronId: "c1",
            logs: [
              [
                {
                  productId: "p1",
                  logs: { repriceData: { repriceDetails: {} } },
                  priceUpdateResponse: null,
                },
              ],
            ],
          },
        ],
        pageNumber: 0,
        pageSize: 25,
        totalDocs: 1,
        totalPages: 1,
      } as any);
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ CronId: "c1", CronName: "C1" }]);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      mockReq.body = {
        startDate: "2025-02-01",
        endDate: "2025-02-24",
        pgno: 1,
        cronType: "Regular",
        cronId: "c1",
        totalRecords: "25",
      };
      await cronLogs.getCustomCronDetails(mockReq as Request, mockRes as Response);
      expect(mockGetCronLogsV2).toHaveBeenCalledWith(0, "Regular", "c1", expect.any(Object), 25);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: expect.any(Array),
      });
    });
    it("should use empty cronId when cronId is ALL", async () => {
      mockGetCronLogsV2.mockResolvedValue({
        mongoResult: [],
        pageNumber: 0,
        pageSize: 25,
        totalDocs: 0,
        totalPages: 0,
      } as any);
      (GetCronSettingsList as jest.Mock).mockResolvedValue([]);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      mockReq.body = {
        startDate: "2025-02-01",
        endDate: "2025-02-24",
        pgno: 1,
        cronType: "Regular",
        cronId: "ALL",
        totalRecords: "25",
      };
      await cronLogs.getCustomCronDetails(mockReq as Request, mockRes as Response);
      expect(mockGetCronLogsV2).toHaveBeenCalledWith(0, "Regular", "", expect.any(Object), 25);
    });
    it("should clamp pgno to 0 when negative", async () => {
      mockGetCronLogsV2.mockResolvedValue({
        mongoResult: [],
        pageNumber: 0,
        pageSize: 25,
        totalDocs: 0,
        totalPages: 0,
      } as any);
      (GetCronSettingsList as jest.Mock).mockResolvedValue([]);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      mockReq.body = {
        startDate: "2025-02-01",
        endDate: "2025-02-24",
        pgno: -1,
        cronType: "Regular",
        cronId: "",
        totalRecords: "25",
      };
      await cronLogs.getCustomCronDetails(mockReq as Request, mockRes as Response);
      expect(mockGetCronLogsV2).toHaveBeenCalledWith(0, "Regular", "", expect.any(Object), 25);
    });
  });

  describe("exportBulkDataCRON", () => {
    it("should return early when in-progress export exists", async () => {
      mockCheckInProgressExport.mockResolvedValue([{ _id: "x" }] as any);
      await cronLogs.exportBulkDataCRON();
      expect(mockFetchQueuedExport).not.toHaveBeenCalled();
    });
    it("should return when no queued export", async () => {
      mockCheckInProgressExport.mockResolvedValue([]);
      mockFetchQueuedExport.mockResolvedValue(null);
      await cronLogs.exportBulkDataCRON();
      expect(mockFetchQueuedExport).toHaveBeenCalled();
    });
  });
});
