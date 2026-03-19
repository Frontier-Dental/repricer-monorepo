import { Request, Response } from "express";
import * as appLog from "../app-log";
import axios from "axios";
import { applicationConfig } from "../../utility/config";

jest.mock("axios");
jest.mock("../../utility/config", () => ({
  applicationConfig: {
    APP_LOG_PATH_ENDPOINT: "/api/app/logs",
    REPRICER_API_BASE_URL: "http://api.test",
    CLEAR_LOG_PATH_ENDPOINT: "/app/clear-logs",
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

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("App-Log Controller", () => {
  let mockReq: Partial<Request> & { query?: any; session?: any };
  let mockRes: Partial<Response>;
  let setHeaderMock: jest.Mock;
  let statusMock: jest.Mock;
  let endMock: jest.Mock;
  let redirectMock: jest.Mock;
  let renderMock: jest.Mock;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const todayStr16 = today.toISOString().slice(0, 16);

  beforeEach(() => {
    jest.clearAllMocks();
    setHeaderMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnThis();
    endMock = jest.fn();
    redirectMock = jest.fn();
    renderMock = jest.fn();
    mockRes = {
      setHeader: setHeaderMock,
      status: statusMock,
      end: endMock,
      redirect: redirectMock,
      render: renderMock,
    };
    mockReq = {
      query: {},
      session: { users_id: { userRole: "admin" } } as any,
    };
    mockWriteResolve.mockResolvedValue(undefined);
  });

  describe("excelExport", () => {
    it("should fetch logs, build workbook and stream xlsx with default query params", async () => {
      const logData = [
        {
          level: "info",
          dateTime: "2025-02-26T10:00:00Z",
          message: "Test",
          timeTaken: "1s",
          module: "repricer",
        },
      ];
      mockedAxios.get.mockResolvedValue({ data: logData });

      await appLog.excelExport(mockReq as Request, mockRes as Response);

      expect(mockedAxios.get).toHaveBeenCalledWith((applicationConfig as any).APP_LOG_PATH_ENDPOINT, {
        params: {
          startDate: todayStr,
          endDate: todayStr,
          logLevel: undefined,
          page: 1,
          keyWord: undefined,
          pageSize: 50,
        },
      });
      expect(mockAddWorksheet).toHaveBeenCalledWith("appLogs");
      expect(mockWorksheet.columns).toEqual([
        { header: "Level", key: "level", width: 10 },
        { header: "Date", key: "dateTime", width: 20 },
        { header: "Message", key: "message", width: 20 },
        { header: "Scrape Time", key: "timeTaken", width: 10 },
        { header: "Module", key: "module", width: 10 },
      ]);
      expect(mockAddRows).toHaveBeenCalledWith(logData);
      expect(setHeaderMock).toHaveBeenCalledWith("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(setHeaderMock).toHaveBeenCalledWith("Content-Disposition", "attachment; filename=" + "appLogs.xlsx");
      expect(mockWriteResolve).toHaveBeenCalledWith(mockRes);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(endMock).toHaveBeenCalled();
    });

    it("should use custom query params when provided", async () => {
      const logData: any[] = [];
      mockedAxios.get.mockResolvedValue({ data: logData });
      mockReq.query = {
        startDate: "2025-02-01",
        endDate: "2025-02-26",
        logLevel: "error",
        page: "2",
        keyWord: "scrape",
        pageSize: "25",
      };

      await appLog.excelExport(mockReq as Request, mockRes as Response);

      expect(mockedAxios.get).toHaveBeenCalledWith((applicationConfig as any).APP_LOG_PATH_ENDPOINT, {
        params: {
          startDate: "2025-02-01",
          endDate: "2025-02-26",
          logLevel: "error",
          page: 2,
          keyWord: "scrape",
          pageSize: 25,
        },
      });
      expect(mockAddRows).toHaveBeenCalledWith([]);
    });

    it("should default page to 1 and pageSize to 50 when invalid or missing", async () => {
      mockedAxios.get.mockResolvedValue({ data: [] });
      mockReq.query = { page: "abc", pageSize: "xyz" };

      await appLog.excelExport(mockReq as Request, mockRes as Response);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({ page: 1, pageSize: 50 }),
        })
      );
    });

    it("should paginate data and add only current page rows to worksheet", async () => {
      const manyLogs = Array.from({ length: 100 }, (_, i) => ({
        level: "info",
        dateTime: "2025-02-26",
        message: `Log ${i}`,
        timeTaken: "1s",
        module: "m",
      }));
      mockedAxios.get.mockResolvedValue({ data: manyLogs });
      mockReq.query = { page: "2", pageSize: "10" };

      await appLog.excelExport(mockReq as Request, mockRes as Response);

      expect(mockAddRows).toHaveBeenCalledWith(manyLogs.slice(10, 20));
    });

    it("should throw when axios get fails (catch returns undefined)", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      mockedAxios.get.mockRejectedValue(new Error("Network error"));

      await expect(appLog.excelExport(mockReq as Request, mockRes as Response)).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("clearLogs", () => {
    it("should call clear-logs endpoint and redirect to /logs", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      mockedAxios.get.mockResolvedValue({});

      await appLog.clearLogs(mockReq as Request, mockRes as Response);

      consoleSpy.mockRestore();

      const expectedUrl = (applicationConfig as any).REPRICER_API_BASE_URL + (applicationConfig as any).CLEAR_LOG_PATH_ENDPOINT;
      expect(mockedAxios.get).toHaveBeenCalledWith(expectedUrl);
      expect(redirectMock).toHaveBeenCalledWith("/logs");
    });

    it("should redirect to /logs even when axios fails", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      mockedAxios.get.mockRejectedValue(new Error("Clear failed"));

      await appLog.clearLogs(mockReq as Request, mockRes as Response);

      expect(redirectMock).toHaveBeenCalledWith("/logs");
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("GetAppLogs", () => {
    it("should render appLogs with default params and fetched logs when load_data is true", async () => {
      const logData = [
        {
          level: "error",
          dateTime: "2025-02-26T10:00:00Z",
          message: "Error message",
          timeTaken: "2s",
          module: "scrape",
        },
      ];
      mockedAxios.get.mockResolvedValue({ data: logData });
      mockReq.query = {};

      await appLog.GetAppLogs(mockReq as Request, mockRes as Response);

      expect(mockedAxios.get).toHaveBeenCalledWith((applicationConfig as any).REPRICER_API_BASE_URL + (applicationConfig as any).APP_LOG_PATH_ENDPOINT, {
        params: {
          startDate: todayStr16,
          endDate: todayStr16,
          logLevel: "error",
          page: 1,
          keyWord: undefined,
          pageSize: 50,
        },
      });
      expect(renderMock).toHaveBeenCalledWith(
        "pages/appLogs",
        expect.objectContaining({
          groupName: "logs",
          logs: logData,
          currentDate: todayStr,
          params: expect.objectContaining({
            startDate: todayStr16,
            endDate: todayStr16,
            logLevel: "error",
            page: 1,
            pageSize: 50,
          }),
          errors: [],
          userRole: "admin",
        })
      );
      const renderArg = renderMock.mock.calls[0][1];
      expect(renderArg.pagination).toEqual({
        currentPage: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
        nextPage: 2,
        prevPage: 0,
      });
    });

    it("should not fetch logs and render with empty data when load_data is false", async () => {
      mockReq.query = { load_data: "false" };

      await appLog.GetAppLogs(mockReq as Request, mockRes as Response);

      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(renderMock).toHaveBeenCalledWith(
        "pages/appLogs",
        expect.objectContaining({
          groupName: "logs",
          logs: [],
          errors: [],
          params: expect.objectContaining({
            logLevel: "error",
            page: 1,
            pageSize: 50,
          }),
        })
      );
      const renderArg = renderMock.mock.calls[0][1];
      expect(renderArg.pagination).toEqual({});
    });

    it("should add validation errors when startDate or endDate is empty", async () => {
      mockReq.query = {
        startDate: "",
        endDate: "2025-02-26",
        load_data: "true",
      };

      await appLog.GetAppLogs(mockReq as Request, mockRes as Response);

      expect(renderMock).toHaveBeenCalledWith(
        "pages/appLogs",
        expect.objectContaining({
          errors: ["startDate is required"],
        })
      );
    });

    it("should add validation error for missing endDate", async () => {
      mockReq.query = {
        startDate: "2025-02-01",
        endDate: "",
        load_data: "true",
      };

      await appLog.GetAppLogs(mockReq as Request, mockRes as Response);

      expect(renderMock).toHaveBeenCalledWith(
        "pages/appLogs",
        expect.objectContaining({
          errors: ["endDate is required"],
        })
      );
    });

    it("should add both validation errors when both startDate and endDate are empty", async () => {
      mockReq.query = {
        startDate: "",
        endDate: "",
        load_data: "true",
      };

      await appLog.GetAppLogs(mockReq as Request, mockRes as Response);

      expect(renderMock).toHaveBeenCalledWith(
        "pages/appLogs",
        expect.objectContaining({
          errors: ["startDate is required", "endDate is required"],
        })
      );
    });

    it("should use custom query params and pass userRole from session", async () => {
      mockedAxios.get.mockResolvedValue({ data: [] });
      mockReq.query = {
        startDate: "2025-02-01T00:00",
        endDate: "2025-02-26T23:59",
        logLevel: "info",
        page: "3",
        keyWord: "timeout",
        pageSize: "20",
      };
      (mockReq as any).session.users_id.userRole = "viewer";

      await appLog.GetAppLogs(mockReq as Request, mockRes as Response);

      expect(mockedAxios.get).toHaveBeenCalledWith(expect.any(String), {
        params: {
          startDate: "2025-02-01T00:00",
          endDate: "2025-02-26T23:59",
          logLevel: "info",
          page: 3,
          keyWord: "timeout",
          pageSize: 20,
        },
      });
      expect(renderMock).toHaveBeenCalledWith(
        "pages/appLogs",
        expect.objectContaining({
          userRole: "viewer",
          params: expect.objectContaining({
            logLevel: "info",
            page: 3,
            pageSize: 20,
          }),
        })
      );
    });

    it("should default page to 1 and pageSize to 50 when invalid", async () => {
      mockedAxios.get.mockResolvedValue({ data: [] });
      mockReq.query = {
        page: "invalid",
        pageSize: "invalid",
      };

      await appLog.GetAppLogs(mockReq as Request, mockRes as Response);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({ page: 1, pageSize: 50 }),
        })
      );
    });

    it("should build pagination with hasNextPage and hasPrevPage for middle page", async () => {
      const manyLogs = Array.from({ length: 50 }, (_, i) => ({
        level: "info",
        dateTime: "2025-02-26",
        message: `Log ${i}`,
        timeTaken: "1s",
        module: "m",
      }));
      mockedAxios.get.mockResolvedValue({ data: manyLogs });
      mockReq.query = { page: "2", pageSize: "10" };

      await appLog.GetAppLogs(mockReq as Request, mockRes as Response);

      const renderArg = renderMock.mock.calls[0][1];
      expect(renderArg.logs).toHaveLength(10);
      expect(renderArg.logs[0].message).toBe("Log 10");
      expect(renderArg.pagination).toEqual({
        currentPage: 2,
        totalPages: 5,
        hasNextPage: true,
        hasPrevPage: true,
        nextPage: 3,
        prevPage: 1,
      });
    });

    it("should not call axios when validation errors exist", async () => {
      mockReq.query = {
        startDate: "",
        endDate: "",
        load_data: "true",
      };

      await appLog.GetAppLogs(mockReq as Request, mockRes as Response);

      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(renderMock).toHaveBeenCalledWith(
        "pages/appLogs",
        expect.objectContaining({
          logs: [],
          errors: ["startDate is required", "endDate is required"],
          pagination: {},
        })
      );
    });

    it("should pass logsURL and currentDate to template", async () => {
      mockedAxios.get.mockResolvedValue({ data: [] });
      mockReq.query = {};

      await appLog.GetAppLogs(mockReq as Request, mockRes as Response);

      const expectedUrl = (applicationConfig as any).REPRICER_API_BASE_URL + (applicationConfig as any).APP_LOG_PATH_ENDPOINT;
      expect(renderMock).toHaveBeenCalledWith(
        "pages/appLogs",
        expect.objectContaining({
          logsURL: expectedUrl,
          currentDate: todayStr,
        })
      );
    });

    it("should throw when axios get fails and load_data is true with no validation errors", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      mockedAxios.get.mockRejectedValue(new Error("API error"));
      mockReq.query = {};

      await expect(appLog.GetAppLogs(mockReq as Request, mockRes as Response)).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
