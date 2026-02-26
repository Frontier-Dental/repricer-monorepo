import { Request, Response } from "express";
import * as history from "../history";
import * as mongoMiddleware from "../../services/mongo";
import * as SessionHelper from "../../utility/session-helper";
import * as historyExportMiddleware from "../../utility/history-export";
import * as ftpMiddleware from "../../services/ftp";
import { applicationConfig } from "../../utility/config";
import { InitExportStatus } from "../../services/mysql-v2";
import fs from "fs";
import path from "path";

jest.mock("../../services/mongo");
jest.mock("../../utility/session-helper");
jest.mock("../../utility/history-export");
jest.mock("../../services/ftp");
jest.mock("../../services/mysql-v2");
jest.mock("../../utility/config", () => ({
  applicationConfig: {
    HISTORY_LIMIT: 50,
    IS_DEV: false,
  },
}));

const mockWriteResolve = jest.fn().mockResolvedValue(undefined);
const mockAddRows = jest.fn();
const mockWorksheet = {
  columns: undefined as any,
  addRows: mockAddRows,
};
const mockAddWorksheet = jest.fn().mockReturnValue(mockWorksheet);
const mockWorkbook = {
  addWorksheet: mockAddWorksheet,
  xlsx: { write: mockWriteResolve },
};
jest.mock("exceljs", () => ({
  __esModule: true,
  default: {
    Workbook: jest.fn().mockImplementation(() => mockWorkbook),
  },
}));

describe("History Controller", () => {
  let mockReq: Partial<Request> & { session?: any; body?: any; query?: any; params?: any };
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let renderMock: jest.Mock;
  let setHeaderMock: jest.Mock;
  let statusMock: jest.Mock;
  let endMock: jest.Mock;
  let downloadMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn().mockReturnThis();
    renderMock = jest.fn();
    setHeaderMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnThis();
    endMock = jest.fn();
    downloadMock = jest.fn((_path: string, callback?: (err?: Error) => void) => {
      if (typeof callback === "function") callback();
    });
    mockRes = {
      json: jsonMock,
      render: renderMock,
      setHeader: setHeaderMock,
      status: statusMock,
      end: endMock,
      download: downloadMock,
    };
    mockReq = {
      body: {},
      query: {},
      params: {},
      session: { users_id: { userRole: "admin" } } as any,
    };
    mockWriteResolve.mockResolvedValue(undefined);
  });

  describe("getHistory", () => {
    it("should render history index with correct model and userRole", async () => {
      await history.getHistory(mockReq as Request, mockRes as Response);

      const maxProductsCount = 65;
      const expectedMaxCount = Math.ceil(maxProductsCount / (applicationConfig as any).HISTORY_LIMIT);
      expect(renderMock).toHaveBeenCalledWith("pages/history/index", {
        model: {
          maxCount: expectedMaxCount,
          batchLimit: (applicationConfig as any).HISTORY_LIMIT,
          totalCount: maxProductsCount,
        },
        groupName: "history",
        userRole: "admin",
      });
    });

    it("should use session userRole when present", async () => {
      (mockReq as any).session.users_id.userRole = "user";
      await history.getHistory(mockReq as Request, mockRes as Response);
      expect(renderMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userRole: "user" }));
    });

    it("should compute maxCount from HISTORY_LIMIT", async () => {
      (applicationConfig as any).HISTORY_LIMIT = 10;
      await history.getHistory(mockReq as Request, mockRes as Response);
      expect(renderMock).toHaveBeenCalledWith(
        "pages/history/index",
        expect.objectContaining({
          model: expect.objectContaining({
            maxCount: 7,
            batchLimit: 10,
            totalCount: 65,
          }),
        })
      );
    });
  });

  describe("exportHistory", () => {
    it("should export by mpId (srchMpId) without date range and set headers + write workbook", async () => {
      const param1 = "12345";
      mockReq.query = { searchBy: "srchMpId", param1, counter: "1" };
      const historicalLogs = [
        {
          refTime: new Date("2024-01-15T10:00:00Z"),
          historicalPrice: [
            {
              existingPrice: 10,
              minQty: 1,
              rank: 1,
              lowestVendor: "V1",
              lowestPrice: 9,
              maxVendor: "V2",
              maxVendorPrice: 12,
              suggestedPrice: 9.5,
              repriceComment: "OK",
              otherVendorList: "V1,V2",
              apiResponse: { foo: "bar" },
            },
          ],
        },
      ];
      (mongoMiddleware.GetHistoryDetailsForId as jest.Mock).mockResolvedValue({
        mpId: 12345,
        historicalLogs,
      });
      (mongoMiddleware.GetHistoryDetailsForIdByDate as jest.Mock).mockResolvedValue(null);

      await history.exportHistory(mockReq as Request, mockRes as Response);

      expect(mongoMiddleware.GetHistoryDetailsForId).toHaveBeenCalledWith(12345);
      expect(mongoMiddleware.GetHistoryDetailsForIdByDate).not.toHaveBeenCalled();
      expect(mockAddWorksheet).toHaveBeenCalledWith("HistoryList");
      expect(mockWorksheet.columns).toBeDefined();
      expect(mockAddRows).toHaveBeenCalled();
      expect(setHeaderMock).toHaveBeenCalledWith("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(setHeaderMock).toHaveBeenCalledWith("Content-Disposition", "attachment; filename=history_batch_1.xlsx");
      await expect(mockWriteResolve).toHaveBeenCalledWith(mockRes);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(endMock).toHaveBeenCalled();
    });

    it("should export by mpId with date range (param2, param3)", async () => {
      mockReq.query = {
        searchBy: "srchMpId",
        param1: "999",
        param2: "2024-01-01",
        param3: "2024-01-31",
        counter: "2",
      };
      (mongoMiddleware.GetHistoryDetailsForIdByDate as jest.Mock).mockResolvedValue({
        mpId: 999,
        historicalLogs: [
          {
            refTime: new Date("2024-01-10T12:00:00Z"),
            historicalPrice: [{ existingPrice: 5, minQty: 1 }],
          },
        ],
      });
      (mongoMiddleware.GetHistoryDetailsForId as jest.Mock).mockResolvedValue(null);

      await history.exportHistory(mockReq as Request, mockRes as Response);

      expect(mongoMiddleware.GetHistoryDetailsForIdByDate).toHaveBeenCalledWith(999, new Date("2024-01-01").setHours(0, 0, 0, 0), new Date("2024-01-31").setHours(23, 59, 59, 59));
      expect(mongoMiddleware.GetHistoryDetailsForId).not.toHaveBeenCalled();
      expect(mockAddRows).toHaveBeenCalled();
      expect(setHeaderMock).toHaveBeenCalledWith("Content-Disposition", "attachment; filename=history_batch_2.xlsx");
    });

    it("should export by date range (srchDate) and flatten multiple mp responses", async () => {
      mockReq.query = {
        searchBy: "srchDate",
        param1: "2024-01-01",
        param2: "2024-01-31",
        counter: "1",
      };
      const mongoResponse = [
        {
          mpId: 100,
          historicalLogs: [
            {
              refTime: new Date("2024-01-15T10:00:00Z"),
              historicalPrice: [{ existingPrice: 10, minQty: 1, apiResponse: null }],
            },
          ],
        },
        {
          mpId: 101,
          historicalLogs: [
            {
              refTime: new Date("2024-01-16T10:00:00Z"),
              historicalPrice: [{ existingPrice: 20 }],
            },
          ],
        },
      ];
      (mongoMiddleware.GetHistoryDetailsForDateRange as jest.Mock).mockResolvedValue(mongoResponse);

      await history.exportHistory(mockReq as Request, mockRes as Response);

      expect(mongoMiddleware.GetHistoryDetailsForDateRange).toHaveBeenCalledWith(new Date("2024-01-01").setHours(0, 0, 0, 0), new Date("2024-01-31").setHours(23, 59, 59, 59), "1");
      expect(mockAddRows).toHaveBeenCalled();
      const rows = mockAddRows.mock.calls[0][0];
      expect(rows.length).toBe(2);
      expect(rows[0].mpId).toBe(100);
      expect(rows[1].mpId).toBe(101);
      expect(rows[0].api_response).toBe("N/A");
    });

    it("should still write workbook when srchMpId returns no historicalLogs", async () => {
      mockReq.query = { searchBy: "srchMpId", param1: "1", counter: "1" };
      (mongoMiddleware.GetHistoryDetailsForId as jest.Mock).mockResolvedValue({
        mpId: 1,
        historicalLogs: [],
      });

      await history.exportHistory(mockReq as Request, mockRes as Response);

      expect(mockAddRows).toHaveBeenCalledWith([]);
      expect(setHeaderMock).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should still write workbook when srchMpId returns null mongoResponse", async () => {
      mockReq.query = { searchBy: "srchMpId", param1: "1", counter: "1" };
      (mongoMiddleware.GetHistoryDetailsForId as jest.Mock).mockResolvedValue(null);

      await history.exportHistory(mockReq as Request, mockRes as Response);

      expect(mockAddRows).toHaveBeenCalledWith([]);
    });

    it("should still write workbook when srchDate returns empty array", async () => {
      mockReq.query = {
        searchBy: "srchDate",
        param1: "2024-01-01",
        param2: "2024-01-31",
        counter: "1",
      };
      (mongoMiddleware.GetHistoryDetailsForDateRange as jest.Mock).mockResolvedValue([]);

      await history.exportHistory(mockReq as Request, mockRes as Response);

      expect(mockAddRows).toHaveBeenCalledWith([]);
    });

    it("should skip mp entries with empty historicalLogs for srchDate", async () => {
      mockReq.query = {
        searchBy: "srchDate",
        param1: "2024-01-01",
        param2: "2024-01-31",
        counter: "1",
      };
      (mongoMiddleware.GetHistoryDetailsForDateRange as jest.Mock).mockResolvedValue([
        { mpId: 1, historicalLogs: [] },
        { mpId: 2, historicalLogs: [{ refTime: new Date(), historicalPrice: [{ x: 1 }] }] },
      ]);

      await history.exportHistory(mockReq as Request, mockRes as Response);

      expect(mockAddRows).toHaveBeenCalled();
      const rows = mockAddRows.mock.calls[0][0];
      expect(rows.length).toBe(1);
      expect(rows[0].mpId).toBe(2);
    });

    it("should skip logs with no historicalPrice in flattenObject", async () => {
      mockReq.query = { searchBy: "srchMpId", param1: "1", counter: "1" };
      (mongoMiddleware.GetHistoryDetailsForId as jest.Mock).mockResolvedValue({
        mpId: 1,
        historicalLogs: [
          { refTime: new Date(), historicalPrice: [] },
          { refTime: new Date(), historicalPrice: undefined },
        ],
      });

      await history.exportHistory(mockReq as Request, mockRes as Response);

      expect(mockAddRows).toHaveBeenCalledWith([]);
    });

    it("should write empty workbook when searchBy is neither srchMpId nor srchDate", async () => {
      mockReq.query = { searchBy: "unknown", counter: "1" };

      await history.exportHistory(mockReq as Request, mockRes as Response);

      expect(mongoMiddleware.GetHistoryDetailsForId).not.toHaveBeenCalled();
      expect(mongoMiddleware.GetHistoryDetailsForIdByDate).not.toHaveBeenCalled();
      expect(mongoMiddleware.GetHistoryDetailsForDateRange).not.toHaveBeenCalled();
      expect(mockAddRows).toHaveBeenCalledWith([]);
      expect(setHeaderMock).toHaveBeenCalledWith("Content-Disposition", "attachment; filename=history_batch_1.xlsx");
      expect(statusMock).toHaveBeenCalledWith(200);
    });
  });

  describe("getAllHistory", () => {
    it("should init export status, trigger ExportAndSaveV2 and return success json", async () => {
      mockReq.body = { param1: "2024-01-01", param2: "2024-01-31" };
      const auditInfo = { UpdatedBy: "user1", UpdatedOn: new Date() };
      (SessionHelper.GetAuditInfo as jest.Mock).mockResolvedValue(auditInfo);
      (InitExportStatus as jest.Mock).mockResolvedValue(undefined);

      await history.getAllHistory(mockReq as Request, mockRes as Response);

      expect(SessionHelper.GetAuditInfo).toHaveBeenCalledWith(mockReq);
      expect(InitExportStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "IN-PROGRESS",
          requestedBy: "user1",
        })
      );
      expect(InitExportStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: expect.stringMatching(/^history-[a-f0-9]+-2024-01-01-TO-2024-01-31\.csv$/),
        })
      );
      expect(historyExportMiddleware.ExportAndSaveV2).toHaveBeenCalledWith(new Date("2024-01-01").setHours(0, 0, 0, 0), new Date("2024-01-31").setHours(23, 59, 59, 59), expect.stringMatching(/^history-[a-f0-9]+-2024-01-01-TO-2024-01-31\.csv$/), auditInfo);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: expect.stringContaining("export request is being worked upon"),
      });
      expect(jsonMock.mock.calls[0][0].message).toContain("FileName :");
    });
  });

  describe("getHistoryById", () => {
    it("should init export status, trigger ExportAndSaveByIdV2 and return success json", async () => {
      mockReq.body = { param1: " 12345 ", param2: "2024-01-01", param3: "2024-01-31" };
      const auditInfo = { UpdatedBy: "admin", UpdatedOn: new Date() };
      (SessionHelper.GetAuditInfo as jest.Mock).mockResolvedValue(auditInfo);
      (InitExportStatus as jest.Mock).mockResolvedValue(undefined);

      await history.getHistoryById(mockReq as Request, mockRes as Response);

      expect(SessionHelper.GetAuditInfo).toHaveBeenCalledWith(mockReq);
      expect(InitExportStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "IN-PROGRESS",
          requestedBy: "admin",
        })
      );
      expect(historyExportMiddleware.ExportAndSaveByIdV2).toHaveBeenCalledWith("12345", new Date("2024-01-01").setHours(0, 0, 0, 0), new Date("2024-01-31").setHours(23, 59, 59, 59), expect.stringMatching(/^history-[a-f0-9]+-.*12345.*-2024-01-01-TO-2024-01-31\.csv$/), auditInfo);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: expect.stringContaining("export request is being worked upon"),
      });
    });
  });

  describe("downloadFile", () => {
    let pathJoinSpy: jest.SpyInstance;
    let unlinkSpy: jest.SpyInstance;

    beforeEach(() => {
      (ftpMiddleware.DownloadFile as jest.Mock).mockResolvedValue(undefined);
      pathJoinSpy = jest.spyOn(path, "join").mockImplementation((...args: string[]) => args.join("/"));
      unlinkSpy = jest.spyOn(fs, "unlink").mockImplementation(((_path: string, cb: (err?: NodeJS.ErrnoException | null) => void) => {
        if (cb) cb(null);
      }) as any);
    });

    afterEach(() => {
      pathJoinSpy?.mockRestore();
      unlinkSpy?.mockRestore();
    });

    it("should use prod path when IS_DEV is false and download file", async () => {
      (applicationConfig as any).IS_DEV = false;
      mockReq.params = { file: "history-abc-1-2.csv" };

      await history.downloadFile(mockReq as Request, mockRes as Response);

      expect(ftpMiddleware.DownloadFile).toHaveBeenCalledWith("/REPRICER/HISTORY/history-abc-1-2.csv", expect.any(String));
      expect(downloadMock).toHaveBeenCalledWith(expect.any(String), expect.any(Function));
    });

    it("should use dev path when IS_DEV is true", async () => {
      (applicationConfig as any).IS_DEV = true;
      mockReq.params = { file: "history-dev.csv" };

      await history.downloadFile(mockReq as Request, mockRes as Response);

      expect(ftpMiddleware.DownloadFile).toHaveBeenCalledWith("/REPRICER/DEV_HISTORY/history-dev.csv", expect.any(String));
    });

    it("should send 500 when download callback receives error", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      (applicationConfig as any).IS_DEV = false;
      mockReq.params = { file: "missing.csv" };
      downloadMock.mockImplementation((_path: string, callback?: (err?: Error) => void) => {
        if (typeof callback === "function") callback(new Error("File not found"));
      });
      const sendMock = jest.fn().mockReturnThis();
      (mockRes as any).send = sendMock;

      await history.downloadFile(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(sendMock).toHaveBeenCalledWith("Error downloading file");
      consoleSpy.mockRestore();
    });

    it("should unlink file after successful download", async () => {
      (applicationConfig as any).IS_DEV = false;
      mockReq.params = { file: "done.csv" };

      await history.downloadFile(mockReq as Request, mockRes as Response);

      const [, downloadCallback] = downloadMock.mock.calls[0];
      (downloadCallback as (err?: Error) => void)();
      expect(unlinkSpy).toHaveBeenCalled();
    });

    it("should not throw when unlink fails in callback", async () => {
      unlinkSpy.mockImplementation(((_path: string, cb: (err?: NodeJS.ErrnoException | null) => void) => {
        if (cb) cb(new Error("unlink failed") as NodeJS.ErrnoException);
      }) as any);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      (applicationConfig as any).IS_DEV = false;
      mockReq.params = { file: "x.csv" };

      await history.downloadFile(mockReq as Request, mockRes as Response);

      const [, downloadCallback] = downloadMock.mock.calls[0];
      (downloadCallback as (err?: Error) => void)();
      expect(unlinkSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
