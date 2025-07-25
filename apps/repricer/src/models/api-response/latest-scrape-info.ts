export default class LatestScrapeInfo {
  MpId: string;
  FocusId: string;
  Net32Url: string;
  MinQty: number;
  Price: number;
  InStock: boolean;
  ScrapeTime: Date;

  constructor(payload: any, focusId: string) {
    this.MpId = payload.Mpid;
    this.FocusId = focusId;
    this.Net32Url = payload.Net32Url;
    this.MinQty = payload.MinQty;
    this.Price = this.getPrice(payload);
    this.InStock = payload.InStock == 0 ? false : true;
    this.ScrapeTime = payload.EndTime;
  }
  getPrice(payload: any) {
    if (parseFloat(payload.FreeShippingGap) > 0) {
      return (
        parseFloat(payload.FreeShippingGap) + parseFloat(payload.UnitPrice)
      );
    } else return parseFloat(payload.UnitPrice);
  }
}
