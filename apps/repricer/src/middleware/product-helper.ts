import _ from "lodash";
import * as mongoMiddleware from "../services/mongo";
import * as httpHelper from "../utility/http-wrappers";
import apiMapping from "../../resources/apiMapping.json";
import ProductModel from "../models/product";
import { applicationConfig } from "../utility/config";

export async function LoadProducts(listOfProducts: any) {
  for (const prod of listOfProducts) {
    var startTime = process.hrtime();
    let productModel = new ProductModel(prod);
    for (const apiDetails of apiMapping) {
      const productDetailsResponse = await httpHelper.native_get(
        apiDetails.apiUrl.replace("{mpid}", prod),
      );
      switch (apiDetails.vendorId) {
        case "17357":
          if (
            productDetailsResponse &&
            productDetailsResponse.data &&
            productDetailsResponse.data.message &&
            productDetailsResponse.data.message.length > 0
          ) {
            let productDetails: any = _.first(
              productDetailsResponse.data.message,
            );
            _.unset(productDetails, "_id");
            productDetails.executionPriority = 1;
            productDetails.activated = JSON.parse(
              applicationConfig.DEFAULT_PRODUCT_STATUS!,
            );
            productDetails.last_cron_time = null;
            productDetails.last_update_time = null;
            productDetails.last_attempted_time = null;
            productDetails.next_cron_time = null;
            productDetails.lastExistingPrice = null;
            productDetails.lastSuggestedPrice = null;
            productDetails.lowest_vendor = null;
            productDetails.lowest_vendor_price = null;
            productDetails.last_cron_message = null;
            productDetails.lastCronRun = null;
            productDetails.insertReason = null;
            productDetails.lastUpdatedBy = null;
            productDetails.allowReprice = true;
            productDetails.cronId = "1659197d96d1453fbb8838f5680251bb";
            productDetails.cronName = "Cron-2";
            productDetails.loadedOn = new Date();
            productModel.tradentDetails = productDetails;
          } else productModel.tradentDetails = null as any;
          break;
        case "20722":
          if (
            productDetailsResponse &&
            productDetailsResponse.data &&
            productDetailsResponse.data.message &&
            productDetailsResponse.data.message.length > 0
          ) {
            let productDetails: any = _.first(
              productDetailsResponse.data.message,
            );
            _.unset(productDetails, "_id");
            productDetails.executionPriority = 2;
            productDetails.activated = JSON.parse(
              applicationConfig.DEFAULT_PRODUCT_STATUS!,
            );
            productDetails.last_cron_time = null;
            productDetails.last_update_time = null;
            productDetails.last_attempted_time = null;
            productDetails.next_cron_time = null;
            productDetails.lastExistingPrice = null;
            productDetails.lastSuggestedPrice = null;
            productDetails.lowest_vendor = null;
            productDetails.lowest_vendor_price = null;
            productDetails.last_cron_message = null;
            productDetails.lastCronRun = null;
            productDetails.insertReason = null;
            productDetails.lastUpdatedBy = null;
            productDetails.allowReprice = true;
            productDetails.cronId = "1659197d96d1453fbb8838f5680251bb";
            productDetails.cronName = "Cron-2";
            productDetails.loadedOn = new Date();
            productModel.frontierDetails = productDetails;
          } else productModel.frontierDetails = null as any;
          break;
        case "20755":
          if (
            productDetailsResponse &&
            productDetailsResponse.data &&
            productDetailsResponse.data.message &&
            productDetailsResponse.data.message.length > 0
          ) {
            let productDetails: any = _.first(
              productDetailsResponse.data.message,
            );
            _.unset(productDetails, "_id");
            productDetails.executionPriority = 3;
            productDetails.activated = JSON.parse(
              applicationConfig.DEFAULT_PRODUCT_STATUS!,
            );
            productDetails.last_cron_time = null;
            productDetails.last_update_time = null;
            productDetails.last_attempted_time = null;
            productDetails.next_cron_time = null;
            productDetails.lastExistingPrice = null;
            productDetails.lastSuggestedPrice = null;
            productDetails.lowest_vendor = null;
            productDetails.lowest_vendor_price = null;
            productDetails.last_cron_message = null;
            productDetails.lastCronRun = null;
            productDetails.insertReason = null;
            productDetails.lastUpdatedBy = null;
            productDetails.allowReprice = true;
            productDetails.cronId = "1659197d96d1453fbb8838f5680251bb";
            productDetails.cronName = "Cron-2";
            productDetails.loadedOn = new Date();
            productModel.mvpDetails = productDetails;
          } else productModel.mvpDetails = null as any;
          break;
        default:
          break;
      }
    }
    await mongoMiddleware.InsertOrUpdateProduct(productModel, null);
    console.log(
      `Finished loading Details for MPID : ${prod} at ${new Date()} || Time taken : ${parseHrtimeToSeconds(process.hrtime(startTime))} seconds`,
    );
  }
}

function parseHrtimeToSeconds(hrtime: any) {
  var seconds = (hrtime[0] + hrtime[1] / 1e9).toFixed(3);
  return seconds;
}
