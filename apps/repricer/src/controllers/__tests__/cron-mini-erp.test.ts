import { Request, Response } from "express";
import * as cronMiniErp from "../cron-mini-erp";
import * as httpMiddleware from "../../utility/http-wrappers";
import { GetMiniErpCronDetails, ToggleCronStatus, UpdateCronSettingsList } from "../../services/mysql-v2";
import cacheClient from "../../client/cacheClient";
import { CacheKey } from "@repricer-monorepo/shared";

jest.mock("../../utility/http-wrappers");
jest.mock("../../services/mysql-v2");
jest.mock("../../client/cacheClient", () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(),
  },
  GetCacheClientOptions: jest.fn((c: any) => ({ host: c?.CACHE_HOST_URL })),
}));
jest.mock("../../utility/config", () => ({
  applicationConfig: { CACHE_HOST_URL: "localhost" },
}));

const mockToggleMiniErpCron = httpMiddleware.toggleMiniErpCron as jest.MockedFunction<typeof httpMiddleware.toggleMiniErpCron>;
const mockRecreateMiniErpCron = httpMiddleware.recreateMiniErpCron as jest.MockedFunction<typeof httpMiddleware.recreateMiniErpCron>;
const mockGetMiniErpCronDetails = GetMiniErpCronDetails as jest.MockedFunction<typeof GetMiniErpCronDetails>;
const mockToggleCronStatus = ToggleCronStatus as jest.MockedFunction<typeof ToggleCronStatus>;
const mockUpdateCronSettingsList = UpdateCronSettingsList as jest.MockedFunction<typeof UpdateCronSettingsList>;

const mockCacheDelete = jest.fn().mockResolvedValue(1);

const CRON_ID_IN_MAPPING = "MiniErpFetchCron";
const CRON_VARIABLE = "MiniErpFetchCron";

describe("cron-mini-erp Controller", () => {
  let mockReq: Partial<Request> & { body?: any };
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn().mockReturnThis();
    mockRes = { json: jsonMock };
    mockReq = { body: {} };
    (cacheClient.getInstance as jest.Mock).mockReturnValue({
      delete: mockCacheDelete,
    });
  });

  describe("toggleCronStatus", () => {
    it("should return success when toggleMiniErpCron returns 200 and status is 1", async () => {
      mockReq.body = { id: CRON_ID_IN_MAPPING, status: 1 };
      mockToggleCronStatus.mockResolvedValue(undefined);
      mockToggleMiniErpCron.mockResolvedValue({
        status: 200,
        data: "Cron enabled",
      } as any);

      await cronMiniErp.toggleCronStatus(mockReq as Request, mockRes as Response);

      expect(mockToggleCronStatus).toHaveBeenCalledWith(CRON_ID_IN_MAPPING, "true", mockReq);
      expect(mockToggleMiniErpCron).toHaveBeenCalledWith({
        jobName: CRON_VARIABLE,
        status: 1,
      });
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Cron enabled",
      });
    });

    it("should call ToggleCronStatus with 'false' when status is 0", async () => {
      mockReq.body = { id: CRON_ID_IN_MAPPING, status: 0 };
      mockToggleCronStatus.mockResolvedValue(undefined);
      mockToggleMiniErpCron.mockResolvedValue({
        status: 200,
        data: "Cron disabled",
      } as any);

      await cronMiniErp.toggleCronStatus(mockReq as Request, mockRes as Response);

      expect(mockToggleCronStatus).toHaveBeenCalledWith(CRON_ID_IN_MAPPING, "false", mockReq);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Cron disabled",
      });
    });

    it("should return error when toggleMiniErpCron returns non-200", async () => {
      mockReq.body = { id: CRON_ID_IN_MAPPING, status: 1 };
      mockToggleCronStatus.mockResolvedValue(undefined);
      mockToggleMiniErpCron.mockResolvedValue({ status: 500 } as any);

      await cronMiniErp.toggleCronStatus(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: "Sorry some error occurred!! Please try again...",
      });
    });

    it("should return error when toggleMiniErpCron returns null/undefined", async () => {
      mockReq.body = { id: CRON_ID_IN_MAPPING, status: 1 };
      mockToggleCronStatus.mockResolvedValue(undefined);
      mockToggleMiniErpCron.mockResolvedValue(undefined as any);

      await cronMiniErp.toggleCronStatus(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: "Sorry some error occurred!! Please try again...",
      });
    });

    it("should call toggleMiniErpCron with undefined jobName when cronId not in mapping", async () => {
      mockReq.body = { id: "non-existent-cron-id", status: 1 };
      mockToggleCronStatus.mockResolvedValue(undefined);
      mockToggleMiniErpCron.mockResolvedValue({ status: 200, data: "ok" } as any);

      await cronMiniErp.toggleCronStatus(mockReq as Request, mockRes as Response);

      expect(mockToggleMiniErpCron).toHaveBeenCalledWith({
        jobName: undefined,
        status: 1,
      });
    });
  });

  describe("RecreateCron", () => {
    it("should return success when recreateMiniErpCron returns 200", async () => {
      mockReq.body = { jobName: "SomeCron" };
      mockRecreateMiniErpCron.mockResolvedValue({
        status: 200,
        data: "Cron recreated",
      } as any);

      await cronMiniErp.RecreateCron(mockReq as Request, mockRes as Response);

      expect(mockRecreateMiniErpCron).toHaveBeenCalledWith({
        jobName: "SomeCron",
      });
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Cron recreated",
      });
    });

    it("should return error when recreateMiniErpCron returns non-200", async () => {
      mockReq.body = { jobName: "SomeCron" };
      mockRecreateMiniErpCron.mockResolvedValue({ status: 500 } as any);

      await cronMiniErp.RecreateCron(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: "Sorry some error occurred!! Please try again...",
      });
    });

    it("should return error when recreateMiniErpCron returns null", async () => {
      mockReq.body = { jobName: "SomeCron" };
      mockRecreateMiniErpCron.mockResolvedValue(null as any);

      await cronMiniErp.RecreateCron(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: "Sorry some error occurred!! Please try again...",
      });
    });
  });

  describe("UpdateMiniErpCronExpression", () => {
    const baseCronRow = {
      CronId: CRON_ID_IN_MAPPING,
      CronName: "Mini ERP Fetch",
      CronTimeUnit: "hours",
      CronTime: 2,
      Offset: 0,
      CronStatus: "1",
      IpType: 1,
      FixedIp: "",
      AlternateProxyProvider: [] as string[],
    };

    it("should return error when GetMiniErpCronDetails returns null", async () => {
      mockReq.body = {};
      mockGetMiniErpCronDetails.mockResolvedValue(null);

      await cronMiniErp.UpdateMiniErpCronExpression(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: "No Mini ERP cron details found.",
      });
      expect(mockUpdateCronSettingsList).not.toHaveBeenCalled();
    });

    it("should return error when GetMiniErpCronDetails returns empty array", async () => {
      mockReq.body = {};
      mockGetMiniErpCronDetails.mockResolvedValue([]);

      await cronMiniErp.UpdateMiniErpCronExpression(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: "No Mini ERP cron details found.",
      });
    });

    it("should return 'No Changes found' when payload matches DB (no updates)", async () => {
      mockGetMiniErpCronDetails.mockResolvedValue([baseCronRow]);
      mockReq.body = {};

      await cronMiniErp.UpdateMiniErpCronExpression(mockReq as Request, mockRes as Response);

      expect(mockUpdateCronSettingsList).not.toHaveBeenCalled();
      expect(mockRecreateMiniErpCron).not.toHaveBeenCalled();
      expect(mockCacheDelete).not.toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "No Changes found to update.",
      });
    });

    it("should update DB and invalidate cache when only CronName changes (no recreate)", async () => {
      mockGetMiniErpCronDetails.mockResolvedValue([baseCronRow]);
      mockReq.body = {
        [`me_cron_name_${CRON_ID_IN_MAPPING}`]: "Updated Name",
      };
      mockUpdateCronSettingsList.mockResolvedValue(undefined);

      await cronMiniErp.UpdateMiniErpCronExpression(mockReq as Request, mockRes as Response);

      expect(mockUpdateCronSettingsList).toHaveBeenCalled();
      expect(mockUpdateCronSettingsList.mock.calls[0][0]).toHaveLength(1);
      expect(mockUpdateCronSettingsList.mock.calls[0][0][0].CronName).toBe("Updated Name");
      expect(mockRecreateMiniErpCron).not.toHaveBeenCalled();
      expect(mockCacheDelete).toHaveBeenCalledWith(CacheKey.MINI_ERP_CRON_DETAILS);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Mini ERP Cron updated successfully.",
      });
    });

    it("should update DB, call recreateMiniErpCron for each changed cron, and invalidate cache when time/offset changes", async () => {
      mockGetMiniErpCronDetails.mockResolvedValue([baseCronRow]);
      mockReq.body = {
        [`me_cron_time_${CRON_ID_IN_MAPPING}`]: "5",
        [`me_cron_time_unit_${CRON_ID_IN_MAPPING}`]: "hours",
        [`me_offset_${CRON_ID_IN_MAPPING}`]: "10",
      };
      mockUpdateCronSettingsList.mockResolvedValue(undefined);
      mockRecreateMiniErpCron.mockResolvedValue({ status: 200 } as any);

      await cronMiniErp.UpdateMiniErpCronExpression(mockReq as Request, mockRes as Response);

      expect(mockUpdateCronSettingsList).toHaveBeenCalled();
      expect(mockRecreateMiniErpCron).toHaveBeenCalledWith({
        jobName: CRON_VARIABLE,
      });
      expect(mockCacheDelete).toHaveBeenCalledWith(CacheKey.MINI_ERP_CRON_DETAILS);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Mini ERP Cron updated successfully.",
      });
    });

    it("should normalize string offset and CronTime from payload and DB", async () => {
      mockGetMiniErpCronDetails.mockResolvedValue([
        {
          ...baseCronRow,
          CronTime: "3" as any,
          Offset: null,
        },
      ]);
      mockReq.body = {
        [`me_offset_${CRON_ID_IN_MAPPING}`]: "15",
        [`me_cron_time_${CRON_ID_IN_MAPPING}`]: "4",
      };
      mockUpdateCronSettingsList.mockResolvedValue(undefined);
      mockRecreateMiniErpCron.mockResolvedValue({ status: 200 } as any);

      await cronMiniErp.UpdateMiniErpCronExpression(mockReq as Request, mockRes as Response);

      expect(mockUpdateCronSettingsList).toHaveBeenCalled();
      const updatedPayload = mockUpdateCronSettingsList.mock.calls[0][0][0];
      expect(updatedPayload.Offset).toBe(15);
      expect(updatedPayload.CronTime).toBe(4);
    });

    it("should handle multiple crons and only update/recreate changed ones", async () => {
      const cron2Id = "StockUpdateCron";
      mockGetMiniErpCronDetails.mockResolvedValue([
        baseCronRow,
        {
          ...baseCronRow,
          CronId: cron2Id,
          CronName: "Stock Update",
        },
      ]);
      mockReq.body = {
        [`me_cron_name_${CRON_ID_IN_MAPPING}`]: "New E1 Name",
      };
      mockUpdateCronSettingsList.mockResolvedValue(undefined);

      await cronMiniErp.UpdateMiniErpCronExpression(mockReq as Request, mockRes as Response);

      expect(mockUpdateCronSettingsList).toHaveBeenCalledTimes(1);
      expect(mockUpdateCronSettingsList.mock.calls[0][0]).toHaveLength(1);
      expect(mockUpdateCronSettingsList.mock.calls[0][0][0].CronId).toBe(CRON_ID_IN_MAPPING);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Mini ERP Cron updated successfully.",
      });
    });

    it("should use payload values when provided, else fall back to DB values", async () => {
      mockGetMiniErpCronDetails.mockResolvedValue([
        {
          ...baseCronRow,
          CronName: "Original",
          CronTimeUnit: "minutes",
          CronTime: 30,
          Offset: 5,
        },
      ]);
      mockReq.body = {
        [`me_cron_name_${CRON_ID_IN_MAPPING}`]: "FromPayload",
        [`me_cron_time_unit_${CRON_ID_IN_MAPPING}`]: "hours",
      };
      mockUpdateCronSettingsList.mockResolvedValue(undefined);

      await cronMiniErp.UpdateMiniErpCronExpression(mockReq as Request, mockRes as Response);

      const payload = mockUpdateCronSettingsList.mock.calls[0][0][0];
      expect(payload.CronName).toBe("FromPayload");
      expect(payload.CronTimeUnit).toBe("hours");
      expect(payload.CronTime).toBe(30);
      expect(payload.Offset).toBe(5);
    });

    it("should normalize invalid string offset to 0 (normalizeToNumber coverage)", async () => {
      mockGetMiniErpCronDetails.mockResolvedValue([
        {
          ...baseCronRow,
          CronTime: 2,
          Offset: 0,
        },
      ]);
      mockReq.body = {
        [`me_offset_${CRON_ID_IN_MAPPING}`]: "not-a-number",
        [`me_cron_time_${CRON_ID_IN_MAPPING}`]: 4,
      };
      mockUpdateCronSettingsList.mockResolvedValue(undefined);
      mockRecreateMiniErpCron.mockResolvedValue({ status: 200 } as any);

      await cronMiniErp.UpdateMiniErpCronExpression(mockReq as Request, mockRes as Response);

      const payload = mockUpdateCronSettingsList.mock.calls[0][0][0];
      expect(payload.Offset).toBe(0);
      expect(payload.CronTime).toBe(4);
    });

    it("should call recreateMiniErpCron for each cronId in recreatePayload", async () => {
      const secondCronId = "StockUpdateCron";
      mockGetMiniErpCronDetails.mockResolvedValue([
        { ...baseCronRow, CronId: CRON_ID_IN_MAPPING, CronTime: 1 },
        {
          ...baseCronRow,
          CronId: secondCronId,
          CronName: "Stock",
          CronTime: 2,
        },
      ]);
      mockReq.body = {
        [`me_cron_time_${CRON_ID_IN_MAPPING}`]: "3",
        [`me_cron_time_${secondCronId}`]: "4",
      };
      mockUpdateCronSettingsList.mockResolvedValue(undefined);
      mockRecreateMiniErpCron.mockResolvedValue({ status: 200 } as any);

      await cronMiniErp.UpdateMiniErpCronExpression(mockReq as Request, mockRes as Response);

      expect(mockRecreateMiniErpCron).toHaveBeenCalledTimes(2);
      expect(mockRecreateMiniErpCron).toHaveBeenCalledWith({
        jobName: CRON_VARIABLE,
      });
      expect(mockRecreateMiniErpCron).toHaveBeenCalledWith({
        jobName: "StockUpdateCron",
      });
    });
  });
});
