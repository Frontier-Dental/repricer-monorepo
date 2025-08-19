import { Net32Product } from "../../../types/net32";
import { insertV2AlgoExecution } from "../../mysql/v2-algo-execution";
import { findOrCreateV2AlgoSettingsForVendors } from "../../mysql/v2-algo-settings";
import { findTinyproxyConfigsByVendorIds } from "../../mysql/tinyproxy-configs";
import { getShippingThreshold } from "./shipping-threshold";
import { Net32PriceUpdateResult, VendorName } from "./types";
import {
  getAllOwnVendorIds,
  getInternalProducts,
  isChangeResult,
} from "./utility";
import { Net32AlgoSolutionWithResult, repriceProductV2 } from "./algorithm";
import { updateProductInfo } from "../../net32/reprice";
import { applicationConfig } from "../../config";
import { AxiosError } from "axios";
import moment from "moment";

export async function repriceProductV2Wrapper(
  net32Products: Net32Product[],
  prod: any,
  vendorNameList: { name: VendorName }[],
) {
  const mpId = prod.mpId;
  const internalProducts = getInternalProducts(prod, vendorNameList);

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
  );

  const uniqueVendorIds = [
    ...new Set(solutionResults.map((s) => s.vendor.vendorId)),
  ];
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
      });
    }),
  );

  return updatePricesIfNecessary(
    solutionResults,
    prod.vpCode,
    applicationConfig.IS_DEV,
  );
}

async function updatePricesIfNecessary(
  solutionResults: Net32AlgoSolutionWithResult[],
  vpCode: string,
  isDev: boolean,
) {
  // Execute price updates using the correct proxy configuration for each vendor
  // Get unique vendor IDs from the final solution
  const solutionVendorIds = [
    ...new Set(solutionResults.map((s) => s.vendor.vendorId)),
  ];

  // Fetch proxy configs for all vendors in the solution
  const proxyConfigs = await findTinyproxyConfigsByVendorIds(solutionVendorIds);

  const results = await Promise.all(
    solutionVendorIds.map(async (vendorId) => {
      const updatesForVendor = solutionResults
        .filter((s) => s.vendor.vendorId === vendorId)
        .filter((s) => isChangeResult(s.result))
        .filter((s) => s.vendor.bestPrice !== undefined);
      if (!updatesForVendor) {
        throw new Error(`No solution found for vendor ${vendorId}`);
      }

      const proxyConfig = proxyConfigs.find(
        (config) => config.vendor_id === vendorId,
      );

      if (!proxyConfig) {
        throw new Error(`No proxy configuration found for vendor ${vendorId}`);
      }

      try {
        // Create axios config with proxy settings
        const axiosConfig = {
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
        console.log("Price changes: ", priceList);

        if (isDev) {
          console.log("We are in dev mode, not executing actual change.");
        } else {
          // Execute the price update
          await updateProductInfo(
            proxyConfig.subscription_key,
            {
              vpCode: vpCode, // Assuming this is the vendor product code
              priceList,
            },
            axiosConfig,
          );
        }

        console.log(`Successfully updated price for vendor ${vendorId}`);
        return { vendorId, updateResult: Net32PriceUpdateResult.OK };
      } catch (error) {
        if (error instanceof AxiosError && error.response?.status === 422) {
          return { vendorId, updateResult: Net32PriceUpdateResult.ERROR_422 };
        }
        console.error(`Failed to update price for vendor ${vendorId}:`, error);
        return { vendorId, updateResult: Net32PriceUpdateResult.UNKNOWN_ERROR };
        // You might want to log this failure or handle it appropriately
      }
    }),
  );
  return solutionResults.map((s) => ({
    ...s,
    priceUpdateResult: results.find((r) => r.vendorId === s.vendor.vendorId),
  }));
}
