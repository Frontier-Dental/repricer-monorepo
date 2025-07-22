import { Net32PriceBreak, Net32Product } from "../types/net32";
import { RepriceRenewedMessageEnum } from "./repriceRenewedMessage";

function getOldPrice(priceBreaks: Net32PriceBreak[]) {
  let oldPrice = 0;
  priceBreaks.forEach((price) => {
    if (price.minQty == 1 && price.active == true) {
      oldPrice = price.unitPrice;
    }
  });
  return oldPrice;
}

export class RepriceData {
  oldPrice: number;
  newPrice: string | null | number;
  isRepriced: boolean;
  updatedOn: Date;
  explained: string | null;
  lowestVendor: string | null;
  lowestVendorPrice: any;
  triggeredByVendor: string | null;
  active?: boolean;
  goToPrice?: string | null | number;
  minQty?: number | null;

  constructor(
    oldPrice: number,
    newPrice: string | number | null,
    isRepriced: boolean,
    message: string | null,
    minQty?: number,
  ) {
    this.oldPrice = oldPrice;
    this.newPrice =
      isRepriced == true
        ? typeof newPrice == "number"
          ? (newPrice as number).toFixed(2)
          : newPrice
        : "N/A";
    this.isRepriced = isRepriced;
    this.updatedOn = new Date();
    this.explained = message;
    this.lowestVendor = null;
    this.lowestVendorPrice = null;
    this.triggeredByVendor = null;
    this.minQty = minQty;
  }

  static fromObject({
    oldPrice,
    newPrice,
    isRepriced,
    message,
    minQty,
    active = true,
  }: {
    oldPrice: number;
    newPrice: string | number | null;
    isRepriced: boolean;
    message: string | null;
    minQty?: number;
    active?: boolean;
  }): RepriceData {
    const repriceData = new RepriceData(
      oldPrice,
      newPrice,
      isRepriced,
      message,
      minQty,
    );
    repriceData.active = active;
    return repriceData;
  }
}

export class RepriceModel {
  net32id: string;
  productName: string;
  vendorName: string;
  vendorProductId: string;
  vendorProductCode: string;
  vendorId: string;
  inStock: boolean;
  isMultiplePriceBreakAvailable: boolean;
  repriceDetails: RepriceData | null;
  listOfRepriceDetails: RepriceData[];

  constructor(
    sourceId: string,
    productDetails: Net32Product | null,
    name: string,
    newPrice: string | number | null,
    isRepriced: boolean,
    multiplePriceBreak: boolean = false,
    listOfRepriceData: RepriceData[] = [],
    message: string | null = null,
  ) {
    this.net32id = sourceId;
    this.productName = name;
    this.vendorName = productDetails ? productDetails.vendorName : "N/A";
    this.vendorProductId = productDetails
      ? (productDetails.vendorProductId as unknown as string)
      : "N/A";
    this.vendorProductCode = productDetails
      ? productDetails.vendorProductCode
      : "N/A";
    this.vendorId = (productDetails
      ? productDetails.vendorId
      : "N/A") as unknown as string;
    this.inStock = productDetails ? productDetails.inStock : false;
    this.isMultiplePriceBreakAvailable = multiplePriceBreak;
    // Initialize repriceDetails based on conditions
    if (multiplePriceBreak || !productDetails) {
      // If it's multiple price updates, repriceData is not used
      this.repriceDetails = null;
    } else {
      this.repriceDetails = new RepriceData(
        getOldPrice(productDetails.priceBreaks),
        newPrice,
        isRepriced,
        message,
      );
    }
    this.listOfRepriceDetails = listOfRepriceData;
  }

  togglePricePoint(value: boolean) {
    this.repriceDetails!.active = value;
    this.repriceDetails!.newPrice = 0 as unknown as string;
  }

  togglePriceUpdation(value: boolean) {
    this.repriceDetails!.isRepriced = value;
    this.repriceDetails!.updatedOn = new Date();
    this.repriceDetails!.explained =
      RepriceRenewedMessageEnum.SHUT_DOWN_NO_COMPETITOR;
  }

  updateLowest(vendorName: string, vendorPrice: number) {
    this.repriceDetails!.lowestVendor = vendorName;
    this.repriceDetails!.lowestVendorPrice = vendorPrice;
  }

  generateRepriceData(
    oldPrice: number,
    newPrice: string | number,
    isRepriced: boolean,
    message: string,
  ) {
    this.repriceDetails = new RepriceData(
      oldPrice,
      newPrice,
      isRepriced,
      message,
    );
  }

  updateTriggeredBy(vendorName: string, vendorId: string) {
    this.repriceDetails!.triggeredByVendor = `${vendorId}-${vendorName}`;
  }
}
