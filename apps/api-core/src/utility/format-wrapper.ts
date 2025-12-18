import _ from "lodash";
import * as globalParam from "../model/global-param";
import { Net32Product } from "../types/net32";
import { FrontierProduct } from "../types/frontier";
import { VendorName } from "@repricer-monorepo/shared";

export function FormatActiveField(data: Net32Product[]) {
  // Return a new array with all priceBreaks' active property set to true, without mutating input
  return data.map((x) => {
    let newPriceBreaks = x.priceBreaks?.map((p) => ({ ...p, active: true })) || [];
    return { ...x, priceBreaks: newPriceBreaks };
  });
}

export function FormatShippingThreshold(data: Net32Product[]): Net32Product[] {
  // Return a new array with the updated shipping threshold logic
  return data.map((x) => {
    let freeShippingThreshold = x.freeShippingThreshold;
    if (x.priceBreaks && x.priceBreaks.length > 0) {
      const minQtyPrice = x.priceBreaks.find((p) => p.minQty === 1);
      if (minQtyPrice) {
        if (x.standardShippingStatus && x.standardShippingStatus === "STANDARD_SHIPPING" && x.freeShippingGap && x.freeShippingGap > 0) {
          freeShippingThreshold = parseFloat(minQtyPrice.unitPrice as unknown as string) + parseFloat(x.freeShippingGap as unknown as string);
        } else if (x.standardShippingStatus && x.standardShippingStatus === "STANDARD_SHIPPING" && x.freeShippingGap === 0) {
          freeShippingThreshold = 999999;
        } else {
          freeShippingThreshold = 0;
        }
      }
    }
    return { ...x, freeShippingThreshold };
  });
}

export function SetGlobalDetails(productItem: FrontierProduct, contextVendor: string) {
  // Create a shallow copy to avoid mutating the original
  const updatedProductItem = { ...productItem };
  switch (contextVendor.toUpperCase()) {
    case VendorName.TRADENT:
      updatedProductItem.ownVendorId = "17357";
      if (!updatedProductItem.sisterVendorId) {
        updatedProductItem.sisterVendorId = "20722;20755;20533;20727;5";
      }
      break;
    case VendorName.FRONTIER:
      updatedProductItem.ownVendorId = "20722";
      if (!updatedProductItem.sisterVendorId) {
        updatedProductItem.sisterVendorId = "17357;20755;20533;20727;5";
      }
      break;
    case VendorName.MVP:
      updatedProductItem.ownVendorId = "20755";
      if (!updatedProductItem.sisterVendorId) {
        updatedProductItem.sisterVendorId = "17357;20722;20533;20727;5";
      }
      break;
    case VendorName.TOPDENT:
      updatedProductItem.ownVendorId = "20727";
      if (!updatedProductItem.sisterVendorId) {
        updatedProductItem.sisterVendorId = "17357;20722;20533;20755;5";
      }
      break;
    case VendorName.FIRSTDENT:
      updatedProductItem.ownVendorId = "20533";
      if (!updatedProductItem.sisterVendorId) {
        updatedProductItem.sisterVendorId = "17357;20722;20755;20727;5";
      }
      break;
    case VendorName.TRIAD:
      updatedProductItem.ownVendorId = "5";
      if (!updatedProductItem.sisterVendorId) {
        updatedProductItem.sisterVendorId = "17357;20722;20755;20727;20533";
      }
      break;
    default:
      throw new Error(`Invalid vendor: ${contextVendor}`);
  }
  return updatedProductItem;
}

export function FormatScrapeResponse(listOfResponse: any) {
  if (listOfResponse && listOfResponse.length > 0) {
    for (let res of listOfResponse) {
      res.vendorProductId = parseInt(res.vendorProductId);
      //res.vendorId = parseInt(res.vendorProductId);
      res.standardShipping = parseFloat(res.standardShipping);
      res.freeShippingGap = parseFloat(res.freeShippingGap);
      res.heavyShipping = parseFloat(res.heavyShipping);
      res.shippingTime = parseInt(res.shippingTime);
      res.isBackordered = res.isBackordered == "true" ? true : false;
      res.inventory = parseInt(res.inventory);
      res.badgeId = parseInt(res.badgeId);
      res.arrivalBusinessDays = parseInt(res.arrivalBusinessDays);
      res.inStock = res.inStock == "true" ? true : false;
      let pbItems = [];
      if (res.priceBreaks && res.priceBreaks["priceBreaks"].length > 0) {
        for (let pb of res.priceBreaks["priceBreaks"]) {
          const customPb = {
            pmId: pb.pmId,
            minQty: parseInt(pb.minQty),
            unitPrice: parseFloat(pb.unitPrice),
            promoAddlDescr: pb.promoAddlDescr,
          };
          pbItems.push(customPb);
        }
      } else if (res.priceBreaks && res.priceBreaks["priceBreaks"]) {
        const customPb = {
          pmId: res.priceBreaks["priceBreaks"].pmId,
          minQty: parseInt(res.priceBreaks["priceBreaks"].minQty),
          unitPrice: parseFloat(res.priceBreaks["priceBreaks"].unitPrice),
          promoAddlDescr: res.priceBreaks["priceBreaks"].promoAddlDescr,
        };
        pbItems.push(customPb);
      }
      res.priceBreaks = pbItems;
    }
  }
  return listOfResponse;
}

export function FormatSingleScrapeResponse(singleResponse: any) {
  let res = _.cloneDeep(singleResponse);
  res.vendorProductId = parseInt(singleResponse.vendorProductId);
  //res.vendorId = parseInt(res.vendorProductId);
  res.standardShipping = parseFloat(singleResponse.standardShipping);
  res.freeShippingGap = parseInt(singleResponse.freeShippingGap);
  res.heavyShipping = parseFloat(singleResponse.heavyShipping);
  res.shippingTime = parseInt(singleResponse.shippingTime);
  res.isBackordered = singleResponse.isBackordered == "true" ? true : false;
  res.inventory = parseInt(singleResponse.inventory);
  res.badgeId = parseInt(singleResponse.badgeId);
  res.arrivalBusinessDays = parseInt(singleResponse.arrivalBusinessDays);
  res.inStock = singleResponse.inStock == "true" ? true : false;
  let pbItems = [];
  if (singleResponse.priceBreaks && singleResponse.priceBreaks["priceBreaks"].length > 0) {
    for (let pb of singleResponse.priceBreaks["priceBreaks"]) {
      const customPb = {
        pmId: pb.pmId,
        minQty: parseInt(pb.minQty),
        unitPrice: parseFloat(pb.unitPrice),
        promoAddlDescr: pb.promoAddlDescr,
      };
      pbItems.push(customPb);
    }
  } else if (singleResponse.priceBreaks && singleResponse.priceBreaks["priceBreaks"]) {
    const customPb = {
      pmId: singleResponse.priceBreaks["priceBreaks"].pmId,
      minQty: parseInt(singleResponse.priceBreaks["priceBreaks"].minQty),
      unitPrice: parseFloat(singleResponse.priceBreaks["priceBreaks"].unitPrice),
      promoAddlDescr: singleResponse.priceBreaks["priceBreaks"].promoAddlDescr,
    };
    pbItems.push(customPb);
  }
  res.priceBreaks = pbItems;
  return [res];
}

export async function SetOwnVendorThreshold(productItem: FrontierProduct, net32Result: Net32Product[]) {
  const $ = await globalParam.GetInfo(productItem.mpid, productItem);
  return net32Result.map((x) => {
    if (x.vendorId !== $.VENDOR_ID) {
      return { ...x };
    }

    if (parseInt(x.inventory as unknown as string) >= productItem.ownVendorThreshold) {
      return { ...x, inStock: true };
    } else {
      return { ...x, inStock: false };
    }
  });
}
