import { Request, Response } from "express";
import axios from "axios";
import * as productV2 from "../product-v2";
import * as mySqlHelper from "../../services/mysql";
import * as mapper from "../../middleware/mapper-helper";
import * as productHelper from "../../middleware/product-helper";
import * as httpHelper from "../../utility/http-wrappers";
import * as SessionHelper from "../../utility/session-helper";
import * as mongoMiddleware from "../../services/mongo";
import { GetCronSettingsList, GetSlowCronDetails, GetScrapeCrons } from "../../services/mysql-v2";

jest.mock("axios");
jest.mock("../../services/mysql");
jest.mock("../../middleware/mapper-helper");
jest.mock("../../middleware/product-helper");
jest.mock("../../utility/http-wrappers");
jest.mock("../../utility/session-helper");
jest.mock("../../services/mongo");
jest.mock("../../services/mysql-v2");

describe("Product V2 Controller", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let renderMock: jest.Mock;
  let setHeaderMock: jest.Mock;
  let sendMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation();
    jest.spyOn(console, "log").mockImplementation();
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnThis();
    renderMock = jest.fn();
    setHeaderMock = jest.fn().mockReturnThis();
    sendMock = jest.fn();
    mockRes = {
      json: jsonMock,
      status: statusMock,
      render: renderMock,
      setHeader: setHeaderMock,
      send: sendMock,
    };
    mockReq = {
      params: {},
      body: {},
      query: {},
      session: {} as any,
    };
  });

  describe("showAllProducts", () => {
    it("should render products list with filter (no mpid/channelId)", async () => {
      (mySqlHelper.GetNumberOfRepriceEligibleProductCount as jest.Mock).mockResolvedValue(25);
      (mySqlHelper.GetAllRepriceEligibleProductByFilter as jest.Mock).mockResolvedValue([{ mpId: 1, tradentDetails: {} }]);
      (mapper.MapBadgeIndicator as jest.Mock).mockImplementation((p) => p);
      (mapper.MapV2 as jest.Mock).mockReturnValue([{ mpid: 1 }]);

      await productV2.showAllProducts(mockReq as Request, mockRes as Response);

      expect(mySqlHelper.GetNumberOfRepriceEligibleProductCount).toHaveBeenCalled();
      expect(mySqlHelper.GetAllRepriceEligibleProductByFilter).toHaveBeenCalledWith(0, 10);
      expect(renderMock).toHaveBeenCalledWith(
        "pages/products/get_all",
        expect.objectContaining({
          items: [{ mpid: 1 }],
          pageNumber: 0,
          pageSize: 10,
          totalDocs: 25,
          totalPages: 3,
          groupName: "Products",
        })
      );
    });

    it("should use pgno query and load by tag when mpid provided", async () => {
      mockReq.query = { pgno: "2", mpid: "100" };
      (mySqlHelper.GetNumberOfRepriceEligibleProductCount as jest.Mock).mockResolvedValue(0);
      const tagItems = Array.from({ length: 25 }, (_, i) => ({ mpId: i + 1 }));
      (mySqlHelper.GetAllRepriceEligibleProductByTag as jest.Mock).mockResolvedValue(tagItems);
      (mapper.MapBadgeIndicator as jest.Mock).mockImplementation((p) => p);
      (mapper.MapV2 as jest.Mock).mockImplementation((arr) => arr.map((x: any) => ({ mpid: x.mpId })));

      await productV2.showAllProducts(mockReq as Request, mockRes as Response);

      expect(mySqlHelper.GetAllRepriceEligibleProductByTag).toHaveBeenCalledWith("100", undefined);
      expect(mySqlHelper.GetAllRepriceEligibleProductByFilter).not.toHaveBeenCalled();
      expect(renderMock).toHaveBeenCalledWith(
        "pages/products/get_all",
        expect.objectContaining({
          pageNumber: 1,
          totalDocs: 25,
          mpid: "100",
        })
      );
    });

    it("should use channelId when provided with mpid", async () => {
      mockReq.query = { mpid: "1", channelId: "2" };
      (mySqlHelper.GetNumberOfRepriceEligibleProductCount as jest.Mock).mockResolvedValue(0);
      (mySqlHelper.GetAllRepriceEligibleProductByTag as jest.Mock).mockResolvedValue([{ mpId: 1 }]);
      (mapper.MapBadgeIndicator as jest.Mock).mockImplementation((p) => p);
      (mapper.MapV2 as jest.Mock).mockReturnValue([{ mpid: 1 }]);

      await productV2.showAllProducts(mockReq as Request, mockRes as Response);

      expect(mySqlHelper.GetAllRepriceEligibleProductByTag).toHaveBeenCalledWith("1", "2");
    });

    it("should handle empty masterItems", async () => {
      (mySqlHelper.GetNumberOfRepriceEligibleProductCount as jest.Mock).mockResolvedValue(0);
      (mySqlHelper.GetAllRepriceEligibleProductByFilter as jest.Mock).mockResolvedValue([]);
      (mapper.MapV2 as jest.Mock).mockReturnValue([]);

      await productV2.showAllProducts(mockReq as Request, mockRes as Response);

      expect(renderMock).toHaveBeenCalledWith("pages/products/get_all", expect.objectContaining({ items: [], totalDocs: 0, totalPages: 0 }));
    });
  });

  describe("updateProductQuantity", () => {
    it("should call API and return success", async () => {
      const axiosPost = axios.post as jest.Mock;
      axiosPost.mockResolvedValue({ data: { id: 1 }, message: "Updated" });
      mockReq.body = { mpid: "123", vendorData: [{ id: 1, qty: 10 }] };

      await productV2.updateProductQuantity(mockReq as Request, mockRes as Response);

      expect(axiosPost).toHaveBeenCalledWith(expect.stringContaining("/data/UpdateProductQuantity"), { mpid: "123", vendorData: [{ id: 1, qty: 10 }] }, expect.any(Object));
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Updated",
        data: { id: 1 },
      });
    });

    it("should return 500 and message on API error", async () => {
      const axiosPost = axios.post as jest.Mock;
      axiosPost.mockRejectedValue({
        response: { data: { message: "Server error" } },
      });
      mockReq.body = { mpid: "123", vendorData: [] };

      await productV2.updateProductQuantity(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: "Server error",
      });
    });

    it("should use fallback message when response has no message", async () => {
      (axios.post as jest.Mock).mockRejectedValue(new Error("Network error"));
      mockReq.body = { mpid: "456" };

      await productV2.updateProductQuantity(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: "Error updating product quantity for mpid 456",
      });
    });
  });

  describe("collateProducts", () => {
    it("should fetch tradent products and start collating", async () => {
      (httpHelper.native_get as jest.Mock).mockResolvedValue({
        data: { productList: [{ id: 1 }] },
      });
      (productHelper.LoadProducts as jest.Mock).mockResolvedValue(undefined);

      await productV2.collateProducts(mockReq as Request, mockRes as Response);

      expect(httpHelper.native_get).toHaveBeenCalled();
      expect(productHelper.LoadProducts).toHaveBeenCalledWith([{ id: 1 }]);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: expect.stringMatching(/Products collating started/),
      });
    });

    it("should not call LoadProducts when productList is empty", async () => {
      (httpHelper.native_get as jest.Mock).mockResolvedValue({
        data: { productList: [] },
      });

      await productV2.collateProducts(mockReq as Request, mockRes as Response);

      expect(productHelper.LoadProducts).not.toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ status: true }));
    });

    it("should not call LoadProducts when data is null", async () => {
      (httpHelper.native_get as jest.Mock).mockResolvedValue({ data: null });

      await productV2.collateProducts(mockReq as Request, mockRes as Response);

      expect(productHelper.LoadProducts).not.toHaveBeenCalled();
    });
  });

  describe("editItemView", () => {
    it("should render edit page with product and cron settings", async () => {
      const productRow = {
        mpId: 1,
        tradentDetails: {},
        cronSettings: [],
      };
      (mySqlHelper.GetFullProductDetailsById as jest.Mock).mockResolvedValue([productRow]);
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ CronId: 1, IsHidden: false }]);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([{ CronId: 2, IsHidden: true }]);
      (GetScrapeCrons as jest.Mock).mockResolvedValue([{ CronId: 3, CronName: "Scrape" }]);
      mockReq.params = { mpid: "1" };
      (mockReq as any).session = { users_id: { userRole: "admin" } };

      await productV2.editItemView(mockReq as Request, mockRes as Response);

      expect(mySqlHelper.GetFullProductDetailsById).toHaveBeenCalledWith("1");
      expect(renderMock).toHaveBeenCalledWith(
        "pages/products/index",
        expect.objectContaining({
          model: expect.objectContaining({
            cronSettings: expect.any(Array),
            scrapeOnlyCrons: [{ CronId: 3, CronName: "Scrape" }],
          }),
          groupName: "Products",
        })
      );
    });
  });

  describe("updateProductDetails", () => {
    it("should update TRADENT channel and return success", async () => {
      const product = {
        tradentDetails: { cronId: 1 },
        frontierDetails: {},
        mvpDetails: null,
        firstDentDetails: null,
        topDentDetails: null,
        triadDetails: null,
        biteSupplyDetails: null,
        isScrapeOnlyActivated: true,
        scrapeOnlyCronId: 1,
        scrapeOnlyCronName: "Scrape",
        isBadgeItem: false,
      };
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ CronId: 1, IsHidden: false }]);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      (mySqlHelper.GetFullProductDetailsById as jest.Mock).mockResolvedValue([product]);
      (mapper.MapUserResponse as jest.Mock).mockResolvedValue({ ...product.tradentDetails });
      (mapper.UpsertProductDetailsInSql as jest.Mock).mockResolvedValue(undefined);
      mockReq.body = {
        mpid: 1,
        channel_name: "TRADENT",
        cronId: 1,
      };

      await productV2.updateProductDetails(mockReq as Request, mockRes as Response);

      expect(mapper.MapUserResponse).toHaveBeenCalled();
      expect(mapper.UpsertProductDetailsInSql).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Products updated successfully!",
      });
    });

    it("should update FRONTIER channel", async () => {
      const product = {
        frontierDetails: { cronId: 1 },
        tradentDetails: null,
        mvpDetails: null,
        firstDentDetails: null,
        topDentDetails: null,
        triadDetails: null,
        biteSupplyDetails: null,
        isScrapeOnlyActivated: false,
        scrapeOnlyCronId: null,
        scrapeOnlyCronName: null,
        isBadgeItem: false,
      };
      (GetCronSettingsList as jest.Mock).mockResolvedValue([]);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      (mySqlHelper.GetFullProductDetailsById as jest.Mock).mockResolvedValue([product]);
      (mapper.MapUserResponse as jest.Mock).mockResolvedValue({});
      (mapper.UpsertProductDetailsInSql as jest.Mock).mockResolvedValue(undefined);
      mockReq.body = { mpid: 1, channel_name: "FRONTIER" };

      await productV2.updateProductDetails(mockReq as Request, mockRes as Response);

      expect(mapper.UpsertProductDetailsInSql).toHaveBeenCalled();
    });

    it("should update MVP channel", async () => {
      const product = {
        mvpDetails: {},
        tradentDetails: null,
        frontierDetails: null,
        firstDentDetails: null,
        topDentDetails: null,
        triadDetails: null,
        biteSupplyDetails: null,
        isScrapeOnlyActivated: false,
        scrapeOnlyCronId: null,
        scrapeOnlyCronName: null,
        isBadgeItem: false,
      };
      (GetCronSettingsList as jest.Mock).mockResolvedValue([]);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      (mySqlHelper.GetFullProductDetailsById as jest.Mock).mockResolvedValue([product]);
      (mapper.MapUserResponse as jest.Mock).mockResolvedValue({});
      (mapper.UpsertProductDetailsInSql as jest.Mock).mockResolvedValue(undefined);
      mockReq.body = { mpid: 1, channel_name: "MVP" };

      await productV2.updateProductDetails(mockReq as Request, mockRes as Response);

      expect(mapper.UpsertProductDetailsInSql).toHaveBeenCalled();
    });

    it("should update FIRSTDENT channel", async () => {
      const product = {
        firstDentDetails: {},
        tradentDetails: null,
        frontierDetails: null,
        mvpDetails: null,
        topDentDetails: null,
        triadDetails: null,
        biteSupplyDetails: null,
        isScrapeOnlyActivated: false,
        scrapeOnlyCronId: null,
        scrapeOnlyCronName: null,
        isBadgeItem: false,
      };
      (GetCronSettingsList as jest.Mock).mockResolvedValue([]);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      (mySqlHelper.GetFullProductDetailsById as jest.Mock).mockResolvedValue([product]);
      (mapper.MapUserResponse as jest.Mock).mockResolvedValue({});
      (mapper.UpsertProductDetailsInSql as jest.Mock).mockResolvedValue(undefined);
      mockReq.body = { mpid: 1, channel_name: "FIRSTDENT" };

      await productV2.updateProductDetails(mockReq as Request, mockRes as Response);

      expect(mapper.UpsertProductDetailsInSql).toHaveBeenCalled();
    });

    it("should update TOPDENT channel", async () => {
      const product = {
        topDentDetails: {},
        tradentDetails: null,
        frontierDetails: null,
        mvpDetails: null,
        firstDentDetails: null,
        triadDetails: null,
        biteSupplyDetails: null,
        isScrapeOnlyActivated: false,
        scrapeOnlyCronId: null,
        scrapeOnlyCronName: null,
        isBadgeItem: false,
      };
      (GetCronSettingsList as jest.Mock).mockResolvedValue([]);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      (mySqlHelper.GetFullProductDetailsById as jest.Mock).mockResolvedValue([product]);
      (mapper.MapUserResponse as jest.Mock).mockResolvedValue({});
      (mapper.UpsertProductDetailsInSql as jest.Mock).mockResolvedValue(undefined);
      mockReq.body = { mpid: 1, channel_name: "TOPDENT" };

      await productV2.updateProductDetails(mockReq as Request, mockRes as Response);

      expect(mapper.UpsertProductDetailsInSql).toHaveBeenCalled();
    });

    it("should update TRIAD channel", async () => {
      const product = {
        triadDetails: {},
        tradentDetails: null,
        frontierDetails: null,
        mvpDetails: null,
        firstDentDetails: null,
        topDentDetails: null,
        biteSupplyDetails: null,
        isScrapeOnlyActivated: false,
        scrapeOnlyCronId: null,
        scrapeOnlyCronName: null,
        isBadgeItem: false,
      };
      (GetCronSettingsList as jest.Mock).mockResolvedValue([]);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      (mySqlHelper.GetFullProductDetailsById as jest.Mock).mockResolvedValue([product]);
      (mapper.MapUserResponse as jest.Mock).mockResolvedValue({});
      (mapper.UpsertProductDetailsInSql as jest.Mock).mockResolvedValue(undefined);
      mockReq.body = { mpid: 1, channel_name: "TRIAD" };

      await productV2.updateProductDetails(mockReq as Request, mockRes as Response);

      expect(mapper.UpsertProductDetailsInSql).toHaveBeenCalled();
    });

    it("should update BITESUPPLY channel", async () => {
      const product = {
        biteSupplyDetails: {},
        tradentDetails: null,
        frontierDetails: null,
        mvpDetails: null,
        firstDentDetails: null,
        topDentDetails: null,
        triadDetails: null,
        isScrapeOnlyActivated: false,
        scrapeOnlyCronId: null,
        scrapeOnlyCronName: null,
        isBadgeItem: false,
      };
      (GetCronSettingsList as jest.Mock).mockResolvedValue([]);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      (mySqlHelper.GetFullProductDetailsById as jest.Mock).mockResolvedValue([product]);
      (mapper.MapUserResponse as jest.Mock).mockResolvedValue({});
      (mapper.UpsertProductDetailsInSql as jest.Mock).mockResolvedValue(undefined);
      mockReq.body = { mpid: 1, channel_name: "BITESUPPLY" };

      await productV2.updateProductDetails(mockReq as Request, mockRes as Response);

      expect(mapper.UpsertProductDetailsInSql).toHaveBeenCalled();
    });
  });

  describe("collateProductsForId", () => {
    it("should load product by id and return success", async () => {
      (productHelper.LoadProducts as jest.Mock).mockResolvedValue(undefined);
      mockReq.params = { id: " 999 " };

      await productV2.collateProductsForId(mockReq as Request, mockRes as Response);

      expect(productHelper.LoadProducts).toHaveBeenCalledWith(["999"]);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: expect.stringMatching(/Products collating & loaded for MPID/),
      });
    });
  });

  describe("addItems", () => {
    it("should render add page with cron settings", async () => {
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ CronId: 1, IsHidden: false }]);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([{ CronId: 2, IsHidden: true }]);
      (GetScrapeCrons as jest.Mock).mockResolvedValue([{ CronId: 3 }]);
      (mockReq as any).session = { users_id: { userRole: "admin" } };

      await productV2.addItems(mockReq as Request, mockRes as Response);

      expect(renderMock).toHaveBeenCalledWith(
        "pages/products/add",
        expect.objectContaining({
          model: expect.objectContaining({
            cronSettings: expect.any(Array),
            scrapeOnlyCrons: [{ CronId: 3 }],
          }),
          groupName: "item",
        })
      );
    });
  });

  describe("addItemToDatabase", () => {
    it("should add product with tradentDetails and return success", async () => {
      (GetScrapeCrons as jest.Mock).mockResolvedValue([{ CronId: 1, CronName: "Scrape1" }]);
      (mapper.MapFormData as jest.Mock).mockResolvedValue({ cronId: 1 });
      (mapper.UpsertProductDetailsInSql as jest.Mock).mockResolvedValue(undefined);
      mockReq.body = {
        mpid: "1",
        isScrapeOnlyActivated: "on",
        scrapeOnlyCron: 1,
        isBadgeItem: "on",
        tradentDetails: { cronId: 1 },
      };

      await productV2.addItemToDatabase(mockReq as Request, mockRes as Response);

      expect(mapper.MapFormData).toHaveBeenCalled();
      expect(mapper.UpsertProductDetailsInSql).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Products added successfully!",
      });
    });

    it("should add product with frontierDetails", async () => {
      (GetScrapeCrons as jest.Mock).mockResolvedValue([{ CronId: 1, CronName: "S" }]);
      (mapper.MapFormData as jest.Mock).mockResolvedValue({});
      (mapper.UpsertProductDetailsInSql as jest.Mock).mockResolvedValue(undefined);
      mockReq.body = {
        mpid: "1",
        isScrapeOnlyActivated: "off",
        scrapeOnlyCron: 1,
        isBadgeItem: "off",
        frontierDetails: { cronId: 1 },
      };

      await productV2.addItemToDatabase(mockReq as Request, mockRes as Response);

      expect(mapper.UpsertProductDetailsInSql).toHaveBeenCalled();
    });

    it("should add product with mvpDetails", async () => {
      (GetScrapeCrons as jest.Mock).mockResolvedValue([{ CronId: 1, CronName: "S" }]);
      (mapper.MapFormData as jest.Mock).mockResolvedValue({});
      (mapper.UpsertProductDetailsInSql as jest.Mock).mockResolvedValue(undefined);
      mockReq.body = {
        mpid: "1",
        isScrapeOnlyActivated: "on",
        scrapeOnlyCron: 1,
        isBadgeItem: "off",
        mvpDetails: {},
      };

      await productV2.addItemToDatabase(mockReq as Request, mockRes as Response);

      expect(mapper.UpsertProductDetailsInSql).toHaveBeenCalled();
    });

    it("should add product with firstDentDetails and topDentDetails", async () => {
      (GetScrapeCrons as jest.Mock).mockResolvedValue([{ CronId: 1, CronName: "S" }]);
      (mapper.MapFormData as jest.Mock).mockResolvedValue({});
      (mapper.UpsertProductDetailsInSql as jest.Mock).mockResolvedValue(undefined);
      mockReq.body = {
        mpid: "1",
        isScrapeOnlyActivated: "off",
        scrapeOnlyCron: 1,
        isBadgeItem: "off",
        firstDentDetails: {},
        topDentDetails: {},
      };

      await productV2.addItemToDatabase(mockReq as Request, mockRes as Response);

      expect(mapper.UpsertProductDetailsInSql).toHaveBeenCalled();
    });
  });

  describe("simulateManualReprice", () => {
    it("should return HTML when response has html", async () => {
      (axios.post as jest.Mock).mockResolvedValue({
        data: { html: "<div>Result</div>" },
      });
      mockReq.params = { id: "123" };

      await productV2.simulateManualReprice(mockReq as Request, mockRes as Response);

      expect(setHeaderMock).toHaveBeenCalledWith("Content-Type", "text/html");
      expect(sendMock).toHaveBeenCalledWith("<div>Result</div>");
    });

    it("should return JSON when no html", async () => {
      (axios.post as jest.Mock).mockResolvedValue({
        data: { logId: "abc", message: "Done" },
      });
      mockReq.params = { id: "456" };

      await productV2.simulateManualReprice(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({ logId: "abc", message: "Done" });
    });
  });

  describe("runManualReprice", () => {
    it("should run manual reprice for each product and return success", async () => {
      (httpHelper.native_get as jest.Mock).mockResolvedValue({
        status: 200,
        data: { logId: "log1" },
      });
      mockReq.body = { mpIds: ["1", "2"] };

      await productV2.runManualReprice(mockReq as Request, mockRes as Response);

      expect(httpHelper.native_get).toHaveBeenCalledTimes(2);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Manual Scrape Done Successfully!",
      });
    });

    it("should accept single mpId (non-array)", async () => {
      (httpHelper.native_get as jest.Mock).mockResolvedValue({
        status: 200,
        data: { logId: "log1" },
      });
      mockReq.body = { mpIds: "99" };

      await productV2.runManualReprice(mockReq as Request, mockRes as Response);

      expect(httpHelper.native_get).toHaveBeenCalledWith(expect.stringContaining("/99"));
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ status: true }));
    });

    it("should return failure message when some ids fail", async () => {
      (httpHelper.native_get as jest.Mock).mockResolvedValueOnce({ status: 200, data: { logId: "1" } }).mockResolvedValueOnce({ status: 404, data: {} });
      mockReq.body = { mpIds: ["1", "2"] };

      await productV2.runManualReprice(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: expect.stringMatching(/Manual Scrape Failed.*2/),
      });
    });

    it("should return failure when repriceResult has no logId", async () => {
      (httpHelper.native_get as jest.Mock).mockResolvedValueOnce({ status: 200, data: { logId: "1" } }).mockResolvedValueOnce({ status: 200, data: {} });
      mockReq.body = { mpIds: ["1", "2"] };

      await productV2.runManualReprice(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: expect.stringMatching(/Manual Scrape Failed/),
      });
    });

    it("should return success when selectedProducts is empty", async () => {
      mockReq.body = { mpIds: [] };

      await productV2.runManualReprice(mockReq as Request, mockRes as Response);

      expect(httpHelper.native_get).not.toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Manual Scrape Done Successfully!",
      });
    });
  });

  describe("syncProductDetails", () => {
    it("should sync product and return success", async () => {
      const productMessage = [
        {
          tradentDetails: { cronId: 1 },
          frontierDetails: null,
          mvpDetails: null,
          topDentDetails: null,
          firstDentDetails: null,
          triadDetails: null,
          biteSupplyDetails: null,
          isScrapeOnlyActivated: true,
          scrapeOnlyCronName: "S",
          scrapeOnlyCronId: 1,
          isBadgeItem: false,
        },
      ];
      (httpHelper.native_get_V2 as jest.Mock).mockResolvedValue({
        data: { message: productMessage },
      });
      (mapper.UpsertProductDetailsInSql as jest.Mock).mockResolvedValue(undefined);
      mockReq.params = { id: " 777 " };

      await productV2.syncProductDetails(mockReq as Request, mockRes as Response);

      expect(httpHelper.native_get_V2).toHaveBeenCalled();
      expect(mapper.UpsertProductDetailsInSql).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Product 777 synced successfully!",
      });
    });

    it("should return success when message is empty", async () => {
      (httpHelper.native_get_V2 as jest.Mock).mockResolvedValue({
        data: { message: null },
      });
      mockReq.params = { id: "888" };

      await productV2.syncProductDetails(mockReq as Request, mockRes as Response);

      expect(mapper.UpsertProductDetailsInSql).not.toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Product 888 synced successfully!",
      });
    });

    it("should skip vendor details that are null when syncing", async () => {
      const productMessage = [
        {
          tradentDetails: { cronId: 1 },
          frontierDetails: null,
          mvpDetails: null,
          topDentDetails: null,
          firstDentDetails: null,
          triadDetails: null,
          biteSupplyDetails: null,
          isScrapeOnlyActivated: false,
          scrapeOnlyCronName: "S",
          scrapeOnlyCronId: 1,
          isBadgeItem: false,
        },
      ];
      (httpHelper.native_get_V2 as jest.Mock).mockResolvedValue({
        data: { message: productMessage },
      });
      (mapper.UpsertProductDetailsInSql as jest.Mock).mockResolvedValue(undefined);
      mockReq.params = { id: "555" };

      await productV2.syncProductDetails(mockReq as Request, mockRes as Response);

      expect(mapper.UpsertProductDetailsInSql).toHaveBeenCalled();
    });
  });

  describe("runManualSyncOfProducts", () => {
    it("should trigger sync and return message", async () => {
      (httpHelper.native_get as jest.Mock).mockResolvedValue({});

      await productV2.runManualSyncOfProducts(mockReq as Request, mockRes as Response);

      expect(httpHelper.native_get).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: expect.stringMatching(/Manual Product Details Sync has been started/),
      });
    });
  });

  describe("removeFrom422", () => {
    it("should remove first product from 422 (array body)", async () => {
      (mongoMiddleware.Update422StatusById as jest.Mock).mockResolvedValue(undefined);
      mockReq.body = { mpIds: [100, 200] };

      await productV2.removeFrom422(mockReq as Request, mockRes as Response);

      expect(mongoMiddleware.Update422StatusById).toHaveBeenCalledWith(100, false);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Successfully removed 100 from 422.",
      });
    });

    it("should handle single mpId", async () => {
      (mongoMiddleware.Update422StatusById as jest.Mock).mockResolvedValue(undefined);
      mockReq.body = { mpIds: 50 };

      await productV2.removeFrom422(mockReq as Request, mockRes as Response);

      expect(mongoMiddleware.Update422StatusById).toHaveBeenCalledWith(50, false);
    });

    it("should not call Update422 when selectedProducts is empty", async () => {
      mockReq.body = { mpIds: [] };

      await productV2.removeFrom422(mockReq as Request, mockRes as Response);

      expect(mongoMiddleware.Update422StatusById).not.toHaveBeenCalled();
    });
  });

  describe("removeFrom422ForAll", () => {
    it("should remove all from 422", async () => {
      (mongoMiddleware.Update422StatusById as jest.Mock).mockResolvedValue(undefined);

      await productV2.removeFrom422ForAll(mockReq as Request, mockRes as Response);

      expect(mongoMiddleware.Update422StatusById).toHaveBeenCalledWith(null, true);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Successfully removed all products from 422.",
      });
    });
  });

  describe("toggleDataScrape", () => {
    it("should toggle scrape and return activated", async () => {
      (SessionHelper.GetAuditInfo as jest.Mock).mockResolvedValue({ UpdatedBy: "u1" });
      (mySqlHelper.ToggleDataScrapeForId as jest.Mock).mockResolvedValue(true);
      mockReq.body = { mpid: " 123 ", state: "true" };

      await productV2.toggleDataScrape(mockReq as Request, mockRes as Response);

      expect(mySqlHelper.ToggleDataScrapeForId).toHaveBeenCalledWith(123, true, expect.any(Object));
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: " 123  product activated successfully.",
      });
    });

    it("should return de-activated message when state is false", async () => {
      (SessionHelper.GetAuditInfo as jest.Mock).mockResolvedValue({});
      (mySqlHelper.ToggleDataScrapeForId as jest.Mock).mockResolvedValue(true);
      mockReq.body = { mpid: "456", state: "false" };

      await productV2.toggleDataScrape(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "456 product de-activated successfully.",
      });
    });

    it("should return MpId is Missing when mpid absent", async () => {
      mockReq.body = { state: "true" };

      await productV2.toggleDataScrape(mockReq as Request, mockRes as Response);

      expect(mySqlHelper.ToggleDataScrapeForId).not.toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "MpId is Missing",
      });
    });
  });

  describe("saveRootDetails", () => {
    it("should save root details and return success", async () => {
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ CronId: 1, CronName: "Regular" }]);
      (GetScrapeCrons as jest.Mock).mockResolvedValue([{ CronId: 2, CronName: "ScrapeOnly" }]);
      (mySqlHelper.ExecuteQuery as jest.Mock).mockResolvedValue(undefined);
      mockReq.body = {
        mpid: " 999 ",
        rootDetailsForPayload: {
          net32Url: "https://u.com",
          cronGroup: 1,
          scrapeOnlyCron: 2,
          isBadgeItem: "false",
          isScrapeOnlyActivated: "true",
        },
      };

      await productV2.saveRootDetails(mockReq as Request, mockRes as Response);

      expect(mySqlHelper.ExecuteQuery).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining(["https://u.com", 1, "Regular", 2, "ScrapeOnly", false, true, "999"]));
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "999 saved successfully.",
      });
    });

    it("should save when cronGroup has no matching CronName (linkedRegularCronName undefined)", async () => {
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ CronId: 99, CronName: "Other" }]);
      (GetScrapeCrons as jest.Mock).mockResolvedValue([{ CronId: 2, CronName: "ScrapeOnly" }]);
      (mySqlHelper.ExecuteQuery as jest.Mock).mockResolvedValue(undefined);
      mockReq.body = {
        mpid: "888",
        rootDetailsForPayload: {
          net32Url: "https://u.com",
          cronGroup: 1,
          scrapeOnlyCron: 2,
          isBadgeItem: "false",
          isScrapeOnlyActivated: "true",
        },
      };

      await productV2.saveRootDetails(mockReq as Request, mockRes as Response);

      expect(mySqlHelper.ExecuteQuery).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining(["https://u.com", 1, undefined, 2, "ScrapeOnly", false, true, "888"]));
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "888 saved successfully.",
      });
    });
  });

  describe("activateProductForAll", () => {
    it("should activate product and return success", async () => {
      (mySqlHelper.ChangeProductActivation as jest.Mock).mockResolvedValue(true);
      mockReq.body = { mpid: " 123 " };

      await productV2.activateProductForAll(mockReq as Request, mockRes as Response);

      expect(mySqlHelper.ChangeProductActivation).toHaveBeenCalledWith(123, true);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: " 123  product activated successfully.",
      });
    });

    it("should return MpId is Missing when mpid absent", async () => {
      mockReq.body = {};

      await productV2.activateProductForAll(mockReq as Request, mockRes as Response);

      expect(mySqlHelper.ChangeProductActivation).not.toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "MpId is Missing",
      });
    });
  });

  describe("deActivateProductForAll", () => {
    it("should deactivate product and return success", async () => {
      (mySqlHelper.ChangeProductActivation as jest.Mock).mockResolvedValue(true);
      mockReq.body = { mpid: "456" };

      await productV2.deActivateProductForAll(mockReq as Request, mockRes as Response);

      expect(mySqlHelper.ChangeProductActivation).toHaveBeenCalledWith(456, false);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "456 product deactivated successfully.",
      });
    });

    it("should return MpId is Missing when mpid absent", async () => {
      mockReq.body = {};

      await productV2.deActivateProductForAll(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "MpId is Missing",
      });
    });
  });

  describe("saveBranches", () => {
    it("should save branch data for multiple vendors", async () => {
      const existing = {
        tradentDetails: { cronId: 1 },
        frontierDetails: null,
        mvpDetails: null,
        topDentDetails: null,
        firstDentDetails: null,
        triadDetails: null,
        biteSupplyDetails: null,
      };
      (mySqlHelper.GetFullProductDetailsById as jest.Mock).mockResolvedValue([existing]);
      (mySqlHelper.UpdateBranchDataForVendor as jest.Mock).mockResolvedValue(undefined);
      mockReq.body = {
        mpid: " 100 ",
        tradentDetails: { cronId: 1, cronName: "C1" },
        frontierDetails: { cronId: 2 },
        mvpDetails: { enabled: true },
        topDentDetails: null,
        firstDentDetails: null,
        triadDetails: null,
        biteSupplyDetails: null,
      };

      await productV2.saveBranches(mockReq as Request, mockRes as Response);

      expect(mySqlHelper.UpdateBranchDataForVendor).toHaveBeenCalledWith("100", "TRADENT", expect.any(Object));
      expect(mySqlHelper.UpdateBranchDataForVendor).toHaveBeenCalledWith("100", "FRONTIER", expect.any(Object));
      expect(mySqlHelper.UpdateBranchDataForVendor).toHaveBeenCalledWith("100", "MVP", expect.any(Object));
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "100 branches saved successfully.",
      });
    });

    it("should save triadDetails and biteSupplyDetails", async () => {
      const existing = {
        tradentDetails: null,
        frontierDetails: null,
        mvpDetails: null,
        topDentDetails: null,
        firstDentDetails: null,
        triadDetails: {},
        biteSupplyDetails: {},
      };
      (mySqlHelper.GetFullProductDetailsById as jest.Mock).mockResolvedValue([existing]);
      (mySqlHelper.UpdateBranchDataForVendor as jest.Mock).mockResolvedValue(undefined);
      mockReq.body = {
        mpid: "200",
        tradentDetails: null,
        frontierDetails: null,
        mvpDetails: null,
        topDentDetails: null,
        firstDentDetails: null,
        triadDetails: { cronId: 2 },
        biteSupplyDetails: { cronId: 3 },
      };

      await productV2.saveBranches(mockReq as Request, mockRes as Response);

      expect(mySqlHelper.UpdateBranchDataForVendor).toHaveBeenCalledWith("200", "TRIAD", expect.any(Object));
      expect(mySqlHelper.UpdateBranchDataForVendor).toHaveBeenCalledWith("200", "BITESUPPLY", expect.any(Object));
    });

    it("should skip null/undefined branch values", async () => {
      const existing = {
        tradentDetails: { cronId: 1 },
        frontierDetails: null,
        mvpDetails: null,
        topDentDetails: null,
        firstDentDetails: null,
        triadDetails: null,
        biteSupplyDetails: null,
      };
      (mySqlHelper.GetFullProductDetailsById as jest.Mock).mockResolvedValue([existing]);
      (mySqlHelper.UpdateBranchDataForVendor as jest.Mock).mockResolvedValue(undefined);
      mockReq.body = {
        mpid: "300",
        tradentDetails: { key: "value", nullKey: null },
        frontierDetails: {},
        mvpDetails: null,
        topDentDetails: null,
        firstDentDetails: null,
        triadDetails: null,
        biteSupplyDetails: null,
      };

      await productV2.saveBranches(mockReq as Request, mockRes as Response);

      expect(mySqlHelper.UpdateBranchDataForVendor).toHaveBeenCalled();
    });
  });

  describe("updateToMax", () => {
    it("should call update to max for each product and return success", async () => {
      (httpHelper.native_get as jest.Mock).mockResolvedValue({
        status: 200,
        data: { logId: "log1" },
      });
      mockReq.body = { mpIds: ["1", "2"] };

      await productV2.updateToMax(mockReq as Request, mockRes as Response);

      expect(httpHelper.native_get).toHaveBeenCalledTimes(2);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Update to Max Done Successfully!",
      });
    });

    it("should return failure when some ids fail", async () => {
      (httpHelper.native_get as jest.Mock).mockResolvedValueOnce({ status: 200, data: { logId: "1" } }).mockResolvedValueOnce({ status: 500 });
      mockReq.body = { mpIds: ["a", "b"] };

      await productV2.updateToMax(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: expect.stringMatching(/Update to Max Failed for the following Ids .*!!\.Please try again\./),
      });
    });

    it("should handle single mpId", async () => {
      (httpHelper.native_get as jest.Mock).mockResolvedValue({
        status: 200,
        data: { logId: "x" },
      });
      mockReq.body = { mpIds: "99" };

      await productV2.updateToMax(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ status: true }));
    });
  });

  describe("exportItems", () => {
    it("should proxy to excel service and pipe stream", async () => {
      const mockStream = { pipe: jest.fn() };
      (axios.get as jest.Mock).mockResolvedValue({
        data: mockStream,
      });
      mockReq.query = {};

      await productV2.exportItems(mockReq as Request, mockRes as Response);

      expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/api\/excel\/download\/all_items/), expect.objectContaining({ responseType: "stream" }));
      expect(setHeaderMock).toHaveBeenCalledWith("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(setHeaderMock).toHaveBeenCalledWith("Content-Disposition", "attachment; filename=" + "itemExcel.xlsx");
      expect(mockStream.pipe).toHaveBeenCalledWith(mockRes);
    });

    it("should return 500 on proxy error", async () => {
      (axios.get as jest.Mock).mockRejectedValue(new Error("Network error"));

      await productV2.exportItems(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "Failed to export Excel file",
        details: "Network error",
      });
    });

    it("should use fallback details when error has no message", async () => {
      (axios.get as jest.Mock).mockRejectedValue({});

      await productV2.exportItems(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        error: "Failed to export Excel file",
        details: "Unknown error occurred",
      });
    });
  });
});
