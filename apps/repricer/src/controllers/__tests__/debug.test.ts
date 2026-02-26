import { Request, Response } from "express";
import * as debug from "../debug";
import * as httpMiddleware from "../../utility/http-wrappers";
import * as mongoMiddleware from "../../services/mongo";
import * as mySqlMiddleware from "../../services/mysql";
import { applicationConfig } from "../../utility/config";
import { GetCronSettingsList } from "../../services/mysql-v2";
import { archiveHistory } from "../../utility/history-archive-helper";
import fs from "fs";

jest.mock("../../services/mongo");
jest.mock("../../services/mysql");
jest.mock("../../utility/http-wrappers");
jest.mock("../../services/mysql-v2");
jest.mock("../../utility/history-archive-helper");

jest.mock("fs", () => {
  const actualStream = require("stream");
  return {
    ...jest.requireActual("fs"),
    createReadStream: jest.fn((_path: string) => actualStream.Readable.from(["Mpid,UnitPrice,TRA_FloorPrice,FRO_FloorPrice,MVP_FloorPrice\n", "1,10,20,NULL,NULL\n", "2,5,NULL,15,NULL\n", "3,2,NULL,NULL,10\n"])),
    writeFileSync: jest.fn(),
  };
});

const mockGetProductListByQuery = mongoMiddleware.GetProductListByQuery as jest.MockedFunction<typeof mongoMiddleware.GetProductListByQuery>;
const mockInsertOrUpdateProduct = mongoMiddleware.InsertOrUpdateProduct as jest.MockedFunction<typeof mongoMiddleware.InsertOrUpdateProduct>;
const mockFindProductById = mongoMiddleware.FindProductById as jest.MockedFunction<typeof mongoMiddleware.FindProductById>;
const mockInsertOrUpdateProductWithQuery = mongoMiddleware.InsertOrUpdateProductWithQuery as jest.MockedFunction<typeof mongoMiddleware.InsertOrUpdateProductWithQuery>;
const mockNativeGet = httpMiddleware.native_get as jest.MockedFunction<typeof httpMiddleware.native_get>;
const mockNativePost = httpMiddleware.native_post as jest.MockedFunction<typeof httpMiddleware.native_post>;
const mockGetCronSettingsList = GetCronSettingsList as jest.MockedFunction<typeof GetCronSettingsList>;
const mockMapVendorToRoot = mySqlMiddleware.MapVendorToRoot as jest.MockedFunction<typeof mySqlMiddleware.MapVendorToRoot>;
const mockExecuteQuery = mySqlMiddleware.ExecuteQuery as jest.MockedFunction<typeof mySqlMiddleware.ExecuteQuery>;
const mockArchiveHistory = archiveHistory as jest.MockedFunction<typeof archiveHistory>;

describe("Debug Controller", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation();
    jsonMock = jest.fn().mockReturnThis();
    mockRes = { json: jsonMock };
    mockReq = { params: {}, body: {} };
    (applicationConfig as any).REPRICER_API_BASE_URL = "http://api.test";
    (applicationConfig as any).GET_DATA_URL_ENDPOINT = "/debug/get-data";
  });

  describe("ResetSlowCronUpdate", () => {
    it("should return success with count 0 when no products match query", async () => {
      mockGetProductListByQuery.mockResolvedValue([]);

      await debug.ResetSlowCronUpdate(mockReq as Request, mockRes as Response);

      expect(mockGetProductListByQuery).toHaveBeenCalledWith({
        $or: [{ "tradentDetails.cronId": "b597ffd1ce4d463088ce12a6f05b55d6" }, { "frontierDetails.cronId": "b597ffd1ce4d463088ce12a6f05b55d6" }, { "mvpDetails.cronId": "b597ffd1ce4d463088ce12a6f05b55d6" }],
      });
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Updated All Product : Count 0",
      });
    });

    it("should reset tradentDetails parent cron and update each product", async () => {
      const products = [
        {
          mpId: "mp1",
          tradentDetails: {
            cronId: "b597ffd1ce4d463088ce12a6f05b55d6",
            cronName: "Slow",
            parentCronId: "parent-id",
            parentCronName: "Parent",
          },
        },
      ];
      mockGetProductListByQuery.mockResolvedValue(products as any);
      mockInsertOrUpdateProduct.mockResolvedValue(undefined as any);

      await debug.ResetSlowCronUpdate(mockReq as Request, mockRes as Response);

      expect(mockInsertOrUpdateProduct).toHaveBeenCalledTimes(1);
      expect(mockInsertOrUpdateProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          mpId: "mp1",
          tradentDetails: {
            cronId: "parent-id",
            cronName: "Parent",
            parentCronId: null,
            parentCronName: null,
          },
        }),
        mockReq
      );
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Updated All Product : Count 1",
      });
    });

    it("should reset frontierDetails and mvpDetails when present", async () => {
      const products = [
        {
          mpId: "mp2",
          frontierDetails: {
            cronId: "b597ffd1ce4d463088ce12a6f05b55d6",
            cronName: "Slow",
            parentCronId: "f-parent",
            parentCronName: "F-Parent",
          },
          mvpDetails: {
            cronId: "b597ffd1ce4d463088ce12a6f05b55d6",
            cronName: "Slow",
            parentCronId: "m-parent",
            parentCronName: "M-Parent",
          },
        },
      ];
      mockGetProductListByQuery.mockResolvedValue(products as any);
      mockInsertOrUpdateProduct.mockResolvedValue(undefined as any);

      await debug.ResetSlowCronUpdate(mockReq as Request, mockRes as Response);

      const updated = mockInsertOrUpdateProduct.mock.calls[0][0];
      expect(updated.frontierDetails).toEqual({
        cronId: "f-parent",
        cronName: "F-Parent",
        parentCronId: null,
        parentCronName: null,
      });
      expect(updated.mvpDetails).toEqual({
        cronId: "m-parent",
        cronName: "M-Parent",
        parentCronId: null,
        parentCronName: null,
      });
    });

    it("should skip details that are not present on product", async () => {
      const products = [{ mpId: "mp3" }];
      mockGetProductListByQuery.mockResolvedValue(products as any);
      mockInsertOrUpdateProduct.mockResolvedValue(undefined as any);

      await debug.ResetSlowCronUpdate(mockReq as Request, mockRes as Response);

      expect(mockInsertOrUpdateProduct).toHaveBeenCalledWith(expect.objectContaining({ mpId: "mp3" }), mockReq);
    });
  });

  describe("RefillParentCronDetails", () => {
    it("should return success with empty data when payload is empty", async () => {
      mockReq.body = [];
      mockGetCronSettingsList.mockResolvedValue([]);

      await debug.RefillParentCronDetails(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Updated All Product : Count - 0",
        data: [],
      });
    });

    it("should refill cron from tradentDetails.cronId when present", async () => {
      mockReq.body = [{ mpId: "mp1" }];
      mockGetCronSettingsList.mockResolvedValue([{ CronId: "c1", CronName: "Cron1" }] as any);
      mockFindProductById.mockResolvedValue([
        {
          mpId: "mp1",
          tradentDetails: { cronId: "c1", cronName: "Cron1" },
        },
      ] as any);
      mockInsertOrUpdateProduct.mockResolvedValue(undefined as any);

      await debug.RefillParentCronDetails(mockReq as Request, mockRes as Response);

      expect(mockFindProductById).toHaveBeenCalledWith("mp1");
      expect(mockInsertOrUpdateProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          mpId: "mp1",
          tradentDetails: {
            cronId: "c1",
            cronName: "Cron1",
            parentCronId: null,
            parentCronName: null,
          },
        }),
        mockReq
      );
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Updated All Product : Count - 1",
        data: [{ productId: "mp1", cronName: "Cron1" }],
      });
    });

    it("should derive context from lastCronRun when cronId not set", async () => {
      mockReq.body = [{ mpId: "mp2" }];
      mockGetCronSettingsList.mockResolvedValue([{ CronId: "c2", CronName: "Cron-Main" }] as any);
      mockFindProductById.mockResolvedValue([
        {
          mpId: "mp2",
          tradentDetails: {
            lastCronRun: "Cron-Main",
            lastUpdatedBy: "other",
          },
        },
      ] as any);
      mockInsertOrUpdateProduct.mockResolvedValue(undefined as any);

      await debug.RefillParentCronDetails(mockReq as Request, mockRes as Response);

      expect(mockInsertOrUpdateProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          tradentDetails: expect.objectContaining({
            cronId: "c2",
            cronName: "Cron-Main",
          }),
        }),
        mockReq
      );
      expect(jsonMock.mock.calls[0][0].data).toEqual([{ productId: "mp2", cronName: "Cron-Main" }]);
    });

    it("should derive context from lastUpdatedBy when lastCronRun is Cron-422", async () => {
      mockReq.body = [{ mpId: "mp3" }];
      mockGetCronSettingsList.mockResolvedValue([{ CronId: "c3", CronName: "Cron-Other" }] as any);
      mockFindProductById.mockResolvedValue([
        {
          mpId: "mp3",
          tradentDetails: {
            lastCronRun: "Cron-422",
            lastUpdatedBy: "Cron-Other",
          },
        },
      ] as any);
      mockInsertOrUpdateProduct.mockResolvedValue(undefined as any);

      await debug.RefillParentCronDetails(mockReq as Request, mockRes as Response);

      expect(mockInsertOrUpdateProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          tradentDetails: expect.objectContaining({
            cronId: "c3",
            cronName: "Cron-Other",
          }),
        }),
        mockReq
      );
    });

    it("should use frontierDetails when tradentDetails missing", async () => {
      mockReq.body = [{ mpId: "mp4" }];
      mockGetCronSettingsList.mockResolvedValue([{ CronId: "c4", CronName: "FrontierCron" }] as any);
      mockFindProductById.mockResolvedValue([
        {
          mpId: "mp4",
          frontierDetails: { cronId: "c4", cronName: "FrontierCron" },
        },
      ] as any);
      mockInsertOrUpdateProduct.mockResolvedValue(undefined as any);

      await debug.RefillParentCronDetails(mockReq as Request, mockRes as Response);

      expect(mockInsertOrUpdateProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          frontierDetails: {
            cronId: "c4",
            cronName: "FrontierCron",
            parentCronId: null,
            parentCronName: null,
          },
        }),
        mockReq
      );
    });

    it("should derive context from frontierDetails.lastCronRun when frontierDetails has no cronId", async () => {
      mockReq.body = [{ mpId: "mp4b" }];
      mockGetCronSettingsList.mockResolvedValue([{ CronId: "c4b", CronName: "FrontierMain" }] as any);
      mockFindProductById.mockResolvedValue([
        {
          mpId: "mp4b",
          frontierDetails: {
            lastCronRun: "FrontierMain",
            lastUpdatedBy: "Other",
          },
        },
      ] as any);
      mockInsertOrUpdateProduct.mockResolvedValue(undefined as any);

      await debug.RefillParentCronDetails(mockReq as Request, mockRes as Response);

      expect(mockInsertOrUpdateProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          frontierDetails: expect.objectContaining({
            cronId: "c4b",
            cronName: "FrontierMain",
            parentCronId: null,
            parentCronName: null,
          }),
        }),
        mockReq
      );
    });

    it("should derive context from frontierDetails.lastUpdatedBy when lastCronRun is Cron-422", async () => {
      mockReq.body = [{ mpId: "mp4c" }];
      mockGetCronSettingsList.mockResolvedValue([{ CronId: "c4c", CronName: "FrontierOther" }] as any);
      mockFindProductById.mockResolvedValue([
        {
          mpId: "mp4c",
          frontierDetails: {
            lastCronRun: "Cron-422",
            lastUpdatedBy: "FrontierOther",
          },
        },
      ] as any);
      mockInsertOrUpdateProduct.mockResolvedValue(undefined as any);

      await debug.RefillParentCronDetails(mockReq as Request, mockRes as Response);

      expect(mockInsertOrUpdateProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          frontierDetails: expect.objectContaining({
            cronId: "c4c",
            cronName: "FrontierOther",
          }),
        }),
        mockReq
      );
    });

    it("should use mvpDetails when tradent and frontier missing", async () => {
      mockReq.body = [{ mpId: "mp5" }];
      mockGetCronSettingsList.mockResolvedValue([{ CronId: "c5", CronName: "MvpCron" }] as any);
      mockFindProductById.mockResolvedValue([
        {
          mpId: "mp5",
          mvpDetails: { cronId: "c5", cronName: "MvpCron" },
        },
      ] as any);
      mockInsertOrUpdateProduct.mockResolvedValue(undefined as any);

      await debug.RefillParentCronDetails(mockReq as Request, mockRes as Response);

      expect(mockInsertOrUpdateProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          mvpDetails: {
            cronId: "c5",
            cronName: "MvpCron",
            parentCronId: null,
            parentCronName: null,
          },
        }),
        mockReq
      );
    });

    it("should derive context from mvpDetails.lastCronRun when mvpDetails has no cronId", async () => {
      mockReq.body = [{ mpId: "mp5b" }];
      mockGetCronSettingsList.mockResolvedValue([{ CronId: "c5b", CronName: "MvpMain" }] as any);
      mockFindProductById.mockResolvedValue([
        {
          mpId: "mp5b",
          mvpDetails: {
            lastCronRun: "MvpMain",
            lastUpdatedBy: "Other",
          },
        },
      ] as any);
      mockInsertOrUpdateProduct.mockResolvedValue(undefined as any);

      await debug.RefillParentCronDetails(mockReq as Request, mockRes as Response);

      expect(mockInsertOrUpdateProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          mvpDetails: expect.objectContaining({
            cronId: "c5b",
            cronName: "MvpMain",
            parentCronId: null,
            parentCronName: null,
          }),
        }),
        mockReq
      );
    });

    it("should derive context from mvpDetails.lastUpdatedBy when lastCronRun is Cron-422", async () => {
      mockReq.body = [{ mpId: "mp5c" }];
      mockGetCronSettingsList.mockResolvedValue([{ CronId: "c5c", CronName: "MvpOther" }] as any);
      mockFindProductById.mockResolvedValue([
        {
          mpId: "mp5c",
          mvpDetails: {
            lastCronRun: "Cron-422",
            lastUpdatedBy: "MvpOther",
          },
        },
      ] as any);
      mockInsertOrUpdateProduct.mockResolvedValue(undefined as any);

      await debug.RefillParentCronDetails(mockReq as Request, mockRes as Response);

      expect(mockInsertOrUpdateProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          mvpDetails: expect.objectContaining({
            cronId: "c5c",
            cronName: "MvpOther",
          }),
        }),
        mockReq
      );
    });

    it("should push empty cronName when no context cron found", async () => {
      mockReq.body = [{ mpId: "mp6" }];
      mockGetCronSettingsList.mockResolvedValue([] as any);
      mockFindProductById.mockResolvedValue([{ mpId: "mp6", tradentDetails: { lastCronRun: "Cron-422", lastUpdatedBy: "Cron-422" } }] as any);

      await debug.RefillParentCronDetails(mockReq as Request, mockRes as Response);

      expect(mockInsertOrUpdateProduct).not.toHaveBeenCalled();
      expect(jsonMock.mock.calls[0][0].data).toEqual([{ productId: "mp6", cronName: "" }]);
    });

    it("should process multiple mpIds from body", async () => {
      mockReq.body = [{ mpId: "mp1" }, { mpId: "mp2" }];
      mockGetCronSettingsList.mockResolvedValue([{ CronId: "c1", CronName: "C1" }] as any);
      mockFindProductById.mockResolvedValueOnce([{ mpId: "mp1", tradentDetails: { cronId: "c1", cronName: "C1" } }] as any).mockResolvedValueOnce([{ mpId: "mp2", tradentDetails: { cronId: "c1", cronName: "C1" } }] as any);
      mockInsertOrUpdateProduct.mockResolvedValue(undefined as any);

      await debug.RefillParentCronDetails(mockReq as Request, mockRes as Response);

      expect(mockFindProductById).toHaveBeenCalledTimes(2);
      expect(mockInsertOrUpdateProduct).toHaveBeenCalledTimes(2);
      expect(jsonMock.mock.calls[0][0].data).toHaveLength(2);
    });
  });

  describe("CorrectSlowCronDetails", () => {
    it("should return success with empty data when payload is empty", async () => {
      mockReq.body = [];

      await debug.CorrectSlowCronDetails(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Updated All Product : Count - 0",
        data: [],
      });
    });

    it("should set isSlowActivated false for each mpId and return results", async () => {
      mockReq.body = [101, 102];
      mockInsertOrUpdateProductWithQuery.mockResolvedValue({ modifiedCount: 1 } as any);

      await debug.CorrectSlowCronDetails(mockReq as Request, mockRes as Response);

      expect(mockInsertOrUpdateProductWithQuery).toHaveBeenCalledWith("101", { $set: { isSlowActivated: false } });
      expect(mockInsertOrUpdateProductWithQuery).toHaveBeenCalledWith("102", { $set: { isSlowActivated: false } });
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Updated All Product : Count - 2",
        data: [
          { productId: 101, result: { modifiedCount: 1 } },
          { productId: 102, result: { modifiedCount: 1 } },
        ],
      });
    });
  });

  describe("ScrapeProduct", () => {
    it("should call get-data URL and return response data", async () => {
      mockReq.params = { mpid: "mp123", proxyProviderId: "prov1" };
      const apiData = { productId: "mp123", price: 10 };
      mockNativeGet.mockResolvedValue({ data: apiData } as any);

      await debug.ScrapeProduct(mockReq as Request, mockRes as Response);

      expect(mockNativeGet).toHaveBeenCalledWith("http://api.test/debug/get-data/mp123/prov1");
      expect(jsonMock).toHaveBeenCalledWith(apiData);
    });
  });

  describe("MapVendorToRoot", () => {
    it("should return early when mpIdList is empty", async () => {
      mockReq.body = [];

      await debug.MapVendorToRoot(mockReq as Request, mockRes as Response);

      expect(mockGetCronSettingsList).not.toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith("Mapped Vendor to Product for 0 products");
    });

    it("should resolve CronId from CronName and call MapVendorToRoot for each item", async () => {
      mockReq.body = [
        { CronName: " Main ", other: "a" },
        { CronName: "Cron2", other: "b" },
      ];
      mockGetCronSettingsList.mockResolvedValue([
        { CronId: "id1", CronName: "Main" },
        { CronId: "id2", CronName: "Cron2" },
      ] as any);
      mockMapVendorToRoot.mockResolvedValue(undefined as any);

      await debug.MapVendorToRoot(mockReq as Request, mockRes as Response);

      expect(mockGetCronSettingsList).toHaveBeenCalled();
      expect(mockMapVendorToRoot).toHaveBeenCalledWith(expect.objectContaining({ CronName: " Main ", CronId: "id1" }));
      expect(mockMapVendorToRoot).toHaveBeenCalledWith(expect.objectContaining({ CronName: "Cron2", CronId: "id2" }));
      expect(jsonMock).toHaveBeenCalledWith("Mapped Vendor to Product for 2 products");
    });
  });

  describe("GetFloorBelowProducts", () => {
    it("should read CSV, filter rows below floor, write output and return done", async () => {
      await debug.GetFloorBelowProducts(mockReq as Request, mockRes as Response);

      expect(fs.createReadStream).toHaveBeenCalledWith("C:\\Users\\ghosh\\Desktop\\POST.csv");
      expect(jsonMock).toHaveBeenCalledWith("GetFloorBelowProducts done");
    });

    it("should write output.csv when filterResults has entries", async () => {
      await debug.GetFloorBelowProducts(mockReq as Request, mockRes as Response);

      expect(fs.writeFileSync).toHaveBeenCalledWith("output.csv", expect.any(String));
    });

    it("should reject when createReadStream throws", async () => {
      (fs.createReadStream as jest.Mock).mockImplementationOnce(() => {
        throw new Error("ENOENT: file not found");
      });

      await expect(debug.GetFloorBelowProducts(mockReq as Request, mockRes as Response)).rejects.toThrow("ENOENT: file not found");
    });
  });

  describe("DeleteHistory", () => {
    it("should run delete queries for each day in range and return done", async () => {
      mockReq.body = {
        startDate: "2024-01-01",
        endDate: "2024-01-03",
      };
      mockExecuteQuery.mockResolvedValue({ affectedRows: 5 } as any);

      await debug.DeleteHistory(mockReq as Request, mockRes as Response);

      expect(mockExecuteQuery).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith("DeleteHistory done for StartDate : 2024-01-01 | EndDate : 2024-01-03");
    });
  });

  describe("DeleteProdHistory", () => {
    it("should call startDeletingHistoryFromProduction and return done", async () => {
      mockReq.body = {
        startDate: "2024-01-01",
        endDate: "2024-01-02",
      };
      mockNativePost.mockResolvedValue({} as any);

      await debug.DeleteProdHistory(mockReq as Request, mockRes as Response);

      expect(mockNativePost).toHaveBeenCalledWith(
        "http://159.89.121.57:3000/debug/delete_history",
        expect.objectContaining({
          startDate: expect.any(String),
          endDate: expect.any(String),
        })
      );
      expect(jsonMock).toHaveBeenCalledWith("DeleteHistory done from Live for StartDate : 2024-01-01 | EndDate : 2024-01-02");
    });
  });

  describe("ArchiveHistory", () => {
    it("should call archiveHistory and return success message", async () => {
      mockArchiveHistory.mockResolvedValue(undefined as any);

      await debug.ArchiveHistory(mockReq as Request, mockRes as Response);

      expect(mockArchiveHistory).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith("Archive History Cron Executed!");
    });
  });
});
