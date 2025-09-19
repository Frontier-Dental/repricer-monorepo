import Item from "./item";

export default class ProductModel {
  mpId: string;
  tradentDetails: typeof Item;
  frontierDetails: typeof Item;
  mvpDetails: typeof Item;
  constructor(_mpId: string) {
    this.mpId = _mpId;
    this.tradentDetails = Item;
    this.frontierDetails = Item;
    this.mvpDetails = Item;
  }
}
