import _ from "lodash";
import express, { Request, Response } from "express";
import * as _codes from "http-status-codes";
// import * as perf from "execution-time";
import * as uuid from "uuid";
import { apiMapping } from "../resources/apiMapping";
import * as axiosHelper from "../utility/axiosHelper";
import * as mongoHelper from "../utility/mongo/mongoHelper";

export const masterDataController = express.Router();

masterDataController.get(
  "/data/collate_feed",
  async (req: Request, res: Response): Promise<any> => {
    // perf.start("collate_feed");
    const runMarker = uuid.v4();
    let listOfActiveProducts: any[] = [];
    for (const vendor of apiMapping) {
      const vendorActiveProductList = await axiosHelper.native_get(
        vendor.activeListUrl,
      );
      if (
        vendorActiveProductList &&
        vendorActiveProductList.data &&
        vendorActiveProductList.data.productList
      ) {
        _.forEach(vendorActiveProductList.data.productList, (prod) => {
          if (!listOfActiveProducts.includes(prod)) {
            listOfActiveProducts.push(prod);
          }
        });
      }
    }

    if (listOfActiveProducts.length > 0) {
      for (const prod of listOfActiveProducts) {
        await fetchAndLoad(prod);
      }
    }
    // const executionResult = perf.stop("collate_feed");
    // console.log(
    //   `Execution time for Id : ${runMarker} | Time : ${executionResult.time} ms`,
    // ); // in milliseconds
    return res
      .status(_codes.StatusCodes.OK)
      .json(
        `Products Loaded Successfully. Count : ${listOfActiveProducts.length}`,
      );
  },
);

async function fetchAndLoad(mpid: string) {
  const aggregatorResponse = await axiosHelper.fetch_product_data(
    process.env.GET_SEARCH_RESULTS!.replace("{mpId}", mpid),
  );
  if (
    aggregatorResponse &&
    aggregatorResponse.data &&
    aggregatorResponse.data.length > 0
  ) {
    const existingDetails = await mongoHelper.GetVendorDetails_ManagedService({
      mpId: mpid,
    });
    if (!existingDetails || existingDetails.length == 0) {
      await mongoHelper.load_vendor_data({
        mpId: mpid,
        result: aggregatorResponse,
        lastUpdated: new Date(),
      });
    } else {
      await mongoHelper.update_vendor_data({
        mpId: mpid,
        result: aggregatorResponse,
        lastUpdated: new Date(),
      });
    }
  }
}
