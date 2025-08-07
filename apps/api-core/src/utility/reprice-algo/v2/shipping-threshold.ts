import vendorShippingData from "./vendor-shipping.json";

export function getShippingThreshold(vendorId: number) {
  const vendor = vendorShippingData.find((v) => v.vendorId === vendorId);
  if (!vendor) {
    throw new Error(`Vendor ${vendorId} not found`);
  }
  return vendor.freeShippingThreshold;
}

export function getShippingCost(vendorId: number) {
  const vendor = vendorShippingData.find((v) => v.vendorId === vendorId);
  if (!vendor) {
    throw new Error(`Vendor ${vendorId} not found`);
  }
  return vendor.standardShipping;
}
