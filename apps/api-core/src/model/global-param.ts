import * as sqlV2Service from "../utility/mysql/mysql-v2";
export async function GetInfo(mpId: any, productDet?: any) {
  const productInfo = productDet ? productDet : null;
  if (productInfo && productInfo.ownVendorId && productInfo.sisterVendorId && productInfo.ownVendorId != "N/A" && productInfo.sisterVendorId != "N/A") {
    const infoDetails = {
      VENDOR_ID: productInfo.ownVendorId,
      EXCLUDED_VENDOR_ID: productInfo.sisterVendorId,
    };
    return infoDetails;
  }
  const response = await sqlV2Service.GetGlobalConfig();

  const infoDetails = {
    VENDOR_ID: (response as any).ownVendorId,
    EXCLUDED_VENDOR_ID: (response as any).excludedSisterVendors,
  };
  return infoDetails;
}
