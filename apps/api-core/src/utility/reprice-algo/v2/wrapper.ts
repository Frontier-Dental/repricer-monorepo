import { Net32Product } from "../../../types/net32";
import { insertV2AlgoExecution } from "../../mysql/v2-algo-execution";
import { findOrCreateV2AlgoSettingsForVendors } from "../../mysql/v2-algo-settings";
import { getShippingThreshold } from "./shipping-threshold";
import { VendorName } from "./types";
import { getAllOwnVendorIds, getInternalProducts } from "./utility";
import { repriceProductV2 } from "./v2_algorithm";

export async function repriceProductV2Wrapper(
  net32Products: Net32Product[],
  prod: any,
  prioritySequence: { name: VendorName; value: string }[],
) {
  const mpId = prod.mpId;
  const internalProducts = getInternalProducts(prod, prioritySequence);

  // Get all unique vendor IDs from net32Products
  const allVendorIds = internalProducts.map((p) => p.ownVendorId);

  // Fetch or create v2_algo_settings for each vendor
  const vendorSettings = await findOrCreateV2AlgoSettingsForVendors(
    mpId,
    allVendorIds,
  );

  const v2AlgoResult = repriceProductV2(
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
  const stringRepresentation =
    v2AlgoResult.priceSolutions[0]?.solutionId.toString() ||
    "No solution found";
  await insertV2AlgoExecution({
    scrape_product_id: prod.productIdentifier,
    time: new Date(),
    chain_of_thought_html: Buffer.from(v2AlgoResult.html),
    comment: stringRepresentation,
    mp_id: prod.mpId,
  });
}
