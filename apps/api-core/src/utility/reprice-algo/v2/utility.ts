import { ProductDetailsListItem } from "../../mysql/mySql-mapper";
import { AlgoResult, PriceSolutions, VendorId, VendorName } from "./types";

export function getAllOwnVendorNames() {
  return [
    { name: VendorName.TRADENT },
    { name: VendorName.FRONTIER },
    { name: VendorName.MVP },
    { name: VendorName.TOPDENT },
    { name: VendorName.FIRSTDENT },
  ];
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
  ];
}

export function getPriceSolutionStringRepresentation(
  priceSolution: PriceSolutions,
) {
  return Object.keys(priceSolution)
    .map((quantity) => {
      if (
        priceSolution[quantity as any] &&
        priceSolution[quantity as any].length > 0
      ) {
        return `${quantity}: ${JSON.stringify(priceSolution[quantity as any][0].vendorPrices)}`;
      }
    })
    .join("\n");
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
        default:
          throw new Error(`Unknown vendor: ${x.name}`);
      }
    })
    .filter((x) => x !== null && x.activated);
}
