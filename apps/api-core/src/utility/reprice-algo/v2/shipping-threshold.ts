import { getKnexInstance } from "../../../model/sql-models/knex-wrapper";

export interface VendorThreshold {
  vendorId: number;
  standardShipping: number;
  threshold: number;
}

export async function getShippingThreshold(vendorId: number) {
  const vendor = await getKnexInstance()
    .select("*")
    .from("vendor_thresholds")
    .where("vendor_id", vendorId)
    .first();
  if (!vendor) {
    throw new Error(`Vendor ${vendorId} not found`);
  }
  return parseFloat(vendor.threshold);
}

export async function getShippingCost(vendorId: number) {
  const vendor = await getKnexInstance()
    .select("*")
    .from("vendor_thresholds")
    .where("vendor_id", vendorId)
    .first();
  if (!vendor) {
    throw new Error(`Vendor ${vendorId} not found`);
  }
  return parseFloat(vendor.standard_shipping);
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
