export class UpdateRequest {
  mpid: any;
  priceList: any[];
  cronName: any;

  constructor(mpId: any, newPrice: any, minQty: any, _cronName: any) {
    this.mpid = parseInt(mpId);
    this.priceList = [];
    this.priceList.push(new PriceList(newPrice, minQty));
    this.cronName = _cronName;
  }
}

export class PriceList {
  minQty: any;
  price: any;
  activeCd: any;

  constructor(newPrice: any, minQty: any, _activeCd: any = 1) {
    this.minQty = minQty;
    this.price = parseFloat(newPrice);
    this.activeCd = _activeCd;
  }
}
