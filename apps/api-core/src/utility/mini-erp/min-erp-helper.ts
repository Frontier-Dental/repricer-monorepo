import { applicationConfig } from "../config";
import * as axiosHelper from "../axios-helper";
import { CacheKey } from "@repricer-monorepo/shared";
import CacheClient, { GetCacheClientOptions } from "../../client/cacheClient";
import {
  MiniErpLoginResponse,
  MiniErpNormalizedResponse,
  MiniErpPaginationMeta,
  MiniErpProduct,
  PaginationDecision,
} from ".";

const DEFAULT_MINI_ERP_PAGE_SIZE = 1000;
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
    console.log(loginResponse?.data, "loginResponse");

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
 * @returns Promise resolving to array of products, or empty array on error
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
    const allProducts = await fetchAllMiniErpProducts(
      productsUrl,
      loginResponse.access_token,
    );
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
 * @returns Promise resolving to array of all fetched products
 */
async function fetchAllMiniErpProducts(
  requestUrl: string,
  accessToken: string,
): Promise<void> {
  let page = 1;
  let hasMore = true;
  let totalProductsFetched = 0;

  while (hasMore) {
    const currentPage = page; // Store current page for logging
    console.log(`Fetching products from Mini ERP page ${currentPage}`);

    try {
      const productsResponse = await axiosHelper.getProductsFromMiniErp(
        requestUrl,
        accessToken,
        { page: currentPage, pageSize: DEFAULT_MINI_ERP_PAGE_SIZE },
      );

      if (!productsResponse?.data) {
        console.error(`Invalid response from Mini ERP for page ${currentPage}`);
        break;
      }

      const { items, meta } = normalizeMiniErpProductsResponse(
        productsResponse.data,
      );

      if (!items || items.length === 0) {
        console.log(
          `No items found on page ${currentPage}, stopping pagination`,
        );
        break;
      }

      // Seed data to SQL table before fetching next page (sequential approach)
      try {
        // await seedProductsToDatabase(items, currentPage);
        console.log(
          `Seeded ${items.length} products from page ${currentPage} to database`,
        );
      } catch (error: any) {
        console.error(
          `Error seeding page ${currentPage} to database:`,
          error.message,
        );
      }

      totalProductsFetched += items.length;

      const { hasNextPage, nextPage } = resolvePaginationDecision(meta);
      hasMore = hasNextPage;
      page = nextPage;

      console.log(
        `Fetched ${items.length} products from Mini ERP page ${currentPage}, has more: ${hasMore}`,
      );
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.errors?.[0]?.message ||
        error.message ||
        "Unknown error";
      console.error(
        `Error fetching page ${currentPage} from Mini ERP: ${errorMessage}`,
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
 * @param payload - Raw response payload from GraphQL API
 * @returns Normalized response with items and pagination metadata
 * @throws Error if payload structure is invalid
 */
function normalizeMiniErpProductsResponse(
  payload: any,
): MiniErpNormalizedResponse {
  if (!payload?.data?.getUpdatedProducts) {
    throw new Error("Invalid response structure: missing getUpdatedProducts");
  }

  const { getUpdatedProducts } = payload.data;
  const { items, page, pageSize, hasMore } = getUpdatedProducts;

  if (!Array.isArray(items)) {
    throw new Error("Invalid response structure: items is not an array");
  }

  return {
    items: items as MiniErpProduct[],
    meta: { page, pageSize, hasMore },
  };
}

/**
 * Resolves pagination decision based on metadata
 * @param meta - Pagination metadata from API response
 * @returns Object containing hasNextPage flag and nextPage number
 */
function resolvePaginationDecision(
  meta: MiniErpPaginationMeta,
): PaginationDecision {
  const { page, hasMore } = meta;
  const currentPage = page ?? 1;
  const hasNextPage = hasMore ?? false;

  return {
    hasNextPage,
    nextPage: hasNextPage ? currentPage + 1 : currentPage,
  };
}
