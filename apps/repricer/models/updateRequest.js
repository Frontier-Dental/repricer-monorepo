class UpdateRequest {
  constructor(mpId, vpCode, newPrice, inventory) {
    //this.vpCode = vpCode;
    this.mpid = parseInt(mpId);
    this.priceList = [];
    //this.inventory = inventory;
    //this.fulfillmentPolicy = "stock";
    this.priceList.push(new PriceList(newPrice));
  }
}

class PriceList {
  constructor(newPrice) {
    this.minQty = 1;
    this.price = parseFloat(newPrice);
    this.activeCd = 1;
  }
}
module.exports = UpdateRequest;
