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
import { delay } from "../utility/reprice-algo/v1/shared";

export async function updateNet32Stock(): Promise<boolean> {
  console.log(`Running net32 stock update cron at ${new Date()}`);
  const items: WaitlistModel[] = await GetWaitlistPendingItems();
  console.log(
    `Found ${items.length} items in waitlist to update in net32 stock`,
  );
  for (const item of items) {
    console.log(
      `Updating net32 stock for item ${item.mp_id} ${item.vendor_name} ${item.net32_inventory}`,
    );
    const vendorData: VendorData = {
      vendor: item.vendor_name.toLowerCase(),
      quantity: item.net32_inventory,
    };
    const updateProductQuantityRequest: UpdateProductQuantityRequest = {
      mpid: item.mp_id,
      vendorData: [vendorData],
    };
    await delay(3); // delay to avoid rate limiting
    const results = await processUpdateProductQuantities(
      updateProductQuantityRequest,
    );
    console.log(
      `Net32 stock update status for item: ${item.mp_id} vendor: ${item.vendor_name} net32_inventory: ${item.net32_inventory} results: ${JSON.stringify(results[0])}`,
    );
    if (results[0].success) {
      await UpdateWaitlistStatus(item.id!, "success");
      await UpdateVendorStock(item.vendor_name, item.mp_id, item.new_inventory);
    } else {
      console.error(
        "Failed to update net32 stock for item",
        item,
        results[0]?.data?.message,
      );
      await UpdateWaitlistStatus(item.id!, "failed", results[0]?.data?.message);
    }
  }
  return true;
}
