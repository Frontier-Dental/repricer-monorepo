import axios from "axios";
import { Response } from "express";
import { ExcelExportService, ExcelExportFilters } from "../excel-export.service";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("ExcelExportService", () => {
  const originalEnv = process.env;
  let mockRes: jest.Mocked<Pick<Response, "setHeader" | "write" | "end">> & {
    pipeTarget: NodeJS.WritableStream | null;
  };
  let mockStream: { pipe: jest.Mock };
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };

    mockStream = {
      pipe: jest.fn(function (this: unknown, dest: NodeJS.WritableStream) {
        (mockRes as typeof mockRes & { pipeTarget: NodeJS.WritableStream | null }).pipeTarget = dest;
        return dest;
      }),
    };

    mockRes = {
      setHeader: jest.fn(),
      pipeTarget: null,
    } as any;

    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    process.env = originalEnv;
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("downloadExcel", () => {
    it("should forward request to export service and pipe stream to response", async () => {
      const filters: ExcelExportFilters = {
        tags: "electronics",
        activated: true,
        cronId: "cron-1",
        channelName: "Amazon",
      };
      const contentDisposition = "attachment; filename=export_123.xlsx";
      mockedAxios.post.mockResolvedValue({
        status: 200,
        headers: { "content-disposition": contentDisposition },
        data: mockStream,
      });

      await ExcelExportService.downloadExcel(filters, mockRes as unknown as Response);

      expect(consoleLogSpy).toHaveBeenCalledWith("Forwarding Excel download request to export service");
      const baseUrl = process.env.EXCEL_EXPORT_SERVICE_URL || "http://localhost:3003";
      expect(mockedAxios.post).toHaveBeenCalledWith(`${baseUrl}/api/excel/download`, filters, {
        responseType: "stream",
        headers: { "Content-Type": "application/json" },
      });
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Disposition", contentDisposition);
      expect(mockStream.pipe).toHaveBeenCalledWith(mockRes);
    });

    it("should use fallback filename when content-disposition header is missing", async () => {
      const filters: ExcelExportFilters = {};
      const before = Date.now();
      mockedAxios.post.mockResolvedValue({
        status: 200,
        headers: {},
        data: mockStream,
      });

      await ExcelExportService.downloadExcel(filters, mockRes as unknown as Response);

      const after = Date.now();
      expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Disposition", expect.stringMatching(/^attachment; filename=items_export_\d+\.xlsx$/));
      const filename = (mockRes.setHeader as jest.Mock).mock.calls.find((c: string[]) => c[0] === "Content-Disposition")?.[1];
      const timestamp = parseInt(filename!.match(/\d+/)?.[0] ?? "0", 10);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after + 1000);
    });

    it("should forward partial filters (only some fields)", async () => {
      const filters: ExcelExportFilters = {
        tags: "books",
        activated: "true",
      };
      mockedAxios.post.mockResolvedValue({
        status: 200,
        headers: { "content-disposition": "attachment; filename=out.xlsx" },
        data: mockStream,
      });

      await ExcelExportService.downloadExcel(filters, mockRes as unknown as Response);

      expect(mockedAxios.post).toHaveBeenCalledWith(expect.any(String), { tags: "books", activated: "true" }, expect.any(Object));
    });

    it("should use default EXCEL_EXPORT_SERVICE_URL when env is not set", async () => {
      const filters: ExcelExportFilters = {};
      mockedAxios.post.mockResolvedValue({
        status: 200,
        headers: {},
        data: mockStream,
      });

      await ExcelExportService.downloadExcel(filters, mockRes as unknown as Response);

      expect(mockedAxios.post).toHaveBeenCalledWith("http://localhost:3003/api/excel/download", {}, expect.any(Object));
    });

    it("should log and rethrow on axios error", async () => {
      const filters: ExcelExportFilters = { cronId: "cron-1" };
      const err = new Error("Network error");
      mockedAxios.post.mockRejectedValue(err);

      await expect(ExcelExportService.downloadExcel(filters, mockRes as unknown as Response)).rejects.toThrow("Network error");

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error forwarding Excel download request:", err);
      expect(mockRes.setHeader).not.toHaveBeenCalled();
      expect(mockStream.pipe).not.toHaveBeenCalled();
    });

    it("should rethrow non-Error rejections", async () => {
      const filters: ExcelExportFilters = {};
      mockedAxios.post.mockRejectedValue("string error");

      await expect(ExcelExportService.downloadExcel(filters, mockRes as unknown as Response)).rejects.toBe("string error");

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("downloadExcelByMpids", () => {
    it("should forward mpids to export service and pipe stream to response", async () => {
      const mpids = ["mp1", "mp2", "mp3"];
      const contentDisposition = "attachment; filename=by_mpids.xlsx";
      mockedAxios.post.mockResolvedValue({
        status: 200,
        headers: { "content-disposition": contentDisposition },
        data: mockStream,
      });

      await ExcelExportService.downloadExcelByMpids(mpids, mockRes as unknown as Response);

      expect(consoleLogSpy).toHaveBeenCalledWith("Forwarding Excel download request for 3 MPIDs to export service");
      const baseUrl = process.env.EXCEL_EXPORT_SERVICE_URL || "http://localhost:3003";
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${baseUrl}/api/excel/download-by-mpids`,
        { mpids },
        {
          responseType: "stream",
          headers: { "Content-Type": "application/json" },
        }
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Disposition", contentDisposition);
      expect(mockStream.pipe).toHaveBeenCalledWith(mockRes);
    });

    it("should use fallback filename when content-disposition is missing", async () => {
      const mpids = ["mp1"];
      mockedAxios.post.mockResolvedValue({
        status: 200,
        headers: {},
        data: mockStream,
      });

      await ExcelExportService.downloadExcelByMpids(mpids, mockRes as unknown as Response);

      expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Disposition", expect.stringMatching(/^attachment; filename=items_export_\d+\.xlsx$/));
    });

    it("should handle empty mpids array", async () => {
      const mpids: string[] = [];
      mockedAxios.post.mockResolvedValue({
        status: 200,
        headers: {},
        data: mockStream,
      });

      await ExcelExportService.downloadExcelByMpids(mpids, mockRes as unknown as Response);

      expect(consoleLogSpy).toHaveBeenCalledWith("Forwarding Excel download request for 0 MPIDs to export service");
      expect(mockedAxios.post).toHaveBeenCalledWith(expect.any(String), { mpids: [] }, expect.any(Object));
    });

    it("should use default EXCEL_EXPORT_SERVICE_URL when env is not set", async () => {
      const mpids = ["mp1"];
      mockedAxios.post.mockResolvedValue({
        status: 200,
        headers: {},
        data: mockStream,
      });

      await ExcelExportService.downloadExcelByMpids(mpids, mockRes as unknown as Response);

      expect(mockedAxios.post).toHaveBeenCalledWith("http://localhost:3003/api/excel/download-by-mpids", { mpids: ["mp1"] }, expect.any(Object));
    });

    it("should log and rethrow on axios error", async () => {
      const mpids = ["mp1", "mp2"];
      const err = new Error("Connection refused");
      mockedAxios.post.mockRejectedValue(err);

      await expect(ExcelExportService.downloadExcelByMpids(mpids, mockRes as unknown as Response)).rejects.toThrow("Connection refused");

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error forwarding Excel download request:", err);
      expect(mockRes.setHeader).not.toHaveBeenCalled();
    });

    it("should rethrow non-Error rejections", async () => {
      const mpids = ["mp1"];
      mockedAxios.post.mockRejectedValue({ code: "ECONNREFUSED" });

      await expect(ExcelExportService.downloadExcelByMpids(mpids, mockRes as unknown as Response)).rejects.toEqual({ code: "ECONNREFUSED" });

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("checkServiceStatus", () => {
    it("should return true when health endpoint returns 200", async () => {
      mockedAxios.get.mockResolvedValue({ status: 200 });

      const result = await ExcelExportService.checkServiceStatus();

      expect(result).toBe(true);
      const baseUrl = process.env.EXCEL_EXPORT_SERVICE_URL || "http://localhost:3003";
      expect(mockedAxios.get).toHaveBeenCalledWith(`${baseUrl}/health`);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("should return false when health endpoint returns non-200", async () => {
      mockedAxios.get.mockResolvedValue({ status: 503 });

      const result = await ExcelExportService.checkServiceStatus();

      expect(result).toBe(false);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("should return false when health request throws", async () => {
      const err = new Error("Network error");
      mockedAxios.get.mockRejectedValue(err);

      const result = await ExcelExportService.checkServiceStatus();

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith("Excel export service is not available:", err);
    });

    it("should use default EXCEL_EXPORT_SERVICE_URL for health check", async () => {
      mockedAxios.get.mockResolvedValue({ status: 200 });

      await ExcelExportService.checkServiceStatus();

      expect(mockedAxios.get).toHaveBeenCalledWith("http://localhost:3003/health");
    });

    it("should return false on timeout", async () => {
      mockedAxios.get.mockRejectedValue(new Error("timeout of 5000ms exceeded"));

      const result = await ExcelExportService.checkServiceStatus();

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("ExcelExportFilters type", () => {
    it("should accept all optional filter fields", () => {
      const filters: ExcelExportFilters = {
        tags: "tag1",
        activated: true,
        cronId: "cron-1",
        channelName: "eBay",
      };
      expect(filters.tags).toBe("tag1");
      expect(filters.activated).toBe(true);
      expect(filters.cronId).toBe("cron-1");
      expect(filters.channelName).toBe("eBay");
    });

    it("should accept string for activated", () => {
      const filters: ExcelExportFilters = { activated: "true" };
      expect(filters.activated).toBe("true");
    });

    it("should accept empty object as filters", () => {
      const filters: ExcelExportFilters = {};
      expect(Object.keys(filters)).toHaveLength(0);
    });
  });
});
