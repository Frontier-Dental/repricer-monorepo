import { applicationConfig } from "../config";
import * as axiosHelper from "../axios-helper";
import { CacheKey } from "@repricer-monorepo/shared";
import CacheClient, { GetCacheClientOptions } from "../../client/cacheClient";
import {
  MiniErpLoginResponse,
  MiniErpNormalizedResponse,
  MiniErpProduct,
} from ".";
import { GetCurrentStock, WaitlistInsert } from "../mysql/mysql-helper";
import { WaitlistModel } from "../../model/waitlist-model";

const DEFAULT_MINI_ERP_PAGE_SIZE = applicationConfig.MINI_ERP_DATA_PAGE_SIZE;
const CACHE_TTL_SECONDS = 60 * 60 * 20; // 20 hours

/**
 * Authenticates with Mini ERP and returns access token
 * Uses cache to avoid unnecessary login requests
 * @returns Promise resolving to login response with access_token, or undefined on error
 */
async function loginToMiniErp(): Promise<MiniErpLoginResponse | undefined> {
  const cacheKey = CacheKey.MINI_ERP_LOGIN_RESPONSE;
  try {
    console.log("Logging into Mini ERP");
    let cacheClient = CacheClient.getInstance(
      GetCacheClientOptions(applicationConfig),
    );
    const cachedLoginResponse =
      await cacheClient.get<MiniErpLoginResponse>(cacheKey);
    if (cachedLoginResponse) {
      console.log("Cached login response found");
      return cachedLoginResponse;
    }

    const baseUrl = applicationConfig.MINI_ERP_BASE_URL;

    const loginUrl = `${baseUrl}/authentication/sign-in`;
    const loginPayload = {
      username: applicationConfig.MINI_ERP_USERNAME,
      password: applicationConfig.MINI_ERP_PASSWORD,
    };

    const loginResponse = await axiosHelper.postAsync(loginPayload, loginUrl);

    console.log("Mini ERP Login response status", loginResponse?.status);

    if (!loginResponse?.data?.access_token) {
      throw new Error("Invalid login response: missing access_token");
    }

    // Cache the login response
    cacheClient = CacheClient.getInstance(
      GetCacheClientOptions(applicationConfig),
    );

    cacheClient.set(cacheKey, loginResponse.data, CACHE_TTL_SECONDS);
    return loginResponse.data;
  } catch (error: any) {
    const errorMessage =
      error.response?.data?.message || error.message || "Unknown error";
    console.error(`Error logging into Mini ERP: ${errorMessage}`);
    return;
  }
}

/**
 * Fetches all products from Mini ERP by paginating through all pages
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function getProductsFromMiniErp(): Promise<boolean> {
  try {
    const loginResponse = await loginToMiniErp();
    if (!loginResponse?.access_token) {
      console.error("Failed to obtain access token from Mini ERP");
      return false;
    }

    const baseUrl = applicationConfig.MINI_ERP_BASE_URL;
    if (!baseUrl) {
      throw new Error("MINI_ERP_URL is not configured");
    }

    const productsUrl = `${baseUrl}/graphql`;
    await fetchAllMiniErpProducts(productsUrl, loginResponse.access_token);
    return true;
  } catch (error: any) {
    const errorMessage = error.message || "Unknown error";
    console.error(`Error getting products from Mini ERP: ${errorMessage}`);
    return false;
  }
}

/**
 * Fetches all products from Mini ERP by paginating through all pages
 * Seeds products to database as they are fetched (sequential approach)
 * @param requestUrl - The GraphQL endpoint URL
 * @param accessToken - Authentication token
 */
async function fetchAllMiniErpProducts(
  requestUrl: string,
  accessToken: string,
): Promise<void> {
  let page = 1;
  let hasMore = true;
  let totalProductsFetched = 0;

  while (hasMore) {
    console.log(`Fetching products from Mini ERP page ${page}`);

    try {
      const productsResponse = await axiosHelper.getProductsFromMiniErp(
        requestUrl,
        accessToken,
        { page: page, pageSize: DEFAULT_MINI_ERP_PAGE_SIZE },
      );

      if (!productsResponse?.data) {
        console.error(`Invalid response from Mini ERP for page ${page}`);
        break;
      }

      const { items, hasMore: hasMoreResponse } =
        normalizeMiniErpProductsResponse(productsResponse.data);

      if (!items || items.length === 0) {
        console.log(`No items found on page ${page}, stopping pagination`);
        break;
      }

      // Seed data to SQL table before fetching next page (sequential approach)
      try {
        await seedProductsToDatabase(items, page);
        console.log(
          `Seeded ${items.length} products from page ${page} to database`,
        );
      } catch (error: any) {
        console.error(`Error seeding page ${page} to database:`, error.message);
      }

      totalProductsFetched += items.length;

      hasMore = hasMoreResponse;
      page = hasMore ? page + 1 : page;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.errors?.[0]?.message ||
        error.message ||
        "Unknown error";
      console.error(
        `Error fetching page ${page} from Mini ERP: ${errorMessage}`,
      );
      break;
    }
  }

  console.log(
    `Completed fetching all products. Total products fetched: ${totalProductsFetched}`,
  );
}

/**
 * Normalizes the Mini ERP GraphQL response into a structured format
 * @param payload - Response data from GraphQL API
 * @returns Normalized response with items and pagination metadata
 * @throws Error if payload structure is invalid
 */
function normalizeMiniErpProductsResponse(
  payload: any,
): MiniErpNormalizedResponse {
  if (!payload?.data?.getUpdatedProductsWithOffsetPagination) {
    console.error(
      "Invalid response structure: missing getUpdatedProducts",
      payload,
    );
    throw new Error("Invalid response structure: missing getUpdatedProducts");
  }

  const { getUpdatedProductsWithOffsetPagination } = payload.data;
  const { items, hasMore } = getUpdatedProductsWithOffsetPagination;

  if (!Array.isArray(items)) {
    console.error("Invalid response structure: items is not an array", items);
    throw new Error("Invalid response structure: items is not an array");
  }

  return {
    items: items as MiniErpProduct[],
    hasMore,
  };
}

/**
 * Seeds products to the watch_list table using batch insert
 * @param products - Array of products to insert
 * @param pageNumber - Current page number for logging
 */
async function seedProductsToDatabase(
  products: MiniErpProduct[],
  pageNumber: number,
): Promise<void> {
  const waitlistItems: WaitlistModel[] = [];

  const stockDataMap = await getInventoryStockMap(products);

  // Process each product using the pre-fetched stock data
  for (const product of products) {
    if (!product?.mpid || !product?.vendorName) {
      continue;
    }

    const stockKey = `${product.mpid}_${product.vendorName}`;
    const currentStock = stockDataMap.get(stockKey);

    if (!currentStock) {
      console.warn(
        `Product ${product.mpid}/${product.vendorName} has no current stock data, skipping...`,
      );
      continue;
    }

    const repricerInventory = Number(currentStock.CurrentInventory ?? 0);
    const miniErpInventory = Number(product.quantityAvailable ?? 0);

    // Determine whether the item needs to be enqueued for net32 sync
    let targetInventory: number | null = null;

    if (repricerInventory > 0 && miniErpInventory === 0) {
      targetInventory = 0;
    } else if (repricerInventory === 0 && miniErpInventory > 0) {
      targetInventory = getRandomizedNet32Quantity(miniErpInventory);
    } else {
      console.log(
        `Product ${product.mpid}/${product.vendorName} inventory states match (repricer: ${repricerInventory}, sql: ${miniErpInventory}), skipping...`,
      );
      continue;
    }

    // create an array of watchlist models for bulk insert
    waitlistItems.push(
      new WaitlistModel(
        Number(product.mpid),
        product.vendorName,
        repricerInventory,
        miniErpInventory,
        targetInventory,
      ),
    );
  }

  if (waitlistItems.length === 0) {
    console.log(`No eligible watchlist items found for page ${pageNumber}`);
    return;
  }

  await WaitlistInsert(waitlistItems);
  console.log(
    `Inserted ${waitlistItems.length} watchlist items for page ${pageNumber}`,
  );
}

async function getInventoryStockMap(products: MiniErpProduct[]) {
  if (!products || products.length === 0) {
    return new Map<string, any>();
  }

  // Group products by vendor name to reduce database calls
  const productsByVendor = products.reduce(
    (acc, product) => {
      if (!product?.mpid || !product?.vendorName) {
        console.warn(`Skipping product due to missing identifiers`, {
          mpid: product?.mpid,
          vendorName: product?.vendorName,
        });
        return acc;
      }
      acc[product.vendorName] = [...(acc[product.vendorName] || []), product];
      return acc;
    },
    {} as Record<string, MiniErpProduct[]>,
  );

  // Create a map for quick lookup: mpid -> stock data
  const stockDataMap = new Map<
    string,
    { CurrentInStock?: number; CurrentInventory?: number }
  >();

  // Fetch stock data in batches (one call per vendor)
  for (const vendor in productsByVendor) {
    const vendorProducts = productsByVendor[vendor];
    const mpids = vendorProducts.map((product) => product.mpid);

    try {
      const currentStockResults = await GetCurrentStock(mpids, vendor);

      if (currentStockResults && Array.isArray(currentStockResults)) {
        for (const stock of currentStockResults) {
          stockDataMap.set(`${stock.mpid}_${vendor}`, {
            CurrentInStock: stock.CurrentInStock,
            CurrentInventory: stock.CurrentInventory,
          });
        }
      }
    } catch (error) {
      console.error(`Failed to load current stock for vendor ${vendor}`, error);
    }
  }

  return stockDataMap;
}

function getRandomizedNet32Quantity(sqlInventory: number): number {
  const DEFAULT_RANDOMIZATION_RANGE = { min: 5000, max: 9999 };

  const NET32_RANDOMIZATION_RULES = [
    { upperBound: 99, min: 250, max: 349 },
    { upperBound: 100, min: 350, max: 599 },
    { upperBound: 500, min: 600, max: 1999 },
    { upperBound: 1000, min: 5000, max: 9999 },
  ];

  const normalizedInventory = Math.max(0, Math.floor(sqlInventory));

  const range =
    NET32_RANDOMIZATION_RULES.find(
      (rule) => normalizedInventory <= rule.upperBound,
    ) ?? DEFAULT_RANDOMIZATION_RANGE;

  const lowerBound = Math.ceil(range.min);
  const upperBound = Math.floor(range.max);

  return Math.floor(Math.random() * (upperBound - lowerBound + 1)) + lowerBound;
}
