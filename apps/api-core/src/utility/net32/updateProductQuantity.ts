import { GetProxiesNet32, GetVendorKeys } from "../mysql/mysql-helper";
import { ProxyNet32 } from "../mysql/types";
import { applicationConfig } from "../config";
import axios from "axios";

const HTTP_STATUS = {
  OK: 200,
  REDIRECT_START: 300,
  NOT_FOUND: 404,
  SERVER_ERROR_START: 500,
} as const;

interface VendorData {
  vendor: string;
  quantity: number;
}

interface UpdateProductQuantityRequest {
  mpid: number;
  vendorData: VendorData[];
}

interface UpdateResult {
  vendor: string;
  success: boolean;
  status?: number;
  data?: any;
  error?: string;
}

interface VendorUpdateData {
  vendor: VendorData;
  vendorKey: string;
  proxy: ProxyNet32;
}

export const processUpdateProductQuantities = async (
  request: UpdateProductQuantityRequest,
): Promise<UpdateResult[]> => {
  const { mpid, vendorData } = request;
  const vendors = vendorData.map((vendorObject) => vendorObject.vendor);
  const { vendorKeys, proxies } = await validateVendorResources(vendors);
  const vendorUpdates = prepareVendorUpdates(vendorData, vendorKeys, proxies);
  const updatePromises = vendorUpdates.map((updateData) =>
    executeVendorUpdate(mpid, updateData),
  );
  return await Promise.all(updatePromises);
};

const validateVendorResources = async (
  vendors: string[],
): Promise<{
  vendorKeys: Map<string, string | null>;
  proxies: ProxyNet32[];
}> => {
  const vendorKeys = await GetVendorKeys(vendors);

  if (!vendorKeys) {
    throw new Error("Unable to retrieve vendor keys");
  }

  if (!validateVendorKeyMap(vendorKeys)) {
    throw new Error("Invalid vendor keys");
  }

  const proxies = await GetProxiesNet32(vendors);

  if (!proxies) {
    throw new Error("Unable to retrieve proxies");
  }

  return { vendorKeys, proxies };
};

const prepareVendorUpdates = (
  vendorData: VendorData[],
  vendorKeys: Map<string, string | null>,
  proxies: ProxyNet32[],
): VendorUpdateData[] => {
  return vendorData.map((vendorObject) => {
    const vendorKey = vendorKeys.get(vendorObject.vendor);
    const proxy = proxies.find(
      (proxy: ProxyNet32) => proxy.proxy_username === vendorObject.vendor,
    );

    if (!vendorKey || !proxy) {
      throw new Error(`Missing resources for vendor: ${vendorObject.vendor}`);
    }

    return {
      vendor: vendorObject,
      vendorKey,
      proxy,
    };
  });
};

const executeVendorUpdate = async (
  mpid: number,
  updateData: VendorUpdateData,
): Promise<UpdateResult> => {
  try {
    const response = await updateProductQuantity(
      mpid,
      updateData.vendor.quantity,
      updateData.vendorKey,
      updateData.proxy,
    );

    const result = {
      vendor: updateData.vendor.vendor,
      success:
        response.data.statusCode >= HTTP_STATUS.OK &&
        response.data.statusCode < HTTP_STATUS.REDIRECT_START,
      status: response.data.statusCode,
      data: response.data.data,
    };

    if (response.data.statusCode === HTTP_STATUS.NOT_FOUND) {
      result.success = true;
      result.data.message =
        "A valid development key is in use, no update made.";
    }

    return result;
  } catch (error: any) {
    return {
      vendor: updateData.vendor.vendor,
      success: false,
      error: error.message || "Unknown error occurred",
    };
  }
};

const validateVendorKeyMap = (
  vendorKeyMap: Map<string, string | null> | null,
) => {
  if (!vendorKeyMap) {
    return false;
  }

  for (const [key, value] of vendorKeyMap.entries()) {
    if (!key || !value) {
      return false;
    }
  }

  return true;
};

const updateProductQuantity = async (
  mpid: number,
  quantity: number,
  vendorKey: string,
  proxy: ProxyNet32,
) => {
  const url = `http://${proxy.ip}:${proxy.port}/proxy`;

  const net32Options = {
    url: applicationConfig.NET32_UPDATE_QUANTITY_URL,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Subscription-Key": vendorKey,
    },
    data: [{ mpid: mpid, inventory: quantity }],
  };

  const proxyOptions = {
    auth: { username: proxy.proxy_username, password: proxy.proxy_password },
    headers: { "Content-Type": "application/json" },
  };

  return await axios.post(url, net32Options, proxyOptions);
};
