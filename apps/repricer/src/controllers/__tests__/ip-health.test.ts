import express, { Request, Response } from "express";
import { GetCronSettingsList } from "../../services/mysql-v2";
import { postData } from "../../middleware/storage-sense-helpers/axios-helper";
import { TriggerEmail } from "../../middleware/storage-sense-helpers/email-helper";
import { applicationConfig } from "../../utility/config";
import { ipHealthController } from "../ip-health";

jest.mock("../../services/mysql-v2");
jest.mock("../../middleware/storage-sense-helpers/axios-helper");
jest.mock("../../middleware/storage-sense-helpers/email-helper");
jest.mock("../../utility/config", () => ({
  applicationConfig: {
    START_IP_HEALTH_CRON: true,
    CRON_IP_SCHEDULE: "*/5 * * * *",
    DEBUG_IP: "http://localhost:3000/help/check_ip_status",
    ENV_NAME: "test-env",
    IP_HEALTH_EMAIL_ID: "ip-health@test.com",
  },
}));

const mockSchedule = jest.fn();
jest.mock("node-cron", () => ({
  __esModule: true,
  default: {
    schedule: (...args: any[]) => mockSchedule(...args),
  },
}));

const mockGetCronSettingsList = GetCronSettingsList as jest.MockedFunction<typeof GetCronSettingsList>;
const mockPostData = postData as jest.MockedFunction<typeof postData>;
const mockTriggerEmail = TriggerEmail as jest.MockedFunction<typeof TriggerEmail>;

function getRouteHandler(router: express.Router, method: string, routePath: string): ((req: Request, res: Response) => void) | null {
  for (const layer of router.stack as any[]) {
    if (layer.route && layer.route.path === routePath && (layer.route.methods as any)[method]) {
      return layer.route.stack[0].handle;
    }
  }
  return null;
}

describe("ip-health Controller", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let statusMock: jest.Mock;
  let sendMock: jest.Mock;
  let handler: ((req: Request, res: Response) => void) | null;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation();
    statusMock = jest.fn().mockReturnThis();
    sendMock = jest.fn().mockReturnThis();
    mockRes = { status: statusMock, send: sendMock };
    mockReq = { params: {}, body: {}, query: {} };
    (applicationConfig as any).START_IP_HEALTH_CRON = true;
    handler = getRouteHandler(ipHealthController, "get", "/schedule/ip-health");
    mockTriggerEmail.mockResolvedValue(undefined as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("GET /schedule/ip-health", () => {
    it("should return 200 and message when START_IP_HEALTH_CRON is false", async () => {
      (applicationConfig as any).START_IP_HEALTH_CRON = false;

      await (handler as any)(mockReq, mockRes);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(sendMock).toHaveBeenCalledWith(expect.stringContaining("Ip-Health Cron not started as per settings"));
      expect(mockSchedule).not.toHaveBeenCalled();
    });

    it("should return 200 and success message when cron.schedule returns truthy", async () => {
      mockSchedule.mockReturnValue({});

      await (handler as any)(mockReq, mockRes);

      expect(mockSchedule).toHaveBeenCalledWith("*/5 * * * *", expect.any(Function), { scheduled: true });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(sendMock).toHaveBeenCalledWith(expect.stringContaining("Successfully Started Ip-Health Cron"));
    });

    it("should return 400 when cron.schedule returns falsy", async () => {
      mockSchedule.mockReturnValue(null);

      await (handler as any)(mockReq, mockRes);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(sendMock).toHaveBeenCalledWith(expect.stringContaining("Some error occurred while starting Ip-Health Cron"));
    });
  });

  describe("checkIpHealthV2 (via cron callback)", () => {
    const runCronCallback = async () => {
      mockSchedule.mockImplementation((_schedule: string, cb: () => void) => {
        setImmediate(() => void Promise.resolve(cb()));
        return {};
      });
      await (handler as any)(mockReq, mockRes);
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));
    };

    it("should call triggerExceptionEmail when GetCronSettingsList returns empty", async () => {
      mockGetCronSettingsList.mockResolvedValue([]);
      await runCronCallback();

      expect(mockGetCronSettingsList).toHaveBeenCalled();
      expect(mockPostData).not.toHaveBeenCalled();
      expect(mockTriggerEmail).toHaveBeenCalledWith(expect.stringContaining("Some error occurred while getting IP health"), expect.stringMatching(/IP-HEALTH \| test-env \| EXCEPTION \|/), "ip-health@test.com");
    });

    it("should call triggerExceptionEmail when GetCronSettingsList returns null", async () => {
      mockGetCronSettingsList.mockResolvedValue(null as any);
      await runCronCallback();

      expect(mockTriggerEmail).toHaveBeenCalledWith(expect.stringContaining("Some error occurred while getting IP health"), expect.stringMatching(/EXCEPTION/), "ip-health@test.com");
    });

    it("should log and not call postData when all FixedIp are null or empty", async () => {
      mockGetCronSettingsList.mockResolvedValue([
        { FixedIp: null, CronName: "Cron1" },
        { FixedIp: "", CronName: "Cron2" },
      ] as any);
      await runCronCallback();

      expect(mockPostData).not.toHaveBeenCalled();
      expect(mockTriggerEmail).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("No Fixed IP Found for the crons"));
    });

    it("should call postData and triggerExceptionEmail when postData returns non-SUCCESS", async () => {
      const cronSettings = [{ FixedIp: "192.168.1.1", CronName: "MainCron" }];
      mockGetCronSettingsList.mockResolvedValue(cronSettings as any);
      mockPostData.mockResolvedValue({
        data: { status: "ERROR" },
      } as any);
      await runCronCallback();

      expect(mockPostData).toHaveBeenCalledWith("http://localhost:3000/help/check_ip_status", { listOfIps: ["192.168.1.1"] });
      expect(mockTriggerEmail).toHaveBeenCalledWith(expect.stringContaining("Some error occurred while getting IP health"), expect.stringMatching(/EXCEPTION/), "ip-health@test.com");
    });

    it("should call triggerExceptionEmail when postData returns no data", async () => {
      mockGetCronSettingsList.mockResolvedValue([{ FixedIp: "192.168.1.1", CronName: "C1" }] as any);
      mockPostData.mockResolvedValue(null as any);
      await runCronCallback();

      expect(mockTriggerEmail).toHaveBeenCalledWith(expect.stringContaining("Some error occurred while getting IP health"), expect.stringMatching(/EXCEPTION/), "ip-health@test.com");
    });

    it("should call triggerExceptionEmail when postData.data is missing", async () => {
      mockGetCronSettingsList.mockResolvedValue([{ FixedIp: "192.168.1.1", CronName: "C1" }] as any);
      mockPostData.mockResolvedValue({} as any);
      await runCronCallback();

      expect(mockTriggerEmail).toHaveBeenCalledWith(expect.stringContaining("Some error occurred while getting IP health"), expect.stringMatching(/EXCEPTION/), "ip-health@test.com");
    });

    it("should build email body and TriggerEmail with SUCCESS when all IPs are GREEN", async () => {
      const cronSettings = [{ FixedIp: "192.168.1.1", CronName: "MainCron" }];
      mockGetCronSettingsList.mockResolvedValue(cronSettings as any);
      mockPostData.mockResolvedValue({
        data: {
          status: "SUCCESS",
          healthInfo: [
            {
              ip: "192.168.1.1",
              port: "3000",
              ipStatus: "GREEN",
              pingResponse: "12ms",
            },
          ],
        },
      } as any);
      await runCronCallback();

      expect(mockTriggerEmail).toHaveBeenCalledTimes(1);
      const [emailBody, subject, emailId] = mockTriggerEmail.mock.calls[0];
      expect(subject).toMatch(/IP-HEALTH \| test-env \| SUCCESS \|/);
      expect(emailId).toBe("ip-health@test.com");
      expect(emailBody).toContain("GREEN");
      expect(emailBody).toContain("MainCron");
      expect(emailBody).toContain("192.168.1.1");
      expect(emailBody).toContain("12ms");
      expect(emailBody).not.toContain("color:RED");
    });

    it("should build email body and TriggerEmail with FAILED when any IP is RED", async () => {
      const cronSettings = [
        { FixedIp: "192.168.1.1", CronName: "CronA" },
        { FixedIp: "192.168.1.2", CronName: "CronB" },
      ];
      mockGetCronSettingsList.mockResolvedValue(cronSettings as any);
      mockPostData.mockResolvedValue({
        data: {
          status: "SUCCESS",
          healthInfo: [
            {
              ip: "192.168.1.1",
              port: "3000",
              ipStatus: "GREEN",
              pingResponse: "10ms",
            },
            {
              ip: "192.168.1.2",
              port: "3000",
              ipStatus: "RED",
              pingResponse: "timeout",
            },
          ],
        },
      } as any);
      await runCronCallback();

      expect(mockTriggerEmail).toHaveBeenCalledTimes(1);
      const [emailBody, subject] = mockTriggerEmail.mock.calls[0];
      expect(subject).toMatch(/IP-HEALTH \| test-env \| FAILED \|/);
      expect(emailBody).toContain("GREEN");
      expect(emailBody).toContain("RED");
      expect(emailBody).toContain("CronA");
      expect(emailBody).toContain("CronB");
      expect(emailBody).toContain("timeout");
    });

    it("should filter out null/empty FixedIp before calling postData", async () => {
      mockGetCronSettingsList.mockResolvedValue([
        { FixedIp: "192.168.1.1", CronName: "C1" },
        { FixedIp: null, CronName: "C2" },
        { FixedIp: "", CronName: "C3" },
      ] as any);
      mockPostData.mockResolvedValue({
        data: {
          status: "SUCCESS",
          healthInfo: [{ ip: "192.168.1.1", port: "80", ipStatus: "GREEN", pingResponse: "1ms" }],
        },
      } as any);
      await runCronCallback();

      expect(mockPostData).toHaveBeenCalledWith("http://localhost:3000/help/check_ip_status", { listOfIps: ["192.168.1.1"] });
      expect(mockTriggerEmail).toHaveBeenCalledWith(expect.stringContaining("IP health status"), expect.stringMatching(/SUCCESS/), "ip-health@test.com");
    });

    it("should build email with empty tbody when healthInfo is empty and status is SUCCESS", async () => {
      mockGetCronSettingsList.mockResolvedValue([{ FixedIp: "192.168.1.1", CronName: "C1" }] as any);
      mockPostData.mockResolvedValue({
        data: {
          status: "SUCCESS",
          healthInfo: [],
        },
      } as any);
      await runCronCallback();

      expect(mockTriggerEmail).toHaveBeenCalledTimes(1);
      const [emailBody, subject] = mockTriggerEmail.mock.calls[0];
      expect(subject).toMatch(/SUCCESS/);
      expect(emailBody).toContain("<tbody>");
      expect(emailBody).toContain("</tbody>");
      expect(emailBody).toContain("IP health status");
    });

    it("should log when cron callback runs", async () => {
      mockGetCronSettingsList.mockResolvedValue([]);
      await runCronCallback();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("IP-HEALTH : Checking IP Health at"));
    });
  });
});
