import { Request, Response } from "express";
import * as cronFilter from "../cron-filter";
import * as mongoMiddleware from "../../services/mongo";
import * as httpMiddleware from "../../utility/http-wrappers";
import * as SessionHelper from "../../utility/session-helper";
import * as MapperHelper from "../../middleware/mapper-helper";
import { GetConfigurations, GetCronSettingsList, GetSlowCronDetails, ToggleCronStatus as SqlToggleCronStatus, UpdateCronSettingsList, GetFilteredCrons, ToggleFilterCronStatus, UpsertFilterCronSettings, GetMiniErpCronDetails } from "../../services/mysql-v2";

jest.mock("../../services/mongo");
jest.mock("../../utility/http-wrappers");
jest.mock("../../utility/session-helper");
jest.mock("../../middleware/mapper-helper");
jest.mock("../../services/mysql-v2");

const mockGetFilterCronLogByKey = mongoMiddleware.GetFilterCronLogByKey as jest.MockedFunction<typeof mongoMiddleware.GetFilterCronLogByKey>;
const mockRecreateFilterCron = httpMiddleware.recreateFilterCron as jest.MockedFunction<typeof httpMiddleware.recreateFilterCron>;
const mockRecreateSlowCron = httpMiddleware.recreateSlowCron as jest.MockedFunction<typeof httpMiddleware.recreateSlowCron>;
const mockToggleFilterCron = httpMiddleware.toggleFilterCron as jest.MockedFunction<typeof httpMiddleware.toggleFilterCron>;
const mockToggleSlowCron = httpMiddleware.toggleSlowCron as jest.MockedFunction<typeof httpMiddleware.toggleSlowCron>;
const mockGetAuditValue = SessionHelper.GetAuditValue as jest.MockedFunction<typeof SessionHelper.GetAuditValue>;
const mockGetAuditInfo = SessionHelper.GetAuditInfo as jest.MockedFunction<typeof SessionHelper.GetAuditInfo>;
const mockGetAlternateProxyProviderId = MapperHelper.GetAlternateProxyProviderId as jest.MockedFunction<typeof MapperHelper.GetAlternateProxyProviderId>;
const mockGetAlternateProxyProviderName = MapperHelper.GetAlternateProxyProviderName as jest.MockedFunction<typeof MapperHelper.GetAlternateProxyProviderName>;
const mockMapAlternateProxyProviderDetails = MapperHelper.MapAlternateProxyProviderDetails as jest.MockedFunction<typeof MapperHelper.MapAlternateProxyProviderDetails>;

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

describe("Cron-Filter Controller", () => {
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
    mockGetAuditInfo.mockResolvedValue({ UpdatedBy: "testuser" } as any);
    mockGetAlternateProxyProviderId.mockResolvedValue(99);
    mockGetAlternateProxyProviderName.mockResolvedValue("");
    mockMapAlternateProxyProviderDetails.mockResolvedValue([]);
    mockWriteResolve.mockResolvedValue(undefined);
  });

  describe("GetFilterCron", () => {
    it("should render filter list with filter crons, slow crons, config and miniErp data", async () => {
      const filterCrons = [{ cronId: "fc1", cronExpression: "0 0 * * *", cronName: "Filter1", AuditInfo: {} }];
      const slowCrons = [
        {
          CronId: "sc1",
          CronName: "Slow1",
          UpdatedTime: new Date(),
          AuditInfo: {},
          IpType: 1,
          FixedIp: "",
          ProxyProvider: 1,
          AlternateProxyProvider: [],
        },
      ];
      const configItems = [{ proxyProvider: 1, proxyProviderName: "P1" }];
      const miniErpCrons = [
        {
          CronId: "me1",
          CronName: "MiniErp",
          UpdatedTime: new Date(),
          AuditInfo: {},
          ProxyProvider: 1,
          AlternateProxyProvider: [],
        },
      ];

      (GetFilteredCrons as jest.Mock).mockResolvedValue(filterCrons);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue(slowCrons);
      (GetConfigurations as jest.Mock).mockResolvedValue(configItems);
      (GetMiniErpCronDetails as jest.Mock).mockResolvedValue(miniErpCrons);
      mockGetAuditValue.mockResolvedValue("user1");

      await cronFilter.GetFilterCron(mockReq as Request, mockRes as Response);

      expect(renderMock).toHaveBeenCalledWith(
        "pages/filter/filteredList",
        expect.objectContaining({
          groupName: "filter",
          userRole: "admin",
          configItems,
          filterCronData: expect.any(Array),
          slowCronData: expect.any(Array),
          miniErpCronData: expect.any(Array),
        })
      );
      expect((filterCrons[0] as any).expressionUrl).toBe("https://crontab.guru/#0_0_*_*_*");
    });

    it("should set expressionUrl for each filter cron via getExpressionUrl", async () => {
      const filterCrons = [{ cronId: "f1", cronExpression: "5 4 * * 1", cronName: "F1", AuditInfo: {} }];
      (GetFilteredCrons as jest.Mock).mockResolvedValue(filterCrons);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      (GetConfigurations as jest.Mock).mockResolvedValue([]);
      (GetMiniErpCronDetails as jest.Mock).mockResolvedValue(null);

      await cronFilter.GetFilterCron(mockReq as Request, mockRes as Response);

      expect((filterCrons[0] as any).expressionUrl).toBe("https://crontab.guru/#5_4_*_*_1");
    });

    it("should pass miniErpCronData as empty array when GetMiniErpCronDetails returns null", async () => {
      (GetFilteredCrons as jest.Mock).mockResolvedValue([]);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      (GetConfigurations as jest.Mock).mockResolvedValue([]);
      (GetMiniErpCronDetails as jest.Mock).mockResolvedValue(null);

      await cronFilter.GetFilterCron(mockReq as Request, mockRes as Response);

      expect(renderMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ miniErpCronData: [] }));
    });

    it("should enrich slow and miniErp items with proxy provider names and flags", async () => {
      const slowCrons = [
        {
          CronId: "s1",
          CronName: "S1",
          UpdatedTime: new Date("2024-01-15T10:00:00Z"),
          AuditInfo: {},
          IpType: 1,
          FixedIp: "",
          ProxyProvider: 1,
          AlternateProxyProvider: [],
        },
      ];
      (GetFilteredCrons as jest.Mock).mockResolvedValue([]);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue(slowCrons);
      (GetConfigurations as jest.Mock).mockResolvedValue([{ proxyProvider: 1, proxyProviderName: "Proxy1" }]);
      (GetMiniErpCronDetails as jest.Mock).mockResolvedValue(null);

      await cronFilter.GetFilterCron(mockReq as Request, mockRes as Response);

      expect(mockGetAlternateProxyProviderId).toHaveBeenCalled();
      expect(mockGetAlternateProxyProviderName).toHaveBeenCalled();
      expect((slowCrons[0] as any).ThresholdReached).toBe(false);
      expect((slowCrons[0] as any).CloseToThresholdReached).toBe(false);
    });
  });

  describe("UpdateFilterCron", () => {
    it("should update CRONEXPRESSION and call recreateFilterCron", async () => {
      const filterCrons = [
        {
          cronId: "505a170450804201a92ea79d3da25fb3",
          cronExpression: "0 0 * * *",
          filterValue: 10,
          linkedCronId: null,
          linkedCronName: "",
          AuditInfo: { UpdatedBy: "" },
        },
      ];
      (GetFilteredCrons as jest.Mock).mockResolvedValue(filterCrons);
      (UpsertFilterCronSettings as jest.Mock).mockResolvedValue(undefined);
      mockRecreateFilterCron.mockResolvedValue({ status: 200 } as any);

      mockReq.body = {
        id: "505a170450804201a92ea79d3da25fb3",
        type: "CRONEXPRESSION",
        value: "0 12 * * *",
      };

      await cronFilter.UpdateFilterCron(mockReq as Request, mockRes as Response);

      expect(filterCrons[0].cronExpression).toBe("0 12 * * *");
      expect(UpsertFilterCronSettings).toHaveBeenCalledWith([filterCrons[0]]);
      expect(mockRecreateFilterCron).toHaveBeenCalledWith({ jobName: "_FC1Cron" });
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Filter Cron details updated successfully.",
      });
    });

    it("should update FILTERVALUE without recreating cron", async () => {
      const filterCrons = [
        {
          cronId: "fc-id",
          cronExpression: "0 0 * * *",
          filterValue: 5,
          AuditInfo: { UpdatedBy: "" },
        },
      ];
      (GetFilteredCrons as jest.Mock).mockResolvedValue(filterCrons);
      (UpsertFilterCronSettings as jest.Mock).mockResolvedValue(undefined);

      mockReq.body = { id: "fc-id", type: "FILTERVALUE", value: "20" };

      await cronFilter.UpdateFilterCron(mockReq as Request, mockRes as Response);

      expect(filterCrons[0].filterValue).toBe(20);
      expect(mockRecreateFilterCron).not.toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Filter Cron details updated successfully.",
      });
    });

    it("should set filterValue to 0 when FILTERVALUE is empty", async () => {
      const filterCrons = [{ cronId: "fc-id", filterValue: 10, AuditInfo: { UpdatedBy: "" } }];
      (GetFilteredCrons as jest.Mock).mockResolvedValue(filterCrons);
      (UpsertFilterCronSettings as jest.Mock).mockResolvedValue(undefined);
      mockReq.body = { id: "fc-id", type: "FILTERVALUE", value: "" };

      await cronFilter.UpdateFilterCron(mockReq as Request, mockRes as Response);

      expect(filterCrons[0].filterValue).toBe(0);
    });

    it("should update LINKEDCRONNAME and set linkedCronId from GetSlowCronDetails", async () => {
      const filterCrons = [
        {
          cronId: "fc-id",
          linkedCronId: null,
          linkedCronName: "",
          AuditInfo: { UpdatedBy: "" },
        },
      ];
      (GetFilteredCrons as jest.Mock).mockResolvedValue(filterCrons);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([{ CronId: "slow-123", CronName: "MyLinkedCron" }]);
      (UpsertFilterCronSettings as jest.Mock).mockResolvedValue(undefined);

      mockReq.body = { id: "fc-id", type: "LINKEDCRONNAME", value: "MyLinkedCron" };

      await cronFilter.UpdateFilterCron(mockReq as Request, mockRes as Response);

      expect(filterCrons[0].linkedCronId).toBe("slow-123");
      expect(filterCrons[0].linkedCronName).toBe("MyLinkedCron");
      expect(mockRecreateFilterCron).not.toHaveBeenCalled();
    });

    it("should do nothing for default/unknown type", async () => {
      const filterCrons = [{ cronId: "fc-id", cronExpression: "0 0 * * *", AuditInfo: { UpdatedBy: "" } }];
      (GetFilteredCrons as jest.Mock).mockResolvedValue(filterCrons);
      (UpsertFilterCronSettings as jest.Mock).mockResolvedValue(undefined);
      mockReq.body = { id: "fc-id", type: "UNKNOWN", value: "x" };

      await cronFilter.UpdateFilterCron(mockReq as Request, mockRes as Response);

      expect(UpsertFilterCronSettings).toHaveBeenCalledWith([filterCrons[0]]);
      expect(mockRecreateFilterCron).not.toHaveBeenCalled();
    });
  });

  describe("UpdateSlowCronExpression", () => {
    it("should return no changes when nothing differs", async () => {
      const altProxy = [
        { Sequence: 1, ProxyProvider: 1 },
        { Sequence: 2, ProxyProvider: 99 },
        { Sequence: 3, ProxyProvider: 99 },
        { Sequence: 4, ProxyProvider: 99 },
        { Sequence: 5, ProxyProvider: 99 },
        { Sequence: 6, ProxyProvider: 99 },
      ];
      const slowCrons = [
        {
          CronId: "b597ffd1ce4d463088ce12a6f05b55d6",
          CronName: "SCG1",
          CronTime: 1,
          CronTimeUnit: "hour",
          Offset: 0,
          ProxyProvider: 1,
          IpType: 1,
          FixedIp: "",
          AlternateProxyProvider: altProxy,
        },
      ];
      (GetSlowCronDetails as jest.Mock).mockResolvedValue(slowCrons);
      mockMapAlternateProxyProviderDetails.mockResolvedValue(altProxy);
      mockReq.body = {
        [`s_cron_name_${slowCrons[0].CronId}`]: "SCG1",
        [`s_cron_time_${slowCrons[0].CronId}`]: "1",
        [`s_cron_time_unit_${slowCrons[0].CronId}`]: "hour",
        [`s_offset_${slowCrons[0].CronId}`]: "0",
        [`s_proxy_provider_${slowCrons[0].CronId}`]: "1",
        [`s_ip_type_${slowCrons[0].CronId}`]: "1",
        [`s_fixed_ip_${slowCrons[0].CronId}`]: "",
        proxy_provider_1: [1],
        proxy_provider_2: [99],
        proxy_provider_3: [99],
        proxy_provider_4: [99],
        proxy_provider_5: [99],
        proxy_provider_6: [99],
      };

      await cronFilter.UpdateSlowCronExpression(mockReq as Request, mockRes as Response);

      expect(UpdateCronSettingsList).not.toHaveBeenCalled();
      expect(mockRecreateSlowCron).not.toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "No Changes found to update.",
      });
    });

    it("should update and recreate when CronTime/CronTimeUnit/Offset change", async () => {
      const slowCrons = [
        {
          CronId: "b597ffd1ce4d463088ce12a6f05b55d6",
          CronName: "SCG1",
          CronTime: 1,
          CronTimeUnit: "hour",
          Offset: 0,
          CronStatus: "1",
          ProxyProvider: 1,
          IpType: 1,
          FixedIp: "",
          AlternateProxyProvider: [],
        },
      ];
      (GetSlowCronDetails as jest.Mock).mockResolvedValue(slowCrons);
      (UpdateCronSettingsList as jest.Mock).mockResolvedValue(undefined);
      mockRecreateSlowCron.mockResolvedValue({ status: 200 } as any);
      mockReq.body = {
        [`s_cron_name_${slowCrons[0].CronId}`]: "SCG1",
        [`s_cron_time_${slowCrons[0].CronId}`]: "2",
        [`s_cron_time_unit_${slowCrons[0].CronId}`]: "hour",
        [`s_offset_${slowCrons[0].CronId}`]: "5",
        [`s_proxy_provider_${slowCrons[0].CronId}`]: "1",
        [`s_ip_type_${slowCrons[0].CronId}`]: "1",
        [`s_fixed_ip_${slowCrons[0].CronId}`]: "",
        proxy_provider_1: [1],
        proxy_provider_2: [99],
        proxy_provider_3: [99],
        proxy_provider_4: [99],
        proxy_provider_5: [99],
        proxy_provider_6: [99],
      };
      mockMapAlternateProxyProviderDetails.mockResolvedValue([
        { Sequence: 1, ProxyProvider: 1 },
        { Sequence: 2, ProxyProvider: 99 },
        { Sequence: 3, ProxyProvider: 99 },
        { Sequence: 4, ProxyProvider: 99 },
        { Sequence: 5, ProxyProvider: 99 },
        { Sequence: 6, ProxyProvider: 99 },
      ]);

      await cronFilter.UpdateSlowCronExpression(mockReq as Request, mockRes as Response);

      expect(UpdateCronSettingsList).toHaveBeenCalled();
      expect(mockRecreateSlowCron).toHaveBeenCalledWith({ jobName: "_SCG1Cron" });
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Slow Cron updated successfully.",
      });
    });

    it("should update without recreate when only CronName/ProxyProvider change", async () => {
      const slowCrons = [
        {
          CronId: "a9d4e1de6e864b7f9edf9cd202559774",
          CronName: "SCG2",
          CronTime: 2,
          CronTimeUnit: "hour",
          Offset: 0,
          CronStatus: "1",
          ProxyProvider: 1,
          IpType: 1,
          FixedIp: "",
          AlternateProxyProvider: [],
        },
      ];
      (GetSlowCronDetails as jest.Mock).mockResolvedValue(slowCrons);
      (UpdateCronSettingsList as jest.Mock).mockResolvedValue(undefined);
      mockReq.body = {
        [`s_cron_name_${slowCrons[0].CronId}`]: "SCG2-Updated",
        [`s_cron_time_${slowCrons[0].CronId}`]: "2",
        [`s_cron_time_unit_${slowCrons[0].CronId}`]: "hour",
        [`s_offset_${slowCrons[0].CronId}`]: "0",
        [`s_proxy_provider_${slowCrons[0].CronId}`]: "1",
        [`s_ip_type_${slowCrons[0].CronId}`]: "1",
        [`s_fixed_ip_${slowCrons[0].CronId}`]: "",
        proxy_provider_1: [1],
        proxy_provider_2: [99],
        proxy_provider_3: [99],
        proxy_provider_4: [99],
        proxy_provider_5: [99],
        proxy_provider_6: [99],
      };
      mockMapAlternateProxyProviderDetails.mockResolvedValue([
        { Sequence: 1, ProxyProvider: 1 },
        { Sequence: 2, ProxyProvider: 99 },
        { Sequence: 3, ProxyProvider: 99 },
        { Sequence: 4, ProxyProvider: 99 },
        { Sequence: 5, ProxyProvider: 99 },
        { Sequence: 6, ProxyProvider: 99 },
      ]);

      await cronFilter.UpdateSlowCronExpression(mockReq as Request, mockRes as Response);

      expect(UpdateCronSettingsList).toHaveBeenCalled();
      expect(mockRecreateSlowCron).not.toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Slow Cron updated successfully.",
      });
    });
  });

  describe("ExportLogDetails", () => {
    it("should build workbook and set headers and write xlsx", async () => {
      const cronKey = "key-123";
      const cronLog = {
        cronKey,
        contextCronId: "fc-id",
        filterDate: new Date("2024-01-10T12:00:00Z"),
        startTime: new Date("2024-01-10T12:00:00Z"),
        cronItem: [
          {
            productId: "mp1",
            lastUpdateTime: "2024-01-10",
            sourceCronId: "src-id",
            destCronName: "Dest",
          },
        ],
      };
      const filterCrons = [{ cronId: "fc-id", cronName: "FilterCron1" }];
      const regularCrons = [{ CronId: "src-id", CronName: "SourceCron1" }];

      mockGetFilterCronLogByKey.mockResolvedValue(cronLog);
      (GetCronSettingsList as jest.Mock).mockResolvedValue(regularCrons);
      (GetFilteredCrons as jest.Mock).mockResolvedValue(filterCrons);
      mockReq.params = { key: cronKey };

      await cronFilter.ExportLogDetails(mockReq as Request, mockRes as Response);

      expect(mockGetFilterCronLogByKey).toHaveBeenCalledWith(cronKey);
      expect(mockAddWorksheet).toHaveBeenCalledWith("ItemList");
      expect(mockAddRows).toHaveBeenCalled();
      expect(setHeaderMock).toHaveBeenCalledWith("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(setHeaderMock).toHaveBeenCalledWith("Content-Disposition", `attachment; filename=${cronKey}.xlsx`);
      expect(mockWriteResolve).toHaveBeenCalledWith(mockRes);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(endMock).toHaveBeenCalled();
      expect((cronLog.cronItem![0] as any).contextCronName).toBe("FilterCron1");
      expect((cronLog.cronItem![0] as any).sourceCronName).toBe("SourceCron1");
      expect((cronLog.cronItem![0] as any).cronKey).toBe(cronKey);
    });

    it("should not iterate cronItem when cronItem is missing", async () => {
      const cronLog = {
        cronKey: "k",
        contextCronId: "fc-id",
        filterDate: new Date(),
        startTime: new Date(),
        cronItem: undefined,
      };
      mockGetFilterCronLogByKey.mockResolvedValue(cronLog);
      (GetCronSettingsList as jest.Mock).mockResolvedValue([]);
      (GetFilteredCrons as jest.Mock).mockResolvedValue([{ cronId: "fc-id", cronName: "FC" }]);
      mockReq.params = { key: "k" };

      await cronFilter.ExportLogDetails(mockReq as Request, mockRes as Response);

      expect(mockAddRows).toHaveBeenCalledWith(undefined);
    });
  });

  describe("ToggleCronStatus", () => {
    it("should toggle filter cron and return success when response is 200", async () => {
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      (ToggleFilterCronStatus as jest.Mock).mockResolvedValue(undefined);
      mockToggleFilterCron.mockResolvedValue({ status: 200, data: "Cron toggled" } as any);
      mockReq.body = { id: "505a170450804201a92ea79d3da25fb3", status: 1 };

      await cronFilter.ToggleCronStatus(mockReq as Request, mockRes as Response);

      expect(ToggleFilterCronStatus).toHaveBeenCalledWith("505a170450804201a92ea79d3da25fb3", true, expect.any(Object));
      expect(mockToggleFilterCron).toHaveBeenCalledWith({
        jobName: "_FC1Cron",
        status: 1,
      });
      expect(jsonMock).toHaveBeenCalledWith({ status: true, message: "Cron toggled" });
    });

    it("should toggle filter cron off when status is 0", async () => {
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      (ToggleFilterCronStatus as jest.Mock).mockResolvedValue(undefined);
      mockToggleFilterCron.mockResolvedValue({ status: 200, data: "Stopped" } as any);
      mockReq.body = { id: "505a170450804201a92ea79d3da25fb3", status: 0 };

      await cronFilter.ToggleCronStatus(mockReq as Request, mockRes as Response);

      expect(ToggleFilterCronStatus).toHaveBeenCalledWith("505a170450804201a92ea79d3da25fb3", false, expect.any(Object));
    });

    it("should not return success when filter cron toggle response is not 200", async () => {
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      (ToggleFilterCronStatus as jest.Mock).mockResolvedValue(undefined);
      mockToggleFilterCron.mockResolvedValue({ status: 500 } as any);
      mockReq.body = { id: "505a170450804201a92ea79d3da25fb3", status: 1 };

      await cronFilter.ToggleCronStatus(mockReq as Request, mockRes as Response);

      expect(jsonMock).not.toHaveBeenCalledWith(expect.objectContaining({ status: true }));
    });

    it("should toggle slow cron when contextCronId is in slow cron list", async () => {
      const slowCrons = [
        {
          CronId: "b597ffd1ce4d463088ce12a6f05b55d6",
          CronName: "SCG1",
        },
      ];
      (GetSlowCronDetails as jest.Mock).mockResolvedValue(slowCrons);
      (SqlToggleCronStatus as jest.Mock).mockResolvedValue(undefined);
      mockToggleSlowCron.mockResolvedValue({ status: 200, data: "Slow cron toggled" } as any);
      mockReq.body = { id: "b597ffd1ce4d463088ce12a6f05b55d6", status: 1 };

      await cronFilter.ToggleCronStatus(mockReq as Request, mockRes as Response);

      expect(SqlToggleCronStatus).toHaveBeenCalledWith("b597ffd1ce4d463088ce12a6f05b55d6", "true", mockReq);
      expect(mockToggleSlowCron).toHaveBeenCalledWith({
        jobName: "_SCG1Cron",
        status: 1,
      });
      expect(jsonMock).toHaveBeenCalledWith({ status: true, message: "Slow cron toggled" });
    });

    it("should not return success when slow cron toggle response is not 200", async () => {
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([{ CronId: "b597ffd1ce4d463088ce12a6f05b55d6", CronName: "SCG1" }]);
      (SqlToggleCronStatus as jest.Mock).mockResolvedValue(undefined);
      mockToggleSlowCron.mockResolvedValue({ status: 500 } as any);
      mockReq.body = { id: "b597ffd1ce4d463088ce12a6f05b55d6", status: 1 };

      await cronFilter.ToggleCronStatus(mockReq as Request, mockRes as Response);

      expect(jsonMock).not.toHaveBeenCalledWith(expect.objectContaining({ status: true }));
    });
  });
});
