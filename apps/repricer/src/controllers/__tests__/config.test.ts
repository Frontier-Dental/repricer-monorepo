import { Request, Response } from "express";
import * as configController from "../config";
import * as sqlV2Service from "../../services/mysql-v2";
import * as SessionHelper from "../../utility/session-helper";

jest.mock("../../services/mysql-v2");
jest.mock("../../utility/session-helper");

const mockGetConfigurations = sqlV2Service.GetConfigurations as jest.MockedFunction<typeof sqlV2Service.GetConfigurations>;
const mockGetEnvSettings = sqlV2Service.GetEnvSettings as jest.MockedFunction<typeof sqlV2Service.GetEnvSettings>;
const mockUpdateConfiguration = sqlV2Service.UpdateConfiguration as jest.MockedFunction<typeof sqlV2Service.UpdateConfiguration>;
const mockUpsertEnvSettings = sqlV2Service.UpsertEnvSettings as jest.MockedFunction<typeof sqlV2Service.UpsertEnvSettings>;
const mockGetAuditInfo = SessionHelper.GetAuditInfo as jest.MockedFunction<typeof SessionHelper.GetAuditInfo>;

describe("Config Controller", () => {
  let mockReq: Partial<Request> & { body?: any; session?: any };
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let renderMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn().mockReturnThis();
    renderMock = jest.fn();
    mockRes = {
      json: jsonMock,
      render: renderMock,
    };
    mockReq = {
      body: {},
      session: { users_id: { userRole: "admin", userName: "testuser" } } as any,
    };
  });

  describe("GetConfigSetup", () => {
    it("should fetch configurations and env settings, enrich data, and render config page", async () => {
      const configItems = [
        {
          id: 1,
          proxyProviderName: "P1",
          ipTypeName: "Residential",
          isDummy: false,
          AuditInfo: {
            UpdatedBy: "user1",
            UpdatedOn: new Date("2024-06-15T14:30:00Z"),
          },
          userName: "u",
          password: "secret",
        },
      ];
      const envData = {
        delay: 1000,
        source: "api",
        AuditInfo: {
          UpdatedBy: "admin",
          UpdatedOn: new Date("2024-06-10T09:00:00Z"),
        },
      };

      mockGetConfigurations.mockResolvedValue(configItems);
      mockGetEnvSettings.mockResolvedValue(envData);

      await configController.GetConfigSetup(mockReq as Request, mockRes as Response);

      expect(mockGetConfigurations).toHaveBeenCalledWith(false);
      expect(mockGetEnvSettings).toHaveBeenCalled();

      expect(renderMock).toHaveBeenCalledTimes(1);
      const [view, options] = renderMock.mock.calls[0];
      expect(view).toBe("pages/config/index");
      expect(options.userRole).toBe("admin");
      expect(options.groupName).toBe("config");

      expect(options.config.configDetails).toHaveLength(1);
      expect(options.config.configDetails[0].lastUpdatedBy).toBe("user1");
      expect(options.config.configDetails[0].lastUpdatedOn).toMatch(/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/);
      expect(options.config.configDetails[0].password).toBe("*****************");
      expect(options.config.envInfo.lastUpdatedBy).toBe("admin");
      expect(options.config.envInfo.lastUpdatedOn).toMatch(/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/);
      expect(options.config.totalProxies).toBe(1);
    });

    it("should filter out config items where isDummy is true", async () => {
      const configItems = [
        { id: 1, isDummy: false, AuditInfo: null },
        { id: 2, isDummy: true, AuditInfo: null },
        { id: 3, isDummy: false, AuditInfo: null },
      ];
      mockGetConfigurations.mockResolvedValue(configItems);
      mockGetEnvSettings.mockResolvedValue({ AuditInfo: null });

      await configController.GetConfigSetup(mockReq as Request, mockRes as Response);

      const options = renderMock.mock.calls[0][1];
      expect(options.config.configDetails).toHaveLength(2);
      expect(options.config.totalProxies).toBe(2);
    });

    it("should set lastUpdatedBy and lastUpdatedOn to '-' when AuditInfo is missing on config", async () => {
      const configItems = [{ id: 1, isDummy: false, AuditInfo: null, userName: "u", password: "p" }];
      mockGetConfigurations.mockResolvedValue(configItems);
      mockGetEnvSettings.mockResolvedValue({ AuditInfo: null });

      await configController.GetConfigSetup(mockReq as Request, mockRes as Response);

      const options = renderMock.mock.calls[0][1];
      expect(options.config.configDetails[0].lastUpdatedBy).toBe("-");
      expect(options.config.configDetails[0].lastUpdatedOn).toBe("-");
      expect(options.config.configDetails[0].password).toBe("*****************");
    });

    it("should set envInfo lastUpdatedBy and lastUpdatedOn to '-' when AuditInfo is missing", async () => {
      mockGetConfigurations.mockResolvedValue([]);
      mockGetEnvSettings.mockResolvedValue({ delay: 500, AuditInfo: null });

      await configController.GetConfigSetup(mockReq as Request, mockRes as Response);

      const options = renderMock.mock.calls[0][1];
      expect(options.config.envInfo.lastUpdatedBy).toBe("-");
      expect(options.config.envInfo.lastUpdatedOn).toBe("-");
    });
  });

  describe("UpdateConfig", () => {
    it("should update configs when payload has one proxy with method and changed password", async () => {
      const existingConfig = {
        proxyProviderName: "Provider",
        ipTypeName: "Residential",
        method: "Method1",
        userName: "oldUser",
        password: "oldPass",
        hostUrl: "http://old",
        port: 8080,
        active: true,
      };
      mockGetConfigurations.mockResolvedValue([existingConfig]);

      mockReq.body = {
        proxyProviderName: { 0: "Provider_Method1" },
        ipTypeName: { 0: "Residential" },
        userName: { 0: "newUser" },
        password: { 0: "newPass" },
        hostUrl: { 0: "http://new" },
        port: { 0: "9090" },
        active: { 0: "false" },
      };

      await configController.UpdateConfig(mockReq as Request, mockRes as Response);

      expect(mockUpdateConfiguration).toHaveBeenCalledTimes(1);
      const [updatedConfigs] = mockUpdateConfiguration.mock.calls[0];
      expect(updatedConfigs).toHaveLength(1);
      expect(updatedConfigs[0].userName).toBe("newUser");
      expect(updatedConfigs[0].password).toBe("newPass");
      expect(updatedConfigs[0].hostUrl).toBe("http://new");
      expect(updatedConfigs[0].port).toBe(9090);
      expect(updatedConfigs[0].active).toBe(false);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Configuration settings updated successfully.",
      });
    });

    it("should keep existing password when payload password is secured placeholder", async () => {
      const existingConfig = {
        proxyProviderName: "P",
        ipTypeName: "N/A",
        method: null,
        userName: "u",
        password: "actualSecret",
        hostUrl: "http://h",
        port: 80,
        active: true,
      };
      mockGetConfigurations.mockResolvedValue([existingConfig]);

      mockReq.body = {
        proxyProviderName: { 0: "P_" },
        ipTypeName: { 0: "" },
        userName: { 0: "updatedUser" },
        password: { 0: "*****************" },
        hostUrl: { 0: "http://h" },
        port: { 0: "80" },
        active: { 0: "true" },
      };

      await configController.UpdateConfig(mockReq as Request, mockRes as Response);

      const [updatedConfigs] = mockUpdateConfiguration.mock.calls[0];
      expect(updatedConfigs).toHaveLength(1);
      expect(updatedConfigs[0].userName).toBe("updatedUser");
      expect(updatedConfigs[0].password).toBe("actualSecret");
    });

    it("should set ipTypeStr to N/A when ipTypeName is empty or space", async () => {
      const existingConfig = {
        proxyProviderName: "P",
        ipTypeName: "N/A",
        userName: "u",
        password: "p",
        hostUrl: "h",
        port: 80,
        active: true,
      };
      mockGetConfigurations.mockResolvedValue([existingConfig]);

      mockReq.body = {
        proxyProviderName: { 0: "P_" },
        ipTypeName: { 0: " " },
        userName: { 0: "newUser" },
        password: { 0: "p" },
        hostUrl: { 0: "h" },
        port: { 0: "80" },
        active: { 0: "true" },
      };

      await configController.UpdateConfig(mockReq as Request, mockRes as Response);

      expect(mockUpdateConfiguration).toHaveBeenCalled();
      const [updatedConfigs] = mockUpdateConfiguration.mock.calls[0];
      expect(updatedConfigs).toHaveLength(1);
      expect(updatedConfigs[0].userName).toBe("newUser");
      expect(updatedConfigs[0].proxyProviderName).toBe("P");
      expect(updatedConfigs[0].ipTypeName).toBe("N/A");
    });

    it("should not push to updatedConfigs when contextConfig equals existing config", async () => {
      const existingConfig = {
        proxyProviderName: "P",
        ipTypeName: "Res",
        userName: "u",
        password: "p",
        hostUrl: "h",
        port: 80,
        active: true,
      };
      mockGetConfigurations.mockResolvedValue([existingConfig]);

      mockReq.body = {
        proxyProviderName: { 0: "P_" },
        ipTypeName: { 0: "Res" },
        userName: { 0: "u" },
        password: { 0: "*****************" },
        hostUrl: { 0: "h" },
        port: { 0: "80" },
        active: { 0: "true" },
      };

      await configController.UpdateConfig(mockReq as Request, mockRes as Response);

      const [updatedConfigs] = mockUpdateConfiguration.mock.calls[0];
      expect(updatedConfigs).toHaveLength(0);
    });

    it("should not push when no contextConfig found for proxy name and ip type", async () => {
      mockGetConfigurations.mockResolvedValue([]);

      mockReq.body = {
        proxyProviderName: { 0: "UnknownProvider_" },
        ipTypeName: { 0: "Residential" },
        userName: { 0: "u" },
        password: { 0: "p" },
        hostUrl: { 0: "h" },
        port: { 0: "80" },
        active: { 0: "true" },
      };

      await configController.UpdateConfig(mockReq as Request, mockRes as Response);

      const [updatedConfigs] = mockUpdateConfiguration.mock.calls[0];
      expect(updatedConfigs).toHaveLength(0);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Configuration settings updated successfully.",
      });
    });

    it("should find config by method when proxyProviderName contains underscore", async () => {
      const configWithMethod = {
        proxyProviderName: "Prov",
        ipTypeName: "Res",
        method: "M1",
        userName: "u",
        password: "p",
        hostUrl: "h",
        port: 80,
        active: true,
      };
      const configWithMethod2 = {
        proxyProviderName: "Prov",
        ipTypeName: "Res",
        method: "M2",
        userName: "u2",
        password: "p2",
        hostUrl: "h2",
        port: 81,
        active: false,
      };
      mockGetConfigurations.mockResolvedValue([configWithMethod, configWithMethod2]);

      mockReq.body = {
        proxyProviderName: { 0: "Prov_M1" },
        ipTypeName: { 0: "Res" },
        userName: { 0: "updatedUser" },
        password: { 0: "*****************" },
        hostUrl: { 0: "http://updated" },
        port: { 0: "90" },
        active: { 0: "true" },
      };

      await configController.UpdateConfig(mockReq as Request, mockRes as Response);

      const [updatedConfigs] = mockUpdateConfiguration.mock.calls[0];
      expect(updatedConfigs).toHaveLength(1);
      expect(updatedConfigs[0].method).toBe("M1");
      expect(updatedConfigs[0].userName).toBe("updatedUser");
      expect(updatedConfigs[0].hostUrl).toBe("http://updated");
      expect(updatedConfigs[0].port).toBe(90);
      expect(updatedConfigs[0].active).toBe(true);
    });

    it("should not push when method is specified but no matching config by method exists", async () => {
      const configOtherMethod = {
        proxyProviderName: "Prov",
        ipTypeName: "Res",
        method: "M2",
        userName: "u",
        password: "p",
        hostUrl: "h",
        port: 80,
        active: true,
      };
      mockGetConfigurations.mockResolvedValue([configOtherMethod]);

      mockReq.body = {
        proxyProviderName: { 0: "Prov_M1" },
        ipTypeName: { 0: "Res" },
        userName: { 0: "u" },
        password: { 0: "*****************" },
        hostUrl: { 0: "h" },
        port: { 0: "80" },
        active: { 0: "true" },
      };

      await configController.UpdateConfig(mockReq as Request, mockRes as Response);

      const [updatedConfigs] = mockUpdateConfiguration.mock.calls[0];
      expect(updatedConfigs).toHaveLength(0);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Configuration settings updated successfully.",
      });
    });

    it("should keep port as-is when port is null or empty string", async () => {
      const existingConfig = {
        proxyProviderName: "P",
        ipTypeName: "Res",
        userName: "u",
        password: "p",
        hostUrl: "h",
        port: 80,
        active: true,
      };
      mockGetConfigurations.mockResolvedValue([existingConfig]);

      mockReq.body = {
        proxyProviderName: { 0: "P_" },
        ipTypeName: { 0: "Res" },
        userName: { 0: "u" },
        password: { 0: "*****************" },
        hostUrl: { 0: "h" },
        port: { 0: "" },
        active: { 0: "true" },
      };

      await configController.UpdateConfig(mockReq as Request, mockRes as Response);

      const [updatedConfigs] = mockUpdateConfiguration.mock.calls[0];
      expect(updatedConfigs[0].port).toBe("");
    });

    it("should set active to false when active is not 'true'", async () => {
      const existingConfig = {
        proxyProviderName: "P",
        ipTypeName: "Res",
        userName: "u",
        password: "p",
        hostUrl: "h",
        port: 80,
        active: true,
      };
      mockGetConfigurations.mockResolvedValue([existingConfig]);

      mockReq.body = {
        proxyProviderName: { 0: "P_" },
        ipTypeName: { 0: "Res" },
        userName: { 0: "u" },
        password: { 0: "*****************" },
        hostUrl: { 0: "h" },
        port: { 0: "80" },
        active: { 0: "false" },
      };

      await configController.UpdateConfig(mockReq as Request, mockRes as Response);

      const [updatedConfigs] = mockUpdateConfiguration.mock.calls[0];
      expect(updatedConfigs[0].active).toBe(false);
    });

    it("should call UpdateConfiguration with req", async () => {
      const existingConfig = {
        proxyProviderName: "P",
        ipTypeName: "Res",
        userName: "u",
        password: "p",
        hostUrl: "h",
        port: 80,
        active: true,
      };
      mockGetConfigurations.mockResolvedValue([existingConfig]);
      mockReq.body = {
        proxyProviderName: { 0: "P_" },
        ipTypeName: { 0: "Res" },
        userName: { 0: "u" },
        password: { 0: "*****************" },
        hostUrl: { 0: "h" },
        port: { 0: "80" },
        active: { 0: "false" },
      };

      await configController.UpdateConfig(mockReq as Request, mockRes as Response);

      expect(mockUpdateConfiguration).toHaveBeenCalledWith(expect.any(Array), mockReq);
    });

    it("should handle multiple proxy entries in payload", async () => {
      const config1 = {
        proxyProviderName: "P1",
        ipTypeName: "Res",
        userName: "u1",
        password: "p1",
        hostUrl: "h1",
        port: 80,
        active: true,
      };
      const config2 = {
        proxyProviderName: "P2",
        ipTypeName: "Res",
        userName: "u2",
        password: "p2",
        hostUrl: "h2",
        port: 81,
        active: true,
      };
      mockGetConfigurations.mockResolvedValue([config1, config2]);

      mockReq.body = {
        proxyProviderName: { 0: "P1_", 1: "P2_" },
        ipTypeName: { 0: "Res", 1: "Res" },
        userName: { 0: "u1New", 1: "u2" },
        password: { 0: "*****************", 1: "*****************" },
        hostUrl: { 0: "h1", 1: "h2" },
        port: { 0: "80", 1: "81" },
        active: { 0: "true", 1: "true" },
      };

      await configController.UpdateConfig(mockReq as Request, mockRes as Response);

      const [updatedConfigs] = mockUpdateConfiguration.mock.calls[0];
      expect(updatedConfigs.length).toBeGreaterThanOrEqual(1);
      expect(updatedConfigs.some((c: any) => c.userName === "u1New")).toBe(true);
    });
  });

  describe("UpdateEnvInfo", () => {
    it("should build payload from body, call UpsertEnvSettings and return success", async () => {
      const auditInfo = { UpdatedBy: "testuser", UpdatedOn: new Date() };
      mockGetAuditInfo.mockResolvedValue(auditInfo as any);

      mockReq.body = {
        globalDelay: 2000,
        sourceType: "api",
        overrideValue: true,
        execPriorityObj: { key: "value" },
        cronOverlapThreshold: 5,
        cronBatchSize: 10,
        cronInstanceLimit: 2,
        slowBatchSize: 20,
        slowInstanceLimit: 3,
      };

      await configController.UpdateEnvInfo(mockReq as Request, mockRes as Response);

      expect(mockGetAuditInfo).toHaveBeenCalledWith(mockReq);
      expect(mockUpsertEnvSettings).toHaveBeenCalledTimes(1);
      const [payload] = mockUpsertEnvSettings.mock.calls[0];
      expect(payload.delay).toBe(2000);
      expect(payload.source).toBe("api");
      expect(payload.override_all).toBe(true);
      expect(payload.override_execution_priority_details).toEqual({ key: "value" });
      expect(payload.expressCronBatchSize).toBe(10);
      expect(payload.expressCronOverlapThreshold).toBe(5);
      expect(payload.expressCronInstanceLimit).toBe(2);
      expect(payload.slowCronBatchSize).toBe(20);
      expect(payload.slowCronInstanceLimit).toBe(3);
      expect(payload.AuditInfo).toEqual(auditInfo);

      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Global settings updated successfully.",
      });
    });

    it("should pass partial body fields to payload", async () => {
      mockGetAuditInfo.mockResolvedValue({ UpdatedBy: "u", UpdatedOn: new Date() } as any);
      mockReq.body = {
        globalDelay: 500,
        sourceType: "file",
        overrideValue: false,
        execPriorityObj: null,
        cronOverlapThreshold: 1,
        cronBatchSize: 5,
        cronInstanceLimit: 1,
        slowBatchSize: 10,
        slowInstanceLimit: 2,
      };

      await configController.UpdateEnvInfo(mockReq as Request, mockRes as Response);

      const [payload] = mockUpsertEnvSettings.mock.calls[0];
      expect(payload.delay).toBe(500);
      expect(payload.source).toBe("file");
      expect(payload.override_all).toBe(false);
      expect(payload.expressCronBatchSize).toBe(5);
    });
  });
});
