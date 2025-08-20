import { AxiosError, AxiosRequestConfig } from "axios";
import moment from "moment";
import { Net32Product } from "../../../types/net32";
import { applicationConfig } from "../../config";
import { findTinyproxyConfigsByVendorIds } from "../../mysql/tinyproxy-configs";
import { insertV2AlgoExecution } from "../../mysql/v2-algo-execution";
import { insertMultipleV2AlgoResults } from "../../mysql/v2-algo-results";
import { findOrCreateV2AlgoSettingsForVendors } from "../../mysql/v2-algo-settings";
import { insertV2AlgoError } from "../../mysql/v2-algo-error";
import { updateProductInfo } from "../../net32/reprice";
import {
  Net32AlgoSolution,
  Net32AlgoSolutionWithChangeResult,
  Net32AlgoSolutionWithQBreakValid,
  repriceProductV2,
} from "./algorithm";
import { getShippingThreshold } from "./shipping-threshold";
import { ChangeResult, VendorName } from "./types";
import {
  getAllOwnVendorIds,
  getInternalProducts,
  isChangeResult,
} from "./utility";
import { v4 } from "uuid";

export async function repriceProductV2Wrapper(
  net32Products: Net32Product[],
  prod: any,
  vendorNameList: { name: VendorName }[],
  cronName: string,
) {
  const jobId = v4();
  const mpId = prod.mpId;
  try {
    const internalProducts = getInternalProducts(prod, vendorNameList);

    if (internalProducts.length === 0) {
      console.log(`No vendors configured found for product ${prod.mpId}`);
      return;
    }
    // Get all unique vendor IDs from net32Products
    const allVendorIds = internalProducts.map((p) => p.ownVendorId);

    // Fetch or create v2_algo_settings for each vendor
    const vendorSettings = await findOrCreateV2AlgoSettingsForVendors(
      mpId,
      allVendorIds,
    );

    const solutionResults = repriceProductV2(
      prod.mpId,
      net32Products.map((p) => ({
        ...p,
        vendorId: parseInt(p.vendorId as string),
        freeShippingThreshold: getShippingThreshold(
          parseInt(p.vendorId as string),
        ),
      })),
      internalProducts,
      getAllOwnVendorIds(),
      vendorSettings,
      jobId,
    );

    const uniqueVendorIds = [
      ...new Set(solutionResults.map((s) => s.vendor.vendorId)),
    ];

    const finalResults = await updatePricesIfNecessary(
      solutionResults,
      prod.vpCode,
      applicationConfig.IS_DEV,
    );

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
      run_time: moment().toDate(),
      q_break_valid: result.qBreakValid,
      price_update_result: result.changeResult,
    }));

    await insertMultipleV2AlgoResults(algoResults);

    // We only need to store one html file per vendor, not per quantity.
    await Promise.all(
      uniqueVendorIds.map(async (vendorId) => {
        const result = solutionResults.find(
          (s) => s.vendor.vendorId === vendorId,
        );
        if (!result) {
          throw new Error(`No result found for vendor ${vendorId}`);
        }
        await insertV2AlgoExecution({
          scrape_product_id: prod.productIdentifier,
          created_at: moment().toDate(),
          expires_at: moment()
            .utc()
            .add(applicationConfig.V2_ALGO_HTML_FILE_EXPIRY_HOURS, "hours")
            .toDate(),
          chain_of_thought_html: Buffer.from(result.html),
          mp_id: prod.mpId,
          vendor_id: result.vendor.vendorId,
          job_id: jobId,
        });
      }),
    );

    console.log(`Algorithm execution completed with job ID: ${jobId}`);
    return finalResults;
  } catch (error) {
    console.error(
      `Error executing repriceProductV2Wrapper for job ${jobId}:`,
      error,
    );

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    await insertV2AlgoError({
      error_message: errorMessage + (errorStack ? `\n${errorStack}` : ""),
      net32_products: net32Products,
      mp_id: mpId,
      cron_name: cronName,
      created_at: new Date(),
    });
  }
}

function priceIsWithinBounariesSafeguard(solution: Net32AlgoSolution) {
  if (!solution.vendor.bestPrice) {
    throw new Error(
      `No best price found for vendor when considering final price boundaries check.` +
        `We should not get here.`,
    );
  }
  if (
    solution.vendor.bestPrice.toNumber() >=
      solution.vendorSettings.floor_price &&
    solution.vendor.bestPrice.toNumber() <= solution.vendorSettings.max_price
  ) {
    return true;
  } else {
    throw new Error(
      `Price is outside of boundaries for vendor ${solution.vendor.vendorId}.` +
        `Proposed price: ${solution.vendor.bestPrice.toNumber()},` +
        `Floor: ${solution.vendorSettings.floor_price},` +
        `Max: ${solution.vendorSettings.max_price}. We should not get here.`,
    );
  }
}

function isLowestExecutionPriority(
  solution: Net32AlgoSolution,
  allSolutions: Net32AlgoSolution[],
) {
  const minimumExecutionPriority = Math.min(
    ...allSolutions.map((sol) => sol.vendorSettings.execution_priority),
  );
  return (
    solution.vendorSettings.execution_priority === minimumExecutionPriority
  );
}

async function updatePricesIfNecessary(
  solutionResults: Net32AlgoSolutionWithQBreakValid[],
  vpCode: string,
  isDev: boolean,
): Promise<Net32AlgoSolutionWithChangeResult[]> {
  const validSolutionsWithChanges = solutionResults
    .filter((s) => isChangeResult(s.algoResult))
    .filter((s) => s.qBreakValid)
    .filter((s) => s.vendor.bestPrice !== undefined)
    .filter(priceIsWithinBounariesSafeguard);

  const solutionVendorIds = [
    ...new Set(validSolutionsWithChanges.map((s) => s.vendor.vendorId)),
  ];

  const proxyConfigs = await findTinyproxyConfigsByVendorIds(solutionVendorIds);

  const results = await Promise.all(
    solutionVendorIds.map(async (vendorId) => {
      const updatesForVendor = validSolutionsWithChanges.filter(
        (s) => s.vendor.vendorId === vendorId,
      );
      if (updatesForVendor.length === 0) {
        throw new Error(
          `No solution found for vendor ${vendorId}. We should not get here.`,
        );
      }

      const proxyConfig = proxyConfigs.find(
        (config) => config.vendor_id === vendorId,
      );

      if (!proxyConfig) {
        throw new Error(`No proxy configuration found for vendor ${vendorId}`);
      }

      // Just pick the first quantity for this vendor as all the settings will be the same
      const hasExecutionPriority = isLowestExecutionPriority(
        updatesForVendor[0],
        solutionResults,
      );

      try {
        // Create axios config with proxy settings
        const axiosConfig: AxiosRequestConfig = {
          proxy: {
            host: proxyConfig.ip,
            port: proxyConfig.port,
            protocol: "http",
            auth: {
              username: proxyConfig.proxy_username,
              password: proxyConfig.proxy_password,
            },
          },
        };

        const priceList = updatesForVendor.map((s) => ({
          minQty: s.quantity,
          price: s.vendor.bestPrice!.toNumber(),
          activeCd: 1, // Active
        }));
        console.log("Price changes in net32 format: ", priceList);

        if (isDev) {
          console.log("We are in dev mode, not executing actual change.");
        }

        if (hasExecutionPriority && !isDev) {
          // Execute the price update
          await updateProductInfo(
            proxyConfig.subscription_key,
            {
              vpCode: vpCode, // Assuming this is the vendor product code
              priceList,
            },
            axiosConfig,
          );
          console.log(`Successfully updated price for vendor ${vendorId}`);
          return { vendorId, changeResult: ChangeResult.OK };
        } else {
          return {
            vendorId,
            changeResult: ChangeResult.NOT_EXECUTION_PRIORITY,
          };
        }
      } catch (error) {
        if (error instanceof AxiosError && error.response?.status === 422) {
          return { vendorId, changeResult: ChangeResult.ERROR_422 };
        }
        console.error(`Failed to update price for vendor ${vendorId}:`, error);
        return { vendorId, changeResult: ChangeResult.UNKNOWN_ERROR };
      }
    }),
  );
  return solutionResults.map((s) => {
    const changeResult = results.find(
      (r) => r.vendorId === s.vendor.vendorId,
    )?.changeResult;
    return {
      ...s,
      changeResult: changeResult ?? null,
    };
  });
}
