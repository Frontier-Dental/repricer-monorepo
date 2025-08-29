import express, { Request, Response } from "express";
import * as _codes from "http-status-codes";
import * as globalParam from "../model/global-param";
import { RepriceAsyncResponse } from "../model/reprice-async-response";
import { RepriceModel } from "../model/reprice-model";
import { RepriceRenewedMessageEnum } from "../model/reprice-renewed-message";
import { UpdateRequest } from "../model/update-request";
import * as axiosHelper from "../utility/axios-helper";
import * as feedHelper from "../utility/feed-helper";
import * as HistoryHelper from "../utility/history-helper";
import * as mongoHelper from "../utility/mongo/mongo-helper";
import * as Rule from "../utility/reprice-algo/v1/repricer-rule-helper";
import * as responseUtility from "../utility/response-utility";
import { applicationConfig } from "../utility/config";
import { apiMapping } from "../resources/api-mapping";

export const feedController = express.Router();
const ControllerName = "FEED";
/************* PUBLIC APIS *************/
feedController.post(
  "/feed/RepriceProduct/:id",
  async (req: Request, res: Response): Promise<any> => {
    const mpid = req.params.id;
    let productDetails = req.body;
    let feedOutput = null;

    console.log(
      `${ControllerName} : Requesting Reprice info for ${mpid} at Time :  ${new Date()}`,
    );

    let repriceModel = new RepriceModel(
      req.params.id,
      null,
      productDetails.productName,
      productDetails.unitPrice,
      false,
      false,
      undefined,
      null,
    );

    if (productDetails && productDetails.activated == true) {
      const existingPrice =
        await responseUtility.GetLastExistingPrice(productDetails);
      //2.Check for eligibility
      const contextErrorItemsList =
        await mongoHelper.GetContextErrorItems(true);
      const isRepriceEligible = await responseUtility.IsEligibleForReprice(
        contextErrorItemsList,
        mpid,
      );
      if (isRepriceEligible == true) {
        //3.If Valid && competeAll == false, check the product availability in other 2 vendors -> Set isSisterAvailable and its corresponding price
        const globalParamInfo = await globalParam.GetInfo(mpid, productDetails);
        let sisterVendorItemDetails = [];
        if (productDetails.competeAll == false) {
          sisterVendorItemDetails =
            await axiosHelper.GetSisterVendorItemDetails(mpid, globalParamInfo);
        }
        repriceModel.vendorName = productDetails.channelName;
        repriceModel.vendorId = globalParamInfo.VENDOR_ID;
        //4.Check for the context details from net32 json
        const currentDetailsFromFeed = await feedHelper.GetContextDetails(mpid);
        feedOutput = currentDetailsFromFeed;
        if (currentDetailsFromFeed) {
          if (currentDetailsFromFeed.availability == "in stock") {
            repriceModel.inStock = true;
            const floorPrice = productDetails.floorPrice
              ? productDetails.floorPrice
              : 0;
            const processOffset = applicationConfig.OFFSET;
            const offsetPrice = currentDetailsFromFeed.price - processOffset;
            if (offsetPrice < floorPrice) {
              repriceModel.generateRepriceData(
                existingPrice,
                0 as unknown as string,
                false,
                RepriceRenewedMessageEnum.OFFSET_LESS_THAN_FLOOR,
              );
            } else if (sisterVendorItemDetails.length > 0) {
              const sisterPriceComparedToLowest = sisterVendorItemDetails.find(
                (x) => x.unitPrice == currentDetailsFromFeed.price,
              );
              if (sisterPriceComparedToLowest) {
                repriceModel.generateRepriceData(
                  existingPrice,
                  0 as unknown as string,
                  false,
                  RepriceRenewedMessageEnum.IGNORE_SISTER_VENDOR,
                );
              } else {
                repriceModel.generateRepriceData(
                  existingPrice,
                  offsetPrice as unknown as string,
                  true,
                  RepriceRenewedMessageEnum.REPRICE_DEFAULT,
                );
              }
            } else {
              repriceModel.generateRepriceData(
                existingPrice,
                offsetPrice as unknown as string,
                true,
                RepriceRenewedMessageEnum.REPRICE_DEFAULT,
              );
            }
          } else {
            repriceModel.generateRepriceData(
              existingPrice,
              0 as unknown as string,
              false,
              RepriceRenewedMessageEnum.IGNORE_NOT_IN_STOCK,
            );
          }
        } else {
          repriceModel.generateRepriceData(
            existingPrice,
            0 as unknown as string,
            false,
            RepriceRenewedMessageEnum.IGNORE_NOT_FOUND_API,
          );
        }
      }
      // Apply Reprice Rule for Product
      if (
        productDetails.repricingRule != null &&
        productDetails.isOverrideRun != true
      ) {
        repriceModel = Rule.ApplyRule(
          repriceModel,
          productDetails.repricingRule,
          undefined,
          undefined,
        );
      }

      // Update History
      await HistoryHelper.Execute(
        mpid,
        repriceModel,
        [feedOutput],
        false,
        undefined,
        undefined,
      );

      let outputResponse = new RepriceAsyncResponse(repriceModel, feedOutput);

      //7.Update Product details in MongoDb
      const repriceNeeded = await isPriceUpdateRequired(
        repriceModel,
        productDetails.allowReprice,
      );
      if (repriceNeeded == true) {
        let priceUpdatedRequest: any = {};
        priceUpdatedRequest.secretKey = productDetails.secretKey;
        let priceUpdatedResponse = null;
        priceUpdatedRequest.payload = new UpdateRequest(
          mpid,
          repriceModel.repriceDetails?.newPrice,
          1,
          undefined,
        );
        const priceUpdateUrl = apiMapping.find(
          (x) => x.vendor === repriceModel.vendorName.toUpperCase(),
        )?.priceUpdateUrl;
        priceUpdatedResponse = await axiosHelper.postAsync(
          priceUpdatedRequest,
          priceUpdateUrl!,
        );
        if (priceUpdatedResponse.data) {
          if (
            priceUpdatedResponse.data.message &&
            (JSON.stringify(priceUpdatedResponse.data.message).indexOf(
              "ERROR:422",
            ) > -1 ||
              JSON.stringify(priceUpdatedResponse.data.message).indexOf("429") >
                -1)
          ) {
            if (
              outputResponse.repriceData &&
              outputResponse.repriceData.isMultiplePriceBreakAvailable ==
                false &&
              outputResponse.repriceData.repriceDetails
            ) {
              outputResponse.repriceData.repriceDetails.explained = `${outputResponse.repriceData.repriceDetails.explained}:FAILED(ERROR:${priceUpdatedResponse.data.message})`;
              outputResponse.repriceData.repriceDetails.isRepriced = false;
            }
            //return res.status(_codes.StatusCodes.OK).json({ "cronResponse": outputResponse, "priceUpdateResponse": null });
          }
          return res.status(_codes.StatusCodes.OK).json({
            cronResponse: outputResponse,
            priceUpdateResponse: priceUpdatedResponse.data,
          });
        }
      }
      return res
        .status(_codes.StatusCodes.OK)
        .json({ cronResponse: outputResponse, priceUpdateResponse: null });
    }
    return res
      .status(_codes.StatusCodes.IM_A_TEAPOT)
      .json("Invalid response found");
  },
);

/************* PRIVATE FUNCTIONS *************/
async function isPriceUpdateRequired(repriceResult: any, isRepriceOn: any) {
  if (
    isRepriceOn == true &&
    repriceResult.repriceDetails &&
    repriceResult.repriceDetails.newPrice != "N/A" &&
    repriceResult.repriceDetails.newPrice !=
      repriceResult.repriceDetails.oldPrice
  ) {
    return true;
  } else if (
    isRepriceOn == true &&
    repriceResult.isMultiplePriceBreakAvailable == true &&
    repriceResult.listOfRepriceDetails.length > 0
  ) {
    let $eval = false;
    repriceResult.listOfRepriceDetails.forEach(($rp: any) => {
      if ($rp.newPrice != "N/A" && $rp.newPrice != $rp.oldPrice) {
        $eval = true;
      } else if ($rp.active == false || $rp.active == 0) {
        $eval = true;
      }
    });
    return $eval;
  }
  return false;
}
