import express, { Request, Response } from "express";
import * as mongoHelper from "../../services/mongo";
import { GetCronSettingsList, GetSlowCronDetails } from "../../services/mysql-v2";
import * as mySqlMiddleware from "../../services/mysql";
import { applicationConfig } from "../../utility/config";
import { TriggerEmail } from "../../middleware/storage-sense-helpers/email-helper";
import { postDataForExcel } from "../../middleware/storage-sense-helpers/axios-helper";
import { archiveHistory } from "../../utility/history-archive-helper";
import fs from "fs";

jest.mock("../../services/mongo");
jest.mock("../../services/mysql-v2");
jest.mock("../../services/mysql", () => ({ ExecuteQuery: jest.fn() }));
jest.mock("../../utility/config", () => ({
  applicationConfig: {
    IS_DEV: false,
    EXPORT_SAVE_CRON_SCHEDULE: "0 1 * * *",
    CRON_PROGRESS_SCHEDULE: "*/30 * * * *",
    CRON_PROGRESS_MAX_COUNT: 25,
    _422_ERROR_CRON_SCHEDULE: "*/30 * * * *",
    _422_ERROR_MAX_COUNT: 100,
    _422_ERROR_ELIGIBLE_MAX_COUNT: 500,
    MONITOR_EMAIL_ID: "monitor@test.com",
    HISTORY_ROOT_PATH: "/tmp/repricer",
    FTP_HOST: "localhost",
    FTP_USER: "test",
    FTP_PASSWORD: "test",
    HISTORY_DELETION_CRON_SCHEDULE: "0 3 * * *",
    CRON_LOGS_DELETION_CRON_SCHEDULE: "0 4 * * *",
    HISTORY_ARCHIVE_CRON_SCHEDULE: "0 0 * * *",
  },
}));
jest.mock("../../middleware/storage-sense-helpers/email-helper");
jest.mock("../../middleware/storage-sense-helpers/axios-helper");
jest.mock("../../utility/history-archive-helper");

const mockSchedule = jest.fn().mockReturnValue({ start: jest.fn(), stop: jest.fn() });
jest.mock("node-cron", () => ({
  __esModule: true,
  default: {
    schedule: jest.fn(() => ({ start: jest.fn(), stop: jest.fn() })),
  },
  schedule: (...args: any[]) => mockSchedule(...args),
}));

jest.mock("basic-ftp", () => ({
  Client: jest.fn().mockImplementation(() => ({
    access: jest.fn().mockResolvedValue(undefined),
    uploadFrom: jest.fn().mockResolvedValue(undefined),
    close: jest.fn(),
    ftp: { verbose: false },
  })),
}));

jest.mock("fs");
jest.mock("path", () => ({
  ...jest.requireActual("path"),
  join: jest.fn((...args: string[]) => args.join("/")),
}));

const mockGetLatestCronStatus = mongoHelper.GetLatestCronStatus as jest.MockedFunction<typeof mongoHelper.GetLatestCronStatus>;
const mockIgnoreCronStatusLog = mongoHelper.IgnoreCronStatusLog as jest.MockedFunction<typeof mongoHelper.IgnoreCronStatusLog>;
const mockGet422ProductCountByType = mongoHelper.Get422ProductCountByType as jest.MockedFunction<typeof mongoHelper.Get422ProductCountByType>;
const mockGetContextErrorItemsCount = mongoHelper.GetContextErrorItemsCount as jest.MockedFunction<typeof mongoHelper.GetContextErrorItemsCount>;
const mockDeleteCronLogsPast15Days = mongoHelper.DeleteCronLogsPast15Days as jest.MockedFunction<typeof mongoHelper.DeleteCronLogsPast15Days>;
const mockGetCronSettingsList = GetCronSettingsList as jest.MockedFunction<typeof GetCronSettingsList>;
const mockGetSlowCronDetails = GetSlowCronDetails as jest.MockedFunction<typeof GetSlowCronDetails>;
const mockExecuteQuery = mySqlMiddleware.ExecuteQuery as jest.MockedFunction<typeof mySqlMiddleware.ExecuteQuery>;
const mockTriggerEmail = TriggerEmail as jest.MockedFunction<typeof TriggerEmail>;
const mockPostDataForExcel = postDataForExcel as jest.MockedFunction<typeof postDataForExcel>;
const mockArchiveHistory = archiveHistory as jest.MockedFunction<typeof archiveHistory>;

function getRouteHandler(router: express.Router, method: string, routePath: string): ((req: Request, res: Response) => void) | null {
  for (const layer of router.stack as any[]) {
    if (layer.route && layer.route.path === routePath && (layer.route.methods as any)[method]) {
      return layer.route.stack[0].handle;
    }
  }
  return null;
}

describe("Monitor-Sense Controller", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let statusMock: jest.Mock;
  let sendMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(console, "info").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();
    statusMock = jest.fn().mockReturnThis();
    sendMock = jest.fn().mockReturnThis();
    mockRes = { status: statusMock, send: sendMock };
    mockReq = { params: {}, body: {}, query: {} };
    (applicationConfig as any).IS_DEV = false;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("startAllMonitorCrons", () => {
    it("should return early without starting crons when IS_DEV is true", async () => {
      const { startAllMonitorCrons } = await import("../monitor-sense");
      (applicationConfig as any).IS_DEV = true;
      mockSchedule.mockClear();

      await startAllMonitorCrons();

      expect(mockSchedule).not.toHaveBeenCalled();
    });

    it("should start all monitor crons when IS_DEV is false", async () => {
      const { startAllMonitorCrons } = await import("../monitor-sense");
      (applicationConfig as any).IS_DEV = false;
      mockSchedule.mockClear();

      await startAllMonitorCrons();

      expect(mockSchedule).toHaveBeenCalledTimes(5);
    });
  });

  describe("GET /schedule/monitor-sense/export_save", () => {
    it("should schedule export_save cron and return 200 when cron.schedule succeeds", async () => {
      const { monitorSenseController } = await import("../monitor-sense");
      const handler = getRouteHandler(monitorSenseController, "get", "/schedule/monitor-sense/export_save");
      expect(handler).toBeDefined();

      await (handler as any)(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(sendMock).toHaveBeenCalledWith(expect.stringContaining("Successfully Started Cron for Export And Save"));
    });

    it("should return 400 when cron.schedule returns falsy", async () => {
      const nodeCron = require("node-cron");
      nodeCron.default.schedule.mockReturnValueOnce(null);
      const { monitorSenseController } = await import("../monitor-sense");
      const handler = getRouteHandler(monitorSenseController, "get", "/schedule/monitor-sense/export_save");
      await (handler as any)(mockReq as Request, mockRes as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(sendMock).toHaveBeenCalledWith(expect.stringContaining("Some error occurred"));
    });

    it("should run StartExportAndSave when scheduled export_save cron callback fires", async () => {
      mockPostDataForExcel.mockResolvedValue({ data: Buffer.from("xlsx") } as any);
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
      const nodeCron = require("node-cron");
      let scheduledCb: (() => Promise<void>) | null = null;
      nodeCron.default.schedule.mockImplementation((_schedule: string, cb: () => Promise<void>) => {
        scheduledCb = cb;
        return { start: jest.fn(), stop: jest.fn() };
      });
      const { monitorSenseController } = await import("../monitor-sense");
      const handler = getRouteHandler(monitorSenseController, "get", "/schedule/monitor-sense/export_save");
      await (handler as any)(mockReq as Request, mockRes as Response);
      expect(scheduledCb).toBeDefined();
      await scheduledCb!();
      expect(mockPostDataForExcel).toHaveBeenCalledWith("http://localhost:3000/productV2/save/download_excel", {});
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe("GET /debug/monitor-sense/cron", () => {
    it("should call ValidateCronDetails and return 200", async () => {
      mockGetLatestCronStatus.mockResolvedValue([]);
      const { monitorSenseController } = await import("../monitor-sense");
      const handler = getRouteHandler(monitorSenseController, "get", "/debug/monitor-sense/cron");
      expect(handler).toBeDefined();

      await (handler as any)(mockReq as Request, mockRes as Response);

      expect(mockGetLatestCronStatus).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(sendMock).toHaveBeenCalledWith(expect.stringContaining("Successfully Started IN-PROGRESS CRONS Check"));
    });

    it("should send email when in-progress cron count exceeds max", async () => {
      const oldDate = new Date(Date.now() - 200 * 1000);
      mockGetLatestCronStatus.mockResolvedValue(
        Array(30)
          .fill(null)
          .map((_, i) => ({
            _id: { toString: () => `id-${i}` },
            cronId: `cron-${i}`,
            keyGenId: `key-${i}`,
            cronTime: oldDate,
            productsCount: 1,
            maximumProductCount: 100,
          })) as any
      );
      mockGetCronSettingsList.mockResolvedValue([{ CronId: "cron-0", CronName: "TestCron" }]);
      mockGetSlowCronDetails.mockResolvedValue([]);
      mockTriggerEmail.mockResolvedValue(undefined);

      const { monitorSenseController } = await import("../monitor-sense");
      const handler = getRouteHandler(monitorSenseController, "get", "/debug/monitor-sense/cron");
      await (handler as any)(mockReq as Request, mockRes as Response);

      expect(mockGetCronSettingsList).toHaveBeenCalled();
      expect(mockGetSlowCronDetails).toHaveBeenCalled();
      expect(mockTriggerEmail).toHaveBeenCalledWith(expect.stringContaining("In-Progress Cron Details"), "MONITOR | Attention Needed : In-Progress Cron Count Reached Maximum Limit", (applicationConfig as any).MONITOR_EMAIL_ID);
    });

    it("should call IgnoreCronStatusLog for crons with productsCount 0 and age > 120s", async () => {
      const oldDate = new Date(Date.now() - 200 * 1000);
      const details = [
        { _id: {}, cronId: "cron-1", keyGenId: "key-1", cronTime: oldDate, productsCount: 0, maximumProductCount: 100 },
        { _id: {}, cronId: "cron-2", keyGenId: "key-2", cronTime: oldDate, productsCount: 1, maximumProductCount: 100 },
        ...Array(25)
          .fill(null)
          .map((_, i) => ({
            _id: {},
            cronId: `cron-${i + 3}`,
            keyGenId: `key-${i + 3}`,
            cronTime: oldDate,
            productsCount: 5,
            maximumProductCount: 100,
          })),
      ];
      mockGetLatestCronStatus.mockResolvedValue(details as any);
      mockGetCronSettingsList.mockResolvedValue([]);
      mockGetSlowCronDetails.mockResolvedValue([]);
      mockIgnoreCronStatusLog.mockResolvedValue(undefined);
      mockTriggerEmail.mockResolvedValue(undefined);

      const { monitorSenseController } = await import("../monitor-sense");
      const handler = getRouteHandler(monitorSenseController, "get", "/debug/monitor-sense/cron");
      await (handler as any)(mockReq as Request, mockRes as Response);

      expect(mockIgnoreCronStatusLog).toHaveBeenCalledWith("cron-1", "key-1");
      expect(mockIgnoreCronStatusLog).not.toHaveBeenCalledWith("cron-2", "key-2");
    });

    it("should not send email when in-progress count is within limit", async () => {
      mockGetLatestCronStatus.mockResolvedValue([{ _id: {}, cronId: "c1", keyGenId: "k1", cronTime: new Date(), productsCount: 5, maximumProductCount: 100 }] as any);
      mockTriggerEmail.mockClear();

      const { monitorSenseController } = await import("../monitor-sense");
      const handler = getRouteHandler(monitorSenseController, "get", "/debug/monitor-sense/cron");
      await (handler as any)(mockReq as Request, mockRes as Response);

      expect(mockTriggerEmail).not.toHaveBeenCalled();
    });

    it("should not send email when GetLatestCronStatus returns null", async () => {
      mockGetLatestCronStatus.mockResolvedValue(null as any);
      mockTriggerEmail.mockClear();

      const { monitorSenseController } = await import("../monitor-sense");
      const handler = getRouteHandler(monitorSenseController, "get", "/debug/monitor-sense/cron");
      await (handler as any)(mockReq as Request, mockRes as Response);

      expect(mockTriggerEmail).not.toHaveBeenCalled();
    });
  });

  describe("GET /debug/monitor-sense/422Error", () => {
    it("should call Validate422ErrorProductDetails and return 200", async () => {
      mockGet422ProductCountByType.mockResolvedValue(0);
      mockGetContextErrorItemsCount.mockResolvedValue(0);
      const { monitorSenseController } = await import("../monitor-sense");
      const handler = getRouteHandler(monitorSenseController, "get", "/debug/monitor-sense/422Error");
      expect(handler).toBeDefined();

      await (handler as any)(mockReq as Request, mockRes as Response);

      expect(mockGet422ProductCountByType).toHaveBeenCalledWith("422_ERROR");
      expect(mockGet422ProductCountByType).toHaveBeenCalledWith("PRICE_UPDATE");
      expect(mockGetContextErrorItemsCount).toHaveBeenCalledWith(true);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(sendMock).toHaveBeenCalledWith(expect.stringContaining("422 Product Count Validation Check"));
    });

    it("should send email when eligibleProducts exceeds max", async () => {
      mockGet422ProductCountByType.mockResolvedValue(50);
      mockGetContextErrorItemsCount.mockResolvedValue(600);
      mockTriggerEmail.mockResolvedValue(undefined);

      const { monitorSenseController } = await import("../monitor-sense");
      const handler = getRouteHandler(monitorSenseController, "get", "/debug/monitor-sense/422Error");
      await (handler as any)(mockReq as Request, mockRes as Response);

      expect(mockTriggerEmail).toHaveBeenCalledWith(expect.stringContaining("Eligible Product Count"), "EXPRESS CRON | Eligible Products Count Reached Maximum Limit", (applicationConfig as any).MONITOR_EMAIL_ID);
    });

    it("should send email when products422Error exceeds max", async () => {
      mockGet422ProductCountByType.mockResolvedValue(150);
      mockGetContextErrorItemsCount.mockResolvedValue(100);
      mockTriggerEmail.mockResolvedValue(undefined);

      const { monitorSenseController } = await import("../monitor-sense");
      const handler = getRouteHandler(monitorSenseController, "get", "/debug/monitor-sense/422Error");
      await (handler as any)(mockReq as Request, mockRes as Response);

      expect(mockTriggerEmail).toHaveBeenCalledWith(expect.stringContaining("422 Error"), "EXPRESS CRON | 422 Error Count Reached Maximum Limit", (applicationConfig as any).MONITOR_EMAIL_ID);
    });

    it("should send both emails when both limits exceeded", async () => {
      mockGet422ProductCountByType.mockResolvedValue(150);
      mockGetContextErrorItemsCount.mockResolvedValue(600);
      mockTriggerEmail.mockResolvedValue(undefined);

      const { monitorSenseController } = await import("../monitor-sense");
      const handler = getRouteHandler(monitorSenseController, "get", "/debug/monitor-sense/422Error");
      await (handler as any)(mockReq as Request, mockRes as Response);

      expect(mockTriggerEmail).toHaveBeenCalledTimes(2);
    });
  });

  describe("GET /debug/monitor-sense/exportAndSave", () => {
    it("should call StartExportAndSave and return 200", async () => {
      mockPostDataForExcel.mockResolvedValue({ data: Buffer.from("xlsx") } as any);
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {});

      const { monitorSenseController } = await import("../monitor-sense");
      const handler = getRouteHandler(monitorSenseController, "get", "/debug/monitor-sense/exportAndSave");
      expect(handler).toBeDefined();

      await (handler as any)(mockReq as Request, mockRes as Response);

      expect(mockPostDataForExcel).toHaveBeenCalledWith("http://localhost:3000/productV2/save/download_excel", {});
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(sendMock).toHaveBeenCalledWith(expect.stringContaining("Successfully Saved Product Data"));
    });
  });

  describe("startInProgressCronCheck / startExpressCronValidationCheck / startHistoryDeletionCron / startCronLogsDeletionCron / startArchiveHistoryCron", () => {
    it("startAllMonitorCrons registers all crons with correct schedule callbacks", async () => {
      mockSchedule.mockClear();
      const { startAllMonitorCrons } = await import("../monitor-sense");
      (applicationConfig as any).IS_DEV = false;

      await startAllMonitorCrons();

      expect(mockSchedule).toHaveBeenCalledWith((applicationConfig as any).CRON_PROGRESS_SCHEDULE, expect.any(Function), { scheduled: true });
      expect(mockSchedule).toHaveBeenCalledWith((applicationConfig as any)._422_ERROR_CRON_SCHEDULE, expect.any(Function), { scheduled: true });
      expect(mockSchedule).toHaveBeenCalledWith((applicationConfig as any).HISTORY_DELETION_CRON_SCHEDULE, expect.any(Function), { scheduled: true });
      expect(mockSchedule).toHaveBeenCalledWith((applicationConfig as any).CRON_LOGS_DELETION_CRON_SCHEDULE, expect.any(Function), { scheduled: true });
      expect(mockSchedule).toHaveBeenCalledWith((applicationConfig as any).HISTORY_ARCHIVE_CRON_SCHEDULE, expect.any(Function), { scheduled: true });
    });

    it("HistoryDeletionCron callback calls DeleteHistory and ExecuteQuery", async () => {
      mockSchedule.mockClear();
      mockExecuteQuery.mockResolvedValue({ affectedRows: 1 } as any);
      const { startAllMonitorCrons } = await import("../monitor-sense");
      (applicationConfig as any).IS_DEV = false;
      await startAllMonitorCrons();
      const historyCronCb = mockSchedule.mock.calls.find((c: any) => c[0] === (applicationConfig as any).HISTORY_DELETION_CRON_SCHEDULE)?.[1];
      expect(historyCronCb).toBeDefined();

      await historyCronCb();

      expect(mockExecuteQuery).toHaveBeenCalledWith("delete from table_history_apiResponse where RefTime < ?", expect.any(Array));
      expect(mockExecuteQuery).toHaveBeenCalledWith("delete from table_history where RefTime < ?", expect.any(Array));
    });

    it("CronLogsDeletionCron callback calls DeleteCronLogsPast15Days", async () => {
      mockSchedule.mockClear();
      mockDeleteCronLogsPast15Days.mockResolvedValue({ deletedCount: 5 } as any);
      const { startAllMonitorCrons } = await import("../monitor-sense");
      (applicationConfig as any).IS_DEV = false;
      await startAllMonitorCrons();
      const logsCronCb = mockSchedule.mock.calls.find((c: any) => c[0] === (applicationConfig as any).CRON_LOGS_DELETION_CRON_SCHEDULE)?.[1];
      expect(logsCronCb).toBeDefined();

      await logsCronCb();

      expect(mockDeleteCronLogsPast15Days).toHaveBeenCalled();
    });

    it("HistoryArchiveCron callback calls archiveHistory", async () => {
      mockSchedule.mockClear();
      mockArchiveHistory.mockResolvedValue(undefined);
      const { startAllMonitorCrons } = await import("../monitor-sense");
      (applicationConfig as any).IS_DEV = false;
      await startAllMonitorCrons();
      const archiveCronCb = mockSchedule.mock.calls.find((c: any) => c[0] === (applicationConfig as any).HISTORY_ARCHIVE_CRON_SCHEDULE)?.[1];
      expect(archiveCronCb).toBeDefined();

      await archiveCronCb();

      expect(mockArchiveHistory).toHaveBeenCalled();
    });

    it("InProgressCron callback catches errors", async () => {
      mockSchedule.mockClear();
      mockGetLatestCronStatus.mockRejectedValue(new Error("Mongo error"));
      const { startAllMonitorCrons } = await import("../monitor-sense");
      (applicationConfig as any).IS_DEV = false;
      await startAllMonitorCrons();
      const inProgressCb = mockSchedule.mock.calls.find((c: any) => c[0] === (applicationConfig as any).CRON_PROGRESS_SCHEDULE)?.[1];
      await inProgressCb();
      expect(console.error).toHaveBeenCalledWith("Error running InProgressCheckCron:", expect.any(Error));
    });

    it("ExpressCheckCron callback catches errors", async () => {
      mockSchedule.mockClear();
      mockGet422ProductCountByType.mockRejectedValue(new Error("Mongo error"));
      const { startAllMonitorCrons } = await import("../monitor-sense");
      (applicationConfig as any).IS_DEV = false;
      await startAllMonitorCrons();
      // Order: InProgress=0, Express=1, HistoryDeletion=2, CronLogsDeletion=3, Archive=4
      const expressCb = mockSchedule.mock.calls[1]?.[1];
      expect(expressCb).toBeDefined();
      await expressCb();
      expect(console.error).toHaveBeenCalledWith("Error running ExpressCheckCron:", expect.any(Error));
    });

    it("HistoryDeletionCron callback catches errors", async () => {
      mockSchedule.mockClear();
      mockExecuteQuery.mockRejectedValue(new Error("DB error"));
      const { startAllMonitorCrons } = await import("../monitor-sense");
      (applicationConfig as any).IS_DEV = false;
      await startAllMonitorCrons();
      const historyCronCb = mockSchedule.mock.calls[2]?.[1];
      await historyCronCb();
      expect(console.error).toHaveBeenCalledWith("HISTORY_DELETION_CRON : Error running HistoryDeletionCron:", expect.any(Error));
    });

    it("CronLogsDeletionCron callback catches errors", async () => {
      mockSchedule.mockClear();
      mockDeleteCronLogsPast15Days.mockRejectedValue(new Error("Mongo delete error"));
      const { startAllMonitorCrons } = await import("../monitor-sense");
      (applicationConfig as any).IS_DEV = false;
      await startAllMonitorCrons();
      const logsCronCb = mockSchedule.mock.calls[3]?.[1];
      await logsCronCb();
      expect(console.error).toHaveBeenCalledWith("CRON_LOGS_DELETION_CRON : Error running CronLogsDeletionCron:", expect.any(Error));
    });

    it("HistoryArchiveCron callback catches errors", async () => {
      mockSchedule.mockClear();
      mockArchiveHistory.mockRejectedValue(new Error("Archive error"));
      const { startAllMonitorCrons } = await import("../monitor-sense");
      (applicationConfig as any).IS_DEV = false;
      await startAllMonitorCrons();
      const archiveCronCb = mockSchedule.mock.calls[4]?.[1];
      await archiveCronCb();
      expect(console.error).toHaveBeenCalledWith("HISTORY_ARCHIVE_CRON : Error running HistoryArchiveCron:", expect.any(Error));
    });
  });

  describe("cronName resolution", () => {
    it("should set cronName to linked CronName when found in settings", async () => {
      const oldDate = new Date(Date.now() - 200 * 1000);
      const details = [
        { _id: {}, cronId: "linked-cron", keyGenId: "k1", cronTime: oldDate, productsCount: 10, maximumProductCount: 100 },
        ...Array(25)
          .fill(null)
          .map((_, i) => ({ _id: {}, cronId: `c-${i}`, keyGenId: `k-${i}`, cronTime: oldDate, productsCount: 5, maximumProductCount: 100 })),
      ];
      mockGetLatestCronStatus.mockResolvedValue(details as any);
      mockGetCronSettingsList.mockResolvedValue([{ CronId: "linked-cron", CronName: "MyCron" }]);
      mockGetSlowCronDetails.mockResolvedValue([]);
      mockTriggerEmail.mockResolvedValue(undefined);

      const { monitorSenseController } = await import("../monitor-sense");
      const handler = getRouteHandler(monitorSenseController, "get", "/debug/monitor-sense/cron");
      await (handler as any)(mockReq as Request, mockRes as Response);

      expect(mockTriggerEmail).toHaveBeenCalledWith(expect.stringContaining("MyCron"), expect.any(String), expect.any(String));
    });

    it("should set cronName to N/A when not found in settings", async () => {
      const oldDate = new Date(Date.now() - 200 * 1000);
      const details = [
        { _id: {}, cronId: "unknown-cron", keyGenId: "k1", cronTime: oldDate, productsCount: 10, maximumProductCount: 100 },
        ...Array(25)
          .fill(null)
          .map((_, i) => ({ _id: {}, cronId: `c-${i}`, keyGenId: `k-${i}`, cronTime: oldDate, productsCount: 5, maximumProductCount: 100 })),
      ];
      mockGetLatestCronStatus.mockResolvedValue(details as any);
      mockGetCronSettingsList.mockResolvedValue([]);
      mockGetSlowCronDetails.mockResolvedValue([]);
      mockTriggerEmail.mockResolvedValue(undefined);

      const { monitorSenseController } = await import("../monitor-sense");
      const handler = getRouteHandler(monitorSenseController, "get", "/debug/monitor-sense/cron");
      await (handler as any)(mockReq as Request, mockRes as Response);

      expect(mockTriggerEmail).toHaveBeenCalledWith(expect.stringContaining("N/A"), expect.any(String), expect.any(String));
    });
  });
});
