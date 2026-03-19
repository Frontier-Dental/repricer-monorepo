import fs from "fs";
import { GetAllFileDetails, DownloadFile } from "../ftp";

interface MockFtpInstance {
  connect: jest.Mock;
  list: jest.Mock;
  get: jest.Mock;
  end: jest.Mock;
}

jest.mock("promise-ftp", () => {
  const instance: MockFtpInstance = {
    connect: jest.fn().mockResolvedValue(undefined),
    list: jest.fn().mockResolvedValue([]),
    get: jest.fn(),
    end: jest.fn().mockResolvedValue(undefined),
  };
  (global as any).__ftpMockInstance = instance;
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => instance),
  };
});

jest.mock("../../utility/config", () => ({
  applicationConfig: {
    FTP_HOST: "ftp.test.com",
    FTP_USER: "ftpuser",
    FTP_PASSWORD: "ftppass",
    IS_DEV: true,
  },
}));

jest.mock("fs", () => ({
  createWriteStream: jest.fn(),
}));

const mockCreateWriteStream = fs.createWriteStream as jest.MockedFunction<typeof fs.createWriteStream>;

interface MockReadStream {
  pipe: jest.Mock;
  once: jest.Mock;
}

interface MockReadStream {
  pipe: jest.Mock;
  once: jest.Mock;
}

function makeMockReadStream(emitClose = true, emitError?: Error): MockReadStream {
  const stream: MockReadStream = {
    pipe: jest.fn().mockReturnThis(),
    once: jest.fn((event: string, handler: (e?: Error) => void) => {
      if (event === "close" && emitClose) setImmediate(() => handler());
      if (event === "error" && emitError) setImmediate(() => handler(emitError));
      return stream;
    }),
  };
  return stream;
}

describe("FTP Service", () => {
  let mockFtp: MockFtpInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFtp = (global as any).__ftpMockInstance;
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe("GetAllFileDetails", () => {
    it("should connect with config and list REPRICER/DEV_HISTORY when IS_DEV is true", async () => {
      mockFtp.list.mockResolvedValue([
        { name: "file1.csv", date: new Date("2024-01-15") },
        { name: "file2.csv", date: new Date("2024-01-16") },
      ]);

      const result = await GetAllFileDetails();

      expect(mockFtp.connect).toHaveBeenCalledWith({
        host: "ftp.test.com",
        user: "ftpuser",
        password: "ftppass",
        secure: false,
      });
      expect(mockFtp.connect).toHaveBeenCalledTimes(1);
      expect(mockFtp.list).toHaveBeenCalledWith("REPRICER/DEV_HISTORY");
      expect(mockFtp.list).toHaveBeenCalledTimes(1);
      expect(mockFtp.end).toHaveBeenCalledTimes(1);
      expect(result).toEqual([
        { name: "file1.csv", createdTime: new Date("2024-01-15") },
        { name: "file2.csv", createdTime: new Date("2024-01-16") },
      ]);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/^FTP FILES : /));
    });

    it("should list REPRICER/HISTORY when IS_DEV is false", async () => {
      const { applicationConfig } = require("../../utility/config");
      (applicationConfig as any).IS_DEV = false;
      mockFtp.list.mockResolvedValue([{ name: "prod.csv", date: new Date() }]);

      await GetAllFileDetails();

      expect(mockFtp.list).toHaveBeenCalledWith("REPRICER/HISTORY");
      (applicationConfig as any).IS_DEV = true; // restore
    });

    it("should filter out . and .. entries", async () => {
      mockFtp.list.mockResolvedValue([
        { name: ".", date: new Date() },
        { name: "..", date: new Date() },
        { name: "valid.csv", date: new Date("2024-01-01") },
      ]);

      const result = await GetAllFileDetails();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: "valid.csv",
        createdTime: new Date("2024-01-01"),
      });
    });

    it("should filter out non-.csv files", async () => {
      mockFtp.list.mockResolvedValue([
        { name: "file.csv", date: new Date("2024-01-01") },
        { name: "file.txt", date: new Date("2024-01-02") },
        { name: "file.CSV", date: new Date("2024-01-03") },
        { name: "nocsv", date: new Date("2024-01-04") },
      ]);

      const result = await GetAllFileDetails();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("file.csv");
    });

    it("should return empty array when list returns no csv files", async () => {
      mockFtp.list.mockResolvedValue([
        { name: ".", date: new Date() },
        { name: "..", date: new Date() },
        { name: "readme.txt", date: new Date() },
      ]);

      const result = await GetAllFileDetails();

      expect(result).toEqual([]);
      expect(consoleLogSpy).toHaveBeenCalledWith("FTP FILES : []");
    });

    it("should call end after list even when list returns empty", async () => {
      mockFtp.list.mockResolvedValue([]);

      await GetAllFileDetails();

      expect(mockFtp.end).toHaveBeenCalledTimes(1);
    });

    it("should propagate connect errors", async () => {
      mockFtp.connect.mockRejectedValueOnce(new Error("Connection refused"));

      await expect(GetAllFileDetails()).rejects.toThrow("Connection refused");
      expect(mockFtp.list).not.toHaveBeenCalled();
      expect(mockFtp.end).not.toHaveBeenCalled();
    });

    it("should propagate list errors", async () => {
      mockFtp.list.mockRejectedValueOnce(new Error("LIST failed"));

      await expect(GetAllFileDetails()).rejects.toThrow("LIST failed");
      // end() is not called when list() throws (exception before end)
      expect(mockFtp.end).not.toHaveBeenCalled();
    });

    it("should not call end if connect fails", async () => {
      mockFtp.connect.mockRejectedValueOnce(new Error("Connect failed"));

      await expect(GetAllFileDetails()).rejects.toThrow("Connect failed");
      expect(mockFtp.end).not.toHaveBeenCalled();
    });
  });

  describe("DownloadFile", () => {
    it("should connect, get remote file, pipe to local path and resolve on stream close", async () => {
      const remotePath = "REPRICER/HISTORY/export.csv";
      const localPath = "/tmp/export.csv";
      const mockReadStream = makeMockReadStream(true);
      const mockWriteStream = { write: jest.fn(), end: jest.fn() };
      mockFtp.get.mockResolvedValue(mockReadStream);
      mockCreateWriteStream.mockReturnValue(mockWriteStream as any);

      await DownloadFile(remotePath, localPath);

      expect(mockFtp.connect).toHaveBeenCalledWith({
        host: "ftp.test.com",
        user: "ftpuser",
        password: "ftppass",
        secure: false,
      });
      expect(mockFtp.get).toHaveBeenCalledWith(remotePath);
      expect(mockCreateWriteStream).toHaveBeenCalledWith(localPath);
      expect(mockReadStream.pipe).toHaveBeenCalledWith(mockWriteStream);
      expect(mockFtp.end).toHaveBeenCalledTimes(1);
    });

    it("should reject on stream error", async () => {
      const remotePath = "REPRICER/remote.csv";
      const localPath = "/tmp/local.csv";
      const err = new Error("Stream read error");
      const mockReadStream = makeMockReadStream(false, err);
      mockFtp.get.mockResolvedValue(mockReadStream);
      mockCreateWriteStream.mockReturnValue({} as any);

      await expect(DownloadFile(remotePath, localPath)).rejects.toThrow("Stream read error");
    });

    it("should call ftp.end when stream closes", async () => {
      const mockReadStream = makeMockReadStream(true);
      mockFtp.get.mockResolvedValue(mockReadStream);
      mockCreateWriteStream.mockReturnValue({} as any);

      await DownloadFile("path/remote.csv", "/local/file.csv");

      expect(mockFtp.end).toHaveBeenCalledTimes(1);
    });

    it("should propagate connect errors", async () => {
      mockFtp.connect.mockRejectedValueOnce(new Error("FTP connect failed"));

      await expect(DownloadFile("remote.csv", "local.csv")).rejects.toThrow("FTP connect failed");
      expect(mockFtp.get).not.toHaveBeenCalled();
    });

    it("should propagate get errors", async () => {
      mockFtp.get.mockRejectedValueOnce(new Error("File not found"));

      await expect(DownloadFile("missing.csv", "/tmp/out.csv")).rejects.toThrow("File not found");
      expect(mockCreateWriteStream).not.toHaveBeenCalled();
    });

    it("should use correct remote and local paths", async () => {
      const mockReadStream = makeMockReadStream(true);
      mockFtp.get.mockResolvedValue(mockReadStream);
      mockCreateWriteStream.mockReturnValue({} as any);

      await DownloadFile("REPRICER/DEV_HISTORY/2024.csv", "/data/2024.csv");

      expect(mockFtp.get).toHaveBeenCalledWith("REPRICER/DEV_HISTORY/2024.csv");
      expect(mockCreateWriteStream).toHaveBeenCalledWith("/data/2024.csv");
    });
  });
});
