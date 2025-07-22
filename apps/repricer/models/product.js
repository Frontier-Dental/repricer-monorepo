const Item = require("../models/item");

class ProductModel {
  constructor(_mpId) {
    this.mpId = _mpId;
    this.tradentDetails = new Item();
    this.frontierDetails = new Item();
    this.mvpDetails = new Item();
  }
}
module.exports = ProductModel;
