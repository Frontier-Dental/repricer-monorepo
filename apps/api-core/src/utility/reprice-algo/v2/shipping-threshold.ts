import { getKnexInstance } from "../../../model/sql-models/knex-wrapper";

export interface VendorThreshold {
  vendorId: number;
  standardShipping: number;
  threshold: number;
}

export async function getVendorThresholds(
  vendorIds: number[],
): Promise<VendorThreshold[]> {
  const vendors = await getKnexInstance()
    .select("*")
    .from("vendor_thresholds")
    .whereIn("vendor_id", vendorIds);

  return vendors.map((vendor) => ({
    vendorId: vendor.vendor_id,
    standardShipping: parseFloat(vendor.standard_shipping),
    threshold: parseFloat(vendor.threshold),
  }));
}
