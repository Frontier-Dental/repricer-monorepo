import express, { Request, Response } from "express";
import _ from "lodash";
import * as _codes from "http-status-codes";
import * as fsExtra from "fs-extra";
import * as path from "path";
import moment from "moment";
import * as axiosHelper from "../utility/axiosHelper";
import { applicationConfig } from "../utility/config";
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
