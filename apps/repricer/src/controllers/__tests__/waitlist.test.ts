import { Request, Response } from "express";
import * as waitlist from "../waitlist";
import { GetWaitlistItems, DeleteWaitlistItem, BulkDeleteWaitlistItems } from "../../services/mysql-v2";

jest.mock("../../services/mysql-v2");

const mockGetWaitlistItems = GetWaitlistItems as jest.MockedFunction<typeof GetWaitlistItems>;
const mockDeleteWaitlistItem = DeleteWaitlistItem as jest.MockedFunction<typeof DeleteWaitlistItem>;
const mockBulkDeleteWaitlistItems = BulkDeleteWaitlistItems as jest.MockedFunction<typeof BulkDeleteWaitlistItems>;

describe("Waitlist Controller", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let renderMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation();
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnThis();
    renderMock = jest.fn();
    mockRes = {
      json: jsonMock,
      status: statusMock,
      render: renderMock,
    };
    mockReq = {
      params: {},
      body: {},
      query: {},
      session: { users_id: { userRole: "admin" } } as any,
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getWaitlistItems", () => {
    const defaultWaitlistResponse = {
      data: [
        {
          id: 1,
          vendor_name: "Vendor A",
          api_status: "pending",
          created_at: "2025-01-01T00:00:00Z",
        },
      ],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      },
    };

    it("should use default query params and render waitlist page when query is empty", async () => {
      mockReq.query = {};
      mockGetWaitlistItems.mockResolvedValue(defaultWaitlistResponse);

      await waitlist.getWaitlistItems(mockReq as Request, mockRes as Response);

      expect(mockGetWaitlistItems).toHaveBeenCalledWith({
        page: 1,
        pageSize: 10,
        offset: 0,
        sort: "created_at DESC",
        status: null,
        startDate: null,
        endDate: null,
        search: null,
      });
      expect(renderMock).toHaveBeenCalledWith("pages/waitlist", {
        items: defaultWaitlistResponse.data,
        pageNumber: 1,
        pageSize: 10,
        totalDocs: 1,
        totalPages: 1,
        groupName: "Waitlist",
        status: "",
        fromDate: "",
        toDate: "",
        search: "",
        userRole: "admin",
      });
    });

    it("should pass custom page, pageSize, sort, status, dates and search to GetWaitlistItems", async () => {
      mockReq.query = {
        page: "3",
        pageSize: "25",
        sort: "vendor_name ASC",
        status: "approved",
        fromDate: "2025-01-01",
        toDate: "2025-01-31",
        search: "acme",
      };
      mockGetWaitlistItems.mockResolvedValue(defaultWaitlistResponse);

      await waitlist.getWaitlistItems(mockReq as Request, mockRes as Response);

      expect(mockGetWaitlistItems).toHaveBeenCalledWith({
        page: 3,
        pageSize: 25,
        offset: 50,
        sort: "vendor_name ASC",
        status: "approved",
        startDate: "2025-01-01",
        endDate: "2025-01-31",
        search: "acme",
      });
      expect(renderMock).toHaveBeenCalledWith(
        "pages/waitlist",
        expect.objectContaining({
          pageNumber: 3,
          pageSize: 25,
          status: "approved",
          fromDate: "2025-01-01",
          toDate: "2025-01-31",
          search: "acme",
        })
      );
    });

    it("should use empty userRole when session or users_id is missing", async () => {
      mockReq.query = {};
      (mockReq as any).session = undefined;
      mockGetWaitlistItems.mockResolvedValue(defaultWaitlistResponse);

      await waitlist.getWaitlistItems(mockReq as Request, mockRes as Response);

      expect(renderMock).toHaveBeenCalledWith("pages/waitlist", expect.objectContaining({ userRole: "" }));
    });

    it("should use empty userRole when users_id has no userRole", async () => {
      mockReq.query = {};
      (mockReq as any).session = { users_id: {} };
      mockGetWaitlistItems.mockResolvedValue(defaultWaitlistResponse);

      await waitlist.getWaitlistItems(mockReq as Request, mockRes as Response);

      expect(renderMock).toHaveBeenCalledWith("pages/waitlist", expect.objectContaining({ userRole: "" }));
    });

    it("should respond with 500 and error message when GetWaitlistItems throws", async () => {
      mockReq.query = {};
      mockGetWaitlistItems.mockRejectedValue(new Error("DB error"));

      await waitlist.getWaitlistItems(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Internal server error" });
      expect(renderMock).not.toHaveBeenCalled();
    });
  });

  describe("deleteWaitlistItem", () => {
    const deleteSuccessResponse = {
      status: true,
      message: "Waitlist item deleted successfully",
    };

    it("should parse id from params, call DeleteWaitlistItem and return result as JSON", async () => {
      mockReq.params = { id: "42" };
      mockDeleteWaitlistItem.mockResolvedValue(deleteSuccessResponse);

      await waitlist.deleteWaitlistItem(mockReq as Request, mockRes as Response);

      expect(mockDeleteWaitlistItem).toHaveBeenCalledWith(42);
      expect(jsonMock).toHaveBeenCalledWith(deleteSuccessResponse);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it("should respond with 500 and error message when DeleteWaitlistItem throws", async () => {
      mockReq.params = { id: "1" };
      mockDeleteWaitlistItem.mockRejectedValue(new Error("Delete failed"));

      await waitlist.deleteWaitlistItem(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Internal server error" });
    });

    it("should still call DeleteWaitlistItem when id parses to NaN (service may handle or throw)", async () => {
      mockReq.params = { id: "not-a-number" };
      mockDeleteWaitlistItem.mockRejectedValue(new Error("Invalid id"));

      await waitlist.deleteWaitlistItem(mockReq as Request, mockRes as Response);

      expect(mockDeleteWaitlistItem).toHaveBeenCalledWith(NaN);
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Internal server error" });
    });
  });

  describe("bulkDeleteWaitlistItems", () => {
    const bulkDeleteSuccessResponse = {
      status: true,
      message: "Waitlist items deleted successfully",
    };

    it("should pass body.ids to BulkDeleteWaitlistItems and return result as JSON", async () => {
      mockReq.body = { ids: [1, 2, 3] };
      mockBulkDeleteWaitlistItems.mockResolvedValue(bulkDeleteSuccessResponse);

      await waitlist.bulkDeleteWaitlistItems(mockReq as Request, mockRes as Response);

      expect(mockBulkDeleteWaitlistItems).toHaveBeenCalledWith([1, 2, 3]);
      expect(jsonMock).toHaveBeenCalledWith(bulkDeleteSuccessResponse);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it("should respond with 500 and error message when BulkDeleteWaitlistItems throws", async () => {
      mockReq.body = { ids: [1] };
      mockBulkDeleteWaitlistItems.mockRejectedValue(new Error("Bulk delete failed"));

      await waitlist.bulkDeleteWaitlistItems(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Internal server error" });
    });

    it("should call BulkDeleteWaitlistItems with undefined when body.ids is missing", async () => {
      mockReq.body = {};
      mockBulkDeleteWaitlistItems.mockResolvedValue(bulkDeleteSuccessResponse);

      await waitlist.bulkDeleteWaitlistItems(mockReq as Request, mockRes as Response);

      expect(mockBulkDeleteWaitlistItems).toHaveBeenCalledWith(undefined);
      expect(jsonMock).toHaveBeenCalledWith(bulkDeleteSuccessResponse);
    });
  });
});
