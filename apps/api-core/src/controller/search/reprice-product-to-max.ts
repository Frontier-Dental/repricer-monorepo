import { Request, Response } from "express";

import * as _codes from "http-status-codes";
import { RepriceAsyncResponse } from "../../model/reprice-async-response";
import { RepriceMessageEnum } from "../../model/reprice-message";
import { RepriceModel } from "../../model/reprice-model";
import { UpdateRequest } from "../../model/update-request";
import { apiMapping } from "../../resources/api-mapping";
import * as axiosHelper from "../../utility/axios-helper";
import * as dbHelper from "../../utility/mongo/db-helper";
import * as formatter from "../../utility/format-wrapper";
import * as HistoryHelper from "../../utility/history-helper";
import * as repriceHelper from "../../utility/reprice-helper";
import * as responseUtility from "../../utility/response-utility";
import {
  delay,
  getPriceStepValue,
  getSecretKey,
  isPriceUpdateRequired,
} from "../../utility/reprice_algo/shared";
import { applicationConfig } from "../../utility/config";

export async function repriceProductToMax(
  req: Request,
  res: Response,
): Promise<any> {
  let productItem = req.body.prod;
  const contextVendor = req.body.contextVendor;
  await delay(await dbHelper.GetDelay());

  let result = req.body.result;
  let repriceResult: RepriceModel | undefined;
  if (!result || result.length === 0) {
    return res
      .status(_codes.StatusCodes.IM_A_TEAPOT)
      .json("Invalid response found in Net32 Api");
  }

  // Format Response as per Expected Net32 Response
  result = formatter.FormatActiveField(result);
  result = formatter.FormatShippingThreshold(result);
  productItem = formatter.SetGlobalDetails(productItem, contextVendor);

  let ownProduct = await responseUtility.GetOwnProduct(result, productItem);
  let output = responseUtility.FilterActiveResponse(result, productItem);
  if (!ownProduct) {
    return res
      .status(_codes.StatusCodes.BAD_REQUEST)
      .json("Could not find own vendor Id");
  }

  if (productItem && ownProduct && ownProduct.inStock == true) {
    if (ownProduct.priceBreaks) {
      repriceResult = await repriceHelper.RepriceToMax(
        ownProduct,
        output,
        productItem,
        req.params.id,
      );
    }
  } else {
    repriceResult = new RepriceModel(
      req.params.id,
      ownProduct,
      productItem.productName,
      productItem.unitPrice,
      false,
      false,
      [],
      RepriceMessageEnum.IGNORE_PRODUCT_INACTIVE,
    );
  }

  if (!repriceResult) {
    return res
      .status(_codes.StatusCodes.BAD_REQUEST)
      .json("Could not find repriceResult");
  }

  // Update History
  await HistoryHelper.Execute(
    req.params.id,
    repriceResult,
    output,
    false,
    contextVendor,
  );

  output = productItem.scrapeOn == true ? output : [];
  let outputResponse = new RepriceAsyncResponse(repriceResult, output);
  const repriceNeeded = isPriceUpdateRequired(
    repriceResult,
    productItem.allowReprice,
  );
  // const repriceNeeded = false;
  if (!repriceNeeded) {
    console.log("=== SUCCESS RESPONSE (NO PRICE UPDATE) ===");
    return res
      .status(_codes.StatusCodes.OK)
      .json({ cronResponse: outputResponse, priceUpdateResponse: null });
  }
  let priceUpdatedRequest: any = {};
  priceUpdatedRequest.secretKey = await getSecretKey(
    productItem.cronId,
    contextVendor,
  );
  const priceUpdateUrl = apiMapping.find(
    (x) => x.vendor == contextVendor.toUpperCase(),
  )?.priceUpdateUrl;
  let priceUpdatedResponse = null;
  if (repriceResult && repriceResult.isMultiplePriceBreakAvailable != true) {
    priceUpdatedRequest.payload = new UpdateRequest(
      req.params.id,
      repriceResult.repriceDetails!.newPrice,
      1,
      productItem.cronName,
    );
    const isDev = applicationConfig.IS_DEV;
    if (isDev == false) {
      priceUpdatedResponse = await axiosHelper.postAsync(
        priceUpdatedRequest,
        priceUpdateUrl!,
      );
    } else {
      priceUpdatedResponse = {
        data: { status: "SUCCESS", type: "dummy", url: priceUpdateUrl },
      };
    }
  }
  if (priceUpdatedResponse && priceUpdatedResponse.data) {
    if (
      priceUpdatedResponse.data.message &&
      (JSON.stringify(priceUpdatedResponse.data.message).indexOf("ERROR:422") >
        -1 ||
        JSON.stringify(priceUpdatedResponse.data.message).indexOf("ERROR:429") >
          -1 ||
        JSON.stringify(priceUpdatedResponse.data.message).indexOf("ERROR:404") >
          -1 ||
        JSON.stringify(priceUpdatedResponse.data.message).indexOf("ERROR:") >
          -1)
    ) {
      if (
        outputResponse.repriceData &&
        outputResponse.repriceData.isMultiplePriceBreakAvailable == false &&
        outputResponse.repriceData.repriceDetails
      ) {
        outputResponse.repriceData.repriceDetails.explained = `${outputResponse.repriceData.repriceDetails.explained}:FAILED(ERROR:${JSON.stringify(priceUpdatedResponse.data.message)})`;
        outputResponse.repriceData.repriceDetails.isRepriced = false;
      }
      //return res.status(_codes.StatusCodes.OK).json({ "cronResponse": outputResponse, "priceUpdateResponse": null });
    } else if (priceUpdatedResponse.data) {
      // Update $UP or $DOWN if Price Update is Successful.
      if (
        outputResponse.repriceData &&
        outputResponse.repriceData.isMultiplePriceBreakAvailable == false &&
        outputResponse.repriceData.repriceDetails
      ) {
        if (
          outputResponse.repriceData.repriceDetails!.explained!.indexOf(
            "#NEW",
          ) < 0
        ) {
          const priceStepValue = await getPriceStepValue(
            outputResponse.repriceData.repriceDetails,
          );
          outputResponse.repriceData.repriceDetails.explained = `${outputResponse.repriceData.repriceDetails.explained} | ${priceStepValue}`;
        }
      }
    }

    return res.status(_codes.StatusCodes.OK).json({
      cronResponse: outputResponse,
      priceUpdateResponse: priceUpdatedResponse.data,
    });
  }
}
