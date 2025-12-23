import { AlgoExecutionMode, VendorNameLookup } from "@repricer-monorepo/shared";
import axios, { AxiosError } from "axios";
import moment from "moment";
import { v4 } from "uuid";
import { calculateNextCronTime } from "../../../controller/main-cron/shared";
import { ErrorItemModel } from "../../../model/error-item";
import { Net32Product } from "../../../types/net32";
import { applicationConfig } from "../../config";
import * as mongoHelper from "../../mongo/db-helper";
import { getNet32UrlById } from "../../mysql/mysql-helper";
import { findTinyProxyConfigsByVendorIds } from "../../mysql/tinyproxy-configs";
import { insertV2AlgoError } from "../../mysql/v2-algo-error";
import { insertV2AlgoExecution } from "../../mysql/v2-algo-execution";
import { insertMultipleV2AlgoResults } from "../../mysql/v2-algo-results";
import { findOrCreateV2AlgoSettingsForVendors } from "../../mysql/v2-algo-settings";
import { Net32AlgoSolution, Net32AlgoSolutionWithChangeResult, Net32AlgoSolutionWithQBreakValid, repriceProductV2 } from "./algorithm";
import { getVendorThresholds } from "./shipping-threshold";
import { AlgoResult, ChangeResult } from "./types";
import { getAllOwnVendorIds, getPriceListFormatted, isChangeResult } from "./utility";
import { GetCronSettingsDetailsByName, GetCronSettingsDetailsById } from "../../../utility/mysql/mysql-v2";
// Custom proxy function for Net32 API calls
async function updateProductInfoWithCustomProxy(
  proxyConfig: any,
  subscriptionKey: string,
  data: {
    mpid: number;
    priceList: {
      minQty: number;
      activeCd: number;
      price?: number;
    }[];
  }
  // subscriptionKey: string
): Promise<any> {
  const PROXY_URL = `http://${proxyConfig.ip}:${proxyConfig.port}`;
  const USERNAME = proxyConfig.proxy_username;
  const PASSWORD = proxyConfig.proxy_password;

  const targetUrl = "https://api.net32.com/products/offers/update";

  console.log("=== CUSTOM PROXY REQUEST ===");
  console.log("Proxy URL:", PROXY_URL);
  console.log("Target URL:", targetUrl);
  // console.log("Username:", USERNAME);
  // console.log("Subscription Key:", subscriptionKey);
  // console.log("Request Data:", JSON.stringify(data, null, 2));
  // console.log("=============================");

  const postResponse = await axios.post(
    `${PROXY_URL}/proxy`,
    {
      url: targetUrl,
      method: "POST",
      data: data,
      headers: {
        "Content-Type": "application/json",
        "Subscription-Key": subscriptionKey,
      },
    },
    {
      auth: { username: USERNAME, password: PASSWORD },
      headers: { "Content-Type": "application/json" },
      timeout: 30000,
    }
  );

  console.log("=== CUSTOM PROXY RESPONSE ===");
  console.log("Status:", postResponse.status);
  console.log("Response Data:", JSON.stringify(postResponse.data, null, 2));
  console.log("==============================");

  if (postResponse.data.statusCode !== 200) {
    throw new Error(`Failed to update price for vendor ${proxyConfig.vendor_id}: ${postResponse.data}. Code: ${postResponse.data.statusCode}`);
  }

  return postResponse.data;
}

export async function repriceProductV2Wrapper(net32Products: Net32Product[], prod: any, cronName: string, isSlowCron: boolean, contextCronId?: string) {
  const jobId = v4();
  const mpId = prod.mpId;
  try {
    const active422CronItems = await mongoHelper.GetErrorItemsByMpId(prod.mpId);
    const ownVendorIds = getAllOwnVendorIds();
    const availableVendorIds = ownVendorIds.filter((id) => !active422CronItems.some((item) => item.vendorName === VendorNameLookup[id]));

    const net32Url = await getNet32UrlById(prod.mpId);

    // Fetch or create v2_algo_settings for each vendor
    const vendorSettings = await findOrCreateV2AlgoSettingsForVendors(mpId, ownVendorIds);

    const vendorThresholds = await getVendorThresholds(net32Products.map((p) => parseInt(p.vendorId as string)));

    const algoProducts = net32Products.map((p) => {
      const vendorThreshold = vendorThresholds.find((v) => v.vendorId === parseInt(p.vendorId as string));
      if (!vendorThreshold) {
        throw new Error(`Vendor shipping threshold not found for vendor ${p.vendorId}`);
      }
      return {
        ...p,
        vendorId: parseInt(p.vendorId as string),
        freeShippingThreshold: vendorThreshold.threshold,
      };
    });

    const solutionResults = repriceProductV2(prod.mpId, algoProducts, availableVendorIds, getAllOwnVendorIds(), vendorSettings, jobId, isSlowCron, net32Url, vendorThresholds);

    const uniqueVendorIds = [...new Set(solutionResults.map((s) => s.vendor.vendorId))];

    const finalResults = await updatePricesIfNecessary(solutionResults, prod.mpId, applicationConfig.IS_DEV, prod.algo_execution_mode, cronName, contextCronId);

    if (finalResults.length === 0) {
      console.log(`No solutions found for product ${prod.mpId}`);
      return [];
    }

    // Store algorithm results in the new v2_algo_results table
    const algoResults = finalResults.map((result) => ({
      job_id: jobId,
      suggested_price: result.suggestedPrice,
      comment: result.comment,
      triggered_by_vendor: result.triggeredByVendor,
      result: result.algoResult,
      quantity: result.quantity,
      vendor_id: result.vendor.vendorId,
      mp_id: mpId,
      cron_name: cronName,
      q_break_valid: result.qBreakValid,
      price_update_result: result.changeResult,
      new_price_breaks: result.priceList ? getPriceListFormatted(result.priceList) : null,
      lowest_price: result.lowestPrice,
      lowest_vendor_id: result.lowestVendorId,
    }));

    await insertMultipleV2AlgoResults(algoResults);

    // We only need to store one html file per vendor, not per quantity.
    await Promise.all(
      uniqueVendorIds.map(async (vendorId) => {
        const result = solutionResults.find((s) => s.vendor.vendorId === vendorId);
        if (!result) {
          throw new Error(`No result found for vendor ${vendorId}`);
        }
        await insertV2AlgoExecution({
          scrape_product_id: prod.productIdentifier,
          created_at: moment().toDate(),
          expires_at: moment().utc().add(applicationConfig.V2_ALGO_HTML_FILE_EXPIRY_HOURS, "hours").toDate(),
          chain_of_thought_html: Buffer.from(result.html),
          mp_id: prod.mpId,
          vendor_id: result.vendor.vendorId,
          job_id: jobId,
        });
      })
    );

    for (const uniqueVendorId of uniqueVendorIds) {
      const changeApplied = finalResults.find((r) => r.vendor.vendorId === uniqueVendorId && r.changeResult === ChangeResult.OK);
      const vendorName = VendorNameLookup[uniqueVendorId];
      if (changeApplied) {
        // Add the product to Error Item Table and update nextCronTime as +12 Hrs
        const priceUpdatedItem = new ErrorItemModel(prod.mpId!, calculateNextCronTime(new Date(), 12), true, prod.cronId!, "PRICE_UPDATE", vendorName);
        await mongoHelper.UpsertErrorItemLog(priceUpdatedItem);
        console.log({
          message: `V2 Algo: ${prod.mpId} moved to ${applicationConfig.CRON_NAME_422}`,
          obj: JSON.stringify(priceUpdatedItem),
        });
      }
    }

    return finalResults;
  } catch (error) {
    console.error(`Error executing repriceProductV2Wrapper for job ${jobId}:`, error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    await insertV2AlgoError({
      error_message: errorMessage + (errorStack ? `\n${errorStack}` : ""),
      net32_products: net32Products,
      mp_id: mpId,
      cron_name: cronName,
      created_at: new Date(),
    });
  } finally {
    console.log(`Algorithm execution completed with job ID: ${jobId}`);
  }
}

export async function updatePrice(proxyConfig: any, subscriptionKey: string, payload: any) {
  const PROXY_URL = `http://${proxyConfig.ip}:${proxyConfig.port}`;
  const USERNAME = proxyConfig.proxy_username;
  const PASSWORD = proxyConfig.proxy_password;

  const targetUrl = "https://api.net32.com/products/offers/update";

  console.log("=== CUSTOM PROXY REQUEST ===");
  console.log("Proxy URL:", PROXY_URL);
  console.log("Target URL:", targetUrl);
  console.log("Username:", USERNAME);
  // console.log("Subscription Key:", subscriptionKey);
  // console.log("Request Data:", JSON.stringify(payload, null, 2));
  console.log("=============================");

  const postResponse = await axios.post(
    `${PROXY_URL}/proxy`,
    {
      url: targetUrl,
      method: "POST",
      data: payload,
      headers: {
        "Content-Type": "application/json",
        "Subscription-Key": subscriptionKey,
      },
    },
    {
      auth: { username: USERNAME, password: PASSWORD },
      headers: { "Content-Type": "application/json" },
      timeout: 30000,
    }
  );

  console.log("=== CUSTOM PROXY RESPONSE ===");
  console.log("Status:", postResponse.status);
  console.log("Response Data:", JSON.stringify(postResponse.data));
  console.log("==============================");

  if (postResponse.data.statusCode !== 200) {
    return { data: { status: false, message: `ERROR:${postResponse.data.statusCode}:Sorry some error occurred! Exception : ${postResponse.data.data.message}` } };
  }
  return { data: { status: true, message: postResponse.data.data.message } };
}

function priceIsWithinBounariesSafeguard(solution: Net32AlgoSolution) {
  if (!solution.vendor.bestPrice) {
    throw new Error(`No best price found for vendor when considering final price boundaries check.` + `We should not get here.`);
  }
  if (solution.vendor.bestPrice.gte(solution.vendorSettings.floor_price) && solution.vendor.bestPrice.lte(solution.vendorSettings.max_price)) {
    return true;
  } else {
    throw new Error(`Price is outside of boundaries for vendor ${solution.vendor.vendorId}.` + `Proposed price: ${solution.vendor.bestPrice.toNumber()},` + `Floor: ${solution.vendorSettings.floor_price},` + `Max: ${solution.vendorSettings.max_price}. We should not get here.`);
  }
}

function isLowestExecutionPriority(solution: Net32AlgoSolution, allSolutions: Net32AlgoSolution[]) {
  const minimumExecutionPriority = Math.min(...allSolutions.map((sol) => sol.vendorSettings.execution_priority));
  return solution.vendorSettings.execution_priority === minimumExecutionPriority;
}

async function updatePricesIfNecessary(solutionResults: Net32AlgoSolutionWithQBreakValid[], mpId: number, isDev: boolean, algo_execution_mode: AlgoExecutionMode, cronName: string, contextCronId?: string): Promise<Net32AlgoSolutionWithChangeResult[]> {
  const validSolutionsWithChanges = solutionResults
    .filter((s) => isChangeResult(s.algoResult))
    .filter((s) => s.qBreakValid)
    .filter((s) => s.vendor.bestPrice !== undefined)
    .filter(priceIsWithinBounariesSafeguard);

  const invalidQBreaks = solutionResults.filter((s) => s.qBreakValid === false);

  const solutionVendorIds = [...new Set(validSolutionsWithChanges.map((s) => s.vendor.vendorId))];

  const proxyConfigs = await findTinyProxyConfigsByVendorIds(solutionVendorIds);

  const settings = cronName === "MANUAL" && contextCronId ? await GetCronSettingsDetailsById(contextCronId) : await GetCronSettingsDetailsByName(cronName);

  if (!settings) {
    throw new Error(`No settings found for cron name ${cronName} and context cron id ${contextCronId}`);
  }

  const results = await Promise.all(
    solutionVendorIds.map(async (vendorId) => {
      const updatesForVendor = validSolutionsWithChanges.filter((s) => s.vendor.vendorId === vendorId);
      if (updatesForVendor.length === 0) {
        throw new Error(`No solution found for vendor ${vendorId}. We should not get here.`);
      }

      const subscriptionKey = settings.SecretKey.find((s: any) => s.vendorName === VendorNameLookup[vendorId])?.secretKey;

      if (!subscriptionKey) {
        throw new Error(`No subscription key found for vendor ${vendorId}`);
      }

      const existingQuantityBreaksBeforeChange = updatesForVendor[0].vendor.priceBreaks;

      const invalidQBreaksForVendor = invalidQBreaks.filter((s) => s.vendor.vendorId === vendorId);

      const invalidQBreaksToRemove = existingQuantityBreaksBeforeChange.filter((s) => invalidQBreaksForVendor.some((v) => v.quantity === s.minQty));

      const proxyConfig = proxyConfigs.find((config) => config.vendor_id === vendorId);

      if (!proxyConfig) {
        throw new Error(`No proxy configuration found for vendor ${vendorId}`);
      }

      // Just pick the first quantity for this vendor as all the settings will be the same
      const hasExecutionPriority = isLowestExecutionPriority(updatesForVendor[0], validSolutionsWithChanges);

      const newlyValidQbreaks = updatesForVendor.map((s) => ({
        minQty: s.quantity,
        price: s.vendor.bestPrice!.toNumber(),
        activeCd: 1,
      }));

      const newlyInvalidQBreaks = invalidQBreaksToRemove.map((q) => ({
        minQty: q.minQty,
        activeCd: 0,
      }));

      const qBreakDelta: {
        minQty: number;
        activeCd: number;
        price?: number;
      }[] = [...newlyValidQbreaks, ...newlyInvalidQBreaks];

      try {
        console.log("Price changes in net32 format: ", qBreakDelta);

        if (isDev) {
          console.log("We are in dev mode, not executing actual change.");
        }

        const priceChangeAllowed = algo_execution_mode === AlgoExecutionMode.V2_ONLY || algo_execution_mode === AlgoExecutionMode.V2_EXECUTE_V1_DRY;

        if (hasExecutionPriority && !isDev && priceChangeAllowed) {
          // Execute the price update using custom proxy
          await updateProductInfoWithCustomProxy(proxyConfig, subscriptionKey, {
            mpid: mpId, // Assuming this is the vendor product code
            priceList: qBreakDelta,
          });
          console.log(`Successfully updated price for vendor ${vendorId}`);
          return {
            vendorId,
            changeResult: ChangeResult.OK,
            priceList: qBreakDelta,
          };
        } else if (hasExecutionPriority && !isDev && !priceChangeAllowed) {
          return {
            vendorId,
            changeResult: ChangeResult.CHANGE_PREVENTED_V2_DISABLED,
            priceList: qBreakDelta,
          };
        } else if (hasExecutionPriority && isDev) {
          return {
            vendorId,
            changeResult: ChangeResult.CHANGE_PREVENTED_DEV,
            priceList: qBreakDelta,
          };
        } else {
          return {
            vendorId,
            changeResult: ChangeResult.NOT_EXECUTION_PRIORITY,
            priceList: qBreakDelta,
          };
        }
      } catch (error) {
        if (error instanceof AxiosError && error.response?.status === 422) {
          return {
            vendorId,
            changeResult: ChangeResult.ERROR_422,
            priceList: qBreakDelta,
          };
        }
        console.error(`Failed to update price for vendor ${vendorId}:`, error);
        return {
          vendorId,
          changeResult: ChangeResult.UNKNOWN_ERROR,
          priceList: qBreakDelta,
        };
      }
    })
  );
  return solutionResults.map((s) => {
    const changeResult = results.find((r) => r.vendorId === s.vendor.vendorId);
    const newlyInactiveQBreak = changeResult?.priceList?.find((q) => q.minQty === s.quantity && q.activeCd === 0);
    return {
      ...s,
      changeResult: changeResult ? changeResult.changeResult : null,
      priceList: changeResult ? changeResult.priceList : null,
      algoResult: newlyInactiveQBreak ? AlgoResult.CHANGE_REMOVED : s.algoResult,
    };
  });
}
