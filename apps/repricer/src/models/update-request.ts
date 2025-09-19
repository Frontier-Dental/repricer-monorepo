export default class UpdateRequest {
  mpid: number;
  priceList: PriceList[];
  constructor(
    mpId: string,
    vpCode: string,
    newPrice: string,
    inventory: string,
  ) {
    this.mpid = parseInt(mpId);
    this.priceList = [];
    this.priceList.push(new PriceList(newPrice));
  }
}

export class PriceList {
  minQty: number;
  price: number;
  activeCd: number;
  constructor(newPrice: string) {
    this.minQty = 1;
    this.price = parseFloat(newPrice);
    this.activeCd = 1;
  }
}
