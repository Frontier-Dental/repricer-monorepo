import { Request, Response } from "express";
import * as cronSettingsController from "../cron_settings";
import * as mongoMiddleware from "../../services/mongo";
import * as httpMiddleware from "../../utility/http-wrappers";
import * as SessionHelper from "../../utility/session-helper";
import * as MapperHelper from "../../middleware/mapper-helper";
import { GetConfigurations, GetCronSettingsList, UpdateCronSettingsList, ToggleCronStatus as SqlToggleCronStatus } from "../../services/mysql-v2";

jest.mock("../../services/mongo");
jest.mock("../../utility/http-wrappers");
jest.mock("../../utility/session-helper");
jest.mock("../../middleware/mapper-helper");
jest.mock("../../services/mysql-v2");

const mockGet422ProductCountByType = mongoMiddleware.Get422ProductCountByType as jest.MockedFunction<typeof mongoMiddleware.Get422ProductCountByType>;
const mockGetContextErrorItemsCount = mongoMiddleware.GetContextErrorItemsCount as jest.MockedFunction<typeof mongoMiddleware.GetContextErrorItemsCount>;
const mockGet422ProductDetailsByType = mongoMiddleware.Get422ProductDetailsByType as jest.MockedFunction<typeof mongoMiddleware.Get422ProductDetailsByType>;
const mockRecreateCron = httpMiddleware.recreateCron as jest.MockedFunction<typeof httpMiddleware.recreateCron>;
const mockStartCron = httpMiddleware.startCron as jest.MockedFunction<typeof httpMiddleware.startCron>;
const mockStopCron = httpMiddleware.stopCron as jest.MockedFunction<typeof httpMiddleware.stopCron>;
const mockGetAuditValue = SessionHelper.GetAuditValue as jest.MockedFunction<typeof SessionHelper.GetAuditValue>;
const mockGetAlternateProxyProviderId = MapperHelper.GetAlternateProxyProviderId as jest.MockedFunction<typeof MapperHelper.GetAlternateProxyProviderId>;
const mockGetAlternateProxyProviderName = MapperHelper.GetAlternateProxyProviderName as jest.MockedFunction<typeof MapperHelper.GetAlternateProxyProviderName>;
const mockMapAlternateProxyProviderDetails = MapperHelper.MapAlternateProxyProviderDetails as jest.MockedFunction<typeof MapperHelper.MapAlternateProxyProviderDetails>;

const mockWriteResolve = jest.fn().mockResolvedValue(undefined);
const mockAddRows = jest.fn();
const mockWorksheet = {
  columns: undefined as any,
  addRows: mockAddRows,
  autoFilter: undefined as any,
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

// cronMapping.json is used at runtime; ensure we have matching ids for tests
const VISIBLE_CRON_ID = "ae319c90d19e48cd9d70c71bd46c0546";
const HIDDEN_422_CRON_ID = "DUMMY-422-Error";

describe("Cron-Settings Controller", () => {
  let mockReq: Partial<Request> & { session?: any; body?: any; params?: any };
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let renderMock: jest.Mock;
  let setHeaderMock: jest.Mock;
  let statusMock: jest.Mock;
  let endMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn().mockReturnThis();
    renderMock = jest.fn();
    setHeaderMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnThis();
    endMock = jest.fn();
    mockRes = {
      json: jsonMock,
      render: renderMock,
      setHeader: setHeaderMock,
      status: statusMock,
      end: endMock,
    };
    mockReq = {
      body: {},
      params: {},
      session: { users_id: { userRole: "admin", userName: "testuser" } } as any,
    };
    mockGetAuditValue.mockResolvedValue(null);
    mockGetAlternateProxyProviderId.mockResolvedValue(99);
    mockGetAlternateProxyProviderName.mockResolvedValue("ProxyName");
    mockMapAlternateProxyProviderDetails.mockResolvedValue([]);
    mockGet422ProductCountByType.mockResolvedValue(0);
    mockGetContextErrorItemsCount.mockResolvedValue(0);
    mockGet422ProductDetailsByType.mockResolvedValue([]);
    mockWriteResolve.mockResolvedValue(undefined);
  });

  describe("getCronSettings", () => {
    it("should render settings list with visible crons and custom 422 details", async () => {
      const visibleCron = {
        CronId: VISIBLE_CRON_ID,
        CronName: "E1",
        IsHidden: false,
        UpdatedTime: new Date("2024-01-15T10:00:00Z"),
        AuditInfo: {},
        ProxyProvider: 1,
        IpType: 1,
        FixedIp: "",
        Offset: 0,
        AlternateProxyProvider: [],
      };
      const hiddenCron = {
        CronId: HIDDEN_422_CRON_ID,
        CronName: "422Cron",
        IsHidden: true,
        CronStatus: true,
        ProxyProvider: 1,
        IpType: 0,
        FixedIp: "",
        Offset: 0,
        CronTime: 1,
        CronTimeUnit: "hour",
        AlternateProxyProvider: [],
      };
      const cronSettingsResult = [visibleCron, hiddenCron];
      const configItems = [{ proxyProvider: 1, proxyProviderName: "P1" }];

      (GetCronSettingsList as jest.Mock).mockResolvedValue(cronSettingsResult);
      (GetConfigurations as jest.Mock).mockResolvedValue(configItems);
      mockGetAuditValue.mockResolvedValue("user1");

      await cronSettingsController.getCronSettings(mockReq as Request, mockRes as Response);

      expect(GetCronSettingsList).toHaveBeenCalled();
      expect(GetConfigurations).toHaveBeenCalledWith(true);
      expect(renderMock).toHaveBeenCalledWith("pages/settings/settingsList", expect.any(Object));
      const renderArg = renderMock.mock.calls[0][1];
      expect(renderArg.groupName).toBe("settings");
      expect(renderArg.userRole).toBe("admin");
      expect(renderArg.configItems).toEqual(configItems);
      expect(renderArg.settings.custom).toBeDefined();
      expect(renderArg.settings.custom.CronId).toBe(HIDDEN_422_CRON_ID);
      expect(renderArg.settings.custom.CronName).toBe("422Cron");
      expect(renderArg.settings.custom.NoOf422Products).toBe(0);
      expect(renderArg.settings.custom.NoOfPriceUpdateProducts).toBe(0);
      expect(renderArg.settings.custom.EligibleProductsCount).toBe(0);
      expect(mockGet422ProductCountByType).toHaveBeenCalledWith("422_ERROR");
      expect(mockGet422ProductCountByType).toHaveBeenCalledWith("PRICE_UPDATE");
      expect(mockGetContextErrorItemsCount).toHaveBeenCalledWith(true);
    });

    it("should filter out hidden crons from main settings list", async () => {
      const visibleCron = {
        CronId: VISIBLE_CRON_ID,
        CronName: "E1",
        IsHidden: false,
        UpdatedTime: new Date(),
        AuditInfo: {},
        ProxyProvider: 1,
        AlternateProxyProvider: [],
      };
      const hiddenCron = {
        CronId: HIDDEN_422_CRON_ID,
        CronName: "422",
        IsHidden: true,
        CronStatus: false,
        ProxyProvider: 0,
        IpType: 0,
        FixedIp: "",
        Offset: 0,
        CronTime: 0,
        CronTimeUnit: "hour",
        AlternateProxyProvider: [],
      };
      (GetCronSettingsList as jest.Mock).mockResolvedValue([visibleCron, hiddenCron]);
      (GetConfigurations as jest.Mock).mockResolvedValue([]);

      await cronSettingsController.getCronSettings(mockReq as Request, mockRes as Response);

      const renderArg = renderMock.mock.calls[0][1];
      expect(Array.isArray(renderArg.settings)).toBe(true);
      expect(renderArg.settings).toHaveLength(1);
      expect(renderArg.settings[0].CronId).toBe(VISIBLE_CRON_ID);
      expect(renderArg.settings[0].UpdatedTime).toMatch(/\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}/);
      expect(renderArg.settings[0].ThresholdReached).toBe(false);
      expect(renderArg.settings[0].CloseToThresholdReached).toBe(false);
    });

    it("should handle empty session userRole", async () => {
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ CronId: HIDDEN_422_CRON_ID, IsHidden: true, CronStatus: false, ProxyProvider: 0, IpType: 0, FixedIp: "", Offset: 0, CronTime: 0, CronTimeUnit: "hour", AlternateProxyProvider: [] }]);
      (GetConfigurations as jest.Mock).mockResolvedValue([]);
      mockReq.session = undefined;

      await cronSettingsController.getCronSettings(mockReq as Request, mockRes as Response);

      expect(renderMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ userRole: undefined }));
    });
  });

  describe("updateCronSettings", () => {
    it("should return no changes when payload matches existing settings", async () => {
      const visibleCron = {
        CronId: VISIBLE_CRON_ID,
        CronName: "E1",
        IsHidden: false,
        CronTime: 1,
        CronTimeUnit: "hour",
        Offset: 0,
        ProxyProvider: 1,
        IpType: 1,
        FixedIp: "",
        AlternateProxyProvider: [],
      };
      const hiddenCron = {
        CronId: HIDDEN_422_CRON_ID,
        CronName: "422",
        IsHidden: true,
        CronStatus: true,
        CronTime: 2,
        CronTimeUnit: "hour",
        Offset: 0,
        ProxyProvider: 1,
        IpType: 0,
        FixedIp: "",
        AlternateProxyProvider: [],
      };
      (GetCronSettingsList as jest.Mock).mockResolvedValue([visibleCron, hiddenCron]);
      mockMapAlternateProxyProviderDetails.mockResolvedValue([]);

      mockReq.body = {
        cron_id_hdn: { "0": VISIBLE_CRON_ID },
        cron_name: { "0": "E1" },
        cron_time_unit: { "0": "hour" },
        cron_time: { "0": "1" },
        offset: { "0": 0 },
        proxy_provider: { "0": 1 },
        [`ip_type_${VISIBLE_CRON_ID}`]: 1,
        [`fixed_ip_${VISIBLE_CRON_ID}`]: "",
        cron_time_422: 2,
        cron_time_unit_422: "hour",
        offset_422: 0,
        proxy_provider_422: 1,
        [`ip_type_${HIDDEN_422_CRON_ID}`]: 0,
        [`fixed_ip_${HIDDEN_422_CRON_ID}`]: "",
      };

      await cronSettingsController.updateCronSettings(mockReq as Request, mockRes as Response);

      expect(UpdateCronSettingsList).not.toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "No Changes found to update.",
      });
    });

    it("should update settings and return success when no cron key changes", async () => {
      const visibleCron = {
        CronId: VISIBLE_CRON_ID,
        CronName: "E1",
        IsHidden: false,
        CronTime: 1,
        CronTimeUnit: "hour",
        Offset: 0,
        ProxyProvider: 1,
        IpType: 1,
        FixedIp: "",
        AlternateProxyProvider: [],
      };
      const hiddenCron = {
        CronId: HIDDEN_422_CRON_ID,
        CronName: "422",
        IsHidden: true,
        CronStatus: true,
        CronTime: 2,
        CronTimeUnit: "hour",
        Offset: 0,
        ProxyProvider: 1,
        IpType: 0,
        FixedIp: "",
        AlternateProxyProvider: [],
      };
      (GetCronSettingsList as jest.Mock).mockResolvedValue([visibleCron, hiddenCron]);
      (UpdateCronSettingsList as jest.Mock).mockResolvedValue(undefined);
      mockMapAlternateProxyProviderDetails.mockResolvedValue([{ Sequence: 1, ProxyProvider: 2 }]);

      mockReq.body = {
        cron_id_hdn: { "0": VISIBLE_CRON_ID },
        cron_name: { "0": "E1" },
        cron_time_unit: { "0": "hour" },
        cron_time: { "0": "1" },
        offset: { "0": 0 },
        proxy_provider: { "0": 2 },
        [`ip_type_${VISIBLE_CRON_ID}`]: 1,
        [`fixed_ip_${VISIBLE_CRON_ID}`]: "",
        cron_time_422: 2,
        cron_time_unit_422: "hour",
        offset_422: 0,
        proxy_provider_422: 1,
        [`ip_type_${HIDDEN_422_CRON_ID}`]: 0,
        [`fixed_ip_${HIDDEN_422_CRON_ID}`]: "",
      };

      await cronSettingsController.updateCronSettings(mockReq as Request, mockRes as Response);

      expect(UpdateCronSettingsList).toHaveBeenCalled();
      expect(mockRecreateCron).not.toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Cron settings updated successfully.",
      });
    });

    it("should update settings, call recreateCron and return success when status 200", async () => {
      const visibleCron = {
        CronId: VISIBLE_CRON_ID,
        CronName: "E1",
        IsHidden: false,
        CronTime: 1,
        CronTimeUnit: "hour",
        Offset: 0,
        ProxyProvider: 1,
        IpType: 1,
        FixedIp: "",
        AlternateProxyProvider: [],
      };
      const hiddenCron = {
        CronId: HIDDEN_422_CRON_ID,
        CronName: "422",
        IsHidden: true,
        CronStatus: true,
        CronTime: 2,
        CronTimeUnit: "hour",
        Offset: 0,
        ProxyProvider: 1,
        IpType: 0,
        FixedIp: "",
        AlternateProxyProvider: [],
      };
      (GetCronSettingsList as jest.Mock).mockResolvedValue([visibleCron, hiddenCron]);
      (UpdateCronSettingsList as jest.Mock).mockResolvedValue(undefined);
      mockRecreateCron.mockResolvedValue({ status: 200 } as any);
      mockMapAlternateProxyProviderDetails.mockResolvedValue([]);

      mockReq.body = {
        cron_id_hdn: { "0": VISIBLE_CRON_ID },
        cron_name: { "0": "E1" },
        cron_time_unit: { "0": "hour" },
        cron_time: { "0": "2" },
        offset: { "0": 5 },
        proxy_provider: { "0": 1 },
        [`ip_type_${VISIBLE_CRON_ID}`]: 1,
        [`fixed_ip_${VISIBLE_CRON_ID}`]: "",
        cron_time_422: 2,
        cron_time_unit_422: "hour",
        offset_422: 0,
        proxy_provider_422: 1,
        [`ip_type_${HIDDEN_422_CRON_ID}`]: 0,
        [`fixed_ip_${HIDDEN_422_CRON_ID}`]: "",
      };

      await cronSettingsController.updateCronSettings(mockReq as Request, mockRes as Response);

      expect(UpdateCronSettingsList).toHaveBeenCalled();
      expect(mockRecreateCron).toHaveBeenCalledWith(["_E1Cron"]);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Cron settings updated successfully.",
      });
    });

    it("should rollback and return false when recreateCron returns response.data", async () => {
      const visibleCron = {
        CronId: VISIBLE_CRON_ID,
        CronName: "E1",
        IsHidden: false,
        CronTime: 1,
        CronTimeUnit: "hour",
        Offset: 0,
        ProxyProvider: 1,
        IpType: 1,
        FixedIp: "",
        AlternateProxyProvider: [],
      };
      const hiddenCron = {
        CronId: HIDDEN_422_CRON_ID,
        IsHidden: true,
        CronStatus: true,
        CronTime: 2,
        CronTimeUnit: "hour",
        Offset: 0,
        ProxyProvider: 1,
        IpType: 0,
        FixedIp: "",
        AlternateProxyProvider: [],
      };
      (GetCronSettingsList as jest.Mock).mockResolvedValue([visibleCron, hiddenCron]);
      (UpdateCronSettingsList as jest.Mock).mockResolvedValue(undefined);
      mockRecreateCron.mockResolvedValue({ response: { data: "Cron service error" } } as any);
      mockMapAlternateProxyProviderDetails.mockResolvedValue([]);

      mockReq.body = {
        cron_id_hdn: { "0": VISIBLE_CRON_ID },
        cron_name: { "0": "E1" },
        cron_time_unit: { "0": "hour" },
        cron_time: { "0": "3" },
        offset: { "0": 0 },
        proxy_provider: { "0": 1 },
        [`ip_type_${VISIBLE_CRON_ID}`]: 1,
        [`fixed_ip_${VISIBLE_CRON_ID}`]: "",
        cron_time_422: 2,
        cron_time_unit_422: "hour",
        offset_422: 0,
        proxy_provider_422: 1,
        [`ip_type_${HIDDEN_422_CRON_ID}`]: 0,
        [`fixed_ip_${HIDDEN_422_CRON_ID}`]: "",
      };

      await cronSettingsController.updateCronSettings(mockReq as Request, mockRes as Response);

      expect(UpdateCronSettingsList).toHaveBeenCalledTimes(2);
      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: "Cron service error",
      });
    });

    it("should rollback and return false when recreateCron returns message", async () => {
      const visibleCron = {
        CronId: VISIBLE_CRON_ID,
        CronName: "E1",
        IsHidden: false,
        CronTime: 1,
        CronTimeUnit: "hour",
        Offset: 0,
        ProxyProvider: 1,
        IpType: 1,
        FixedIp: "",
        AlternateProxyProvider: [],
      };
      const hiddenCron = {
        CronId: HIDDEN_422_CRON_ID,
        IsHidden: true,
        CronStatus: true,
        CronTime: 2,
        CronTimeUnit: "hour",
        Offset: 0,
        ProxyProvider: 1,
        IpType: 0,
        FixedIp: "",
        AlternateProxyProvider: [],
      };
      (GetCronSettingsList as jest.Mock).mockResolvedValue([visibleCron, hiddenCron]);
      (UpdateCronSettingsList as jest.Mock).mockResolvedValue(undefined);
      mockRecreateCron.mockResolvedValue({ response: {}, message: "Network error" } as any);
      mockMapAlternateProxyProviderDetails.mockResolvedValue([]);

      mockReq.body = {
        cron_id_hdn: { "0": VISIBLE_CRON_ID },
        cron_name: { "0": "E1" },
        cron_time_unit: { "0": "hour" },
        cron_time: { "0": "4" },
        offset: { "0": 0 },
        proxy_provider: { "0": 1 },
        [`ip_type_${VISIBLE_CRON_ID}`]: 1,
        [`fixed_ip_${VISIBLE_CRON_ID}`]: "",
        cron_time_422: 2,
        cron_time_unit_422: "hour",
        offset_422: 0,
        proxy_provider_422: 1,
        [`ip_type_${HIDDEN_422_CRON_ID}`]: 0,
        [`fixed_ip_${HIDDEN_422_CRON_ID}`]: "",
      };

      await cronSettingsController.updateCronSettings(mockReq as Request, mockRes as Response);

      expect(UpdateCronSettingsList).toHaveBeenCalledTimes(2);
      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: "Network error",
      });
    });

    it("should rollback and return Cron update failed when recreateCron returns no status/data/message", async () => {
      const visibleCron = {
        CronId: VISIBLE_CRON_ID,
        CronName: "E1",
        IsHidden: false,
        CronTime: 1,
        CronTimeUnit: "hour",
        Offset: 0,
        ProxyProvider: 1,
        IpType: 1,
        FixedIp: "",
        AlternateProxyProvider: [],
      };
      const hiddenCron = {
        CronId: HIDDEN_422_CRON_ID,
        IsHidden: true,
        CronStatus: true,
        CronTime: 2,
        CronTimeUnit: "hour",
        Offset: 0,
        ProxyProvider: 1,
        IpType: 0,
        FixedIp: "",
        AlternateProxyProvider: [],
      };
      (GetCronSettingsList as jest.Mock).mockResolvedValue([visibleCron, hiddenCron]);
      (UpdateCronSettingsList as jest.Mock).mockResolvedValue(undefined);
      mockRecreateCron.mockResolvedValue({ response: {} } as any);
      mockMapAlternateProxyProviderDetails.mockResolvedValue([]);

      mockReq.body = {
        cron_id_hdn: { "0": VISIBLE_CRON_ID },
        cron_name: { "0": "E1" },
        cron_time_unit: { "0": "hour" },
        cron_time: { "0": "5" },
        offset: { "0": 0 },
        proxy_provider: { "0": 1 },
        [`ip_type_${VISIBLE_CRON_ID}`]: 1,
        [`fixed_ip_${VISIBLE_CRON_ID}`]: "",
        cron_time_422: 2,
        cron_time_unit_422: "hour",
        offset_422: 0,
        proxy_provider_422: 1,
        [`ip_type_${HIDDEN_422_CRON_ID}`]: 0,
        [`fixed_ip_${HIDDEN_422_CRON_ID}`]: "",
      };

      await cronSettingsController.updateCronSettings(mockReq as Request, mockRes as Response);

      expect(UpdateCronSettingsList).toHaveBeenCalledTimes(2);
      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: "Cron update failed. Please retry",
      });
    });

    it("should update 422 cron when only hidden cron differs", async () => {
      const visibleCron = {
        CronId: VISIBLE_CRON_ID,
        CronName: "E1",
        IsHidden: false,
        CronTime: 1,
        CronTimeUnit: "hour",
        Offset: 0,
        ProxyProvider: 1,
        IpType: 1,
        FixedIp: "",
        AlternateProxyProvider: [],
      };
      const hiddenCron = {
        CronId: HIDDEN_422_CRON_ID,
        CronName: "422",
        IsHidden: true,
        CronStatus: true,
        CronTime: 2,
        CronTimeUnit: "hour",
        Offset: 0,
        ProxyProvider: 1,
        IpType: 0,
        FixedIp: "",
        AlternateProxyProvider: [],
      };
      (GetCronSettingsList as jest.Mock).mockResolvedValue([visibleCron, hiddenCron]);
      (UpdateCronSettingsList as jest.Mock).mockResolvedValue(undefined);
      mockRecreateCron.mockResolvedValue({ status: 200 } as any);
      mockMapAlternateProxyProviderDetails.mockResolvedValueOnce([]).mockResolvedValueOnce([{ Sequence: 1, ProxyProvider: 2 }]);

      mockReq.body = {
        cron_id_hdn: { "0": VISIBLE_CRON_ID },
        cron_name: { "0": "E1" },
        cron_time_unit: { "0": "hour" },
        cron_time: { "0": "1" },
        offset: { "0": 0 },
        proxy_provider: { "0": 1 },
        [`ip_type_${VISIBLE_CRON_ID}`]: 1,
        [`fixed_ip_${VISIBLE_CRON_ID}`]: "",
        cron_time_422: 3,
        cron_time_unit_422: "hour",
        offset_422: 1,
        proxy_provider_422: 1,
        [`ip_type_${HIDDEN_422_CRON_ID}`]: 0,
        [`fixed_ip_${HIDDEN_422_CRON_ID}`]: "",
      };

      await cronSettingsController.updateCronSettings(mockReq as Request, mockRes as Response);

      expect(UpdateCronSettingsList).toHaveBeenCalled();
      expect(mockRecreateCron).toHaveBeenCalledWith(["_Error422Cron"]);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Cron settings updated successfully.",
      });
    });
  });

  describe("toggleCronStatus", () => {
    it("should toggle by CronName and start cron when Action is true", async () => {
      const crons = [{ CronId: VISIBLE_CRON_ID, CronName: "E1Cron", CronStatus: false, IsHidden: false }];
      (GetCronSettingsList as jest.Mock).mockResolvedValue(crons);
      (SqlToggleCronStatus as jest.Mock).mockResolvedValue(undefined);
      mockStartCron.mockResolvedValue({ status: 200 } as any);
      mockReq.body = { CronName: "E1Cron", Action: "true" };

      await cronSettingsController.toggleCronStatus(mockReq as Request, mockRes as Response);

      expect(SqlToggleCronStatus).toHaveBeenCalledWith(VISIBLE_CRON_ID, true, mockReq);
      expect(mockStartCron).toHaveBeenCalledWith({ jobName: "E1Cron", cronId: null });
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Cron E1Cron Started Successfully.",
      });
    });

    it("should toggle by CronName and stop cron when Action is false", async () => {
      const crons = [{ CronId: VISIBLE_CRON_ID, CronName: "E1Cron", CronStatus: true, IsHidden: false }];
      (GetCronSettingsList as jest.Mock).mockResolvedValue(crons);
      (SqlToggleCronStatus as jest.Mock).mockResolvedValue(undefined);
      mockStopCron.mockResolvedValue({ status: 200 } as any);
      mockReq.body = { CronName: "E1Cron", Action: "false" };

      await cronSettingsController.toggleCronStatus(mockReq as Request, mockRes as Response);

      expect(SqlToggleCronStatus).toHaveBeenCalledWith(VISIBLE_CRON_ID, false, mockReq);
      expect(mockStopCron).toHaveBeenCalledWith({ jobName: "E1Cron" });
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Cron E1Cron Stopped Successfully.",
      });
    });

    it("should toggle by CronId and start cron when Action differs from existing", async () => {
      const crons = [{ CronId: VISIBLE_CRON_ID, CronName: "E1", CronStatus: false, IsHidden: false }];
      (GetCronSettingsList as jest.Mock).mockResolvedValue(crons);
      (SqlToggleCronStatus as jest.Mock).mockResolvedValue(undefined);
      mockStartCron.mockResolvedValue({ status: 200 } as any);
      mockReq.body = { CronId: VISIBLE_CRON_ID, Action: "true" };

      await cronSettingsController.toggleCronStatus(mockReq as Request, mockRes as Response);

      expect(SqlToggleCronStatus).toHaveBeenCalledWith(VISIBLE_CRON_ID, true, mockReq);
      expect(mockStartCron).toHaveBeenCalledWith({
        jobName: "_E1Cron",
        cronId: VISIBLE_CRON_ID,
      });
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Cron ae319c90d19e48cd9d70c71bd46c0546 Started Successfully.",
      });
    });

    it("should toggle by CronId and stop cron when Action is false", async () => {
      const crons = [{ CronId: VISIBLE_CRON_ID, CronName: "E1", CronStatus: true, IsHidden: false }];
      (GetCronSettingsList as jest.Mock).mockResolvedValue(crons);
      (SqlToggleCronStatus as jest.Mock).mockResolvedValue(undefined);
      mockStopCron.mockResolvedValue({ status: 200 } as any);
      mockReq.body = { CronId: VISIBLE_CRON_ID, Action: "false" };

      await cronSettingsController.toggleCronStatus(mockReq as Request, mockRes as Response);

      expect(mockStopCron).toHaveBeenCalledWith({ jobName: "_E1Cron" });
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Cron ae319c90d19e48cd9d70c71bd46c0546 Stopped Successfully.",
      });
    });

    it("should not call start/stop when toggling by CronId but status unchanged", async () => {
      const crons = [{ CronId: VISIBLE_CRON_ID, CronName: "E1", CronStatus: true, IsHidden: false }];
      (GetCronSettingsList as jest.Mock).mockResolvedValue(crons);
      (SqlToggleCronStatus as jest.Mock).mockResolvedValue(undefined);
      mockReq.body = { CronId: VISIBLE_CRON_ID, Action: "true" };

      await cronSettingsController.toggleCronStatus(mockReq as Request, mockRes as Response);

      expect(SqlToggleCronStatus).toHaveBeenCalledWith(VISIBLE_CRON_ID, true, mockReq);
      expect(mockStartCron).not.toHaveBeenCalled();
      expect(mockStopCron).not.toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Cron ae319c90d19e48cd9d70c71bd46c0546  Successfully.",
      });
    });
  });

  describe("show_details", () => {
    it("should render detail view with product list and formatted dates", async () => {
      const productList = [
        {
          mpId: "mp1",
          nextCronTime: new Date("2024-01-15T10:00:00Z"),
          updatedOn: new Date("2024-01-14T09:00:00Z"),
          insertReason: "422_ERROR",
        },
      ];
      mockGet422ProductDetailsByType.mockResolvedValue(productList as any);
      mockReq.params = { param: "422_ERROR" };

      await cronSettingsController.show_details(mockReq as Request, mockRes as Response);

      expect(mockGet422ProductDetailsByType).toHaveBeenCalledWith("422_ERROR");
      expect((productList as any).paramData).toBe("422_ERROR");
      expect((productList[0] as any).nextCronTime).toMatch(/\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}/);
      expect((productList[0] as any).updatedOn).toMatch(/\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}/);
      expect(renderMock).toHaveBeenCalledWith(
        "pages/settings/detail_view",
        expect.objectContaining({
          items: productList,
          groupName: "settings",
          userRole: "admin",
        })
      );
    });

    it("should render with empty list and null dates when no products", async () => {
      mockGet422ProductDetailsByType.mockResolvedValue([]);
      mockReq.params = { param: "PRICE_UPDATE" };

      await cronSettingsController.show_details(mockReq as Request, mockRes as Response);

      expect(renderMock).toHaveBeenCalledTimes(1);
      expect(renderMock.mock.calls[0][0]).toBe("pages/settings/detail_view");
      expect(renderMock.mock.calls[0][1]).toMatchObject({
        groupName: "settings",
        userRole: "admin",
      });
      expect(Array.isArray(renderMock.mock.calls[0][1].items)).toBe(true);
      expect(renderMock.mock.calls[0][1].items).toHaveLength(0);
    });

    it("should trim param and set paramData on productList", async () => {
      const productList = [{ mpId: "mp1" }];
      mockGet422ProductDetailsByType.mockResolvedValue(productList as any);
      mockReq.params = { param: "  422_ERROR  " };

      await cronSettingsController.show_details(mockReq as Request, mockRes as Response);

      expect(mockGet422ProductDetailsByType).toHaveBeenCalledWith("422_ERROR");
      expect((productList as any).paramData).toBe("422_ERROR");
    });
  });

  describe("exportItems", () => {
    it("should build workbook, set headers and write xlsx with product list", async () => {
      const productList = [
        {
          mpId: "mp1",
          vendorName: "V1",
          nextCronTime: new Date("2024-01-15T10:00:00Z"),
          updatedOn: new Date("2024-01-14T09:00:00Z"),
          insertReason: "422",
        },
      ];
      mockGet422ProductDetailsByType.mockResolvedValue(productList as any);
      mockReq.params = { type_info: "422_ERROR" };

      await cronSettingsController.exportItems(mockReq as Request, mockRes as Response);

      expect(mockGet422ProductDetailsByType).toHaveBeenCalledWith("422_ERROR");
      expect(mockAddWorksheet).toHaveBeenCalledWith("ItemList", {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      expect(mockWorksheet.autoFilter).toBe("A1:E1");
      expect(mockAddRows).toHaveBeenCalled();
      const rowsPassed = mockAddRows.mock.calls[0][0];
      expect(rowsPassed).toHaveLength(1);
      expect(rowsPassed[0]).toMatchObject({ mpId: "mp1", vendorName: "V1", insertReason: "422" });
      expect(rowsPassed[0].nextCronTime).toMatch(/\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}/);
      expect(rowsPassed[0].updatedOn).toMatch(/\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}/);
      expect(setHeaderMock).toHaveBeenCalledWith("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(setHeaderMock).toHaveBeenCalledWith("Content-Disposition", "attachment; filename=422ExportData.xlsx");
      expect(mockWriteResolve).toHaveBeenCalledWith(mockRes);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(endMock).toHaveBeenCalled();
    });

    it("should export empty list when no products", async () => {
      mockGet422ProductDetailsByType.mockResolvedValue([]);
      mockReq.params = { type_info: "PRICE_UPDATE" };

      await cronSettingsController.exportItems(mockReq as Request, mockRes as Response);

      expect(mockAddRows).toHaveBeenCalledWith([]);
      expect(mockWriteResolve).toHaveBeenCalledWith(mockRes);
      expect(statusMock).toHaveBeenCalledWith(200);
    });
  });
});
