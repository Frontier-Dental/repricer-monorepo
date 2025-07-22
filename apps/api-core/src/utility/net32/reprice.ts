import axios, { AxiosInstance, AxiosRequestConfig } from "axios";

// --- Types generated from OpenAPI ---

export type PriceListItem = {
  minQty: number;
  price?: number;
  activeCd: number;
  effectiveTimestamp?: string;
  endTime?: string;
};

export type PromoPriceListItem = {
  pmId: number;
  minQty: number;
  price: number;
  activeCd: number;
  effectiveTimestamp: string;
  endTime: string;
};

export type Product = {
  mpid: number;
  vpCode: string;
  mpCode: string;
  manufacturerName: string;
  brandName: string;
  description: string;
  fulfillmentPolicy: string;
  inStock: boolean;
  inventory: number;
  pht: number;
  atts: number;
  annualQtySales: number;
  annualSales: number;
  lastOrderDate: string;
  category: string;
  retailPrice: number;
  priceList: PriceListItem[];
  promoPriceList: PromoPriceListItem[];
  status: string;
};

export type GetSingleProductResponse = {
  statusCode: number;
  payload: {
    result: Product[];
    totalResults: number;
    totalReturned: number;
  };
};

export type UpdateProductRequest = {
  vpCode?: string;
  mpid?: number;
  priceList?: PriceListItem[];
  fulfillmentPolicy?: string;
  pht?: number;
  inventory?: number;
  inStock?: boolean;
};

export type UpdateProductSuccessResponse = {
  statusCode: number;
  payload: {
    mpid: number;
    vpCode: string;
    mpCode: string;
    fulfillmentPolicy: string;
    inStock: boolean;
    inventory: number;
    pht: number;
    priceList: PriceListItem[];
    promoPriceList: PromoPriceListItem[];
  };
  message: string;
};

export type ApiErrorResponse = {
  statusCode: number;
  payload: unknown;
  message: string;
};

// --- Axios instance ---

const BASE_URL = "https://api.net32.com/products";

/**
 * Proxy configuration (optional):
 * Set the following environment variables to enable proxy with basic authentication:
 *   NET32_PROXY_HOST
 *   NET32_PROXY_PORT
 *   NET32_PROXY_USERNAME
 *   NET32_PROXY_PASSWORD
 */

function createNet32Api(
  subscriptionKey: string,
  axiosConfig?: AxiosRequestConfig,
): AxiosInstance {
  // Proxy config from environment variables
  const proxyHost = process.env.NET32_PROXY_HOST;
  const proxyPort = process.env.NET32_PROXY_PORT;
  const proxyUsername = process.env.NET32_PROXY_USERNAME;
  const proxyPassword = process.env.NET32_PROXY_PASSWORD;

  const anyProxyVarSet =
    proxyHost || proxyPort || proxyUsername || proxyPassword;
  if (anyProxyVarSet) {
    if (!proxyHost || !proxyPort || !proxyUsername || !proxyPassword) {
      throw new Error(
        "Proxy configuration error: All of NET32_PROXY_HOST, NET32_PROXY_PORT, NET32_PROXY_USERNAME, and NET32_PROXY_PASSWORD must be set.",
      );
    }
  }

  let proxy: AxiosRequestConfig["proxy"] = undefined;
  if (proxyHost && proxyPort) {
    proxy = {
      host: proxyHost,
      port: parseInt(proxyPort, 10),
      protocol: "http",
    };
    if (proxyUsername && proxyPassword) {
      proxy.auth = {
        username: proxyUsername,
        password: proxyPassword,
      };
    }
  }

  return axios.create({
    baseURL: BASE_URL,
    ...axiosConfig,
    proxy,
    headers: {
      ...(axiosConfig?.headers || {}),
      "Subscription-Key": subscriptionKey,
    },
  });
}

// --- API Wrappers ---

export interface GetProductDetailsParams {
  vpCode?: string;
  mpid?: number;
  status?:
    | "all"
    | "active-offer"
    | "inactive-offer"
    | "out-of-stock"
    | "delisted";
  limit?: number;
  after_vpCode?: string;
}

export async function getProductDetails(
  subscriptionKey: string,
  params: GetProductDetailsParams,
  axiosConfig?: AxiosRequestConfig,
): Promise<GetSingleProductResponse> {
  const api = createNet32Api(subscriptionKey, axiosConfig);
  const response = await api.get<GetSingleProductResponse>("/offers", {
    params,
  });
  return response.data;
}

export async function updateProductInfo(
  subscriptionKey: string,
  data: UpdateProductRequest,
  axiosConfig?: AxiosRequestConfig,
): Promise<UpdateProductSuccessResponse> {
  const api = createNet32Api(subscriptionKey, axiosConfig);
  const response = await api.post<UpdateProductSuccessResponse>(
    "/offers/update",
    data,
  );
  return response.data;
}

// --- Error Types (for 400, 403, 404, 406, 422, 500) ---
export type UpdateProductErrorResponse = ApiErrorResponse;
