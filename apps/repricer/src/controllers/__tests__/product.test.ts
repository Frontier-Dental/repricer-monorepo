import { Request, Response } from "express";
import * as product from "../product";
import * as httpMiddleware from "../../utility/http-wrappers";
import * as mapperHelper from "../../middleware/mapper-helper";
import * as mongoMiddleware from "../../services/mongo";
import * as SessionHelper from "../../utility/session-helper";
import { ExcelExportService } from "../../services/excel-export.service";
import { GetCronSettingsList, GetEnvValueByKey, ToggleCronStatus, GetSlowCronDetails, GetScrapeCrons } from "../../services/mysql-v2";
import Item from "../../models/item";
import { applicationConfig } from "../../utility/config";

jest.mock("../../services/mongo");
jest.mock("../../utility/http-wrappers");
jest.mock("../../middleware/mapper-helper");
jest.mock("../../utility/session-helper");
jest.mock("../../services/excel-export.service");
jest.mock("../../services/mysql-v2");
jest.mock("../../models/item", () => ({
  __esModule: true,
  default: {
    countDocuments: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
}));

const mockWrite = jest.fn().mockReturnValue(Promise.resolve());
const mockSheet = {
  columns: [] as any[],
  addRows: jest.fn(),
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

describe("Product Controller", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let renderMock: jest.Mock;
  let setHeaderMock: jest.Mock;
  let endMock: jest.Mock;

  const mockItemModel = Item as jest.Mocked<typeof Item>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation();
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
    (applicationConfig as any).USE_MYSQL = true;
  });

  describe("getMasterItemController", () => {
    it("should render list with items and pagination when no tags", async () => {
      mockItemModel.countDocuments.mockResolvedValue(25);
      mockItemModel.find.mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([
          {
            badgeIndicator: "ALL_ZERO",
            cronId: "1",
            last_cron_time: new Date(),
            last_update_time: new Date(),
            last_attempted_time: new Date(),
            next_cron_time: new Date(),
          },
        ]),
      } as any);
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ CronId: "1", CronName: "Main Cron" }]);

      await product.getMasterItemController(mockReq as Request, mockRes as Response);

      expect(mockItemModel.countDocuments).toHaveBeenCalledWith({});
      expect(renderMock).toHaveBeenCalledWith(
        "pages/itemmaster/list",
        expect.objectContaining({
          pageNumber: 0,
          pageSize: 10,
          totalDocs: 25,
          totalPages: 3,
          tags: "",
          groupName: "item",
        })
      );
    });

    it("should build query from tags and use pgno", async () => {
      mockReq.query = { tags: "foo bar", pgno: "2" };
      mockItemModel.countDocuments.mockResolvedValue(5);
      mockItemModel.find.mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      } as any);
      (GetCronSettingsList as jest.Mock).mockResolvedValue([]);

      await product.getMasterItemController(mockReq as Request, mockRes as Response);

      expect(mockItemModel.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([expect.any(Object), { tags: { $all: expect.any(Array) } }]),
        })
      );
      expect(renderMock).toHaveBeenCalledWith("pages/itemmaster/list", expect.objectContaining({ pageNumber: 1, tags: "foo bar" }));
    });
  });

  describe("addMasterItemController", () => {
    it("should render add page with cron settings", async () => {
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ CronId: 1, CronName: "Cron1" }]);

      await product.addMasterItemController(mockReq as Request, mockRes as Response);

      expect(renderMock).toHaveBeenCalledWith("pages/itemmaster/add", {
        items: [{ CronId: 1, CronName: "Cron1" }],
        groupName: "item",
        userRole: "admin",
      });
    });
  });

  describe("editMasterItemController", () => {
    it("should render edit page with item and cron settings", async () => {
      mockReq.params = { id: "507f1f77bcf86cd799439011" };
      const item = {
        _id: "507f1f77bcf86cd799439011",
        badgeIndicator: "ALL_ZERO",
        cronId: "1",
      };
      mockItemModel.findById.mockResolvedValue(item);
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ CronId: "1", CronName: "Main" }]);

      await product.editMasterItemController(mockReq as Request, mockRes as Response);

      expect(mockItemModel.findById).toHaveBeenCalledWith("507f1f77bcf86cd799439011");
      expect(renderMock).toHaveBeenCalledWith(
        "pages/itemmaster/edit",
        expect.objectContaining({
          item: expect.objectContaining({ cronName: "Main" }),
          groupName: "item",
        })
      );
    });

    it("should render edit page when item has no cronId", async () => {
      mockReq.params = { id: "507f1f77bcf86cd799439012" };
      const item = {
        _id: "507f1f77bcf86cd799439012",
        badgeIndicator: "ALL_ZERO",
        cronId: null,
      };
      mockItemModel.findById.mockResolvedValue(item);
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ CronId: "1", CronName: "Main" }]);

      await product.editMasterItemController(mockReq as Request, mockRes as Response);

      expect(renderMock).toHaveBeenCalledWith(
        "pages/itemmaster/edit",
        expect.objectContaining({
          item: expect.objectContaining({ cronName: "" }),
          groupName: "item",
        })
      );
    });
  });

  describe("deleteMasterItemController", () => {
    it("should return success when item is deleted", async () => {
      mockReq.body = { rowid: "abc123" };
      (mongoMiddleware.deleteById as jest.Mock).mockResolvedValue({ _id: "abc123" });

      await product.deleteMasterItemController(mockReq as Request, mockRes as Response);

      expect(mongoMiddleware.deleteById).toHaveBeenCalledWith("abc123");
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Item Deleted successfully.",
      });
    });

    it("should not return json when delete returns falsy", async () => {
      mockReq.body = { rowid: "abc123" };
      (mongoMiddleware.deleteById as jest.Mock).mockResolvedValue(null);

      await product.deleteMasterItemController(mockReq as Request, mockRes as Response);

      expect(jsonMock).not.toHaveBeenCalled();
    });
  });

  describe("addMasterItemToDatabase", () => {
    it("should create item and return success", async () => {
      mockReq.body = {
        cronGroup: "1",
        channel_name: "TRADENT",
        product_name: "Product",
        Scrape_on_off: "on",
        Reprice_on_off: "on",
        requestInterval: "5",
        floor_price: "10",
        net32_url: "http://x.com",
        mpid: "mp1",
        focus_id: "f1",
        channel_Id: "c1",
        unit_price: "20",
        max_price: "30",
        tags: "a, b",
        activated: "on",
        is_nc_needed: "off",
        reprice_rule_select: "2",
        suppressPriceBreak: "on",
        request_interval_unit: "min",
        priority: "5",
        competeAll: "off",
        suppressPriceBreakForOne: "off",
        beatQPrice: "off",
        percentageIncrease: "1",
        compareWithQ1: "off",
        wait_update_period: "on",
        badgeIndicator: "ALL_ZERO",
        badgePercentage: "2",
        abortDeactivatingQPriceBreak: "on",
        ownVendorId: "v1",
        sisterVendorId: "v2",
        inactiveVendorId: "v3",
        includeInactiveVendors: "off",
        override_bulk_update: "on",
        override_bulk_rule: "2",
        latest_price: "25",
      };
      mockItemModel.create.mockResolvedValue({ _id: "new-id" } as any);

      await product.addMasterItemToDatabase(mockReq as Request, mockRes as Response);

      expect(mockItemModel.create).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Item added successfully.",
      });
    });
  });

  describe("updateMasterItemController", () => {
    it("should update item and return success", async () => {
      mockReq.body = {
        id: "item-id",
        cronGroup: "1",
        channel_name: "TRADENT",
        product_name: "Product",
        Scrape_on_off: "on",
        Reprice_on_off: "on",
        requestInterval: "5",
        floor_price: "10",
        net32_url: "http://x.com",
        mpid: "mp1",
        focus_id: "f1",
        channel_Id: "c1",
        unit_price: "20",
        max_price: "30",
        tags: "a, b",
        activated: "on",
        is_nc_needed: "off",
        reprice_rule_select: "2",
        suppressPriceBreak: "on",
        request_interval_unit: "min",
        priority: "5",
        competeAll: "off",
        suppressPriceBreakForOne: "off",
        beatQPrice: "off",
        percentageIncrease: "1",
        compareWithQ1: "off",
        wait_update_period: "on",
        badgeIndicator: "ALL_ZERO",
        badgePercentage: "2",
        abortDeactivatingQPriceBreak: "on",
        ownVendorId: "v1",
        sisterVendorId: "v2",
        inactiveVendorId: "v3",
        includeInactiveVendors: "off",
        override_bulk_update: "on",
        override_bulk_rule: "2",
        latest_price: "25",
      };
      mockItemModel.findByIdAndUpdate.mockResolvedValue({ _id: "item-id" });

      await product.updateMasterItemController(mockReq as Request, mockRes as Response);

      expect(mockItemModel.findByIdAndUpdate).toHaveBeenCalledWith("item-id", expect.any(Object));
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Item updated successfully.",
      });
    });

    it("should not return success when findByIdAndUpdate returns null", async () => {
      mockReq.body = { id: "item-id", tags: "a, b" } as any;
      mockItemModel.findByIdAndUpdate.mockResolvedValue(null);

      await product.updateMasterItemController(mockReq as Request, mockRes as Response);

      expect(jsonMock).not.toHaveBeenCalled();
    });
  });

  describe("excelDownload", () => {
    it("should use ExcelExportService when available", async () => {
      (ExcelExportService.checkServiceStatus as jest.Mock).mockResolvedValue(true);
      (ExcelExportService.downloadExcel as jest.Mock).mockResolvedValue(undefined);
      mockReq.body = { tags: "", activated: "", cronId: "", channelName: "" };

      await product.excelDownload(mockReq as Request, mockRes as Response);

      expect(ExcelExportService.checkServiceStatus).toHaveBeenCalled();
      expect(ExcelExportService.downloadExcel).toHaveBeenCalledWith(expect.objectContaining({ tags: "" }), mockRes);
    });

    it("should fallback to legacy implementation when service unavailable", async () => {
      (ExcelExportService.checkServiceStatus as jest.Mock).mockResolvedValue(false);
      const mockItems = [
        {
          cronId: "1",
          tags: ["a", "b"],
          last_cron_time: new Date(),
          last_update_time: new Date(),
          last_attempted_time: new Date(),
          next_cron_time: new Date(),
          badgeIndicator: "ALL_ZERO",
        },
      ];
      mockItemModel.find.mockResolvedValue(mockItems);
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ CronId: "1", CronName: "Main" }]);

      await product.excelDownload(mockReq as Request, mockRes as Response);

      expect(mockItemModel.find).toHaveBeenCalled();
      expect(GetCronSettingsList).toHaveBeenCalled();
      expect(mockWrite).toHaveBeenCalledWith(mockRes);
      expect(setHeaderMock).toHaveBeenCalledWith("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(setHeaderMock).toHaveBeenCalledWith("Content-Disposition", "attachment; filename=itemExcel.xlsx");
      await Promise.resolve(); // allow write().then() to run
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(endMock).toHaveBeenCalled();
    });

    it("should return 500 on error", async () => {
      (ExcelExportService.checkServiceStatus as jest.Mock).mockRejectedValue(new Error("Service down"));

      await product.excelDownload(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "Failed to generate Excel file",
        message: "Service down",
      });
    });

    it("should handle non-Error in catch", async () => {
      (ExcelExportService.checkServiceStatus as jest.Mock).mockRejectedValue("string error");

      await product.excelDownload(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        error: "Failed to generate Excel file",
        message: "Unknown error",
      });
    });
  });

  describe("runAllCron", () => {
    it("should toggle crons and run cron, return success", async () => {
      (GetCronSettingsList as jest.Mock).mockResolvedValue([
        { CronId: 1, IsHidden: false },
        { CronId: 2, IsHidden: true },
      ]);
      (ToggleCronStatus as jest.Mock).mockResolvedValue(undefined);
      (httpMiddleware.runCron as jest.Mock).mockResolvedValue({
        status: 200,
        data: "Cron started",
      });

      await product.runAllCron(mockReq as Request, mockRes as Response);

      expect(ToggleCronStatus).toHaveBeenCalledWith(1, true, mockReq);
      expect(ToggleCronStatus).not.toHaveBeenCalledWith(2, expect.anything(), expect.anything());
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Cron started",
      });
    });

    it("should return error when runCron fails", async () => {
      (GetCronSettingsList as jest.Mock).mockResolvedValue([]);
      (httpMiddleware.runCron as jest.Mock).mockResolvedValue({ status: 500 });

      await product.runAllCron(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: "Something went wrong. Please try again.",
      });
    });

    it("should handle empty cron settings", async () => {
      (GetCronSettingsList as jest.Mock).mockResolvedValue([]);
      (httpMiddleware.runCron as jest.Mock).mockResolvedValue({ status: 200, data: "ok" });

      await product.runAllCron(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({ status: true, message: "ok" });
    });
  });

  describe("runManualCron", () => {
    it("should run manual cron for selected products and render view", async () => {
      mockReq.body = { mpIds: ["mp1", "mp2"] };
      mockItemModel.find.mockResolvedValue([{ mpid: "mp1", productName: "P1", channelId: "c1" }]);
      (GetEnvValueByKey as jest.Mock).mockResolvedValue("SOURCE1");
      (httpMiddleware.runManualCron as jest.Mock).mockResolvedValue({
        data: {
          cronResponse: "ok",
          priceUpdateResponse: "updated",
        },
      });
      (httpMiddleware.updateProductManual as jest.Mock).mockResolvedValue({});
      (mongoMiddleware.PushManualCronLogAsync as jest.Mock).mockResolvedValue({
        insertedId: "log-id",
      });

      await product.runManualCron(mockReq as Request, mockRes as Response);

      expect(mockItemModel.find).toHaveBeenCalledWith({ mpid: "mp1" });
      expect(mockItemModel.find).toHaveBeenCalledWith({ mpid: "mp2" });
      expect(httpMiddleware.runManualCron).toHaveBeenCalled();
      expect(renderMock).toHaveBeenCalledWith(
        "pages/cron/cronView",
        expect.objectContaining({
          response: "Manual repricing done",
          groupName: "item",
        })
      );
    });

    it("should handle single mpId (not array)", async () => {
      mockReq.body = { mpIds: "mp1" };
      mockItemModel.find.mockResolvedValue([{ mpid: "mp1" }]);
      (GetEnvValueByKey as jest.Mock).mockResolvedValue("S");
      (httpMiddleware.runManualCron as jest.Mock).mockResolvedValue({
        data: { cronResponse: "ok", priceUpdateResponse: "ERROR:422" },
      });
      (httpMiddleware.updateProductManual as jest.Mock).mockResolvedValue({});
      (mongoMiddleware.PushManualCronLogAsync as jest.Mock).mockResolvedValue({ insertedId: "x" });

      await product.runManualCron(mockReq as Request, mockRes as Response);

      expect(renderMock).toHaveBeenCalled();
    });

    it("should do nothing when selectedProducts is empty", async () => {
      mockReq.body = { mpIds: [] };

      await product.runManualCron(mockReq as Request, mockRes as Response);

      expect(mockItemModel.find).not.toHaveBeenCalled();
      expect(renderMock).not.toHaveBeenCalled();
    });

    it("should handle repriceResult null", async () => {
      mockReq.body = { mpIds: ["mp1"] };
      mockItemModel.find.mockResolvedValue([{ mpid: "mp1" }]);
      (GetEnvValueByKey as jest.Mock).mockResolvedValue("S");
      (httpMiddleware.runManualCron as jest.Mock).mockResolvedValue(null);
      (httpMiddleware.updateProductManual as jest.Mock).mockResolvedValue({});
      (mongoMiddleware.PushManualCronLogAsync as jest.Mock).mockResolvedValue({ insertedId: "x" });

      await product.runManualCron(mockReq as Request, mockRes as Response);

      expect(renderMock).toHaveBeenCalled();
    });
  });

  describe("resetCron", () => {
    it("should reset last_cron_time and render view", async () => {
      mockItemModel.updateMany.mockResolvedValue({
        acknowledged: true,
        modifiedCount: 10,
        matchedCount: 10,
        upsertedCount: 0,
        upsertedId: null,
      } as any);

      await product.resetCron(mockReq as Request, mockRes as Response);

      expect(mockItemModel.updateMany).toHaveBeenCalledWith({}, expect.objectContaining({ $set: expect.objectContaining({ last_cron_time: expect.any(Date) }) }));
      expect(renderMock).toHaveBeenCalledWith(
        "pages/cron/cronView",
        expect.objectContaining({
          response: expect.stringMatching(/Last cron time reset/),
          groupName: "item",
        })
      );
    });
  });

  describe("deleteAll", () => {
    it("should delete all items and return success", async () => {
      mockItemModel.deleteMany.mockResolvedValue({
        acknowledged: true,
        deletedCount: 5,
      } as any);

      await product.deleteAll(mockReq as Request, mockRes as Response);

      expect(mockItemModel.deleteMany).toHaveBeenCalledWith({});
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Items deleted successfully.",
      });
    });
  });

  describe("addExcelData", () => {
    it("should use mongo path when USE_MYSQL is false", async () => {
      (applicationConfig as any).USE_MYSQL = false;
      (SessionHelper.GetAuditInfo as jest.Mock).mockResolvedValue({
        UpdatedBy: "u",
        UpdatedOn: new Date(),
      });
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ CronId: "1", CronName: "Main" }]);
      (GetSlowCronDetails as jest.Mock).mockResolvedValue([]);
      (GetScrapeCrons as jest.Mock).mockResolvedValue([]);
      (mapperHelper.AlignProducts as jest.Mock).mockResolvedValue(undefined);
      (mongoMiddleware.InsertOrUpdateProductWithCronName as jest.Mock).mockResolvedValue(undefined);
      mockReq.body = {
        count: "1",
        data: [["TRADENT", "true", "mp1", "ch1", null, null, null, null, null, null, "0", "5", "0", "false", "false", "0", "false", "false", "2", "false", "false", "0", "false", "false", "false", "ALL_ZERO", "0", null, "Product", null, "Main", "1", "min", "true", "true", "a, b", "5", "true", "f1", "http://u.com", "true", "v1", "v2", "false", "v3", "true", "2", "0", null, null, null, null, null, null, null, null, null, "false", "false"]],
      };

      await product.addExcelData(mockReq as Request, mockRes as Response);

      expect(mongoMiddleware.InsertOrUpdateProductWithCronName).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Item Chart added successfully. Count : 1",
      });
    });
  });

  describe("stopAllCron", () => {
    it("should toggle crons off and stop all, return success", async () => {
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ CronId: 1, IsHidden: false }]);
      (ToggleCronStatus as jest.Mock).mockResolvedValue(undefined);
      (httpMiddleware.stopAllCron as jest.Mock).mockResolvedValue({
        status: 200,
        data: "Stopped",
      });

      await product.stopAllCron(mockReq as Request, mockRes as Response);

      expect(ToggleCronStatus).toHaveBeenCalledWith(1, false, mockReq);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Stopped",
      });
    });

    it("should skip hidden crons", async () => {
      (GetCronSettingsList as jest.Mock).mockResolvedValue([{ CronId: 1, IsHidden: true }]);
      (httpMiddleware.stopAllCron as jest.Mock).mockResolvedValue({ status: 200, data: "ok" });

      await product.stopAllCron(mockReq as Request, mockRes as Response);

      expect(ToggleCronStatus).not.toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({ status: true, message: "ok" });
    });

    it("should return error when stopAllCron fails", async () => {
      (GetCronSettingsList as jest.Mock).mockResolvedValue([]);
      (httpMiddleware.stopAllCron as jest.Mock).mockResolvedValue({ status: 500 });

      await product.stopAllCron(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: "Something went wrong. Please try again.",
      });
    });
  });

  describe("start_override", () => {
    it("should call StartOverride and render view", async () => {
      (httpMiddleware.StartOverride as jest.Mock).mockResolvedValue(undefined);

      await product.start_override(mockReq as Request, mockRes as Response);

      expect(httpMiddleware.StartOverride).toHaveBeenCalled();
      expect(renderMock).toHaveBeenCalledWith(
        "pages/cron/cronView",
        expect.objectContaining({
          response: expect.stringMatching(/Override Run Started/),
          groupName: "item",
        })
      );
    });
  });

  describe("getAllActiveProducts", () => {
    it("should return productList when active items exist", async () => {
      mockItemModel.find.mockResolvedValue([{ mpid: "mp1" }, { mpid: "mp2" }]);

      await product.getAllActiveProducts(mockReq as Request, mockRes as Response);

      expect(mockItemModel.find).toHaveBeenCalledWith({ activated: true });
      expect(jsonMock).toHaveBeenCalledWith({
        productList: ["mp1", "mp2"],
      });
    });

    it("should not return when no active items", async () => {
      mockItemModel.find.mockResolvedValue([]);

      await product.getAllActiveProducts(mockReq as Request, mockRes as Response);

      expect(jsonMock).not.toHaveBeenCalled();
    });

    it("should not return when itemDetails is null/undefined", async () => {
      mockItemModel.find.mockResolvedValue(null as any);

      await product.getAllActiveProducts(mockReq as Request, mockRes as Response);

      expect(jsonMock).not.toHaveBeenCalled();
    });
  });
});
