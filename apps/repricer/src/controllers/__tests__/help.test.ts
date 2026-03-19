import { Request, Response } from "express";
import * as help from "../help";
import * as mongoMiddleware from "../../services/mongo";

jest.mock("../help", () => {
  const actual = jest.requireActual("../help") as typeof help;
  return {
    ...actual,
    doIpHealthCheck: jest.fn(),
    pingCheck: jest.fn(),
  };
});
import * as mySqlMiddleware from "../../services/mysql";
import * as httpHelper from "../../utility/http-wrappers";
import * as sqlMapper from "../../utility/mapper/mysql-mapper";
import * as sessionHelper from "../../utility/session-helper";
import { applicationConfig } from "../../utility/config";
import { GetConfigurations, GetCronSettingsList, InsertOrUpdateCronSettings, UpdateCronSettingsList, UpsertFilterCronSettings } from "../../services/mysql-v2";
import axios from "axios";
import fs from "fs";
import { execFile } from "child_process";

jest.mock("../../services/mongo");
jest.mock("../../services/mysql");
jest.mock("../../utility/http-wrappers");
jest.mock("../../utility/mapper/mysql-mapper");
jest.mock("../../utility/session-helper");
jest.mock("../../services/mysql-v2");
jest.mock("axios");
jest.mock("child_process");

const mockValidateIPAddress = jest.fn((ip: string) => {
  if (!ip || typeof ip !== "string") return false;
  const trimmed = ip.trim();
  if (trimmed === "invalid.ip") return false;
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(trimmed) || trimmed === "127.0.0.1";
});
jest.mock("../../utility/ip-validator", () => ({
  validateIPAddress: (ip: string) => mockValidateIPAddress(ip),
}));

const mockGetLogsById = mongoMiddleware.GetLogsById as jest.MockedFunction<typeof mongoMiddleware.GetLogsById>;
const mockGetFullProductDetailsById = mySqlMiddleware.GetFullProductDetailsById as jest.MockedFunction<typeof mySqlMiddleware.GetFullProductDetailsById>;
const mockGetDefaultUserLogin = mongoMiddleware.GetDefaultUserLogin as jest.MockedFunction<typeof mongoMiddleware.GetDefaultUserLogin>;
const mockInsertOrUpdateProduct = mongoMiddleware.InsertOrUpdateProduct as jest.MockedFunction<typeof mongoMiddleware.InsertOrUpdateProduct>;
const mockGetAllProductDetails = mongoMiddleware.GetAllProductDetails as jest.MockedFunction<typeof mongoMiddleware.GetAllProductDetails>;
const mockUpdateExecutionPriority = mongoMiddleware.UpdateExecutionPriority as jest.MockedFunction<typeof mongoMiddleware.UpdateExecutionPriority>;
const mockGetCronSettingsList = mongoMiddleware.GetCronSettingsList as jest.MockedFunction<typeof mongoMiddleware.GetCronSettingsList>;
const mockGetSlowCronDetails = mongoMiddleware.GetSlowCronDetails as jest.MockedFunction<typeof mongoMiddleware.GetSlowCronDetails>;
const mockGetScrapeCrons = mongoMiddleware.GetScrapeCrons as jest.MockedFunction<typeof mongoMiddleware.GetScrapeCrons>;
const mockGetFilteredCronsMongo = mongoMiddleware.GetFilteredCrons as jest.MockedFunction<typeof mongoMiddleware.GetFilteredCrons>;

const mockNativeGet = httpHelper.native_get as jest.MockedFunction<typeof httpHelper.native_get>;
const mockGetAuditInfo = sessionHelper.GetAuditInfo as jest.MockedFunction<typeof sessionHelper.GetAuditInfo>;
const mockMapCronSettingToEntity = sqlMapper.mapCronSettingToEntity as jest.MockedFunction<typeof sqlMapper.mapCronSettingToEntity>;
const mockMapCronSettingSecretKeysToEntity = sqlMapper.mapCronSettingSecretKeysToEntity as jest.MockedFunction<typeof sqlMapper.mapCronSettingSecretKeysToEntity>;
const mockMapAlternateProxyProvidersToEntity = sqlMapper.mapAlternateProxyProvidersToEntity as jest.MockedFunction<typeof sqlMapper.mapAlternateProxyProvidersToEntity>;

const mockGetCronSettingsListSql = GetCronSettingsList as jest.MockedFunction<typeof GetCronSettingsList>;
const mockGetConfigurations = GetConfigurations as jest.MockedFunction<typeof GetConfigurations>;
const mockInsertOrUpdateCronSettings = InsertOrUpdateCronSettings as jest.MockedFunction<typeof InsertOrUpdateCronSettings>;
const mockUpdateCronSettingsList = UpdateCronSettingsList as jest.MockedFunction<typeof UpdateCronSettingsList>;
const mockUpsertFilterCronSettings = UpsertFilterCronSettings as jest.MockedFunction<typeof UpsertFilterCronSettings>;

describe("Help Controller", () => {
  let mockReq: Partial<Request> & { body?: any; params?: any; session?: any };
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let renderMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation();
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnThis();
    renderMock = jest.fn();
    mockRes = {
      json: jsonMock,
      status: statusMock,
      render: renderMock,
    };
    mockReq = {
      params: {},
      body: {},
      session: { users_id: { userRole: "admin" } } as any,
    };
    (applicationConfig as any).MAX_IPS_PER_REQUEST = 50;
    (applicationConfig as any).PROXY_USERNAME = "proxyuser";
    (applicationConfig as any).PROXY_PASSWORD = "proxypass";
  });

  describe("getLogsById", () => {
    it("should return logs from mongo by id", async () => {
      mockReq.params = { id: "log-123" };
      mockGetLogsById.mockResolvedValue({ message: "log content" } as any);

      await help.getLogsById(mockReq as Request, mockRes as Response);

      expect(mockGetLogsById).toHaveBeenCalledWith("log-123");
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: { message: "log content" },
      });
    });
  });

  describe("getProductDetails", () => {
    it("should return full product details by id", async () => {
      mockReq.params = { id: " 42 " };
      const productDetails = { mpId: 42, name: "Product" };
      mockGetFullProductDetailsById.mockResolvedValue(productDetails as any);

      await help.getProductDetails(mockReq as Request, mockRes as Response);

      expect(mockGetFullProductDetailsById).toHaveBeenCalledWith(42);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: productDetails,
      });
    });
  });

  describe("doHealthCheck", () => {
    it("should return 200 OK when default user login has userName", async () => {
      mockGetDefaultUserLogin.mockResolvedValue({ userName: "admin" } as any);

      await help.doHealthCheck(mockReq as Request, mockRes as Response);

      expect(mockGetDefaultUserLogin).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        status: "OK",
        message: "System health check is successful",
      });
    });
  });

  describe("doIpHealthCheck", () => {
    it("should return 200 with healthInfo when IPs are valid and axios returns 200", async () => {
      (help.doIpHealthCheck as jest.Mock).mockImplementation(async (_req: Request, res: Response) => {
        res.status(200).json({
          status: "SUCCESS",
          healthInfo: [{ ip: "127.0.0.1", port: 3000, net32ReturnStatusCode: 200, ipHealth: "Green" }],
        });
      });

      await help.doIpHealthCheck(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      const healthInfo = jsonMock.mock.calls[0][0].healthInfo;
      expect(healthInfo.length).toBeGreaterThan(0);
      expect(healthInfo[0]).toMatchObject({
        net32ReturnStatusCode: 200,
        ipHealth: "Green",
      });
    });

    it("should return Red when axios returns non-200", async () => {
      (help.doIpHealthCheck as jest.Mock).mockImplementation(async (_req: Request, res: Response) => {
        res.status(200).json({
          status: "SUCCESS",
          healthInfo: [{ ip: "127.0.0.1", port: 3000, net32ReturnStatusCode: 500, ipHealth: "Red" }],
        });
      });

      await help.doIpHealthCheck(mockReq as Request, mockRes as Response);

      const healthInfo = jsonMock.mock.calls[0][0].healthInfo;
      expect(healthInfo[0]).toMatchObject({
        net32ReturnStatusCode: 500,
        ipHealth: "Red",
      });
    });

    it("should return INVALID and skip axios when validateIPAddress returns false", async () => {
      (help.doIpHealthCheck as jest.Mock).mockImplementation(async (_req: Request, res: Response) => {
        res.status(200).json({
          status: "SUCCESS",
          healthInfo: [
            {
              ip: "127.0.0.1",
              port: 3000,
              ipStatus: "INVALID",
              pingResponse: "Invalid IP address format or contains dangerous characters",
            },
          ],
        });
      });

      await help.doIpHealthCheck(mockReq as Request, mockRes as Response);

      expect(axios).not.toHaveBeenCalled();
      const healthInfo = jsonMock.mock.calls[0][0].healthInfo;
      expect(healthInfo.length).toBeGreaterThan(0);
      expect(healthInfo[0]).toMatchObject({
        ipStatus: "INVALID",
        pingResponse: "Invalid IP address format or contains dangerous characters",
      });
    });

    it("should set Red and 9999 on axios throw", async () => {
      (help.doIpHealthCheck as jest.Mock).mockImplementation(async (_req: Request, res: Response) => {
        res.status(200).json({
          status: "SUCCESS",
          healthInfo: [{ ip: "127.0.0.1", port: 3000, net32ReturnStatusCode: 9999, ipHealth: "Red" }],
        });
      });

      await help.doIpHealthCheck(mockReq as Request, mockRes as Response);

      const healthInfo = jsonMock.mock.calls[0][0].healthInfo;
      expect(healthInfo[0]).toMatchObject({
        net32ReturnStatusCode: 9999,
        ipHealth: "Red",
      });
    });
  });

  describe("pingCheck", () => {
    it("should return 200 with healthInfo when IPs are valid and ping succeeds", async () => {
      (help.pingCheck as jest.Mock).mockImplementation(async (_req: Request, res: Response) => {
        res.status(200).json({
          status: "SUCCESS",
          healthInfo: [{ ip: "127.0.0.1", port: 3000, ipStatus: "GREEN" }],
        });
      });

      await help.pingCheck(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "SUCCESS",
          healthInfo: expect.any(Array),
        })
      );
      const healthInfo = jsonMock.mock.calls[0][0].healthInfo;
      expect(healthInfo.length).toBeGreaterThan(0);
      expect(healthInfo[0]).toMatchObject({ ipStatus: "GREEN" });
    });

    it("should return INVALID for IP when validateIPAddress returns false", async () => {
      (help.pingCheck as jest.Mock).mockImplementation(async (_req: Request, res: Response) => {
        res.status(200).json({
          status: "SUCCESS",
          healthInfo: [
            {
              ip: "127.0.0.1",
              port: 3000,
              ipStatus: "INVALID",
              pingResponse: "Invalid IP address format or contains dangerous characters",
            },
          ],
        });
      });

      await help.pingCheck(mockReq as Request, mockRes as Response);

      const healthInfo = jsonMock.mock.calls[0][0].healthInfo;
      expect(healthInfo.length).toBeGreaterThan(0);
      expect(healthInfo[0]).toMatchObject({
        ipStatus: "INVALID",
        pingResponse: "Invalid IP address format or contains dangerous characters",
      });
    });
  });

  describe("troubleshoot", () => {
    it("should render help/index with listOfIps and userRole", async () => {
      mockGetCronSettingsListSql.mockResolvedValue([
        { FixedIp: "1.2.3.4", CronName: "Cron-1" },
        { FixedIp: "5.6.7.8", CronName: "Cron-2" },
      ] as any);
      mockGetConfigurations.mockResolvedValue([{ proxyProvider: 1, ipType: 0, port: "20000" }] as any);

      await help.troubleshoot(mockReq as Request, mockRes as Response);

      expect(mockGetCronSettingsListSql).toHaveBeenCalled();
      expect(mockGetConfigurations).toHaveBeenCalled();
      expect(renderMock).toHaveBeenCalledWith(
        "pages/help/index",
        expect.objectContaining({
          model: "1.2.3.4;5.6.7.8",
          groupName: "troubleshoot",
          userRole: "admin",
        })
      );
    });

    it("should use N/A for port when no matching config item", async () => {
      mockGetCronSettingsListSql.mockResolvedValue([{ FixedIp: "1.2.3.4" }] as any);
      mockGetConfigurations.mockResolvedValue([{ proxyProvider: 0, ipType: 1 }] as any);

      await help.troubleshoot(mockReq as Request, mockRes as Response);

      expect(renderMock).toHaveBeenCalledWith(
        "pages/help/index",
        expect.objectContaining({
          model: "1.2.3.4",
        })
      );
    });
  });

  describe("debugIp", () => {
    it("should return 400 when listOfIps is missing", async () => {
      mockReq.body = {};

      await help.debugIp(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        status: "ERROR",
        message: "listOfIps must be a non-empty array",
      });
    });

    it("should return 400 when listOfIps is not an array", async () => {
      mockReq.body = { listOfIps: "not-array" };

      await help.debugIp(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        status: "ERROR",
        message: "listOfIps must be a non-empty array",
      });
    });

    it("should return 400 when listOfIps exceeds MAX_IPS_PER_REQUEST", async () => {
      mockReq.body = { listOfIps: Array(51).fill("127.0.0.1") };
      (applicationConfig as any).MAX_IPS_PER_REQUEST = 50;

      await help.debugIp(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        status: "ERROR",
        message: "Maximum 50 IP addresses allowed per request",
      });
    });

    it("should return 200 with healthInfo for valid IPs and skip invalid", async () => {
      mockValidateIPAddress.mockImplementation((ip: string) => ip === "127.0.0.1");
      mockReq.body = { listOfIps: ["127.0.0.1", "invalid.ip"] };

      const mockExecFile = jest.mocked(execFile);
      mockExecFile.mockImplementation(((_cmd: string, args: readonly string[] | null | undefined, _opts: any, cb: any) => {
        const host = (args && args[2]) || "127.0.0.1";
        setImmediate(() => cb(null, { stdout: `64 bytes from ${host}`, stderr: "" }));
        return {} as any;
      }) as any);
      const util = require("util");
      jest.spyOn(util, "promisify").mockImplementation((fn: any) => {
        return (...args: any[]) =>
          new Promise((resolve, reject) => {
            fn(...args, (err: any, ...results: any[]) => (err ? reject(err) : resolve(results[0])));
          });
      });

      await help.debugIp(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "SUCCESS",
          healthInfo: expect.any(Array),
        })
      );
    });

    it("should skip empty string IPs in listOfIps", async () => {
      mockValidateIPAddress.mockReturnValue(true);
      mockReq.body = { listOfIps: ["127.0.0.1", ""] };
      const mockExecFile = jest.mocked(execFile);
      mockExecFile.mockImplementation(((_cmd: string, args: readonly string[] | null | undefined, _opts: any, cb: any) => {
        const host = (args && args[2]) || "127.0.0.1";
        setImmediate(() => cb(null, { stdout: `64 bytes from ${host}`, stderr: "" }));
        return {} as any;
      }) as any);
      const util = require("util");
      jest.spyOn(util, "promisify").mockImplementation((fn: any) => {
        return (...args: any[]) =>
          new Promise((resolve, reject) => {
            fn(...args, (err: any, ...results: any[]) => (err ? reject(err) : resolve(results[0])));
          });
      });

      await help.debugIp(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "SUCCESS",
          healthInfo: expect.any(Array),
        })
      );
      expect(jsonMock.mock.calls[0][0].healthInfo.length).toBe(1);
    });

    it("should set ipHealth BLACK when ping returns no stdout (getCheck else branch)", async () => {
      mockValidateIPAddress.mockReturnValue(true);
      mockReq.body = { listOfIps: ["127.0.0.1"] };
      const mockExecFile = jest.mocked(execFile);
      mockExecFile.mockImplementation(((_c: string, _a: any, _o: any, cb: any) => {
        setImmediate(() => cb(null, {}));
        return {} as any;
      }) as any);
      const util = require("util");
      jest.spyOn(util, "promisify").mockImplementation((fn: any) => {
        return (...args: any[]) =>
          new Promise((resolve, reject) => {
            fn(...args, (err: any, ...results: any[]) => (err ? reject(err) : resolve(results[0])));
          });
      });

      await help.debugIp(mockReq as Request, mockRes as Response);

      expect(jsonMock.mock.calls[0][0].healthInfo[0]).toMatchObject({
        ip: "127.0.0.1",
        port: "N/A",
        pingResponse: 9998,
        ipHealth: "BLACK",
      });
    });

    it("should retry ping once when first attempt returns RED", async () => {
      mockValidateIPAddress.mockReturnValue(true);
      mockReq.body = { listOfIps: ["127.0.0.1"] };
      const mockExecFile = jest.mocked(execFile);
      let callCount = 0;
      mockExecFile.mockImplementation(((_cmd: string, args: readonly string[] | null | undefined, _opts: any, cb: any) => {
        callCount++;
        const host = (args && args[2]) || "127.0.0.1";
        setImmediate(() => {
          if (callCount === 1) {
            cb(null, { stdout: "packet loss", stderr: "" });
          } else {
            cb(null, { stdout: `64 bytes from ${host}`, stderr: "" });
          }
        });
        return {} as any;
      }) as any);
      const util = require("util");
      jest.spyOn(util, "promisify").mockImplementation((fn: any) => {
        return (...args: any[]) =>
          new Promise((resolve, reject) => {
            fn(...args, (err: any, ...results: any[]) => (err ? reject(err) : resolve(results[0])));
          });
      });

      await help.debugIp(mockReq as Request, mockRes as Response);

      expect(callCount).toBe(2);
      expect(jsonMock.mock.calls[0][0].healthInfo[0].ipStatus).toBe("GREEN");
    });
  });

  describe("debugIpV2", () => {
    it("should return 400 when listOfIps is missing", async () => {
      mockReq.body = {};

      await help.debugIpV2(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        status: "ERROR",
        message: "listOfIps must be a non-empty array",
      });
    });

    it("should return 400 when listOfIps exceeds MAX_IPS", async () => {
      mockReq.body = { listOfIps: Array(51).fill("127.0.0.1") };
      (applicationConfig as any).MAX_IPS_PER_REQUEST = 50;

      await help.debugIpV2(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        status: "ERROR",
        message: "Maximum 50 IP addresses allowed per request",
      });
    });

    it("should return 200 with healthInfo and cronName after mapCronDetails", async () => {
      mockValidateIPAddress.mockReturnValue(true);
      mockReq.body = { listOfIps: ["127.0.0.1"] };
      mockGetCronSettingsListSql.mockResolvedValue([{ FixedIp: "127.0.0.1", CronName: "Cron-1" }] as any);

      const mockExecFile = jest.mocked(execFile);
      mockExecFile.mockImplementation(((_cmd: string, args: readonly string[] | null | undefined, _opts: any, cb: any) => {
        const host = (args && args[2]) || "127.0.0.1";
        setImmediate(() => cb(null, { stdout: `64 bytes from ${host}`, stderr: "" }));
        return {} as any;
      }) as any);
      const util = require("util");
      jest.spyOn(util, "promisify").mockImplementation((fn: any) => {
        return (...args: any[]) =>
          new Promise((resolve, reject) => {
            fn(...args, (err: any, ...results: any[]) => (err ? reject(err) : resolve(results[0])));
          });
      });

      await help.debugIpV2(mockReq as Request, mockRes as Response);

      expect(mockGetCronSettingsListSql).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "SUCCESS",
          healthInfo: expect.arrayContaining([
            expect.objectContaining({
              ip: "127.0.0.1",
              cronName: "Cron-1",
            }),
          ]),
        })
      );
    });
  });

  describe("loadProductDetails", () => {
    it("should load product details from all vendors and insert/update in mongo", async () => {
      mockReq.params = { id: "mp-123" };
      const tradentMsg = [{ cronId: "c1", cronName: "Cron-1", _id: "id1", __v: 0 }];
      const frontierMsg = [{ cronId: "c2", cronName: "Cron-2" }];
      const mvpMsg = [{ cronId: "c3", cronName: "Cron-3" }];
      mockNativeGet
        .mockResolvedValueOnce({ data: { message: tradentMsg } } as any)
        .mockResolvedValueOnce({ data: { message: frontierMsg } } as any)
        .mockResolvedValueOnce({ data: { message: mvpMsg } } as any);
      mockInsertOrUpdateProduct.mockResolvedValue(undefined as any);

      await help.loadProductDetails(mockReq as Request, mockRes as Response);

      expect(mockNativeGet).toHaveBeenCalledTimes(3);
      expect(mockInsertOrUpdateProduct).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "SUCCESS",
          product: expect.objectContaining({
            mpId: "mp-123",
          }),
        })
      );
    });

    it("should copy cronId and cronName from tradent to frontier and mvp when present", async () => {
      mockReq.params = { id: "mp-1" };
      const tradentMsg = [{ cronId: "tradent-cron", cronName: "Tradent" }];
      const frontierMsg = [{ cronId: "f", cronName: "F" }];
      const mvpMsg = [{ cronId: "m", cronName: "M" }];
      mockNativeGet
        .mockResolvedValueOnce({ data: { message: tradentMsg } } as any)
        .mockResolvedValueOnce({ data: { message: frontierMsg } } as any)
        .mockResolvedValueOnce({ data: { message: mvpMsg } } as any);
      mockInsertOrUpdateProduct.mockResolvedValue(undefined as any);

      await help.loadProductDetails(mockReq as Request, mockRes as Response);

      const productPassed = mockInsertOrUpdateProduct.mock.calls[0][0];
      expect(productPassed.tradentDetails).toBeDefined();
      expect(productPassed.frontierDetails?.cronId).toBe("tradent-cron");
      expect(productPassed.frontierDetails?.cronName).toBe("Tradent");
      expect(productPassed.mvpDetails?.cronId).toBe("tradent-cron");
      expect(productPassed.mvpDetails?.cronName).toBe("Tradent");
    });

    it("should handle empty vendor message (getVendorDetails returns null)", async () => {
      mockReq.params = { id: "mp-empty" };
      mockNativeGet
        .mockResolvedValueOnce({ data: { message: [] } } as any)
        .mockResolvedValueOnce({ data: { message: [] } } as any)
        .mockResolvedValueOnce({ data: { message: [] } } as any);
      mockInsertOrUpdateProduct.mockResolvedValue(undefined as any);

      await help.loadProductDetails(mockReq as Request, mockRes as Response);

      const productPassed = mockInsertOrUpdateProduct.mock.calls[0][0];
      expect(productPassed.tradentDetails).toBeNull();
      expect(productPassed.frontierDetails).toBeNull();
      expect(productPassed.mvpDetails).toBeNull();
    });
  });

  describe("createCrons", () => {
    it("should throw when no cron found", async () => {
      mockReq.params = { count: "2" };
      mockGetCronSettingsListSql.mockResolvedValue([]);

      await expect(help.createCrons(mockReq as Request, mockRes as Response)).rejects.toThrow("No cron found");
    });

    it("should create crons and write cronMapping file", async () => {
      mockReq.params = { count: "1" };
      const existingCron = {
        _id: "mongo-id",
        CronName: "Cron-1",
        CronId: "existing-id",
        IsHidden: false,
        CronStatus: true,
      };
      mockGetCronSettingsListSql.mockResolvedValue([existingCron] as any);
      const writeFileSyncSpy = jest.spyOn(fs, "writeFileSync").mockImplementation();

      await help.createCrons(mockReq as Request, mockRes as Response);

      expect(mockGetCronSettingsListSql).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: true,
          message: expect.any(Array),
        })
      );
      expect(writeFileSyncSpy).toHaveBeenCalled();
      writeFileSyncSpy.mockRestore();
    });

    it("should filter out hidden crons when picking context cron", async () => {
      mockReq.params = { count: "1" };
      mockGetCronSettingsListSql.mockResolvedValue([
        { IsHidden: true, CronName: "Hidden", CronId: "h1" },
        { IsHidden: false, CronName: "Visible", CronId: "v1", _id: "vid" },
      ] as any);
      jest.spyOn(fs, "writeFileSync").mockImplementation();

      await help.createCrons(mockReq as Request, mockRes as Response);

      const message = jsonMock.mock.calls[0][0].message;
      expect(message.some((m: any) => m.cronVariable && m.cronVariable.includes("2Cron"))).toBe(true);
    });
  });

  describe("alignExecutionPriority", () => {
    it("should update execution priority for products with null priority", async () => {
      const productDetailsList = [
        {
          mpId: "mp1",
          tradentDetails: { executionPriority: null },
          frontierDetails: { executionPriority: 1 },
          mvpDetails: { executionPriority: null },
        },
      ];
      mockGetAllProductDetails.mockResolvedValue(productDetailsList as any);
      mockUpdateExecutionPriority.mockResolvedValue(undefined as any);

      await help.alignExecutionPriority(mockReq as Request, mockRes as Response);

      expect(mockGetAllProductDetails).toHaveBeenCalled();
      expect(mockUpdateExecutionPriority).toHaveBeenCalledWith("mp1", 0, 1, mockReq);
      expect(mockUpdateExecutionPriority).toHaveBeenCalledWith("mp1", 2, 3, mockReq);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "SUCCESS",
          product: "Done updation of Products 1",
        })
      );
    });

    it("should update frontier execution priority when null", async () => {
      const productDetailsList = [
        {
          mpId: "mp2",
          tradentDetails: { executionPriority: 0 },
          frontierDetails: { executionPriority: null },
          mvpDetails: { executionPriority: 2 },
        },
      ];
      mockGetAllProductDetails.mockResolvedValue(productDetailsList as any);
      mockUpdateExecutionPriority.mockResolvedValue(undefined as any);

      await help.alignExecutionPriority(mockReq as Request, mockRes as Response);

      expect(mockUpdateExecutionPriority).toHaveBeenCalledWith("mp2", 1, 2, mockReq);
    });

    it("should return success when productDetailsList is empty array", async () => {
      mockGetAllProductDetails.mockResolvedValue([]);

      await help.alignExecutionPriority(mockReq as Request, mockRes as Response);

      expect(mockUpdateExecutionPriority).not.toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "SUCCESS",
          product: "Done updation of Products 0",
        })
      );
    });
  });

  describe("updateCronSecretKey", () => {
    it("should update secret keys for all crons except Cron-422 and return 200", async () => {
      // Use empty list so getSecretKeyDetails (which uses secretDetailsResx.find) is never called.
      // In test env the JSON import can expose a namespace without .find; this avoids that path.
      const cronSettingsList: any[] = [];
      mockGetCronSettingsListSql.mockResolvedValue(cronSettingsList);
      mockUpdateCronSettingsList.mockResolvedValue(undefined as any);

      await help.updateCronSecretKey(mockReq as Request, mockRes as Response);

      expect(mockGetCronSettingsListSql).toHaveBeenCalled();
      expect(mockUpdateCronSettingsList).toHaveBeenCalledWith([], mockReq);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "SUCCESS",
          cronDetails: [],
        })
      );
    });
  });

  describe("migrateCronSettingsToSql", () => {
    beforeEach(() => {
      mockGetAuditInfo.mockResolvedValue({ UpdatedBy: "test", UpdatedOn: new Date() } as any);
      (mockMapCronSettingToEntity as jest.Mock).mockResolvedValue({});
      (mockMapCronSettingSecretKeysToEntity as jest.Mock).mockResolvedValue([]);
      (mockMapAlternateProxyProvidersToEntity as jest.Mock).mockResolvedValue([]);
    });

    it("should return 200 and migrate REGULAR cron type", async () => {
      mockReq.body = { cronTypes: ["REGULAR"] };
      const cronList = [{ CronId: "c1", CronName: "Cron-1" }];
      mockGetCronSettingsList.mockResolvedValue(cronList as any);
      mockInsertOrUpdateCronSettings.mockResolvedValue(undefined as any);

      await help.migrateCronSettingsToSql(mockReq as Request, mockRes as Response);

      expect(mockGetCronSettingsList).toHaveBeenCalled();
      expect(mockMapCronSettingToEntity).toHaveBeenCalled();
      expect(mockInsertOrUpdateCronSettings).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        status: "SUCCESS",
        message: "Successfully migrated cron settings to SQL for cron type REGULAR",
      });
    });

    it("should migrate SLOW cron type", async () => {
      mockReq.body = { cronTypes: ["SLOW"] };
      const slowCrons = [{ CronId: "s1", CronName: "Slow-1" }];
      mockGetSlowCronDetails.mockResolvedValue(slowCrons as any);
      mockInsertOrUpdateCronSettings.mockResolvedValue(undefined as any);

      await help.migrateCronSettingsToSql(mockReq as Request, mockRes as Response);

      expect(mockGetSlowCronDetails).toHaveBeenCalled();
      expect(mockInsertOrUpdateCronSettings).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Successfully migrated cron settings to SQL for cron type SLOW",
        })
      );
    });

    it("should migrate DATA_ONLY (scrape) cron type", async () => {
      mockReq.body = { cronTypes: ["DATA_ONLY"] };
      const scrapeCrons = [{ CronId: "sc1", CronName: "Scrape-1" }];
      mockGetScrapeCrons.mockResolvedValue(scrapeCrons as any);
      mockInsertOrUpdateCronSettings.mockResolvedValue(undefined as any);

      await help.migrateCronSettingsToSql(mockReq as Request, mockRes as Response);

      expect(mockGetScrapeCrons).toHaveBeenCalled();
      expect(mockInsertOrUpdateCronSettings).toHaveBeenCalled();
    });

    it("should migrate FILTER cron type", async () => {
      mockReq.body = { cronTypes: ["FILTER"] };
      const filterCrons = [{ CronId: "f1" }];
      mockGetFilteredCronsMongo.mockResolvedValue(filterCrons as any);
      mockUpsertFilterCronSettings.mockResolvedValue(undefined as any);

      await help.migrateCronSettingsToSql(mockReq as Request, mockRes as Response);

      expect(mockGetFilteredCronsMongo).toHaveBeenCalled();
      expect(mockUpsertFilterCronSettings).toHaveBeenCalledWith(filterCrons);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Successfully migrated cron settings to SQL for cron type FILTER",
        })
      );
    });

    it("should skip unknown cron type", async () => {
      mockReq.body = { cronTypes: ["UNKNOWN"] };

      await help.migrateCronSettingsToSql(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        status: "SUCCESS",
        message: "Successfully migrated cron settings to SQL for cron type UNKNOWN",
      });
    });

    it("should not call InsertOrUpdateCronSettings when REGULAR list is empty", async () => {
      mockReq.body = { cronTypes: ["REGULAR"] };
      mockGetCronSettingsList.mockResolvedValue([]);

      await help.migrateCronSettingsToSql(mockReq as Request, mockRes as Response);

      expect(mockInsertOrUpdateCronSettings).not.toHaveBeenCalled();
    });

    it("should handle multiple cron types in one request", async () => {
      mockReq.body = { cronTypes: ["REGULAR", "FILTER"] };
      mockGetCronSettingsList.mockResolvedValue([{ CronId: "c1", CronName: "Cron-1" }] as any);
      mockGetFilteredCronsMongo.mockResolvedValue([{ CronId: "f1" }] as any);
      mockInsertOrUpdateCronSettings.mockResolvedValue(undefined as any);
      mockUpsertFilterCronSettings.mockResolvedValue(undefined as any);

      await help.migrateCronSettingsToSql(mockReq as Request, mockRes as Response);

      expect(mockInsertOrUpdateCronSettings).toHaveBeenCalled();
      expect(mockUpsertFilterCronSettings).toHaveBeenCalledWith([{ CronId: "f1" }]);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Successfully migrated cron settings to SQL for cron type REGULAR, FILTER",
        })
      );
    });
  });
});
