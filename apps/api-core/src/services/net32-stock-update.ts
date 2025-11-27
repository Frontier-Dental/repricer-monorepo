import { schedule, ScheduledTask } from "node-cron";
import { applicationConfig } from "../utility/config";
import { getProductsFromMiniErp } from "../utility/mini-erp/min-erp-helper";
import {
  GetWaitlistPendingItems,
  UpdateVendorStock,
  UpdateWaitlistStatus,
} from "../utility/mysql/mysql-helper";
import {
  processUpdateProductQuantities,
  UpdateProductQuantityRequest,
  VendorData,
} from "../utility/net32/updateProductQuantity";
import { WaitlistModel } from "../model/waitlist-model";

let fetchProductsFromMiniErpCron: ScheduledTask | null = null;
let net32StockUpdateCron: ScheduledTask | null = null;

/**
 * Starts the net32 stock update crons
 */
export function startNet32StockUpdateCrons(): void {
  console.log("Starting net32 stock update crons at", new Date());
  if (net32StockUpdateCron) {
    console.log("Stock update cron is already running");
    return;
  }

  if (fetchProductsFromMiniErpCron) {
    console.log("Fetch products from mini erp cron is already running");
    return;
  }
}

fetchProductsFromMiniErpCron = schedule(
  applicationConfig.MINI_ERP_DATA_CRON_EXP,
  async () => {
    try {
      console.log("Fetching products from mini erp");
      const success = await getProductsFromMiniErp();
      if (!success) {
        console.error("Failed to fetch products from mini erp");
      }
    } catch (error: any) {
      const errorMessage = error.message || "Unknown error";
      console.error(`Error fetching products from mini erp: ${errorMessage}`);
    }
  },
);

net32StockUpdateCron = schedule(
  applicationConfig.STOCK_UPDATE_CRON_EXP,
  async () => {
    console.log("Updating net32 stock");
    const success = await updateNet32Stock();
    if (!success) {
      console.error("Failed to update net32 stock");
    }
  },
);

async function updateNet32Stock(): Promise<boolean> {
  console.log("Updating net32 stock");
  //get items from waitlist table where status is pending
  const items: WaitlistModel[] = await GetWaitlistPendingItems();
  for (const item of items) {
    console.log("Updating net32 stock for item", item);
    const vendorData: VendorData = {
      vendor: item.vendor_name.toLowerCase(),
      quantity: item.net32_inventory,
    };
    const updateProductQuantityRequest: UpdateProductQuantityRequest = {
      mpid: item.mp_id,
      vendorData: [vendorData],
    };
    const results = await processUpdateProductQuantities(
      updateProductQuantityRequest,
    );
    console.log("Results for item", item, results[0]);
    if (results[0].success) {
      console.log("Successfully updated net32 stock for item", item);
      await UpdateWaitlistStatus(item.id!, "success");
      await UpdateVendorStock(item.vendor_name, item.mp_id, item.new_inventory);
    } else {
      console.error("Failed to update net32 stock for item", item);
      await UpdateWaitlistStatus(item.id!, "failed", results[0]?.data?.message);
    }
  }
  return true;
}
