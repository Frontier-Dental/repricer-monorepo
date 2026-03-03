import { RepriceModel, RepriceData } from "../../../../../model/reprice-model";
import { Net32Product } from "../../../../../types/net32";

/**
 * Build a RepriceData for testing.
 * Unlike the real constructor, this does NOT format newPrice with toFixed(2).
 * Tests need exact control over values.
 */
function makeRepriceData(opts: { oldPrice?: number; newPrice?: number | string | null; isRepriced?: boolean; explained?: string | null; minQty?: number; active?: boolean; goToPrice?: number | string | null; lowestVendor?: string | null; lowestVendorPrice?: any; triggeredByVendor?: string | null }): RepriceData {
  const d = new RepriceData(opts.oldPrice ?? 10, opts.newPrice ?? 9.99, opts.isRepriced ?? true, opts.explained ?? "", opts.minQty ?? 1);
  // Override fields that the constructor may have formatted
  if (opts.newPrice !== undefined) d.newPrice = opts.newPrice;
  if (opts.isRepriced !== undefined) d.isRepriced = opts.isRepriced;
  if (opts.active !== undefined) d.active = opts.active;
  if (opts.goToPrice !== undefined) d.goToPrice = opts.goToPrice;
  if (opts.lowestVendor !== undefined) d.lowestVendor = opts.lowestVendor;
  if (opts.lowestVendorPrice !== undefined) d.lowestVendorPrice = opts.lowestVendorPrice;
  if (opts.triggeredByVendor !== undefined) d.triggeredByVendor = opts.triggeredByVendor;
  return d;
}

export class RepriceModelBuilder {
  private sourceId = "12345";
  private productName = "Test Product";
  private vendorId: number | string = 17357;
  private vendorName = "Tradent";
  private singleDetail: Parameters<typeof makeRepriceData>[0] | null = null;
  private multiDetails: Array<Parameters<typeof makeRepriceData>[0]> = [];

  static create(): RepriceModelBuilder {
    return new RepriceModelBuilder();
  }

  /** Set fields for a single-break model (repriceDetails) */
  withOldPrice(price: number): this {
    if (!this.singleDetail) this.singleDetail = {};
    this.singleDetail.oldPrice = price;
    return this;
  }

  withNewPrice(price: number | string | null): this {
    if (!this.singleDetail) this.singleDetail = {};
    this.singleDetail.newPrice = price;
    this.singleDetail.isRepriced = price !== "N/A" && price !== null;
    return this;
  }

  withExplained(msg: string): this {
    if (!this.singleDetail) this.singleDetail = {};
    this.singleDetail.explained = msg;
    return this;
  }

  withGoToPrice(price: number | string | null): this {
    if (!this.singleDetail) this.singleDetail = {};
    this.singleDetail.goToPrice = price;
    return this;
  }

  /** Add a price break for multi-break models (listOfRepriceDetails) */
  withPriceBreak(opts: { minQty: number; oldPrice?: number; newPrice?: number | string; isRepriced?: boolean; active?: boolean; explained?: string; goToPrice?: number | string | null }): this {
    this.multiDetails.push({
      minQty: opts.minQty,
      oldPrice: opts.oldPrice ?? 10,
      newPrice: opts.newPrice ?? 9.99,
      isRepriced: opts.isRepriced ?? opts.newPrice !== "N/A",
      active: opts.active,
      explained: opts.explained ?? "",
      goToPrice: opts.goToPrice,
    });
    return this;
  }

  withVendorId(id: number | string): this {
    this.vendorId = id;
    return this;
  }
  withVendorName(name: string): this {
    this.vendorName = name;
    return this;
  }

  build(): RepriceModel {
    // Create a minimal Net32Product for the constructor
    const productDetails: Net32Product = {
      vendorProductId: 1001,
      vendorProductCode: "VP-001",
      vendorId: this.vendorId,
      vendorName: this.vendorName,
      vendorRegion: "US",
      inStock: true,
      standardShipping: 0,
      standardShippingStatus: "FREE",
      freeShippingGap: 0,
      heavyShippingStatus: "NONE",
      heavyShipping: 0,
      shippingTime: 2,
      inventory: 100,
      isFulfillmentPolicyStock: true,
      vdrGeneralAverageRatingSum: 4.5,
      vdrNumberOfGeneralRatings: 100,
      isBackordered: false,
      vendorProductLevelLicenseRequiredSw: false,
      vendorVerticalLevelLicenseRequiredSw: false,
      priceBreaks: [{ minQty: 1, unitPrice: 10, active: true }],
      badgeId: 0,
      badgeName: null,
      imagePath: "",
      arrivalDate: "",
      arrivalBusinessDays: 2,
      twoDayDeliverySw: false,
      isLowestTotalPrice: null,
    };

    if (this.multiDetails.length > 0) {
      // Multi-break model
      const listOfRepriceData = this.multiDetails.map((d) => makeRepriceData(d));
      const model = new RepriceModel(this.sourceId, productDetails, this.productName, null, false, true, listOfRepriceData, null);
      return model;
    }

    if (this.singleDetail) {
      // Single-break model
      const model = new RepriceModel(this.sourceId, productDetails, this.productName, this.singleDetail.newPrice ?? 9.99, this.singleDetail.isRepriced ?? true, false, [], this.singleDetail.explained ?? "");
      // Override any fields the constructor formatted
      if (this.singleDetail.oldPrice !== undefined) model.repriceDetails!.oldPrice = this.singleDetail.oldPrice;
      if (this.singleDetail.newPrice !== undefined) model.repriceDetails!.newPrice = this.singleDetail.newPrice;
      if (this.singleDetail.isRepriced !== undefined) model.repriceDetails!.isRepriced = this.singleDetail.isRepriced;
      if (this.singleDetail.goToPrice !== undefined) model.repriceDetails!.goToPrice = this.singleDetail.goToPrice;
      if (this.singleDetail.active !== undefined) model.repriceDetails!.active = this.singleDetail.active;
      return model;
    }

    // Default: single break, repriced from 10 to 9.99
    return new RepriceModel(this.sourceId, productDetails, this.productName, 9.99, true, false, [], "");
  }
}

/** Shorthand factory */
export const aRepriceModel = () => RepriceModelBuilder.create();

/** Export the helper for direct use */
export { makeRepriceData };
