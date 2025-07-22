export class PriceBreakInfo {
  LinkedProductInfo: any;
  PMID: any;
  MinQty: any;
  UnitPrice: any;
  PromoAddlDescr: any;
  IsActive: any;

  constructor(_linkedProdInfo: any, priceBreak: any) {
    this.LinkedProductInfo = _linkedProdInfo;
    this.PMID = priceBreak.pmId;
    this.MinQty = priceBreak.minQty;
    this.UnitPrice = priceBreak.unitPrice;
    this.PromoAddlDescr = priceBreak.promoAddlDescr;
    this.IsActive = true;
  }
}
