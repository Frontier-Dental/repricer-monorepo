import { Request, Response } from "express";
import * as monitor from "../monitor";
import * as httpMiddleware from "../../utility/http-wrappers";
import * as mongoMiddleware from "../../services/mongo";
import * as SessionHelper from "../../utility/session-helper";
import { applicationConfig } from "../../utility/config";
import { GetCronSettingsList, GetSlowCronDetails } from "../../services/mysql-v2";

jest.mock("../../utility/http-wrappers");
jest.mock("../../services/mongo");
jest.mock("../../utility/session-helper");
jest.mock("../../services/mysql-v2");
jest.mock("../../utility/config", () => ({
  applicationConfig: {
    REPRICER_API_BASE_URL: "https://api.test/",
    GET_422_BELOW_PRODUCTS_ENDPOINT: "/debug/filterProductsWithFloor/xxx",
  },
}));

const mockNativeGet = httpMiddleware.native_get as jest.MockedFunction<typeof httpMiddleware.native_get>;
const mockGetLatestCronStatus = mongoMiddleware.GetLatestCronStatus as jest.MockedFunction<typeof mongoMiddleware.GetLatestCronStatus>;
const mockIgnoreCronStatusLog = mongoMiddleware.IgnoreCronStatusLog as jest.MockedFunction<typeof mongoMiddleware.IgnoreCronStatusLog>;
const mockGet422ProductCountByType = mongoMiddleware.Get422ProductCountByType as jest.MockedFunction<typeof mongoMiddleware.Get422ProductCountByType>;
const mockGetContextErrorItemsCount = mongoMiddleware.GetContextErrorItemsCount as jest.MockedFunction<typeof mongoMiddleware.GetContextErrorItemsCount>;
const mockGetAllProductDetailsV2 = mongoMiddleware.GetAllProductDetailsV2 as jest.MockedFunction<typeof mongoMiddleware.GetAllProductDetailsV2>;
const mockInsertOrUpdateScrapeOnlyProduct = mongoMiddleware.InsertOrUpdateScrapeOnlyProduct as jest.MockedFunction<typeof mongoMiddleware.InsertOrUpdateScrapeOnlyProduct>;
const mockGetAuditInfo = SessionHelper.GetAuditInfo as jest.MockedFunction<typeof SessionHelper.GetAuditInfo>;
const mockGetCronSettingsList = GetCronSettingsList as jest.MockedFunction<typeof GetCronSettingsList>;
const mockGetSlowCronDetails = GetSlowCronDetails as jest.MockedFunction<typeof GetSlowCronDetails>;

describe("monitor Controller", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn().mockReturnThis();
    mockRes = { json: jsonMock };
    mockReq = { params: {}, body: {}, query: {} };
    mockNativeGet.mockResolvedValue(undefined as any);
    mockGetAuditInfo.mockResolvedValue({ UpdatedBy: "test-user" } as any);
  });

  describe("GetInprogressCron", () => {
    it("should return status true and empty data when no in-progress crons", async () => {
      mockGetCronSettingsList.mockResolvedValue([]);
      mockGetSlowCronDetails.mockResolvedValue([]);
      mockGetLatestCronStatus.mockResolvedValue([]);

      await monitor.GetInprogressCron(mockReq as Request, mockRes as Response);

      expect(mockGetCronSettingsList).toHaveBeenCalled();
      expect(mockGetSlowCronDetails).toHaveBeenCalled();
      expect(mockGetLatestCronStatus).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        data: [],
      });
    });

    it("should attach cronName from GetCronSettingsList when CronId matches", async () => {
      const cronSettings = [{ CronId: "cron-1", CronName: "MainCron" }];
      const inProgressCrons = [{ cronId: "cron-1", keyGenId: "key-1", productsCount: 5, cronTime: new Date() }];
      mockGetCronSettingsList.mockResolvedValue(cronSettings as any);
      mockGetSlowCronDetails.mockResolvedValue([]);
      mockGetLatestCronStatus.mockResolvedValue(inProgressCrons as any);

      await monitor.GetInprogressCron(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        data: [
          expect.objectContaining({
            cronId: "cron-1",
            cronName: "MainCron",
            productsCount: 5,
          }),
        ],
      });
      expect(mockIgnoreCronStatusLog).not.toHaveBeenCalled();
    });

    it("should attach cronName from GetSlowCronDetails when CronId matches", async () => {
      const slowCrons = [{ CronId: "slow-cron-1", CronName: "SlowCron" }];
      const inProgressCrons = [{ cronId: "slow-cron-1", keyGenId: "key-1", productsCount: 1, cronTime: new Date() }];
      mockGetCronSettingsList.mockResolvedValue([]);
      mockGetSlowCronDetails.mockResolvedValue(slowCrons as any);
      mockGetLatestCronStatus.mockResolvedValue(inProgressCrons as any);

      await monitor.GetInprogressCron(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        data: [
          expect.objectContaining({
            cronId: "slow-cron-1",
            cronName: "SlowCron",
          }),
        ],
      });
    });

    it("should call IgnoreCronStatusLog when productsCount is 0 and age > 120 seconds", async () => {
      const oldTime = new Date(Date.now() - 121 * 1000);
      const inProgressCrons = [{ cronId: "stale-cron", keyGenId: "key-stale", productsCount: 0, cronTime: oldTime }];
      mockGetCronSettingsList.mockResolvedValue([]);
      mockGetSlowCronDetails.mockResolvedValue([]);
      mockGetLatestCronStatus.mockResolvedValue(inProgressCrons as any);
      mockIgnoreCronStatusLog.mockResolvedValue(undefined as any);

      await monitor.GetInprogressCron(mockReq as Request, mockRes as Response);

      expect(mockIgnoreCronStatusLog).toHaveBeenCalledWith("stale-cron", "key-stale");
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        data: inProgressCrons,
      });
    });

    it("should not call IgnoreCronStatusLog when productsCount is 0 but age <= 120 seconds", async () => {
      const recentTime = new Date(Date.now() - 60 * 1000);
      const inProgressCrons = [{ cronId: "recent-cron", keyGenId: "key-recent", productsCount: 0, cronTime: recentTime }];
      mockGetCronSettingsList.mockResolvedValue([]);
      mockGetSlowCronDetails.mockResolvedValue([]);
      mockGetLatestCronStatus.mockResolvedValue(inProgressCrons as any);

      await monitor.GetInprogressCron(mockReq as Request, mockRes as Response);

      expect(mockIgnoreCronStatusLog).not.toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        data: inProgressCrons,
      });
    });

    it("should not call IgnoreCronStatusLog when productsCount > 0 even if age > 120 seconds", async () => {
      const oldTime = new Date(Date.now() - 200 * 1000);
      const inProgressCrons = [{ cronId: "old-but-active", keyGenId: "key-1", productsCount: 10, cronTime: oldTime }];
      mockGetCronSettingsList.mockResolvedValue([]);
      mockGetSlowCronDetails.mockResolvedValue([]);
      mockGetLatestCronStatus.mockResolvedValue(inProgressCrons as any);

      await monitor.GetInprogressCron(mockReq as Request, mockRes as Response);

      expect(mockIgnoreCronStatusLog).not.toHaveBeenCalled();
    });

    it("should leave cronName undefined when no match in combined cron list", async () => {
      const inProgressCrons = [{ cronId: "unknown-cron", keyGenId: "key-1", productsCount: 1, cronTime: new Date() }];
      mockGetCronSettingsList.mockResolvedValue([{ CronId: "other", CronName: "Other" }] as any);
      mockGetSlowCronDetails.mockResolvedValue([]);
      mockGetLatestCronStatus.mockResolvedValue(inProgressCrons as any);

      await monitor.GetInprogressCron(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        data: [
          expect.objectContaining({
            cronId: "unknown-cron",
            cronName: undefined,
          }),
        ],
      });
    });

    it("should call IgnoreCronStatusLog for each stale cron (0 products, >120s)", async () => {
      const oldTime = new Date(Date.now() - 130 * 1000);
      const inProgressCrons = [
        { cronId: "stale-1", keyGenId: "key-1", productsCount: 0, cronTime: oldTime },
        { cronId: "stale-2", keyGenId: "key-2", productsCount: 0, cronTime: oldTime },
      ];
      mockGetCronSettingsList.mockResolvedValue([]);
      mockGetSlowCronDetails.mockResolvedValue([]);
      mockGetLatestCronStatus.mockResolvedValue(inProgressCrons as any);
      mockIgnoreCronStatusLog.mockResolvedValue(undefined as any);

      await monitor.GetInprogressCron(mockReq as Request, mockRes as Response);

      expect(mockIgnoreCronStatusLog).toHaveBeenCalledTimes(2);
      expect(mockIgnoreCronStatusLog).toHaveBeenCalledWith("stale-1", "key-1");
      expect(mockIgnoreCronStatusLog).toHaveBeenCalledWith("stale-2", "key-2");
    });
  });

  describe("Get422ProductDetails", () => {
    it("should return status true and product counts with formatted time", async () => {
      mockGet422ProductCountByType.mockResolvedValueOnce(10).mockResolvedValueOnce(20);
      mockGetContextErrorItemsCount.mockResolvedValue(5);

      await monitor.Get422ProductDetails(mockReq as Request, mockRes as Response);

      expect(mockGet422ProductCountByType).toHaveBeenCalledWith("422_ERROR");
      expect(mockGet422ProductCountByType).toHaveBeenCalledWith("PRICE_UPDATE");
      expect(mockGetContextErrorItemsCount).toHaveBeenCalledWith(true);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        data: {
          products422Error: 10,
          priceUpdateProducts: 20,
          eligibleProducts: 5,
          time: expect.stringMatching(/\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}/),
        },
      });
    });
  });

  describe("GetProductsBelowFloor", () => {
    it("should call native_get with config URL and return job started message", async () => {
      const baseUrl = (applicationConfig as any).REPRICER_API_BASE_URL;
      const endpoint = (applicationConfig as any).GET_422_BELOW_PRODUCTS_ENDPOINT;

      await monitor.GetProductsBelowFloor(mockReq as Request, mockRes as Response);

      expect(mockNativeGet).toHaveBeenCalledWith(baseUrl + endpoint);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        data: expect.stringContaining("Job Started at"),
      });
    });
  });

  describe("LoadScrapeOnlyProducts", () => {
    beforeEach(() => {
      jest.spyOn(console, "log").mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should return success with count 0 when no products", async () => {
      mockReq.params = { pageNo: "1", pageSize: "10" };
      mockGetAllProductDetailsV2.mockResolvedValue([]);

      await monitor.LoadScrapeOnlyProducts(mockReq as Request, mockRes as Response);

      expect(mockGetAllProductDetailsV2).toHaveBeenCalledWith({}, 1, 10);
      expect(mockGetAuditInfo).toHaveBeenCalledWith(mockReq);
      expect(mockInsertOrUpdateScrapeOnlyProduct).not.toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        data: expect.stringMatching(/Inserted Scrape Only products.*Count : 0/),
      });
    });

    it("should insert products with tradentDetails net32url", async () => {
      mockReq.params = { pageNo: "0", pageSize: "25" };
      const products = [{ mpId: 100, tradentDetails: { net32url: "https://tradent.net/100" } }];
      mockGetAllProductDetailsV2.mockResolvedValue(products as any);
      mockInsertOrUpdateScrapeOnlyProduct.mockResolvedValue(undefined as any);

      await monitor.LoadScrapeOnlyProducts(mockReq as Request, mockRes as Response);

      expect(mockInsertOrUpdateScrapeOnlyProduct).toHaveBeenCalledWith({
        mpId: 100,
        isActive: true,
        net32Url: "https://tradent.net/100",
        AuditInfo: expect.anything(),
      });
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        data: expect.stringMatching(/Count : 1/),
      });
    });

    it("should use frontierDetails.net32url when tradentDetails absent", async () => {
      mockReq.params = { pageNo: "1", pageSize: "10" };
      const products = [{ mpId: 200, frontierDetails: { net32url: "https://frontier.net/200" } }];
      mockGetAllProductDetailsV2.mockResolvedValue(products as any);
      mockInsertOrUpdateScrapeOnlyProduct.mockResolvedValue(undefined as any);

      await monitor.LoadScrapeOnlyProducts(mockReq as Request, mockRes as Response);

      expect(mockInsertOrUpdateScrapeOnlyProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          mpId: 200,
          net32Url: "https://frontier.net/200",
        })
      );
    });

    it("should use mvpDetails.net32url when only mvpDetails present", async () => {
      mockReq.params = { pageNo: "1", pageSize: "10" };
      const products = [{ mpId: 300, mvpDetails: { net32url: "https://mvp.net/300" } }];
      mockGetAllProductDetailsV2.mockResolvedValue(products as any);
      mockInsertOrUpdateScrapeOnlyProduct.mockResolvedValue(undefined as any);

      await monitor.LoadScrapeOnlyProducts(mockReq as Request, mockRes as Response);

      expect(mockInsertOrUpdateScrapeOnlyProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          mpId: 300,
          net32Url: "https://mvp.net/300",
        })
      );
    });

    it("should use empty string for net32Url when no detail sources present", async () => {
      mockReq.params = { pageNo: "1", pageSize: "10" };
      const products = [{ mpId: 400 }];
      mockGetAllProductDetailsV2.mockResolvedValue(products as any);
      mockInsertOrUpdateScrapeOnlyProduct.mockResolvedValue(undefined as any);

      await monitor.LoadScrapeOnlyProducts(mockReq as Request, mockRes as Response);

      expect(mockInsertOrUpdateScrapeOnlyProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          mpId: 400,
          net32Url: "",
        })
      );
    });

    it("should skip products without mpId", async () => {
      mockReq.params = { pageNo: "1", pageSize: "10" };
      const products = [{ mpId: 500, tradentDetails: { net32url: "url" } }, { mpId: null, tradentDetails: {} }, { mpId: undefined }] as any[];
      mockGetAllProductDetailsV2.mockResolvedValue(products);
      mockInsertOrUpdateScrapeOnlyProduct.mockResolvedValue(undefined as any);

      await monitor.LoadScrapeOnlyProducts(mockReq as Request, mockRes as Response);

      expect(mockInsertOrUpdateScrapeOnlyProduct).toHaveBeenCalledTimes(1);
      expect(mockInsertOrUpdateScrapeOnlyProduct).toHaveBeenCalledWith(expect.objectContaining({ mpId: 500 }));
    });

    it("should skip null/undefined product entries", async () => {
      mockReq.params = { pageNo: "1", pageSize: "10" };
      const products = [{ mpId: 600, mvpDetails: { net32url: "u" } }, null, undefined] as any[];
      mockGetAllProductDetailsV2.mockResolvedValue(products);
      mockInsertOrUpdateScrapeOnlyProduct.mockResolvedValue(undefined as any);

      await monitor.LoadScrapeOnlyProducts(mockReq as Request, mockRes as Response);

      expect(mockInsertOrUpdateScrapeOnlyProduct).toHaveBeenCalledTimes(1);
    });

    it("should insert multiple products and return correct count", async () => {
      mockReq.params = { pageNo: "2", pageSize: "5" };
      const products = [
        { mpId: 1, tradentDetails: { net32url: "u1" } },
        { mpId: 2, frontierDetails: { net32url: "u2" } },
      ];
      mockGetAllProductDetailsV2.mockResolvedValue(products as any);
      mockInsertOrUpdateScrapeOnlyProduct.mockResolvedValue(undefined as any);

      await monitor.LoadScrapeOnlyProducts(mockReq as Request, mockRes as Response);

      expect(mockGetAllProductDetailsV2).toHaveBeenCalledWith({}, 2, 5);
      expect(mockInsertOrUpdateScrapeOnlyProduct).toHaveBeenCalledTimes(2);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        data: expect.stringMatching(/Count : 2/),
      });
    });
  });
});
