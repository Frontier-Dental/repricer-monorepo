import { Request, Response } from "express";
import * as scrape from "../scrape";
import * as httpMiddleware from "../../utility/http-wrappers";
import * as MapperHelper from "../../middleware/mapper-helper";
import * as mongoMiddleware from "../../services/mongo";
import * as sqlMiddleware from "../../services/mysql";
import * as SessionHelper from "../../utility/session-helper";
import { applicationConfig } from "../../utility/config";
import * as sqlV2Service from "../../services/mysql-v2";

jest.mock("../../utility/http-wrappers");
jest.mock("../../middleware/mapper-helper");
jest.mock("../../services/mongo");
jest.mock("../../services/mysql");
jest.mock("../../utility/session-helper");
jest.mock("../../services/mysql-v2");

const mockWrite = jest.fn().mockReturnValue(Promise.resolve());
const mockSheet = {
  columns: [] as any[],
  addRows: jest.fn(),
  autoFilter: "",
};
const mockWorkbook = {
  addWorksheet: jest.fn(() => mockSheet),
  xlsx: { write: mockWrite },
};
jest.mock("exceljs", () => ({
  __esModule: true,
  default: {
    Workbook: jest.fn(() => mockWorkbook),
  },
}));

// Use first cronId from cronMapping for UpdateScrapeCronExp tests
const SAMPLE_CRON_ID = "ae319c90d19e48cd9d70c71bd46c0546";
const SAMPLE_CRON_VAR = "_E1Cron";

describe("Scrape Controller", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let renderMock: jest.Mock;
  let setHeaderMock: jest.Mock;
  let endMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation();
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnThis();
    renderMock = jest.fn();
    setHeaderMock = jest.fn().mockReturnThis();
    endMock = jest.fn();
    mockRes = {
      json: jsonMock,
      status: statusMock,
      render: renderMock,
      setHeader: setHeaderMock,
      end: endMock,
    };
    mockReq = {
      params: {},
      body: {},
      query: {},
      session: { users_id: { userRole: "admin" } } as any,
    };
    (applicationConfig as any).CRON_PAGESIZE = 10;
  });

  describe("GetScrapeCron", () => {
    it("should fetch scrape crons, enrich with audit and proxy names, and render list", async () => {
      const scrapeCronDetails = [
        {
          CronId: SAMPLE_CRON_ID,
          CronName: "E1",
          ProxyProvider: 1,
          AlternateProxyProvider: [],
        },
      ];
      const configItems = [{ proxyProvider: 1, name: "Provider1" }];
      (sqlV2Service.GetScrapeCrons as jest.Mock).mockResolvedValue(scrapeCronDetails);
      (sqlV2Service.GetConfigurations as jest.Mock).mockResolvedValue(configItems);
      (SessionHelper.GetAuditValue as jest.Mock).mockResolvedValueOnce("user1").mockResolvedValueOnce("2024-01-01 12:00:00");
      (MapperHelper.GetAlternateProxyProviderId as jest.Mock).mockResolvedValue(1);
      (MapperHelper.GetAlternateProxyProviderName as jest.Mock).mockResolvedValue("Provider1");

      await scrape.GetScrapeCron(mockReq as Request, mockRes as Response);

      expect(sqlV2Service.GetScrapeCrons).toHaveBeenCalled();
      expect(sqlV2Service.GetConfigurations).toHaveBeenCalledWith(true);
      expect(SessionHelper.GetAuditValue).toHaveBeenCalledWith(scrapeCronDetails[0], "U_NAME");
      expect(SessionHelper.GetAuditValue).toHaveBeenCalledWith(scrapeCronDetails[0], "U_TIME");
      expect(renderMock).toHaveBeenCalledWith(
        "pages/scrape/scrapeOnlyList",
        expect.objectContaining({
          configItems,
          scrapeCronData: expect.any(Array),
          groupName: "scraping",
          userRole: "admin",
        })
      );
    });

    it("should call mapper for all 6 alternate proxy providers per item", async () => {
      (sqlV2Service.GetScrapeCrons as jest.Mock).mockResolvedValue([{ CronId: "1" }]);
      (sqlV2Service.GetConfigurations as jest.Mock).mockResolvedValue([]);
      (SessionHelper.GetAuditValue as jest.Mock).mockResolvedValue("");
      (MapperHelper.GetAlternateProxyProviderId as jest.Mock).mockResolvedValue(0);
      (MapperHelper.GetAlternateProxyProviderName as jest.Mock).mockResolvedValue("");

      await scrape.GetScrapeCron(mockReq as Request, mockRes as Response);

      expect(MapperHelper.GetAlternateProxyProviderId).toHaveBeenCalledTimes(6);
      expect(MapperHelper.GetAlternateProxyProviderName).toHaveBeenCalledTimes(7); // 6 alt + 1 default
    });
  });

  describe("ToggleCronStatus", () => {
    it("should toggle cron and return success when API returns 200", async () => {
      mockReq.body = { id: SAMPLE_CRON_ID, status: 1 };
      (sqlV2Service.ToggleCronStatus as jest.Mock).mockResolvedValue(undefined);
      (httpMiddleware.toggleScrapeCron as jest.Mock).mockResolvedValue({
        status: 200,
        data: "Cron started",
      });

      await scrape.ToggleCronStatus(mockReq as Request, mockRes as Response);

      expect(sqlV2Service.ToggleCronStatus).toHaveBeenCalledWith(SAMPLE_CRON_ID, "true", mockReq);
      expect(httpMiddleware.toggleScrapeCron).toHaveBeenCalledWith({
        jobName: SAMPLE_CRON_VAR,
        status: 1,
      });
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Cron started",
      });
    });

    it("should pass status false when status is 0", async () => {
      mockReq.body = { id: SAMPLE_CRON_ID, status: 0 };
      (sqlV2Service.ToggleCronStatus as jest.Mock).mockResolvedValue(undefined);
      (httpMiddleware.toggleScrapeCron as jest.Mock).mockResolvedValue({
        status: 200,
        data: "Stopped",
      });

      await scrape.ToggleCronStatus(mockReq as Request, mockRes as Response);

      expect(sqlV2Service.ToggleCronStatus).toHaveBeenCalledWith(SAMPLE_CRON_ID, "false", mockReq);
      expect(jsonMock).toHaveBeenCalledWith({ status: true, message: "Stopped" });
    });

    it("should return error when API response is not 200", async () => {
      mockReq.body = { id: SAMPLE_CRON_ID, status: 1 };
      (sqlV2Service.ToggleCronStatus as jest.Mock).mockResolvedValue(undefined);
      (httpMiddleware.toggleScrapeCron as jest.Mock).mockResolvedValue({
        status: 500,
        data: "Error",
      });

      await scrape.ToggleCronStatus(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: "Sorry some error occurred!! Please try again...",
      });
    });

    it("should return error when response is null/falsy", async () => {
      mockReq.body = { id: SAMPLE_CRON_ID, status: 1 };
      (sqlV2Service.ToggleCronStatus as jest.Mock).mockResolvedValue(undefined);
      (httpMiddleware.toggleScrapeCron as jest.Mock).mockResolvedValue(null);

      await scrape.ToggleCronStatus(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: "Sorry some error occurred!! Please try again...",
      });
    });
  });

  describe("UpdateScrapeCronExp", () => {
    it("should return no changes when payload matches existing cron settings", async () => {
      const existing = [
        {
          CronId: SAMPLE_CRON_ID,
          CronName: "E1",
          CronTime: 5,
          CronTimeUnit: "min",
          Offset: 0,
          ProxyProvider: 1,
          status: "true",
          AlternateProxyProvider: [],
        },
      ];
      mockReq.body = {
        cron_id_hdn: SAMPLE_CRON_ID,
        scr_cron_name: "E1",
        scr_cron_time: 5,
        scr_cron_time_unit: "min",
        scr_offset: 0,
        scr_proxy_provider: 1,
      };
      (sqlV2Service.GetScrapeCrons as jest.Mock).mockResolvedValue(existing);
      (MapperHelper.MapAlternateProxyProviderDetails as jest.Mock).mockResolvedValue([]);

      await scrape.UpdateScrapeCronExp(mockReq as Request, mockRes as Response);

      expect(sqlV2Service.UpdateCronSettingsList).not.toHaveBeenCalled();
      expect(httpMiddleware.recreateScrapeCron).not.toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "No Changes found to update.",
      });
    });

    it("should update and recreate cron when payload differs from existing", async () => {
      const existing = [
        {
          CronId: SAMPLE_CRON_ID,
          CronName: "E1",
          CronTime: 5,
          CronTimeUnit: "min",
          Offset: 0,
          ProxyProvider: 1,
          status: "true",
          AlternateProxyProvider: [],
        },
      ];
      mockReq.body = {
        cron_id_hdn: SAMPLE_CRON_ID,
        scr_cron_name: "E1 Updated",
        scr_cron_time: 10,
        scr_cron_time_unit: "min",
        scr_offset: 0,
        scr_proxy_provider: 1,
      };
      (sqlV2Service.GetScrapeCrons as jest.Mock).mockResolvedValue(existing);
      (sqlV2Service.UpdateCronSettingsList as jest.Mock).mockResolvedValue(undefined);
      (MapperHelper.MapAlternateProxyProviderDetails as jest.Mock).mockResolvedValue([]);
      (httpMiddleware.recreateScrapeCron as jest.Mock).mockResolvedValue(undefined);

      await scrape.UpdateScrapeCronExp(mockReq as Request, mockRes as Response);

      expect(sqlV2Service.UpdateCronSettingsList).toHaveBeenCalled();
      expect(httpMiddleware.recreateScrapeCron).toHaveBeenCalledWith({
        jobName: SAMPLE_CRON_VAR,
      });
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Scrape Cron updated successfully.",
      });
    });

    it("should normalize scalar payload to arrays", async () => {
      const existing = [
        {
          CronId: SAMPLE_CRON_ID,
          CronName: "E1",
          CronTime: 5,
          CronTimeUnit: "min",
          Offset: 0,
          ProxyProvider: 1,
          status: "true",
          AlternateProxyProvider: [],
        },
      ];
      mockReq.body = {
        cron_id_hdn: SAMPLE_CRON_ID,
        scr_cron_name: "E1 New",
        scr_cron_time: "5",
        scr_cron_time_unit: "min",
        scr_offset: 0,
        scr_proxy_provider: "1",
      };
      (sqlV2Service.GetScrapeCrons as jest.Mock).mockResolvedValue(existing);
      (sqlV2Service.UpdateCronSettingsList as jest.Mock).mockResolvedValue(undefined);
      (MapperHelper.MapAlternateProxyProviderDetails as jest.Mock).mockResolvedValue([]);
      (httpMiddleware.recreateScrapeCron as jest.Mock).mockResolvedValue(undefined);

      await scrape.UpdateScrapeCronExp(mockReq as Request, mockRes as Response);

      expect(MapperHelper.MapAlternateProxyProviderDetails).toHaveBeenCalledWith(
        "0",
        expect.objectContaining({
          cron_id_hdn: [SAMPLE_CRON_ID],
          scr_cron_name: ["E1 New"],
        })
      );
    });

    it("should detect change when only Offset differs", async () => {
      const existing = [
        {
          CronId: SAMPLE_CRON_ID,
          CronName: "E1",
          CronTime: 5,
          CronTimeUnit: "min",
          Offset: undefined,
          ProxyProvider: 1,
          status: "true",
          AlternateProxyProvider: [],
        },
      ];
      mockReq.body = {
        cron_id_hdn: SAMPLE_CRON_ID,
        scr_cron_name: "E1",
        scr_cron_time: 5,
        scr_cron_time_unit: "min",
        scr_offset: 10,
        scr_proxy_provider: 1,
      };
      (sqlV2Service.GetScrapeCrons as jest.Mock).mockResolvedValue(existing);
      (sqlV2Service.UpdateCronSettingsList as jest.Mock).mockResolvedValue(undefined);
      (MapperHelper.MapAlternateProxyProviderDetails as jest.Mock).mockResolvedValue([]);
      (httpMiddleware.recreateScrapeCron as jest.Mock).mockResolvedValue(undefined);

      await scrape.UpdateScrapeCronExp(mockReq as Request, mockRes as Response);

      expect(sqlV2Service.UpdateCronSettingsList).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Scrape Cron updated successfully.",
      });
    });

    it("should detect change when AlternateProxyProvider differs", async () => {
      const existing = [
        {
          CronId: SAMPLE_CRON_ID,
          CronName: "E1",
          CronTime: 5,
          CronTimeUnit: "min",
          Offset: 0,
          ProxyProvider: 1,
          status: "true",
          AlternateProxyProvider: [],
        },
      ];
      mockReq.body = {
        cron_id_hdn: SAMPLE_CRON_ID,
        scr_cron_name: "E1",
        scr_cron_time: 5,
        scr_cron_time_unit: "min",
        scr_offset: 0,
        scr_proxy_provider: 1,
      };
      (sqlV2Service.GetScrapeCrons as jest.Mock).mockResolvedValue(existing);
      (sqlV2Service.UpdateCronSettingsList as jest.Mock).mockResolvedValue(undefined);
      (MapperHelper.MapAlternateProxyProviderDetails as jest.Mock).mockResolvedValue([{ Sequence: 1, ProviderId: 2 }]);
      (httpMiddleware.recreateScrapeCron as jest.Mock).mockResolvedValue(undefined);

      await scrape.UpdateScrapeCronExp(mockReq as Request, mockRes as Response);

      expect(sqlV2Service.UpdateCronSettingsList).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Scrape Cron updated successfully.",
      });
    });

    it("should accept payload with already-array fields", async () => {
      const existing = [
        {
          CronId: SAMPLE_CRON_ID,
          CronName: "E1",
          CronTime: 5,
          CronTimeUnit: "min",
          Offset: 0,
          ProxyProvider: 1,
          status: "true",
          AlternateProxyProvider: [],
        },
      ];
      mockReq.body = {
        cron_id_hdn: [SAMPLE_CRON_ID],
        scr_cron_name: ["E1 Updated"],
        scr_cron_time: [10],
        scr_cron_time_unit: ["min"],
        scr_offset: [0],
        scr_proxy_provider: [1],
      };
      (sqlV2Service.GetScrapeCrons as jest.Mock).mockResolvedValue(existing);
      (sqlV2Service.UpdateCronSettingsList as jest.Mock).mockResolvedValue(undefined);
      (MapperHelper.MapAlternateProxyProviderDetails as jest.Mock).mockResolvedValue([]);
      (httpMiddleware.recreateScrapeCron as jest.Mock).mockResolvedValue(undefined);

      await scrape.UpdateScrapeCronExp(mockReq as Request, mockRes as Response);

      expect(MapperHelper.MapAlternateProxyProviderDetails).toHaveBeenCalledWith(
        "0",
        expect.objectContaining({
          cron_id_hdn: [SAMPLE_CRON_ID],
          scr_cron_name: ["E1 Updated"],
        })
      );
    });
  });

  describe("GetLatestPriceInfo", () => {
    it("should return 200 with priceInfo when product and scrape data exist", async () => {
      mockReq.params = { identifier: "focus-123" };
      const productDetails = [{ mpId: 100, tradentDetails: { focusId: "focus-123" } }];
      const sqlScrapeDetails = [{ MinQty: 1, Price: 25 }];
      (mongoMiddleware.GetProductListByQuery as jest.Mock).mockResolvedValue(productDetails);
      (sqlMiddleware.GetLastScrapeDetailsById as jest.Mock).mockResolvedValue(sqlScrapeDetails);
      (MapperHelper.MapLatestPriceInfo as jest.Mock).mockResolvedValue({
        price: 25,
        minQty: 1,
      });

      await scrape.GetLatestPriceInfo(mockReq as Request, mockRes as Response);

      expect(mongoMiddleware.GetProductListByQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([expect.objectContaining({ "tradentDetails.focusId": "focus-123" })]),
        })
      );
      expect(sqlMiddleware.GetLastScrapeDetailsById).toHaveBeenCalledWith(100);
      expect(MapperHelper.MapLatestPriceInfo).toHaveBeenCalledWith(sqlScrapeDetails, "focus-123");
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        priceInfo: { price: 25, minQty: 1 },
        error: null,
      });
    });

    it("should return 206 when product found but no scrape data", async () => {
      mockReq.params = { identifier: "focus-456" };
      const productDetails = [{ mpId: 200, mvpDetails: { focusId: "focus-456" } }];
      (mongoMiddleware.GetProductListByQuery as jest.Mock).mockResolvedValue(productDetails);
      (sqlMiddleware.GetLastScrapeDetailsById as jest.Mock).mockResolvedValue([]);
      (MapperHelper.MapLatestPriceInfo as jest.Mock).mockResolvedValue(null);

      await scrape.GetLatestPriceInfo(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(206);
      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        priceInfo: null,
        error: expect.stringContaining("No Latest Scrape Data found"),
      });
    });

    it("should return 502 when product not found", async () => {
      mockReq.params = { identifier: "focus-missing" };
      (mongoMiddleware.GetProductListByQuery as jest.Mock).mockResolvedValue([]);

      await scrape.GetLatestPriceInfo(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(502);
      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        priceInfo: null,
        error: "Product with FocusId : focus-missing not found.",
      });
    });

    it("should return 502 when productDetails is null", async () => {
      mockReq.params = { identifier: "focus-null" };
      (mongoMiddleware.GetProductListByQuery as jest.Mock).mockResolvedValue(null);

      await scrape.GetLatestPriceInfo(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(502);
    });
  });

  describe("GetScrapeProducts", () => {
    it("should render products list without filter when no tags", async () => {
      const scrapeCronDetails = [{ CronId: "1", CronName: "Main" }];
      const items = [{ MpId: 1, Net32Url: "http://x.com" }];
      (sqlV2Service.GetScrapeCrons as jest.Mock).mockResolvedValue(scrapeCronDetails);
      (sqlMiddleware.GetScrapeProductList as jest.Mock).mockResolvedValue(items);
      (sqlMiddleware.GetScrapeProductListByFilter as jest.Mock).mockResolvedValue([]);
      (sqlMiddleware.GetNumberOfScrapeProducts as jest.Mock).mockResolvedValue(25);

      await scrape.GetScrapeProducts(mockReq as Request, mockRes as Response);

      expect(sqlMiddleware.GetScrapeProductList).toHaveBeenCalledWith(1, 10);
      expect(sqlMiddleware.GetScrapeProductListByFilter).not.toHaveBeenCalled();
      expect(renderMock).toHaveBeenCalledWith(
        "pages/scrapeProducts/scrapeOnlyProducts",
        expect.objectContaining({
          itemsScrape: scrapeCronDetails,
          items,
          pageNumber: 1,
          pageSize: 10,
          tags: "",
          totalDocs: 25,
          totalPages: 3,
          groupName: "ScrapeProducts",
          userRole: "admin",
        })
      );
    });

    it("should use filter and pgno when query has tags and pgno", async () => {
      mockReq.query = { tags: "foo", pgno: "2" };
      (sqlV2Service.GetScrapeCrons as jest.Mock).mockResolvedValue([]);
      (sqlMiddleware.GetScrapeProductListByFilter as jest.Mock).mockResolvedValue([]);
      (sqlMiddleware.GetNumberOfScrapeProducts as jest.Mock).mockResolvedValue(15);

      await scrape.GetScrapeProducts(mockReq as Request, mockRes as Response);

      expect(sqlMiddleware.GetScrapeProductListByFilter).toHaveBeenCalledWith("foo", 10, "2");
      expect(renderMock).toHaveBeenCalledWith(
        "pages/scrapeProducts/scrapeOnlyProducts",
        expect.objectContaining({
          pageNumber: "2",
          tags: "foo",
          totalPages: 2,
        })
      );
    });
  });

  describe("exportItems", () => {
    it("should build workbook, set headers and write excel to response", async () => {
      const scrapeCollection = [
        {
          Is_Active: true,
          MpId: 1,
          Net32Url: "http://x.com",
          LinkedCronName: "E1",
          LinkedCronId: SAMPLE_CRON_ID,
          LastUpdatedAt: "2024-01-01",
          LastUpdatedBy: "user1",
          LastScrapedDate: "2024-01-02",
          Is_Badge: false,
        },
      ];
      (sqlMiddleware.GetAllScrapeProductDetails as jest.Mock).mockResolvedValue(scrapeCollection);

      await scrape.exportItems(mockReq as Request, mockRes as Response);

      expect(sqlMiddleware.GetAllScrapeProductDetails).toHaveBeenCalled();
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith("ScrapeList", {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      expect(mockSheet.addRows).toHaveBeenCalledWith(scrapeCollection);
      expect(setHeaderMock).toHaveBeenCalledWith("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(setHeaderMock).toHaveBeenCalledWith("Content-Disposition", "attachment; filename=" + "scrapeExcel.xlsx");
      await Promise.resolve();
      expect(mockWrite).toHaveBeenCalledWith(mockRes);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(endMock).toHaveBeenCalled();
    });
  });

  describe("importItems", () => {
    it("should parse input rows, upsert each item and return success", async () => {
      const auditInfo = { UpdatedBy: "u1", UpdatedOn: new Date() };
      const scrapeCron = [{ CronId: SAMPLE_CRON_ID, CronName: "E1" }];
      mockReq.body = {
        count: "3",
        data: [
          ["true", 101, "http://a.com", "E1", null, null, null, null, "false"],
          ["false", 102, "http://b.com", "E1", null, null, null, null, "true"],
        ],
      };
      (SessionHelper.GetAuditInfo as jest.Mock).mockResolvedValue(auditInfo);
      (sqlV2Service.GetScrapeCrons as jest.Mock).mockResolvedValue(scrapeCron);
      (sqlMiddleware.UpsertProductDetails as jest.Mock).mockResolvedValue(undefined);

      await scrape.importItems(mockReq as Request, mockRes as Response);

      expect(SessionHelper.GetAuditInfo).toHaveBeenCalledWith(mockReq);
      expect(sqlMiddleware.UpsertProductDetails).toHaveBeenCalledTimes(2);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Item Chart added successfully. Count : 3",
      });
    });

    it("should process single row when count is 2", async () => {
      mockReq.body = {
        count: "2",
        data: [["true", 100, "http://a.com", "E1", null, null, null, null, "false"]],
      };
      (SessionHelper.GetAuditInfo as jest.Mock).mockResolvedValue({
        UpdatedBy: "u",
        UpdatedOn: new Date(),
      });
      (sqlV2Service.GetScrapeCrons as jest.Mock).mockResolvedValue([{ CronId: SAMPLE_CRON_ID, CronName: "E1" }]);
      (sqlMiddleware.UpsertProductDetails as jest.Mock).mockResolvedValue(undefined);

      await scrape.importItems(mockReq as Request, mockRes as Response);

      expect(sqlMiddleware.UpsertProductDetails).toHaveBeenCalledTimes(1);
    });

    it("should use default values when row cells are falsy", async () => {
      mockReq.body = {
        count: "2",
        data: [[null, 50, null, "", null, null, null, null, null]],
      };
      (SessionHelper.GetAuditInfo as jest.Mock).mockResolvedValue({
        UpdatedBy: "u",
        UpdatedOn: new Date(),
      });
      (sqlV2Service.GetScrapeCrons as jest.Mock).mockResolvedValue([{ CronId: SAMPLE_CRON_ID, CronName: "E1" }]);
      (sqlMiddleware.UpsertProductDetails as jest.Mock).mockResolvedValue(undefined);

      await scrape.importItems(mockReq as Request, mockRes as Response);

      expect(sqlMiddleware.UpsertProductDetails).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
          mpId: 50,
          net32Url: "N/A",
          linkedCron: "",
          linkedCronId: "",
          isBadgeItem: false,
        })
      );
    });
  });

  describe("addItems", () => {
    it("should build scrapeData from body and audit, upsert and return success", async () => {
      mockReq.body = {
        net32_url: "http://x.com",
        mpid: "99",
        activated: "on",
        cronName: "E1",
        scrape_cron: SAMPLE_CRON_ID,
        is_badge_item: "on",
      };
      (SessionHelper.GetAuditInfo as jest.Mock).mockResolvedValue({
        UpdatedBy: "admin",
        UpdatedOn: new Date("2024-01-01T12:00:00Z"),
      });
      (sqlMiddleware.UpsertProductDetails as jest.Mock).mockResolvedValue(true);

      await scrape.addItems(mockReq as Request, mockRes as Response);

      expect(sqlMiddleware.UpsertProductDetails).toHaveBeenCalledWith(
        expect.objectContaining({
          net32Url: "http://x.com",
          mpId: 99,
          isActive: true,
          linkedCron: "E1",
          linkedCronId: SAMPLE_CRON_ID,
          isBadgeItem: true,
          lastUpdatedBy: "admin",
        })
      );
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Item added successfully.",
      });
    });

    it("should set isActive and isBadgeItem false when off", async () => {
      mockReq.body = {
        net32_url: "http://y.com",
        mpid: "88",
        activated: "off",
        cronName: "E1",
        scrape_cron: SAMPLE_CRON_ID,
        is_badge_item: "off",
      };
      (SessionHelper.GetAuditInfo as jest.Mock).mockResolvedValue({
        UpdatedBy: "u",
        UpdatedOn: new Date(),
      });
      (sqlMiddleware.UpsertProductDetails as jest.Mock).mockResolvedValue(true);

      await scrape.addItems(mockReq as Request, mockRes as Response);

      expect(sqlMiddleware.UpsertProductDetails).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
          isBadgeItem: false,
        })
      );
    });

    it("should not call res.json when UpsertProductDetails returns falsy", async () => {
      mockReq.body = {
        net32_url: "http://x.com",
        mpid: "99",
        activated: "on",
        cronName: "E1",
        scrape_cron: SAMPLE_CRON_ID,
        is_badge_item: "off",
      };
      (SessionHelper.GetAuditInfo as jest.Mock).mockResolvedValue({
        UpdatedBy: "u",
        UpdatedOn: new Date(),
      });
      (sqlMiddleware.UpsertProductDetails as jest.Mock).mockResolvedValue(null);

      await scrape.addItems(mockReq as Request, mockRes as Response);

      expect(jsonMock).not.toHaveBeenCalled();
    });
  });

  describe("editItems", () => {
    it("should build scrapeData and upsert, return success", async () => {
      mockReq.body = {
        net32_url: "http://edit.com",
        mpId: "77",
        activated: "on",
        cronName: "E1",
        scrape_cron: SAMPLE_CRON_ID,
        is_badge_item: "off",
      };
      (SessionHelper.GetAuditInfo as jest.Mock).mockResolvedValue({
        UpdatedBy: "editor",
        UpdatedOn: new Date(),
      });
      (sqlMiddleware.UpsertProductDetails as jest.Mock).mockResolvedValue(true);

      await scrape.editItems(mockReq as Request, mockRes as Response);

      expect(sqlMiddleware.UpsertProductDetails).toHaveBeenCalledWith(
        expect.objectContaining({
          mpId: 77,
          net32Url: "http://edit.com",
          linkedCronId: SAMPLE_CRON_ID,
        })
      );
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Item edited successfully.",
      });
    });

    it("should not call res.json when UpsertProductDetails returns falsy", async () => {
      mockReq.body = {
        net32_url: "http://x.com",
        mpId: "77",
        activated: "on",
        cronName: "E1",
        scrape_cron: SAMPLE_CRON_ID,
        is_badge_item: "off",
      };
      (SessionHelper.GetAuditInfo as jest.Mock).mockResolvedValue({
        UpdatedBy: "u",
        UpdatedOn: new Date(),
      });
      (sqlMiddleware.UpsertProductDetails as jest.Mock).mockResolvedValue(null);

      await scrape.editItems(mockReq as Request, mockRes as Response);

      expect(jsonMock).not.toHaveBeenCalled();
    });
  });

  describe("deleteItem", () => {
    it("should delete by id and return success", async () => {
      mockReq.body = { id: "42" };
      (sqlMiddleware.DeleteScrapeProductById as jest.Mock).mockResolvedValue({});

      await scrape.deleteItem(mockReq as Request, mockRes as Response);

      expect(sqlMiddleware.DeleteScrapeProductById).toHaveBeenCalledWith(42);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Item Deleted successfully.",
      });
    });

    it("should not call res.json when delete returns falsy", async () => {
      mockReq.body = { id: "99" };
      (sqlMiddleware.DeleteScrapeProductById as jest.Mock).mockResolvedValue(null);

      await scrape.deleteItem(mockReq as Request, mockRes as Response);

      expect(jsonMock).not.toHaveBeenCalled();
    });
  });
});
