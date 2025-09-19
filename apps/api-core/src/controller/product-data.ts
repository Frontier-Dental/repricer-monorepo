import express, { Request, Response } from "express";
import _ from "lodash";
import * as _codes from "http-status-codes";
import * as fsExtra from "fs-extra";
import * as path from "path";
import moment from "moment";
import * as axiosHelper from "../utility/axios-helper";
import { applicationConfig } from "../utility/config";
import { processUpdateProductQuantities } from "../utility/net32/updateProductQuantity";
export const dataController = express.Router();

/************* PUBLIC APIS *************/
dataController.get(
  "/data/GetProductList",
  async (req: Request, res: Response) => {
    const dataRequest = applicationConfig.GET_PRODUCT_RESULTS;
    let result = await axiosHelper.getProduct(dataRequest as any);

    if (result && result.data && result.data.length > 0) {
      const savedData = await saveProductData(result.data);
      if (savedData) {
        res
          .status(_codes.StatusCodes.OK)
          .json({ message: "Product Data accessed" });
      } else {
        res
          .status(_codes.StatusCodes.INTERNAL_SERVER_ERROR)
          .send("Sorry some error occurred!");
      }
    }
  },
);

dataController.post(
  "/data/UpdateProductQuantity",
  async (req: Request, res: Response) => {
    if (!req.body.vendorData) {
      res
        .status(_codes.StatusCodes.INTERNAL_SERVER_ERROR)
        .send("Vendor data is missing");
      return;
    }

    if (!req.body.mpid) {
      res
        .status(_codes.StatusCodes.INTERNAL_SERVER_ERROR)
        .send("MPID is missing");
      return;
    }

    try {
      const results = await processUpdateProductQuantities({
        mpid: req.body.mpid,
        vendorData: req.body.vendorData,
      });

      res.status(_codes.StatusCodes.OK).json({ results });
    } catch (error) {
      console.log("Error while updating product quantity", error);
      res.status(_codes.StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: "Error while updating product quantity",
        message: error instanceof Error ? error?.message : "Unknown error",
      });
    }
  },
);

/************* PRIVATE FUNCTIONS *************/
async function saveProductData(data: any) {
  const fileName = `${moment().format("YYYY-MM-DD-HH-mm-ss")}.json`;
  const serverPath = `${applicationConfig.FEED_FILE_PATH}`;
  const filePath = `${applicationConfig.PRODUCT_LOCAL_PATH}`;
  fsExtra.outputJSON(
    path.join(__dirname, filePath, fileName),
    JSON.parse(JSON.stringify(data)),
  );
  fsExtra.outputJSON(path.join(__dirname, serverPath, fileName), data);
  return true;
}
