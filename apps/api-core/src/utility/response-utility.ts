import _ from "lodash";
import * as globalParam from "../model/global-param";
import { FrontierProduct } from "../types/frontier";
import { Net32Product } from "../types/net32";

export function FilterActiveResponse(payload: Net32Product[], productItem: FrontierProduct): Net32Product[] {
  let returnPayload = [...payload];

  // Remove inactive products unless includeInactiveVendors is true
  if (!productItem || !productItem.includeInactiveVendors) {
    returnPayload = returnPayload.filter((p) => p.inStock !== false);
  } else if (productItem.includeInactiveVendors === true) {
    // If includeInactiveVendors is true, add one inactive vendor if specified
    const allRecords = [...returnPayload];
    returnPayload = returnPayload.filter((p) => p.inStock !== false);
    if (productItem.inactiveVendorId) {
      const inactiveVendorsIds = productItem.inactiveVendorId.split(";");
      // Find all inactive products
      const inactiveProducts = allRecords.filter((p) => p.inStock === false);
      // Filter for those with matching vendorId
      const tempFilterRes = inactiveProducts.filter((p) => inactiveVendorsIds.includes(p.vendorId.toString()));
      // Sort by unitPrice for minQty 1 and active
      const sortedPayload = tempFilterRes.sort((a, b) => {
        const aPrice = a.priceBreaks.find((x) => x.minQty === 1 && x.active === true)?.unitPrice ?? Infinity;
        const bPrice = b.priceBreaks.find((x) => x.minQty === 1 && x.active === true)?.unitPrice ?? Infinity;
        return aPrice - bPrice;
      });
      if (sortedPayload.length > 0) {
        returnPayload.push(sortedPayload[0]);
      }
    }
  }
  // Remove backordered products
  returnPayload = returnPayload.filter((p) => !p.isBackordered);
  return returnPayload;
}

export async function GetOwnProduct(products: Net32Product[], frontierProduct: FrontierProduct): Promise<Net32Product | undefined> {
  const $ = await globalParam.GetInfo(frontierProduct.mpid, frontierProduct);
  return products.find((prod) => prod.vendorId == $.VENDOR_ID);
}

export function GetCronGeneric(timeUnit: string, duration: number, offset: number): string {
  let genericValue = "";
  var off = 1;
  switch (timeUnit.toUpperCase()) {
    case "MIN":
      const strOp = getMinuteString(offset, duration);
      genericValue = `${strOp} * * * *`;
      break;
    case "HOURS":
      off = offset >= 23 ? 1 : offset;
      genericValue = `0 ${off}-23/${duration} * * *`;
      break;
    case "DAYS":
      off = offset >= 31 ? 1 : offset;
      genericValue = `0 0 ${off}-31/${duration} * *`;
      break;
    case "SEC":
      genericValue = `*/${duration} * * * * *`;
      break;
    default:
      break;
  }
  return genericValue;
}

export async function IsEligibleForReprice(contextErrorItemsList: any[], mpid: any): Promise<boolean> {
  return contextErrorItemsList.filter((x) => x.mpId == mpid).length > 0 ? false : true;
}

export async function GetLastExistingPrice(productDetails: any): Promise<number> {
  let price = 0;
  const lastExistingPrice = productDetails.latest_price && productDetails.latest_price != 0 ? productDetails.latest_price : productDetails.lastExistingPrice;
  if (!lastExistingPrice) return price;
  if (lastExistingPrice.indexOf("/") >= 0) {
    const priceBreaks = lastExistingPrice.split("/");
    _.forEach(priceBreaks, (pb) => {
      if (pb && pb.trim() != "" && pb.indexOf("1@") >= 0) {
        price = parseFloat(pb.split("@")[1].trim());
      }
    });
  } else {
    price = parseFloat(lastExistingPrice);
  }
  return price;
}

export function MapOverrideExecutionPriority(productDetails: any, priorityList: any) {
  if (productDetails.tradentDetails) {
    productDetails.tradentDetails.executionPriority = parseInt(priorityList.tradent_priority);
  }
  if (productDetails.frontierDetails) {
    productDetails.frontierDetails.executionPriority = parseInt(priorityList.frontier_priority);
  }
  if (productDetails.mvpDetails) {
    productDetails.mvpDetails.executionPriority = parseInt(priorityList.mvp_priority);
  }
  if (productDetails.topDentDetails) {
    productDetails.topDentDetails.executionPriority = parseInt(priorityList.topDent_priority);
  }
  if (productDetails.mvpDetails) {
    productDetails.mvpDetails.firstDentDetails = parseInt(priorityList.firstDent_priority);
  }
  if (productDetails.triadDetails) {
    productDetails.triadDetails.executionPriority = parseInt(priorityList.triad_priority);
  }
  return productDetails;
}

function getMinuteString(offset: number, duration: number) {
  let strOutput = offset == null || parseInt(offset as any) == 1 ? `1` : `${offset}`;
  let counterInit = parseInt(duration as any);
  for (let idx = 1; idx < 60; idx++) {
    if (idx == 1 && parseInt(duration as any) + parseInt(offset as any) < 60) {
      strOutput = `${strOutput},${parseInt(duration as any) + parseInt(offset as any)}`;
      counterInit = parseInt(duration as any) + parseInt(offset as any);
    } else if (parseInt(counterInit as any) + parseInt(duration as any) < 60) {
      strOutput = `${strOutput},${parseInt(counterInit as any) + parseInt(duration as any)}`;
      counterInit = parseInt(counterInit as any) + parseInt(duration as any);
    } else {
      break;
    }
  }
  return strOutput;
}
