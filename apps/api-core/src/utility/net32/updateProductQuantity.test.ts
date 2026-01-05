// Mock dependencies before imports
jest.mock("../mysql/mysql-helper", () => ({
  GetProxiesNet32: jest.fn(),
  GetVendorKeys: jest.fn(),
}));

jest.mock("../config", () => ({
  applicationConfig: {
    NET32_UPDATE_QUANTITY_URL: "https://api.net32-fake.com/inventory/products/update",
  },
}));

jest.mock("axios");

import { GetProxiesNet32, GetVendorKeys } from "../mysql/mysql-helper";
import { ProxyNet32 } from "../mysql/types";
import { applicationConfig } from "../config";
import axios from "axios";
import { processUpdateProductQuantities, UpdateProductQuantityRequest, VendorData } from "./updateProductQuantity";

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedGetVendorKeys = GetVendorKeys as jest.MockedFunction<typeof GetVendorKeys>;
const mockedGetProxiesNet32 = GetProxiesNet32 as jest.MockedFunction<typeof GetProxiesNet32>;

describe("updateProductQuantity", () => {
  const mockProxy1: ProxyNet32 = {
    id: 1,
    proxy_username: "MVP",
    proxy_password: "password1",
    ip: "127.0.0.1",
    port: "8080",
  };

  const mockProxy2: ProxyNet32 = {
    id: 2,
    proxy_username: "TRADENT",
    proxy_password: "password2",
    ip: "127.0.0.1",
    port: "8081",
  };

  const mockVendorKeyMap = new Map<string, string | null>([
    ["MVP", "key1"],
    ["TRADENT", "key2"],
  ]);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("processUpdateProductQuantities", () => {
    it("should successfully process multiple vendor updates", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [
          { vendor: "MVP", quantity: 10 },
          { vendor: "TRADENT", quantity: 20 },
        ],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1, mockProxy2]);

      mockedAxios.post
        .mockResolvedValueOnce({
          data: {
            statusCode: 200,
            data: { message: "Success" },
          },
        })
        .mockResolvedValueOnce({
          data: {
            statusCode: 200,
            data: { message: "Success" },
          },
        });

      const results = await processUpdateProductQuantities(request);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        vendor: "MVP",
        success: true,
        status: 200,
        data: { message: "Success" },
      });
      expect(results[1]).toEqual({
        vendor: "TRADENT",
        success: true,
        status: 200,
        data: { message: "Success" },
      });

      expect(mockedGetVendorKeys).toHaveBeenCalledWith(["MVP", "TRADENT"]);
      expect(mockedGetProxiesNet32).toHaveBeenCalledWith(["MVP", "TRADENT"]);
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it("should handle single vendor update", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      const singleVendorKeyMap = new Map<string, string | null>([["MVP", "key1"]]);

      mockedGetVendorKeys.mockResolvedValue(singleVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          statusCode: 200,
          data: { message: "Success" },
        },
      });

      const results = await processUpdateProductQuantities(request);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].vendor).toBe("MVP");
    });

    it("should throw error when vendor keys cannot be retrieved", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(null);

      await expect(processUpdateProductQuantities(request)).rejects.toThrow("Unable to retrieve vendor keys");
    });

    it("should throw error when vendor keys are invalid", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      const invalidVendorKeyMap = new Map<string, string | null>([["MVP", null]]);

      mockedGetVendorKeys.mockResolvedValue(invalidVendorKeyMap);

      await expect(processUpdateProductQuantities(request)).rejects.toThrow("Invalid vendor keys");
    });

    it("should throw error when proxies cannot be retrieved", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue(null as any);

      await expect(processUpdateProductQuantities(request)).rejects.toThrow("Unable to retrieve proxies");
    });

    it("should throw error when vendor proxy is missing", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([]);

      await expect(processUpdateProductQuantities(request)).rejects.toThrow("Missing resources for vendor: MVP");
    });

    it("should throw error when vendor key is missing", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      const missingKeyMap = new Map<string, string | null>();

      mockedGetVendorKeys.mockResolvedValue(missingKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      await expect(processUpdateProductQuantities(request)).rejects.toThrow("Missing resources for vendor: MVP");
    });

    it("should handle mixed success and failure results", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [
          { vendor: "MVP", quantity: 10 },
          { vendor: "TRADENT", quantity: 20 },
        ],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1, mockProxy2]);

      mockedAxios.post
        .mockResolvedValueOnce({
          data: {
            statusCode: 200,
            data: { message: "Success" },
          },
        })
        .mockRejectedValueOnce(new Error("Network error"));

      const results = await processUpdateProductQuantities(request);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe("Network error");
    });
  });

  describe("executeVendorUpdate", () => {
    it("should handle successful update with 200 status", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          statusCode: 200,
          data: { message: "Update successful" },
        },
      });

      const results = await processUpdateProductQuantities(request);

      expect(results[0].success).toBe(true);
      expect(results[0].status).toBe(200);
    });

    it("should handle 201 status code as success", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          statusCode: 201,
          data: { message: "Created" },
        },
      });

      const results = await processUpdateProductQuantities(request);

      expect(results[0].success).toBe(true);
      expect(results[0].status).toBe(201);
    });

    it("should handle 299 status code as success", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          statusCode: 299,
          data: { message: "Success" },
        },
      });

      const results = await processUpdateProductQuantities(request);

      expect(results[0].success).toBe(true);
      expect(results[0].status).toBe(299);
    });

    it("should handle 404 status code as success with special message", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          statusCode: 404,
          data: {},
        },
      });

      const results = await processUpdateProductQuantities(request);

      expect(results[0].success).toBe(true);
      expect(results[0].status).toBe(404);
      expect(results[0].data.message).toBe("A valid development key is in use, no update made.");
    });

    it("should handle 300 status code as failure", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          statusCode: 300,
          data: { message: "Redirect" },
        },
      });

      const results = await processUpdateProductQuantities(request);

      expect(results[0].success).toBe(false);
      expect(results[0].status).toBe(300);
    });

    it("should handle 400 status code as failure", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          statusCode: 400,
          data: { message: "Bad Request" },
        },
      });

      const results = await processUpdateProductQuantities(request);

      expect(results[0].success).toBe(false);
      expect(results[0].status).toBe(400);
    });

    it("should handle 500 status code as failure", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          statusCode: 500,
          data: { message: "Internal Server Error" },
        },
      });

      const results = await processUpdateProductQuantities(request);

      expect(results[0].success).toBe(false);
      expect(results[0].status).toBe(500);
    });

    it("should handle axios errors gracefully", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      const error = new Error("Request failed");
      mockedAxios.post.mockRejectedValueOnce(error);

      const results = await processUpdateProductQuantities(request);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe("Request failed");
      expect(results[0].vendor).toBe("MVP");
    });

    it("should handle errors without message", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      const error = new Error();
      error.message = "";
      mockedAxios.post.mockRejectedValueOnce(error);

      const results = await processUpdateProductQuantities(request);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe("Unknown error occurred");
    });
  });

  describe("updateProductQuantity", () => {
    it("should make correct axios post request with proper parameters", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          statusCode: 200,
          data: { message: "Success" },
        },
      });

      await processUpdateProductQuantities(request);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        "http://127.0.0.1:8080/proxy",
        {
          url: applicationConfig.NET32_UPDATE_QUANTITY_URL,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Subscription-Key": "key1",
          },
          data: [{ mpid: 12345, inventory: 10 }],
        },
        {
          auth: {
            username: "MVP",
            password: "password1",
          },
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    });

    it("should use correct proxy configuration for different vendors", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [
          { vendor: "MVP", quantity: 10 },
          { vendor: "TRADENT", quantity: 20 },
        ],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1, mockProxy2]);

      mockedAxios.post
        .mockResolvedValueOnce({
          data: { statusCode: 200, data: {} },
        })
        .mockResolvedValueOnce({
          data: { statusCode: 200, data: {} },
        });

      await processUpdateProductQuantities(request);

      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        1,
        "http://127.0.0.1:8080/proxy",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Subscription-Key": "key1",
          }),
          data: [{ mpid: 12345, inventory: 10 }],
        }),
        expect.objectContaining({
          auth: {
            username: "MVP",
            password: "password1",
          },
        })
      );

      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        2,
        "http://127.0.0.1:8081/proxy",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Subscription-Key": "key2",
          }),
          data: [{ mpid: 12345, inventory: 20 }],
        }),
        expect.objectContaining({
          auth: {
            username: "TRADENT",
            password: "password2",
          },
        })
      );
    });
  });

  describe("validateVendorKeyMap", () => {
    it("should validate vendor key map with all valid keys", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      const validMap = new Map<string, string | null>([["MVP", "valid-key"]]);

      mockedGetVendorKeys.mockResolvedValue(validMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: { statusCode: 200, data: {} },
      });

      await expect(processUpdateProductQuantities(request)).resolves.toBeDefined();
    });

    it("should reject vendor key map with null values", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      const invalidMap = new Map<string, string | null>([["MVP", null]]);

      mockedGetVendorKeys.mockResolvedValue(invalidMap);

      await expect(processUpdateProductQuantities(request)).rejects.toThrow("Invalid vendor keys");
    });

    it("should reject vendor key map with empty string values", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      const invalidMap = new Map<string, string | null>([["MVP", ""]]);

      mockedGetVendorKeys.mockResolvedValue(invalidMap);

      await expect(processUpdateProductQuantities(request)).rejects.toThrow("Invalid vendor keys");
    });

    it("should reject vendor key map with empty keys", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      const invalidMap = new Map<string, string | null>([["", "value"]]);

      mockedGetVendorKeys.mockResolvedValue(invalidMap);

      await expect(processUpdateProductQuantities(request)).rejects.toThrow("Invalid vendor keys");
    });

    it("should reject null vendor key map", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(null);

      await expect(processUpdateProductQuantities(request)).rejects.toThrow("Unable to retrieve vendor keys");
    });
  });

  describe("prepareVendorUpdates", () => {
    it("should match vendors with correct proxies by username", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [
          { vendor: "MVP", quantity: 10 },
          { vendor: "TRADENT", quantity: 20 },
        ],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy2, mockProxy1]); // Different order

      mockedAxios.post
        .mockResolvedValueOnce({
          data: { statusCode: 200, data: {} },
        })
        .mockResolvedValueOnce({
          data: { statusCode: 200, data: {} },
        });

      await processUpdateProductQuantities(request);

      // Should still match correctly by proxy_username
      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        1,
        "http://127.0.0.1:8080/proxy",
        expect.any(Object),
        expect.objectContaining({
          auth: { username: "MVP", password: "password1" },
        })
      );

      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        2,
        "http://127.0.0.1:8081/proxy",
        expect.any(Object),
        expect.objectContaining({
          auth: { username: "TRADENT", password: "password2" },
        })
      );
    });
  });

  describe("edge cases", () => {
    it("should handle empty vendor data array", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [],
      };

      mockedGetVendorKeys.mockResolvedValue(new Map());
      mockedGetProxiesNet32.mockResolvedValue([]);

      const results = await processUpdateProductQuantities(request);

      expect(results).toHaveLength(0);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it("should handle large quantity values", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 999999 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: { statusCode: 200, data: {} },
      });

      await processUpdateProductQuantities(request);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          data: [{ mpid: 12345, inventory: 999999 }],
        }),
        expect.any(Object)
      );
    });

    it("should handle zero quantity", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 0 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: { statusCode: 200, data: {} },
      });

      await processUpdateProductQuantities(request);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          data: [{ mpid: 12345, inventory: 0 }],
        }),
        expect.any(Object)
      );
    });

    it("should handle negative quantity", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: -5 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: { statusCode: 200, data: {} },
      });

      await processUpdateProductQuantities(request);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          data: [{ mpid: 12345, inventory: -5 }],
        }),
        expect.any(Object)
      );
    });

    it("should handle very large mpid", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 999999999,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: { statusCode: 200, data: {} },
      });

      await processUpdateProductQuantities(request);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          data: [{ mpid: 999999999, inventory: 10 }],
        }),
        expect.any(Object)
      );
    });

    it("should handle multiple vendors with same quantity", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [
          { vendor: "MVP", quantity: 10 },
          { vendor: "TRADENT", quantity: 10 },
        ],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1, mockProxy2]);

      mockedAxios.post
        .mockResolvedValueOnce({
          data: { statusCode: 200, data: {} },
        })
        .mockResolvedValueOnce({
          data: { statusCode: 200, data: {} },
        });

      const results = await processUpdateProductQuantities(request);

      expect(results).toHaveLength(2);
      expect(results[0].vendor).toBe("MVP");
      expect(results[1].vendor).toBe("TRADENT");
    });
  });

  describe("concurrent execution", () => {
    it("should execute all vendor updates in parallel", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [
          { vendor: "MVP", quantity: 10 },
          { vendor: "TRADENT", quantity: 20 },
          { vendor: "MVP", quantity: 30 },
        ],
      };

      const extendedVendorKeyMap = new Map<string, string | null>([
        ["MVP", "key1"],
        ["TRADENT", "key2"],
      ]);

      mockedGetVendorKeys.mockResolvedValue(extendedVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1, mockProxy2]);

      const callOrder: number[] = [];
      mockedAxios.post.mockImplementation(async () => {
        callOrder.push(Date.now());
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          data: { statusCode: 200, data: {} },
        };
      });

      const startTime = Date.now();
      await processUpdateProductQuantities(request);
      const endTime = Date.now();

      // All calls should be made (3 vendors, but VENDOR1 appears twice)
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
      // Should complete quickly due to parallel execution
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe("status code boundary conditions", () => {
    it("should handle 199 status code as failure", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          statusCode: 199,
          data: { message: "Informational" },
        },
      });

      const results = await processUpdateProductQuantities(request);

      expect(results[0].success).toBe(false);
      expect(results[0].status).toBe(199);
    });

    it("should handle 200 status code as success", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          statusCode: 200,
          data: { message: "OK" },
        },
      });

      const results = await processUpdateProductQuantities(request);

      expect(results[0].success).toBe(true);
      expect(results[0].status).toBe(200);
    });

    it("should handle 299 status code as success", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          statusCode: 299,
          data: { message: "Success" },
        },
      });

      const results = await processUpdateProductQuantities(request);

      expect(results[0].success).toBe(true);
      expect(results[0].status).toBe(299);
    });

    it("should handle 300 status code as failure", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          statusCode: 300,
          data: { message: "Multiple Choices" },
        },
      });

      const results = await processUpdateProductQuantities(request);

      expect(results[0].success).toBe(false);
      expect(results[0].status).toBe(300);
    });

    it("should handle 499 status code as failure", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          statusCode: 499,
          data: { message: "Client Closed Request" },
        },
      });

      const results = await processUpdateProductQuantities(request);

      expect(results[0].success).toBe(false);
      expect(results[0].status).toBe(499);
    });

    it("should handle 500 status code as failure", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          statusCode: 500,
          data: { message: "Internal Server Error" },
        },
      });

      const results = await processUpdateProductQuantities(request);

      expect(results[0].success).toBe(false);
      expect(results[0].status).toBe(500);
    });

    it("should handle 599 status code as failure", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          statusCode: 599,
          data: { message: "Network Connect Timeout Error" },
        },
      });

      const results = await processUpdateProductQuantities(request);

      expect(results[0].success).toBe(false);
      expect(results[0].status).toBe(599);
    });
  });

  describe("validateVendorKeyMap edge cases", () => {
    it("should reject vendor key map with null map", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(null);

      await expect(processUpdateProductQuantities(request)).rejects.toThrow("Unable to retrieve vendor keys");
    });

    it("should reject vendor key map with empty string key", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      const invalidMap = new Map<string, string | null>([["", "valid-value"]]);

      mockedGetVendorKeys.mockResolvedValue(invalidMap);

      await expect(processUpdateProductQuantities(request)).rejects.toThrow("Invalid vendor keys");
    });

    it("should reject vendor key map with null value", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      const invalidMap = new Map<string, string | null>([["MVP", null]]);

      mockedGetVendorKeys.mockResolvedValue(invalidMap);

      await expect(processUpdateProductQuantities(request)).rejects.toThrow("Invalid vendor keys");
    });

    it("should reject vendor key map with empty string value", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      const invalidMap = new Map<string, string | null>([["MVP", ""]]);

      mockedGetVendorKeys.mockResolvedValue(invalidMap);

      await expect(processUpdateProductQuantities(request)).rejects.toThrow("Invalid vendor keys");
    });

    it("should accept vendor key map with valid keys and values", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      const validMap = new Map<string, string | null>([
        ["MVP", "valid-key-123"],
        ["TRADENT", "another-valid-key"],
      ]);

      mockedGetVendorKeys.mockResolvedValue(validMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: { statusCode: 200, data: {} },
      });

      await expect(processUpdateProductQuantities(request)).resolves.toBeDefined();
    });

    it("should reject vendor key map with mixed valid and invalid entries", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      const invalidMap = new Map<string, string | null>([
        ["MVP", "valid-key"],
        ["TRADENT", null], // Invalid entry
      ]);

      mockedGetVendorKeys.mockResolvedValue(invalidMap);

      await expect(processUpdateProductQuantities(request)).rejects.toThrow("Invalid vendor keys");
    });
  });

  describe("executeVendorUpdate error handling", () => {
    it("should handle error with undefined message property", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      const error = { response: { status: 500 } } as any;
      mockedAxios.post.mockRejectedValueOnce(error);

      const results = await processUpdateProductQuantities(request);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe("Unknown error occurred");
    });

    it("should handle error with null message", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      const error = { message: null } as any;
      mockedAxios.post.mockRejectedValueOnce(error);

      const results = await processUpdateProductQuantities(request);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe("Unknown error occurred");
    });

    it("should handle error with undefined message", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      const error = { message: undefined } as any;
      mockedAxios.post.mockRejectedValueOnce(error);

      const results = await processUpdateProductQuantities(request);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe("Unknown error occurred");
    });

    it("should handle 404 with undefined data object by catching error", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          statusCode: 404,
          data: undefined,
        },
      });

      const results = await processUpdateProductQuantities(request);

      // When data is undefined, setting result.data.message throws an error
      // which is caught and returns a failure result
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBeDefined();
    });

    it("should handle 404 with null data object by catching error", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          statusCode: 404,
          data: null,
        },
      });

      const results = await processUpdateProductQuantities(request);

      // When data is null, setting result.data.message throws an error
      // which is caught and returns a failure result
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBeDefined();
    });
  });

  describe("prepareVendorUpdates edge cases", () => {
    it("should throw error when vendor key is missing for one vendor in multiple vendors", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [
          { vendor: "MVP", quantity: 10 },
          { vendor: "TRADENT", quantity: 20 },
        ],
      };

      const partialVendorKeyMap = new Map<string, string | null>([["MVP", "key1"]]);

      mockedGetVendorKeys.mockResolvedValue(partialVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1, mockProxy2]);

      await expect(processUpdateProductQuantities(request)).rejects.toThrow("Missing resources for vendor: TRADENT");
    });

    it("should throw error when proxy is missing for one vendor in multiple vendors", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [
          { vendor: "MVP", quantity: 10 },
          { vendor: "TRADENT", quantity: 20 },
        ],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]); // Missing VENDOR2 proxy

      await expect(processUpdateProductQuantities(request)).rejects.toThrow("Missing resources for vendor: TRADENT");
    });

    it("should throw error when vendor key exists but proxy username doesn't match", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      const wrongProxy: ProxyNet32 = {
        id: 1,
        proxy_username: "WRONG_VENDOR",
        proxy_password: "password1",
        ip: "127.0.0.1",
        port: "8080",
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([wrongProxy]);

      await expect(processUpdateProductQuantities(request)).rejects.toThrow("Missing resources for vendor: MVP");
    });
  });

  describe("updateProductQuantity request structure", () => {
    it("should construct correct URL with proxy IP and port", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: { statusCode: 200, data: {} },
      });

      await processUpdateProductQuantities(request);

      expect(mockedAxios.post).toHaveBeenCalledWith("http://127.0.0.1:8080/proxy", expect.any(Object), expect.any(Object));
    });

    it("should include correct subscription key in headers", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: { statusCode: 200, data: {} },
      });

      await processUpdateProductQuantities(request);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Subscription-Key": "key1",
          }),
        }),
        expect.any(Object)
      );
    });

    it("should include correct mpid and inventory in data array", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 99999,
        vendorData: [{ vendor: "MVP", quantity: 42 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: { statusCode: 200, data: {} },
      });

      await processUpdateProductQuantities(request);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          data: [{ mpid: 99999, inventory: 42 }],
        }),
        expect.any(Object)
      );
    });

    it("should include correct proxy authentication", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [{ vendor: "MVP", quantity: 10 }],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1]);

      mockedAxios.post.mockResolvedValueOnce({
        data: { statusCode: 200, data: {} },
      });

      await processUpdateProductQuantities(request);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          auth: {
            username: "MVP",
            password: "password1",
          },
        })
      );
    });
  });

  describe("integration scenarios", () => {
    it("should handle three vendors with different outcomes", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [
          { vendor: "MVP", quantity: 10 },
          { vendor: "TRADENT", quantity: 20 },
        ],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1, mockProxy2]);

      mockedAxios.post
        .mockResolvedValueOnce({
          data: { statusCode: 200, data: { message: "Success" } },
        })
        .mockRejectedValueOnce(new Error("Network timeout"));

      const results = await processUpdateProductQuantities(request);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].status).toBe(200);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe("Network timeout");
    });

    it("should handle all vendors failing", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [
          { vendor: "MVP", quantity: 10 },
          { vendor: "TRADENT", quantity: 20 },
        ],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1, mockProxy2]);

      mockedAxios.post.mockRejectedValueOnce(new Error("Error 1")).mockRejectedValueOnce(new Error("Error 2"));

      const results = await processUpdateProductQuantities(request);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe("Error 1");
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe("Error 2");
    });

    it("should handle all vendors succeeding with different status codes", async () => {
      const request: UpdateProductQuantityRequest = {
        mpid: 12345,
        vendorData: [
          { vendor: "MVP", quantity: 10 },
          { vendor: "TRADENT", quantity: 20 },
        ],
      };

      mockedGetVendorKeys.mockResolvedValue(mockVendorKeyMap);
      mockedGetProxiesNet32.mockResolvedValue([mockProxy1, mockProxy2]);

      mockedAxios.post
        .mockResolvedValueOnce({
          data: { statusCode: 200, data: { message: "OK" } },
        })
        .mockResolvedValueOnce({
          data: { statusCode: 404, data: {} },
        });

      const results = await processUpdateProductQuantities(request);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].status).toBe(200);
      expect(results[1].success).toBe(true);
      expect(results[1].status).toBe(404);
      expect(results[1].data.message).toBe("A valid development key is in use, no update made.");
    });
  });
});
