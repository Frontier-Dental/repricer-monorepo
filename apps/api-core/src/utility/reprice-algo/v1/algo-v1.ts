import _ from "lodash";
import { RepriceAsyncResponse } from "../../../model/reprice-async-response";
import { RepriceMessageEnum } from "../../../model/reprice-message";
import { RepriceModel } from "../../../model/reprice-model";
import { PriceList, UpdateRequest } from "../../../model/update-request";
import { apiMapping } from "../../../resources/api-mapping";
import { FrontierProduct } from "../../../types/frontier";
import { Net32PriceBreak, Net32Product } from "../../../types/net32";
import * as axiosHelper from "../../axios-helper";
import { applicationConfig } from "../../config";
import * as formatter from "../../format-wrapper";
import * as HistoryHelper from "../../history-helper";
import * as mySqlHelper from "../../mysql/mysql-helper";
import * as repriceHelper from "./reprice-helper";
import * as repriceHelperNc from "./reprice-helper-nc";
import * as Rule from "./repricer-rule-helper";
import * as responseUtility from "../../response-utility";
import {
  getIsFloorReached,
  getPriceStepValue,
  getSamePriceBreakDetails,
  getSecretKey,
  isOverrideEnabledForProduct,
  isPriceUpdateRequired,
  MinQtyPricePresent,
  notQ2VsQ1,
} from "./shared";
import { AlgoExecutionMode } from "@repricer-monorepo/shared";
import * as ResultParser from "../../../utility/repriceResultParser";
import * as filterMapper from "../../../utility/filter-mapper";
import * as buyBoxHelper from "../../../utility/buy-box-helper";

export async function repriceProduct(
  mpid: string,
  net32Products: Net32Product[],
  internalProduct: FrontierProduct,
  contextVendor: string,
) {
  let productItem = internalProduct;

  let result = net32Products;
  let repriceResult: RepriceModel | undefined;

  if (!result || result.length === 0) {
    throw new Error("Invalid response found in Net32 Api");
  }
  // Format Response as per Expected Net32 Response
  result = formatter.FormatActiveField(result);
  result = formatter.FormatShippingThreshold(result);
  productItem = formatter.SetGlobalDetails(productItem, contextVendor);

  // Logic to Work with Own Vendor Threshold
  result = await formatter.SetOwnVendorThreshold(productItem, result);

  let ownProduct = await responseUtility.GetOwnProduct(result, productItem);
  let output = responseUtility.FilterActiveResponse(result, productItem);

  if (!ownProduct) {
    return {
      cronResponse: new RepriceAsyncResponse(
        new RepriceModel(
          mpid,
          null,
          productItem.productName,
          productItem.unitPrice,
          false,
          false,
          [],
          RepriceMessageEnum.IGNORE_NOT_FOUND_API,
        ),
        output,
      ),
      priceUpdateResponse: null,
      historyIdentifier: null,
    };
  }

  // Do MultiPrice Reprice  - Compete with other vendors
  const flagMultiPriceUpdate = applicationConfig.FLAG_MULTI_PRICE_UPDATE;

  if (flagMultiPriceUpdate === true) {
    const distinctPriceBreaks =
      await repriceHelper.GetDistinctPriceBreaksAcrossVendors(
        output,
        ownProduct,
        productItem,
      );
    if (distinctPriceBreaks) {
      distinctPriceBreaks.forEach(($) => {
        ownProduct.priceBreaks.push($);
      });
    }
  }

  const isMinQty2PriceBreakExists = MinQtyPricePresent(
    ownProduct.priceBreaks,
    2,
  );

  if (productItem.compareWithQ1 && !isMinQty2PriceBreakExists) {
    ownProduct.priceBreaks.push({
      minQty: 2,
      unitPrice: 0,
      active: true,
    });
  }

  if (productItem && ownProduct && ownProduct.inStock) {
    if (
      ownProduct.priceBreaks &&
      (ownProduct.priceBreaks.length === 1 || productItem.suppressPriceBreak)
    ) {
      if (productItem.is_nc_needed && productItem.is_nc_needed) {
        repriceResult = await repriceHelperNc.Reprice(
          ownProduct,
          output,
          productItem,
          mpid,
        );
      } else {
        repriceResult = await repriceHelper.Reprice(
          ownProduct,
          output,
          productItem,
          mpid,
        );
      }
    } else if (ownProduct.priceBreaks && ownProduct.priceBreaks.length > 1) {
      let multipleRepriceData = new RepriceModel(
        mpid,
        ownProduct,
        productItem.productName,
        null,
        false,
        true,
      );

      for (const priceBreak of ownProduct.priceBreaks) {
        const otherVendorRepriceDetails = await getSamePriceBreakDetails(
          output,
          priceBreak,
          productItem,
        );

        let indRepriceResult: RepriceModel;
        if (productItem.is_nc_needed && productItem.is_nc_needed) {
          indRepriceResult = await repriceHelperNc.RepriceIndividualPriceBreak(
            ownProduct,
            output,
            productItem,
            mpid,
            priceBreak,
          );
        } else {
          indRepriceResult = await repriceHelper.RepriceIndividualPriceBreak(
            ownProduct,
            output,
            productItem,
            mpid,
            priceBreak,
          );
        }

        if (
          otherVendorRepriceDetails &&
          otherVendorRepriceDetails.length === 0 &&
          priceBreak.minQty !== 1 &&
          notQ2VsQ1(priceBreak.minQty, productItem.compareWithQ1)
        ) {
          indRepriceResult.togglePricePoint(false);
          indRepriceResult.togglePriceUpdation(true);
        }

        multipleRepriceData.listOfRepriceDetails.push(
          indRepriceResult.repriceDetails!,
        );
      }
      repriceResult = multipleRepriceData;
    }
  } else {
    repriceResult = new RepriceModel(
      mpid,
      ownProduct,
      productItem.productName,
      productItem.unitPrice,
      false,
      false,
      [],
      RepriceMessageEnum.IGNORE_PRODUCT_INACTIVE,
    );
  }

  let isNcForBuyBoxApplied = false;
  //Apply NC Buy Box
  if (productItem.applyNcForBuyBox && productItem.applyNcForBuyBox === true) {
    if (
      repriceResult!.listOfRepriceDetails &&
      repriceResult!.listOfRepriceDetails.length > 0
    ) {
      let copiedRepriceResult = _.cloneDeep(repriceResult);
      copiedRepriceResult!.listOfRepriceDetails = [];
      for (const $eval of repriceResult!.listOfRepriceDetails) {
        const isFloorReached = await getIsFloorReached($eval);
        if (isFloorReached === true) {
          const contextPriceBreak = ownProduct.priceBreaks.find(
            (x: any) => x.minQty == $eval.minQty,
          );
          let overridingRepriceResult =
            await repriceHelperNc.RepriceIndividualPriceBreak(
              ownProduct,
              output,
              productItem,
              mpid,
              contextPriceBreak,
            );
          overridingRepriceResult.repriceDetails!.explained = `${overridingRepriceResult.repriceDetails!.explained} #NCBuyBox`;
          copiedRepriceResult!.listOfRepriceDetails.push(
            overridingRepriceResult.repriceDetails!,
          );
          isNcForBuyBoxApplied = true;
        } else {
          copiedRepriceResult!.listOfRepriceDetails.push($eval);
        }
      }
      repriceResult = copiedRepriceResult;
    } else if (repriceResult!.repriceDetails) {
      const isFloorReached = await getIsFloorReached(
        repriceResult!.repriceDetails,
      );
      if (isFloorReached === true) {
        repriceResult = await repriceHelperNc.Reprice(
          ownProduct,
          output,
          productItem,
          mpid,
        );
        repriceResult!.repriceDetails!.explained = `${repriceResult!.repriceDetails!.explained} #NCBuyBox`;
        isNcForBuyBoxApplied = true;
      }
    }
  }

  // Apply Reprice Rule for Product
  const isOverrideEnabled = await isOverrideEnabledForProduct(
    productItem.override_bulk_update,
  );
  const isNcToBeApplied =
    isNcForBuyBoxApplied === true ? true : productItem.is_nc_needed;
  if (productItem.repricingRule != null && isOverrideEnabled === false) {
    repriceResult = await Rule.ApplyRule(
      repriceResult!,
      productItem.repricingRule,
      isNcToBeApplied,
      ownProduct,
    );
  }

  if (isOverrideEnabled === true) {
    repriceResult = await Rule.ApplyRule(
      repriceResult!,
      productItem.override_bulk_rule,
      isNcToBeApplied,
      ownProduct,
    );
  }

  //Apply Rule for Do Not Deactivate Q PriceBreak
  repriceResult = await Rule.ApplyDeactivateQPriceBreakRule(
    repriceResult!,
    productItem.abortDeactivatingQPriceBreak,
  );

  // Apply MultiPrice Rule Check
  repriceResult = await Rule.ApplyMultiPriceBreakRule(repriceResult);

  //Apply Beat Q Price(MinQty #1) Rule
  if (productItem.beatQPrice != null && productItem.beatQPrice === true) {
    repriceResult = await Rule.ApplyBeatQPriceRule(repriceResult);
  }

  //Apply Percentage Up Rule
  if (
    productItem.percentageIncrease != null &&
    productItem.percentageIncrease > 0
  ) {
    repriceResult = await Rule.ApplyPercentagePriceRule(
      repriceResult,
      productItem.percentageIncrease,
    );
  }

  // Apply Buy Box Logic post all execution
  if (productItem.applyBuyBoxLogic && productItem.applyBuyBoxLogic === true) {
    repriceResult = await Rule.ApplyBuyBoxRule(repriceResult, result);
  }

  //Apply Keep Position Logic
  if (productItem.keepPosition && productItem.keepPosition === true) {
    repriceResult = await Rule.ApplyKeepPositionLogic(
      repriceResult,
      result,
      productItem.ownVendorId!,
    );
  }

  //Apply Suppress_Price_Break_For_One Rule
  if (
    isOverrideEnabled === true ||
    (productItem.suppressPriceBreakForOne != null &&
      productItem.suppressPriceBreakForOne === true)
  ) {
    repriceResult = await Rule.ApplySuppressPriceBreakRule(
      repriceResult,
      1,
      isOverrideEnabled,
    );
  }

  //Apply Floor Check Rule
  repriceResult = await Rule.ApplyFloorCheckRule(
    repriceResult,
    parseFloat(productItem.floorPrice),
  );

  //Append #InvThreshold if InventoryThreshold Scenario is executed
  if (
    productItem.inventoryThreshold != null &&
    productItem.inventoryThreshold > 0
  ) {
    if (
      repriceResult.listOfRepriceDetails &&
      repriceResult.listOfRepriceDetails.length > 0
    ) {
      repriceResult.listOfRepriceDetails.forEach(($: any) => {
        $.explained = `${$.explained} #InvThreshold`;
      });
    } else if (repriceResult.repriceDetails) {
      repriceResult.repriceDetails.explained = `${repriceResult.repriceDetails.explained} #InvThreshold`;
    }
  }

  // Apply to Reprice Down Badge % Rule
  repriceResult = await Rule.ApplyRepriceDownBadgeCheckRule(
    repriceResult,
    result,
    productItem,
    parseFloat(productItem.badgePercentageDown),
  );

  // Apply MultiPrice Rule Check after Badge % as well to restrict Price Change due to %
  repriceResult = await Rule.ApplyMultiPriceBreakRule(repriceResult);

  // Append $NEW for New Price Break Activation
  repriceResult = await Rule.AppendNewPriceBreakActivation(repriceResult);

  //Last Reprice Check for Identical Sister Price
  repriceResult = await Rule.ApplySisterComparisonCheck(
    repriceResult,
    result,
    productItem,
  );

  //Update TriggeredByVendor
  await mySqlHelper.UpdateTriggeredByVendor(repriceResult, contextVendor, mpid);

  // Update History
  const historyIdentifier = await HistoryHelper.Execute(
    mpid,
    repriceResult,
    output,
    isNcToBeApplied,
    contextVendor,
    productItem.contextCronName,
  );
  output = productItem.scrapeOn === true ? output : [];

  let outputResponse = new RepriceAsyncResponse(repriceResult!, output);

  const repriceNeeded = isPriceUpdateRequired(
    repriceResult!,
    productItem.allowReprice,
  );

  const isDev = applicationConfig.IS_DEV;
  if (!repriceNeeded) {
    return {
      cronResponse: outputResponse,
      priceUpdateResponse: null,
      historyIdentifier: historyIdentifier,
    };
  }

  // Reprice is needed

  const isWaitingForNextRun = await filterMapper.IsWaitingForNextRun(
    mpid,
    contextVendor,
    productItem,
  );

  if (!isWaitingForNextRun) {
    let priceUpdatedRequest: any = {};
    priceUpdatedRequest.secretKey = await getSecretKey(
      productItem.cronId,
      contextVendor,
    );
    const priceUpdateUrl = apiMapping.find(
      (x: any) => x.vendor === contextVendor.toUpperCase(),
    )?.priceUpdateUrl;
    let priceUpdatedResponse = null;

    const priceChangeAllowed =
      productItem.algo_execution_mode === AlgoExecutionMode.V1_ONLY ||
      productItem.algo_execution_mode === AlgoExecutionMode.V1_EXECUTE_V2_DRY;

    if (repriceResult?.isMultiplePriceBreakAvailable !== true) {
      priceUpdatedRequest.payload = new UpdateRequest(
        mpid,
        repriceResult?.repriceDetails?.newPrice,
        1,
        productItem.cronName,
      );

      if (isDev === false && priceChangeAllowed) {
        priceUpdatedResponse = await axiosHelper.postAsync(
          priceUpdatedRequest,
          priceUpdateUrl!,
        );
      } else {
        priceUpdatedResponse = {
          data: {
            status: "SUCCESS",
            type: "dummy",
            url: priceUpdateUrl,
          },
        };
      }
    } else {
      priceUpdatedRequest.payload = new UpdateRequest(
        mpid,
        0,
        1,
        productItem.cronName,
      );
      priceUpdatedRequest.payload.priceList = [];
      repriceResult.listOfRepriceDetails.forEach(($rpBreak: any) => {
        if ($rpBreak.isRepriced === true) {
          if ($rpBreak.active === false || $rpBreak.active === 0) {
            priceUpdatedRequest.payload.priceList.push(
              new PriceList($rpBreak.oldPrice, $rpBreak.minQty, 0),
            );
          } else {
            priceUpdatedRequest.payload.priceList.push(
              new PriceList($rpBreak.newPrice, $rpBreak.minQty),
            );
          }
        }
      });
      if (priceUpdatedRequest.payload.priceList.length > 0) {
        if (isDev === false && priceChangeAllowed) {
          priceUpdatedResponse = await axiosHelper.postAsync(
            priceUpdatedRequest,
            priceUpdateUrl!,
          );
        } else {
          priceUpdatedResponse = {
            data: {
              status: "SUCCESS",
              type: "dummy",
              url: priceUpdateUrl,
              message: "ERROR:422 : CUSTOM ERROR",
            },
          };
        }
      }
    }
    if (priceUpdatedResponse && priceUpdatedResponse.data) {
      if (
        priceUpdatedResponse.data.message &&
        (JSON.stringify(priceUpdatedResponse.data.message).indexOf(
          "ERROR:422",
        ) > -1 ||
          JSON.stringify(priceUpdatedResponse.data.message).indexOf(
            "ERROR:429",
          ) > -1 ||
          JSON.stringify(priceUpdatedResponse.data.message).indexOf(
            "ERROR:404",
          ) > -1 ||
          JSON.stringify(priceUpdatedResponse.data.message).indexOf("ERROR:") >
            -1)
      ) {
        if (
          outputResponse.repriceData &&
          outputResponse.repriceData.isMultiplePriceBreakAvailable === true &&
          outputResponse.repriceData.listOfRepriceDetails
        ) {
          outputResponse.repriceData.listOfRepriceDetails.forEach(
            ($lp: any) => {
              if ($lp.isRepriced === true) {
                $lp.explained = `${$lp.explained}:FAILED(ERROR:${JSON.stringify(priceUpdatedResponse.data.message)})`;
                $lp.isRepriced = false;
              }
            },
          );
        } else if (
          outputResponse.repriceData &&
          outputResponse.repriceData.isMultiplePriceBreakAvailable === false &&
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
          outputResponse.repriceData.isMultiplePriceBreakAvailable == true &&
          outputResponse.repriceData.listOfRepriceDetails
        ) {
          for (let $lp of outputResponse.repriceData.listOfRepriceDetails) {
            if ($lp.explained && $lp.explained.indexOf("#NEW") < 0) {
              const priceStepValue = await getPriceStepValue($lp);
              $lp.explained = `${$lp.explained} | ${priceStepValue}`;
            }
          }
        } else if (
          outputResponse.repriceData &&
          outputResponse.repriceData.isMultiplePriceBreakAvailable == false &&
          outputResponse.repriceData.repriceDetails
        ) {
          if (
            outputResponse.repriceData.repriceDetails.explained &&
            outputResponse.repriceData.repriceDetails.explained.indexOf(
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
    }

    const repriceResultStatus = await ResultParser.Parse(repriceResult);

    await mySqlHelper.UpdateRepriceResultStatus(
      repriceResultStatus,
      mpid,
      contextVendor,
    );

    return {
      cronResponse: outputResponse,
      priceUpdateResponse: priceUpdatedResponse?.data,
      historyIdentifier: historyIdentifier,
    };
  } else {
    repriceResult =
      await Rule.OverrideRepriceResultForExpressCron(repriceResult);
  }
}
