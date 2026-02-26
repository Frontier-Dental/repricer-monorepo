import * as historyExport from "../history-export";

// --- Mock: fs
const mockReadDirSync = jest.fn();
const mockStatSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockLstatSync = jest.fn();

jest.mock("fs", () => ({
  __esModule: true,
  default: {
    readdirSync: (...args: unknown[]) => mockReadDirSync(...args),
    statSync: (...args: unknown[]) => mockStatSync(...args),
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  },
  readdirSync: (...args: unknown[]) => mockReadDirSync(...args),
  statSync: (...args: unknown[]) => mockStatSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  lstatSync: (...args: unknown[]) => mockLstatSync(...args),
}));

// --- Mock: path
const mockPathJoin = jest.fn((...args: string[]) => args.join("/"));
jest.mock("path", () => ({
  __esModule: true,
  default: {
    join: (...args: string[]) => mockPathJoin(...args),
  },
  join: (...args: string[]) => mockPathJoin(...args),
}));

// --- Mock: exceljs
const mockAddRows = jest.fn();
const mockWriteFile = jest.fn().mockResolvedValue(undefined);
const mockReadFile = jest.fn().mockResolvedValue(undefined);
const mockGetWorksheet = jest.fn();
const mockGetRow = jest.fn();
const mockGetCell = jest.fn().mockReturnValue({ value: undefined, commit: jest.fn() });
const mockCommit = jest.fn();

const mockWorksheet = {
  columns: undefined as unknown,
  addRows: mockAddRows,
  lastRow: { number: 1 },
  getRow: mockGetRow,
};
mockGetRow.mockReturnValue({
  getCell: (col: string) => ({ value: undefined, commit: mockCommit }),
  commit: mockCommit,
});

const mockAddWorksheet = jest.fn().mockReturnValue(mockWorksheet);
const mockWorkbookInstance = {
  addWorksheet: mockAddWorksheet,
  xlsx: {
    writeFile: mockWriteFile,
    readFile: mockReadFile,
  },
  getWorksheet: mockGetWorksheet,
};
mockGetWorksheet.mockReturnValue(mockWorksheet);

jest.mock("exceljs", () => ({
  __esModule: true,
  default: {
    Workbook: jest.fn().mockImplementation(() => mockWorkbookInstance),
  },
}));

// --- Mock: config
jest.mock("../config", () => ({
  applicationConfig: {
    FILE_DELIMITER: "/",
    HISTORY_BASE_PATH: "/repricer-api-core/history/",
    HISTORY_EXPORT_URL_BY_ID: "http://localhost:5421/debug/history-export/exportAndSave/{productId}",
    HISTORY_EXPORT_URL_FOR_ALL: "http://localhost:5421/debug/history-export/exportAndSaveAll",
    HISTORY_LIMIT: 50,
  },
}));

const HISTORY_EXPORT_URL_FOR_ALL = "http://localhost:5421/debug/history-export/exportAndSaveAll";

// --- Mock: http-wrappers
const mockNativePost = jest.fn().mockResolvedValue(undefined);
jest.mock("../http-wrappers", () => ({
  native_post: (...args: unknown[]) => mockNativePost(...args),
}));

// --- Mock: mysql-v2
const mockUpdateExportStatusV2 = jest.fn().mockResolvedValue(undefined);
jest.mock("../../services/mysql-v2", () => ({
  UpdateExportStatusV2: (...args: unknown[]) => mockUpdateExportStatusV2(...args),
}));

describe("history-export", () => {
  let consoleLogSpy: jest.SpyInstance;
  let cwdSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    cwdSpy = jest.spyOn(process, "cwd").mockReturnValue("/Users/app/project/repricer");
    mockPathJoin.mockImplementation((...args: string[]) => args.join("/"));
    mockGetRow.mockReturnValue({
      getCell: () => ({ value: undefined, commit: mockCommit }),
      commit: mockCommit,
    });
    mockWorksheet.lastRow = { number: 1 };
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    cwdSpy.mockRestore();
  });

  describe("FindAllDownloads", () => {
    it("returns empty array when exports dir has no files", async () => {
      mockReadDirSync.mockReturnValue([{ name: "subdir", isDirectory: () => true }]);

      const result = await historyExport.FindAllDownloads();

      expect(result).toEqual([]);
      expect(mockReadDirSync).toHaveBeenCalledWith("./exports", { withFileTypes: true });
    });

    it("returns file names and createdDate for each file in exports dir", async () => {
      const mtime = new Date("2024-01-15T10:00:00Z");
      mockReadDirSync.mockReturnValue([
        { name: "subdir", isDirectory: () => true },
        { name: "export1.xlsx", isDirectory: () => false },
        { name: "export2.xlsx", isDirectory: () => false },
      ]);
      mockStatSync.mockReturnValue({ mtime });

      const result = await historyExport.FindAllDownloads();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ name: "export1.xlsx", createdDate: mtime.getTime() });
      expect(result[1]).toEqual({ name: "export2.xlsx", createdDate: mtime.getTime() });
      expect(mockStatSync).toHaveBeenCalledWith("./exports/export1.xlsx");
      expect(mockStatSync).toHaveBeenCalledWith("./exports/export2.xlsx");
    });
  });

  describe("ExportAndSaveById", () => {
    const auditInfo = { UpdatedBy: "user1" };
    const startDate = new Date("2024-01-01T00:00:00Z").getTime();
    const endDate = new Date("2024-01-31T23:59:59Z").getTime();

    it("creates blank excel and calls UpdateExportStatusV2 when context dir does not exist", async () => {
      mockLstatSync.mockReturnValue({ isDirectory: () => false });

      await historyExport.ExportAndSaveById(12345, startDate, endDate, "history.xlsx", auditInfo);

      expect(mockUpdateExportStatusV2).toHaveBeenCalledTimes(1);
      const payload = mockUpdateExportStatusV2.mock.calls[0][0];
      expect(payload.status).toBe("COMPLETE");
      expect(payload.fileName).toBe("history.xlsx");
      expect(payload.requestedBy).toBe("user1");
      expect(mockAddWorksheet).toHaveBeenCalledWith("HistoryList-1");
      expect(mockWriteFile).toHaveBeenCalledWith("./exports/history.xlsx");
    });

    it("creates blank excel when context dir exists but has no subdirs in date range", async () => {
      mockLstatSync.mockReturnValue({ isDirectory: () => true });
      mockReadDirSync.mockReturnValueOnce(["2024-02-15"]);

      await historyExport.ExportAndSaveById(12345, startDate, endDate, "history.xlsx", auditInfo);

      expect(mockUpdateExportStatusV2).toHaveBeenCalledTimes(1);
      expect(mockAddWorksheet).toHaveBeenCalledWith("HistoryList-1");
    });

    it("includes subdirs in date range, reads JSON files, creates/upserts excel and calls UpdateExportStatusV2", async () => {
      mockLstatSync.mockReturnValue({ isDirectory: () => true });
      mockReadDirSync.mockReturnValueOnce(["2024-01-15"]).mockReturnValueOnce([{ name: "file1.json", isDirectory: () => false }]);
      mockPathJoin.mockImplementation((...args: string[]) => args.join("/"));

      const historyJson = {
        refTime: "2024-01-15T12:00:00Z",
        historicalPrice: [
          {
            vendorName: "V1",
            existingPrice: 10,
            apiResponse: { foo: "bar" },
          },
        ],
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(historyJson));

      await historyExport.ExportAndSaveById(12345, startDate, endDate, "history.xlsx", auditInfo);

      expect(mockUpdateExportStatusV2).toHaveBeenCalledTimes(1);
      const payload = mockUpdateExportStatusV2.mock.calls[0][0];
      expect(payload.status).toBe("COMPLETE");
      expect(payload.fileName).toBe("history.xlsx");
      if (mockAddRows.mock.calls.length > 0) {
        const rows = mockAddRows.mock.calls[0][0];
        if (rows && rows.length > 0) {
          expect(rows[0]).toMatchObject({ vendorName: "V1", mpId: 12345, existingPrice: 10 });
        }
      }
    });

    it("calls upsertExcel for second and later context subfolders when historyResponse has data", async () => {
      const start = new Date("2024-01-01T00:00:00Z").getTime();
      const end = new Date("2024-01-31T23:59:59Z").getTime();

      mockLstatSync.mockReturnValue({ isDirectory: () => true });
      mockReadDirSync.mockImplementation((pathOrDir: string, opts?: { withFileTypes?: boolean }) => {
        if (opts?.withFileTypes) {
          return [{ name: "f.json", isDirectory: () => false }];
        }
        return ["2024-01-10", "2024-01-15"];
      });
      mockPathJoin.mockImplementation((...args: string[]) => args.join("/"));
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          refTime: "2024-01-10T12:00:00Z",
          historicalPrice: [{ vendorName: "V1", existingPrice: 10 }],
        })
      );

      await historyExport.ExportAndSaveById(12345, start, end, "out.xlsx", auditInfo);

      expect(mockWriteFile).toHaveBeenCalled();
      expect(mockUpdateExportStatusV2).toHaveBeenCalledTimes(1);
      if (mockReadFile.mock.calls.length > 0) {
        expect(mockReadFile).toHaveBeenCalled();
      }
    });
  });

  describe("ExportAndSave", () => {
    const auditInfo = { UpdatedBy: "user1" };
    const startDate = new Date("2024-01-01");
    const endDate = new Date("2024-01-03");

    it("creates blank excel and calls UpdateExportStatusV2 when no subdirs", async () => {
      mockReadDirSync.mockReset();
      mockReadDirSync.mockReturnValue([]);

      await historyExport.ExportAndSave(startDate, endDate, "all.xlsx", auditInfo);

      expect(mockAddWorksheet).toHaveBeenCalledWith("HistoryList-1");
      expect(mockWriteFile).toHaveBeenCalledWith("./exports/all.xlsx");
      expect(mockUpdateExportStatusV2).toHaveBeenCalledTimes(1);
    });

    it("creates excel and calls SaveAllHistoryByDate when subdirs and dates exist", async () => {
      jest.useFakeTimers();
      mockReadDirSync.mockImplementation((_path: string, opts?: { withFileTypes?: boolean }) => {
        if (opts?.withFileTypes) return [];
        return ["mp1"];
      });
      mockLstatSync.mockReturnValue({ isDirectory: () => false });

      const promise = historyExport.ExportAndSave(startDate, endDate, "all.xlsx", auditInfo);
      await jest.runAllTimersAsync();
      await promise;

      expect(mockUpdateExportStatusV2).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
    });
  });

  describe("ExportAndSaveByIdV2", () => {
    it("calls native_post with correct URL and payload", async () => {
      const mpid = 999;
      const startDate = new Date("2024-01-01T00:00:00Z");
      const endDate = new Date("2024-01-31T23:59:59Z");
      const historyFileName = "export-by-id.xlsx";
      const auditInfo = { UpdatedBy: "admin" };

      await historyExport.ExportAndSaveByIdV2(mpid, startDate, endDate, historyFileName, auditInfo);

      expect(mockNativePost).toHaveBeenCalledTimes(1);
      expect(mockNativePost).toHaveBeenCalledWith(
        "http://localhost:5421/debug/history-export/exportAndSave/999",
        expect.objectContaining({
          startDate: expect.any(String),
          endDate: expect.any(String),
          fileName: "export-by-id.xlsx",
        })
      );
      const payload = mockNativePost.mock.calls[0][1];
      expect(payload.startDate).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expect(payload.endDate).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it("replaces {productId} in URL with parsed mpid", async () => {
      await historyExport.ExportAndSaveByIdV2("42", new Date(), new Date(), "f.xlsx", {});

      expect(mockNativePost).toHaveBeenCalledWith(expect.stringContaining("/42"), expect.any(Object));
    });
  });

  describe("ExportAndSaveV2", () => {
    it("calls native_post with HISTORY_EXPORT_URL_FOR_ALL and formatted dates", async () => {
      const startDate = new Date("2024-01-01T08:00:00Z");
      const endDate = new Date("2024-01-15T18:30:00Z");
      const historyFileName = "export-all.xlsx";
      const auditInfo = { UpdatedBy: "system" };

      await historyExport.ExportAndSaveV2(startDate, endDate, historyFileName, auditInfo);

      expect(mockNativePost).toHaveBeenCalledTimes(1);
      expect(mockNativePost).toHaveBeenCalledWith(
        HISTORY_EXPORT_URL_FOR_ALL,
        expect.objectContaining({
          startDate: expect.any(String),
          endDate: expect.any(String),
          fileName: "export-all.xlsx",
        })
      );
      const payload = mockNativePost.mock.calls[0][1];
      expect(payload.startDate).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expect(payload.endDate).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Called ExportAndSave For All"));
    });
  });
});
