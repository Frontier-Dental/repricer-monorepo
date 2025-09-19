import { VendorId, VendorName } from "@repricer-monorepo/shared";
import { ProductDetailsListItem } from "../../mysql/mySql-mapper";
import { AlgoResult } from "./types";
import { Net32PriceBreak } from "../../../types/net32";

export function getAllOwnVendorNames() {
  return [
    { name: VendorName.TRADENT },
    { name: VendorName.FRONTIER },
    { name: VendorName.MVP },
    { name: VendorName.TOPDENT },
    { name: VendorName.FIRSTDENT },
    { name: VendorName.TRIAD },
  ];
}

export function isShortExpiryProduct(
  priceBreaks: Net32PriceBreak[],
  quantity: number,
) {
  const priceBreakForQuantity = priceBreaks.find(
    (pb) => pb.minQty === quantity,
  );
  return priceBreakForQuantity?.promoAddlDescr?.includes("EXP");
}

export function isChangeResult(result: AlgoResult) {
  return (
    result === AlgoResult.CHANGE_UP ||
    result === AlgoResult.CHANGE_DOWN ||
    result === AlgoResult.CHANGE_NEW
  );
}

export function getAllOwnVendorIds() {
  return [
    VendorId.TRADENT,
    VendorId.FRONTIER,
    VendorId.MVP,
    VendorId.TOPDENT,
    VendorId.FIRSTDENT,
    VendorId.TRIAD,
  ];
}

export function getPriceListFormatted(
  priceList: { minQty: number; activeCd: number; price?: number }[],
) {
  return priceList
    .map(
      (p) =>
        `Q${p.minQty}@${p.price ? p.price.toFixed(2) : ""}${p.activeCd === 0 ? "REMOVED" : ""}`,
    )
    .join(", ");
}

export function getInternalProducts(
  prod: ProductDetailsListItem,
  allVendors: { name: string }[],
) {
  return allVendors
    .map((x, i) => {
      switch (x.name) {
        case VendorName.FRONTIER:
          return {
            ...prod.frontierDetails,
            ownVendorId: VendorId.FRONTIER,
            ownVendorName: VendorName.FRONTIER,
            floorPrice: prod.frontierDetails?.floorPrice
              ? parseFloat(prod.frontierDetails.floorPrice as unknown as string)
              : 0,
            maxPrice: prod.frontierDetails?.maxPrice
              ? parseFloat(prod.frontierDetails.maxPrice as unknown as string)
              : Infinity,
            priority: i,
          };
        case VendorName.MVP:
          return {
            ...prod.mvpDetails,
            ownVendorId: VendorId.MVP,
            ownVendorName: VendorName.MVP,
            floorPrice: prod.mvpDetails?.floorPrice
              ? parseFloat(prod.mvpDetails.floorPrice as unknown as string)
              : 0,
            maxPrice: prod.mvpDetails?.maxPrice
              ? parseFloat(prod.mvpDetails.maxPrice as unknown as string)
              : Infinity,
            priority: i,
          };
        case VendorName.TRADENT:
          return {
            ...prod.tradentDetails,
            ownVendorId: VendorId.TRADENT,
            ownVendorName: VendorName.TRADENT,
            floorPrice: prod.tradentDetails?.floorPrice
              ? parseFloat(prod.tradentDetails.floorPrice as unknown as string)
              : 0,
            maxPrice: prod.tradentDetails?.maxPrice
              ? parseFloat(prod.tradentDetails.maxPrice as unknown as string)
              : Infinity,
            priority: i,
          };
        case VendorName.FIRSTDENT:
          return {
            ...prod.firstDentDetails,
            ownVendorId: VendorId.FIRSTDENT,
            ownVendorName: VendorName.FIRSTDENT,
            floorPrice: prod.firstDentDetails?.floorPrice
              ? parseFloat(
                  prod.firstDentDetails.floorPrice as unknown as string,
                )
              : 0,
            maxPrice: prod.firstDentDetails?.maxPrice
              ? parseFloat(prod.firstDentDetails.maxPrice as unknown as string)
              : Infinity,
            priority: i,
          };
        case VendorName.TOPDENT:
          return {
            ...prod.topDentDetails,
            ownVendorId: VendorId.TOPDENT,
            ownVendorName: VendorName.TOPDENT,
            floorPrice: prod.topDentDetails?.floorPrice
              ? parseFloat(prod.topDentDetails.floorPrice as unknown as string)
              : 0,
            maxPrice: prod.topDentDetails?.maxPrice
              ? parseFloat(prod.topDentDetails.maxPrice as unknown as string)
              : Infinity,
            priority: i,
          };
        case VendorName.TRIAD:
          return {
            ...prod.triadDetails,
            ownVendorId: VendorId.TRIAD,
            ownVendorName: VendorName.TRIAD,
            floorPrice: prod.triadDetails?.floorPrice
              ? parseFloat(prod.triadDetails.floorPrice as unknown as string)
              : 0,
            maxPrice: prod.triadDetails?.maxPrice
              ? parseFloat(prod.triadDetails.maxPrice as unknown as string)
              : Infinity,
            priority: i,
          };
        default:
          throw new Error(`Unknown vendor: ${x.name}`);
      }
    })
    .filter((x) => x !== null && x.activated);
}
