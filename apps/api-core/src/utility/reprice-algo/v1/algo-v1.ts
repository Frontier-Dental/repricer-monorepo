import _ from "lodash";
import { RepriceAsyncResponse } from "../../../model/reprice-async-response";
import { RepriceMessageEnum } from "../../../model/reprice-message";
import { RepriceModel } from "../../../model/reprice-model";
import { PriceList, UpdateRequest } from "../../../model/update-request";
import { apiMapping } from "../../../resources/api-mapping";
import { FrontierProduct } from "../../../types/frontier";
import { Net32Product } from "../../../types/net32";
import * as axiosHelper from "../../axios-helper";
import { applicationConfig } from "../../config";
import * as formatter from "../../format-wrapper";
import * as HistoryHelper from "../../history-helper";
import * as mySqlHelper from "../../mysql/mysql-helper";
import * as repriceHelper from "./reprice-helper";
import * as repriceHelperNc from "./reprice-helper-nc";
import * as Rule from "./repricer-rule-helper";
import * as responseUtility from "../../response-utility";
import { getIsFloorReached, getPriceStepValue, getSamePriceBreakDetails, getSecretKey, isOverrideEnabledForProduct, isPriceUpdateRequired, MinQtyPricePresent, notQ2VsQ1 } from "./shared";
import { AlgoExecutionMode } from "@repricer-monorepo/shared";
import * as ResultParser from "../../../utility/repriceResultParser";
import * as filterMapper from "../../../utility/filter-mapper";
import * as buyBoxHelper from "../../../utility/buy-box-helper";
import { findTinyProxyConfigByVendorId } from "../../mysql/tinyproxy-configs";
import { updatePrice } from "../v2/wrapper";

export async function repriceProduct(mpid: string, net32Products: Net32Product[], internalProduct: any, contextVendor: string) {
  let productItem = internalProduct;

  let result = net32Products;
  let repriceResult: RepriceModel | undefined;
  let ownVendorAvailableInStock = true;
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
      cronResponse: new RepriceAsyncResponse(new RepriceModel(mpid, null, productItem.productName, productItem.unitPrice, false, false, [], RepriceMessageEnum.IGNORE_NOT_FOUND_API), output),
      priceUpdateResponse: null,
      historyIdentifier: null,
    };
  }

  // Do MultiPrice Reprice  - Compete with other vendors
  const flagMultiPriceUpdate = applicationConfig.FLAG_MULTI_PRICE_UPDATE;

  if (flagMultiPriceUpdate === true) {
    const distinctPriceBreaks = await repriceHelper.GetDistinctPriceBreaksAcrossVendors(output, ownProduct, productItem);
    if (distinctPriceBreaks) {
      distinctPriceBreaks.forEach(($) => {
        ownProduct.priceBreaks.push($);
      });
    }
  }

  const isMinQty2PriceBreakExists = MinQtyPricePresent(ownProduct.priceBreaks, 2);

  if (productItem.compareWithQ1 && !isMinQty2PriceBreakExists) {
    ownProduct.priceBreaks.push({
      minQty: 2,
      unitPrice: 0,
      active: true,
    });
  }

  if (productItem && ownProduct && ownProduct.inStock) {
    if (ownProduct.priceBreaks && (ownProduct.priceBreaks.length === 1 || productItem.suppressPriceBreak)) {
      repriceResult = productItem.is_nc_needed == true ? await repriceHelperNc.Reprice(ownProduct, output, productItem, mpid) : await repriceHelper.Reprice(ownProduct, output, productItem, mpid);
    } else if (ownProduct.priceBreaks && ownProduct.priceBreaks.length > 1) {
      let multipleRepriceData = new RepriceModel(mpid, ownProduct, productItem.productName, null, false, true);

      for (const priceBreak of ownProduct.priceBreaks) {
        const otherVendorRepriceDetails = await getSamePriceBreakDetails(output, priceBreak, productItem);

        let indRepriceResult: RepriceModel;
        indRepriceResult = productItem.is_nc_needed == true ? await repriceHelperNc.RepriceIndividualPriceBreak(ownProduct, output, productItem, mpid, priceBreak) : await repriceHelper.RepriceIndividualPriceBreak(ownProduct, output, productItem, mpid, priceBreak);

        if (otherVendorRepriceDetails && otherVendorRepriceDetails.length === 0 && priceBreak.minQty !== 1 && notQ2VsQ1(priceBreak.minQty, productItem.compareWithQ1)) {
          indRepriceResult.togglePricePoint(false);
          indRepriceResult.togglePriceUpdation(true);
        }

        multipleRepriceData.listOfRepriceDetails.push(indRepriceResult.repriceDetails!);
      }
      repriceResult = multipleRepriceData;
    }
  } else {
    ownVendorAvailableInStock = false;
    repriceResult = new RepriceModel(mpid, ownProduct, productItem.productName, productItem.unitPrice, false, false, [], RepriceMessageEnum.IGNORE_PRODUCT_INACTIVE);
  }

  let isNcForBuyBoxApplied = false;
  //Apply NC Buy Box
  if (productItem.applyNcForBuyBox && productItem.applyNcForBuyBox) {
    if (repriceResult!.listOfRepriceDetails && repriceResult!.listOfRepriceDetails.length > 0) {
      let copiedRepriceResult = _.cloneDeep(repriceResult);
      copiedRepriceResult!.listOfRepriceDetails = [];
      for (const $eval of repriceResult!.listOfRepriceDetails) {
        const isFloorReached = await getIsFloorReached($eval);
        if (isFloorReached) {
          const contextPriceBreak = ownProduct.priceBreaks.find((x: any) => x.minQty == $eval.minQty);
          let overridingRepriceResult = await repriceHelperNc.RepriceIndividualPriceBreak(ownProduct, output, productItem, mpid, contextPriceBreak);
          overridingRepriceResult.repriceDetails!.explained = `${overridingRepriceResult.repriceDetails!.explained} #NCBuyBox`;
          copiedRepriceResult!.listOfRepriceDetails.push(overridingRepriceResult.repriceDetails!);
          isNcForBuyBoxApplied = true;
        } else {
          copiedRepriceResult!.listOfRepriceDetails.push($eval);
        }
      }
      repriceResult = copiedRepriceResult;
    } else if (repriceResult!.repriceDetails) {
      const isFloorReached = await getIsFloorReached(repriceResult!.repriceDetails);
      if (isFloorReached) {
        repriceResult = await repriceHelperNc.Reprice(ownProduct, output, productItem, mpid);
        repriceResult!.repriceDetails!.explained = `${repriceResult!.repriceDetails!.explained} #NCBuyBox`;
        isNcForBuyBoxApplied = true;
      }
    }
  }

  // Apply Reprice Rule for Product
  const isOverrideEnabled = await isOverrideEnabledForProduct(productItem.override_bulk_update, productItem.isSlowCronRun);
  const isNcToBeApplied = isNcForBuyBoxApplied ? true : productItem.is_nc_needed;

  if (isOverrideEnabled) {
    repriceResult = await Rule.ApplyRule(repriceResult!, productItem.override_bulk_rule, isNcToBeApplied, ownProduct);
  }
  if (productItem.repricingRule != null && !isOverrideEnabled) {
    repriceResult = await Rule.ApplyRule(repriceResult!, productItem.repricingRule, isNcToBeApplied, ownProduct);
  }

  //Apply Rule for Do Not Deactivate Q PriceBreak
  repriceResult = await Rule.ApplyDeactivateQPriceBreakRule(repriceResult!, productItem.abortDeactivatingQPriceBreak);

  // Apply MultiPrice Rule Check
  repriceResult = await Rule.ApplyMultiPriceBreakRule(repriceResult);

  //Apply Beat Q Price(MinQty #1) Rule
  if (productItem.beatQPrice != null && productItem.beatQPrice) {
    repriceResult = await Rule.ApplyBeatQPriceRule(repriceResult);
  }

  //Apply Percentage Up Rule
  if (productItem.percentageIncrease != null && productItem.percentageIncrease > 0) {
    repriceResult = await Rule.ApplyPercentagePriceRule(repriceResult, productItem.percentageIncrease);
  }

  // Apply Buy Box Logic post all execution
  if (productItem.applyBuyBoxLogic && productItem.applyBuyBoxLogic) {
    repriceResult = await Rule.ApplyBuyBoxRule(repriceResult, result);
  }

  //Apply Keep Position Logic
  if (productItem.keepPosition && productItem.keepPosition) {
    repriceResult = await Rule.ApplyKeepPositionLogic(repriceResult, result, productItem.ownVendorId!);
  }

  //Apply Suppress_Price_Break_For_One Rule
  if (isOverrideEnabled || (productItem.suppressPriceBreakForOne != null && productItem.suppressPriceBreakForOne)) {
    repriceResult = await Rule.ApplySuppressPriceBreakRule(repriceResult, 1, isOverrideEnabled);
  }

  //Apply Floor Check Rule
  repriceResult = await Rule.ApplyFloorCheckRule(repriceResult, parseFloat(productItem.floorPrice));

  //Append #InvThreshold if InventoryThreshold Scenario is executed
  if (productItem.inventoryThreshold != null && productItem.inventoryThreshold > 0) {
    if (repriceResult.listOfRepriceDetails && repriceResult.listOfRepriceDetails.length > 0) {
      repriceResult.listOfRepriceDetails.forEach(($: any) => {
        $.explained = `${$.explained} #InvThreshold`;
      });
    } else if (repriceResult.repriceDetails) {
      repriceResult.repriceDetails.explained = `${repriceResult.repriceDetails.explained} #InvThreshold`;
    }
  }

  // Apply to Reprice Down Badge % Rule
  repriceResult = await Rule.ApplyRepriceDownBadgeCheckRule(repriceResult, result, productItem, parseFloat(productItem.badgePercentageDown));

  // Apply MultiPrice Rule Check after Badge % as well to restrict Price Change due to %
  repriceResult = await Rule.ApplyMultiPriceBreakRule(repriceResult);

  // Append $NEW for New Price Break Activation
  repriceResult = await Rule.AppendNewPriceBreakActivation(repriceResult);

  //Apply Shipping BuyBox Rule
  if (productItem.getBBShipping && repriceResult!.listOfRepriceDetails.length === 0) {
    repriceResult = await buyBoxHelper.parseShippingBuyBox(repriceResult, result, productItem);
  }

  //Apply Badge BuyBox Rule
  if (productItem.getBBBadge && repriceResult!.listOfRepriceDetails.length === 0) {
    repriceResult = await buyBoxHelper.parseBadgeBuyBox(repriceResult, result, productItem);
  }

  //Last Reprice Check for Identical Sister Price
  repriceResult = await Rule.ApplySisterComparisonCheck(repriceResult, result, productItem);

  //Apply MAX Price Check
  if (ownVendorAvailableInStock) {
    repriceResult = await Rule.ApplyMaxPriceCheck(repriceResult, productItem);
  }

  // Align IsRepriced Field Based on Price Suggestion
  repriceResult = await Rule.AlignIsRepriced(repriceResult);

  //Update TriggeredByVendor
  await mySqlHelper.UpdateTriggeredByVendor(repriceResult, contextVendor, mpid);

  // Update History
  const historyIdentifier = await HistoryHelper.Execute(mpid, repriceResult!, output, isNcToBeApplied, contextVendor, productItem.contextCronName);

  //Update Reprice Result Status
  const repriceResultStatus = await ResultParser.Parse(repriceResult);
  await mySqlHelper.UpdateRepriceResultStatus(repriceResultStatus, mpid, contextVendor);

  output = productItem.scrapeOn ? output : [];

  let outputResponse = new RepriceAsyncResponse(repriceResult!, output);

  const repriceNeeded = isPriceUpdateRequired(repriceResult!, productItem.allowReprice);

  const isDev = applicationConfig.IS_DEV;
  if (!repriceNeeded) {
    return {
      cronResponse: outputResponse,
      priceUpdateResponse: null,
      historyIdentifier: historyIdentifier,
    };
  }

  // Reprice is needed

  const isWaitingForNextRun = await filterMapper.IsWaitingForNextRun(mpid, contextVendor, productItem);

  if (!isWaitingForNextRun) {
    let priceUpdatedRequest: any = {};
    priceUpdatedRequest.secretKey = await getSecretKey(productItem.cronId, contextVendor);
    const priceUpdateUrl = apiMapping.find((x: any) => x.vendor === contextVendor.toUpperCase())?.priceUpdateUrl;
    let priceUpdatedResponse = null;

    const priceChangeAllowed = productItem.algo_execution_mode === AlgoExecutionMode.V1_ONLY || productItem.algo_execution_mode === AlgoExecutionMode.V1_EXECUTE_V2_DRY;
    const contextVendorId = productItem.ownVendorId;
    const proxyConfig = await findTinyProxyConfigByVendorId(parseInt(contextVendorId));
    if (repriceResult?.isMultiplePriceBreakAvailable !== true) {
      priceUpdatedRequest.payload = new UpdateRequest(mpid, repriceResult?.repriceDetails?.newPrice, 1, productItem.cronName);
      if (!isDev && priceChangeAllowed) {
        if (applicationConfig.PRICE_UPDATE_V2_ENABLED) {
          priceUpdatedResponse = await updatePrice(proxyConfig, priceUpdatedRequest.secretKey, priceUpdatedRequest.payload);
        } else {
          priceUpdatedResponse = await axiosHelper.postAsync(priceUpdatedRequest, priceUpdateUrl!);
        }
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
      priceUpdatedRequest.payload = new UpdateRequest(mpid, 0, 1, productItem.cronName);
      priceUpdatedRequest.payload.priceList = [];
      repriceResult.listOfRepriceDetails.forEach(($rpBreak: any) => {
        if ($rpBreak.isRepriced === true) {
          if ($rpBreak.active === false || $rpBreak.active === 0) {
            priceUpdatedRequest.payload.priceList.push(new PriceList($rpBreak.oldPrice, $rpBreak.minQty, 0));
          } else {
            priceUpdatedRequest.payload.priceList.push(new PriceList($rpBreak.newPrice, $rpBreak.minQty));
          }
        }
      });
      if (priceUpdatedRequest.payload.priceList.length > 0) {
        if (!isDev && priceChangeAllowed) {
          if (applicationConfig.PRICE_UPDATE_V2_ENABLED) {
            priceUpdatedResponse = await updatePrice(proxyConfig, priceUpdatedRequest.secretKey, priceUpdatedRequest.payload);
          } else {
            priceUpdatedResponse = await axiosHelper.postAsync(priceUpdatedRequest, priceUpdateUrl!);
          }
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
      if (priceUpdatedResponse.data.message && (JSON.stringify(priceUpdatedResponse.data.message).indexOf("ERROR:422") > -1 || JSON.stringify(priceUpdatedResponse.data.message).indexOf("ERROR:429") > -1 || JSON.stringify(priceUpdatedResponse.data.message).indexOf("ERROR:404") > -1 || JSON.stringify(priceUpdatedResponse.data.message).indexOf("ERROR:") > -1)) {
        if (outputResponse.repriceData && outputResponse.repriceData.isMultiplePriceBreakAvailable && outputResponse.repriceData.listOfRepriceDetails) {
          outputResponse.repriceData.listOfRepriceDetails.forEach(($lp: any) => {
            if ($lp.isRepriced === true) {
              $lp.explained = `${$lp.explained}:FAILED(ERROR:${JSON.stringify(priceUpdatedResponse.data.message)})`;
              $lp.isRepriced = false;
            }
          });
        } else if (outputResponse.repriceData && !outputResponse.repriceData.isMultiplePriceBreakAvailable && outputResponse.repriceData.repriceDetails) {
          outputResponse.repriceData.repriceDetails.explained = `${outputResponse.repriceData.repriceDetails.explained}:FAILED(ERROR:${JSON.stringify(priceUpdatedResponse.data.message)})`;
          outputResponse.repriceData.repriceDetails.isRepriced = false;
        }
        //return res.status(_codes.StatusCodes.OK).json({ "cronResponse": outputResponse, "priceUpdateResponse": null });
      } else if (priceUpdatedResponse.data) {
        // Update $UP or $DOWN if Price Update is Successful.
        if (outputResponse.repriceData && outputResponse.repriceData.isMultiplePriceBreakAvailable && outputResponse.repriceData.listOfRepriceDetails) {
          for (let $lp of outputResponse.repriceData.listOfRepriceDetails) {
            if ($lp.explained && $lp.explained.indexOf("#NEW") < 0) {
              const priceStepValue = await getPriceStepValue($lp);
              $lp.explained = `${$lp.explained} | ${priceStepValue}`;
            }
          }
        } else if (outputResponse.repriceData && !outputResponse.repriceData.isMultiplePriceBreakAvailable && outputResponse.repriceData.repriceDetails) {
          if (outputResponse.repriceData.repriceDetails.explained && outputResponse.repriceData.repriceDetails.explained.indexOf("#NEW") < 0) {
            const priceStepValue = await getPriceStepValue(outputResponse.repriceData.repriceDetails);
            outputResponse.repriceData.repriceDetails.explained = `${outputResponse.repriceData.repriceDetails.explained} | ${priceStepValue}`;
          }
        }
      }
    }

    const repriceResultStatus = await ResultParser.Parse(repriceResult);

    await mySqlHelper.UpdateRepriceResultStatus(repriceResultStatus, mpid, contextVendor);

    return {
      cronResponse: outputResponse,
      priceUpdateResponse: priceUpdatedResponse?.data,
      historyIdentifier: historyIdentifier,
    };
  } else {
    repriceResult = await Rule.OverrideRepriceResultForExpressCron(repriceResult);
    outputResponse = new RepriceAsyncResponse(repriceResult!, output);
    return {
      cronResponse: outputResponse,
      priceUpdateResponse: null,
      historyIdentifier: historyIdentifier,
    };
  }
}

export async function repriceProductToMax(mpid: string, net32Products: Net32Product[], internalProduct: FrontierProduct, contextVendor: string) {
  try {
    let productItem = internalProduct;
    let result = net32Products;
    let repriceResult: RepriceModel;
    if (result && result.length > 0) {
      // Format Response as per Expected Net32 Response
      result = await formatter.FormatActiveField(result);
      result = await formatter.FormatShippingThreshold(result);
      productItem = await formatter.SetGlobalDetails(productItem, contextVendor);

      let ownProduct = await responseUtility.GetOwnProduct(result, productItem);
      let output = await responseUtility.FilterActiveResponse(result, productItem);
      if (!ownProduct) {
        return; //throw new Error("Could not find own product in Net32 Response");
      }

      if (productItem && ownProduct && ownProduct.inStock == true) {
        if (ownProduct.priceBreaks) {
          repriceResult = await repriceHelper.RepriceToMax(ownProduct, output, productItem, mpid);
        }
      }

      // Update History
      await HistoryHelper.Execute(mpid, repriceResult!, output, false, contextVendor);

      output = productItem.scrapeOn == true ? output : [];
      let outputResponse = new RepriceAsyncResponse(repriceResult!, output);
      const repriceNeeded = await isPriceUpdateRequired(repriceResult!, productItem.allowReprice);
      // const repriceNeeded = false;
      if (repriceNeeded) {
        let priceUpdatedRequest: any = {};
        priceUpdatedRequest.secretKey = await getSecretKey(productItem.cronId, contextVendor);
        const priceUpdateUrl = apiMapping.find((x: any) => x.vendor == contextVendor.toUpperCase())?.priceUpdateUrl;
        let priceUpdatedResponse = null;
        if (repriceResult! && repriceResult.isMultiplePriceBreakAvailable != true) {
          priceUpdatedRequest.payload = new UpdateRequest(mpid, repriceResult?.repriceDetails?.newPrice, 1, productItem.cronName);
          const isDev = JSON.parse(process.env.IS_DEV!);
          if (isDev == false) {
            priceUpdatedResponse = await axiosHelper.postAsync(priceUpdatedRequest, priceUpdateUrl!);
          } else {
            priceUpdatedResponse = {
              data: { status: "SUCCESS", type: "dummy", url: priceUpdateUrl },
            };
          }
        }
        if (priceUpdatedResponse && priceUpdatedResponse.data) {
          try {
            if (priceUpdatedResponse.data.message && (JSON.stringify(priceUpdatedResponse.data.message).indexOf("ERROR:422") > -1 || JSON.stringify(priceUpdatedResponse.data.message).indexOf("ERROR:429") > -1 || JSON.stringify(priceUpdatedResponse.data.message).indexOf("ERROR:404") > -1 || JSON.stringify(priceUpdatedResponse.data.message).indexOf("ERROR:") > -1)) {
              if (outputResponse.repriceData && outputResponse.repriceData.isMultiplePriceBreakAvailable == false && outputResponse.repriceData.repriceDetails) {
                outputResponse.repriceData.repriceDetails.explained = `${outputResponse.repriceData.repriceDetails.explained}:FAILED(ERROR:${JSON.stringify(priceUpdatedResponse.data.message)})`;
                outputResponse.repriceData.repriceDetails.isRepriced = false;
              }
              //return res.status(_codes.StatusCodes.OK).json({ "cronResponse": outputResponse, "priceUpdateResponse": null });
            } else if (priceUpdatedResponse.data) {
              // Update $UP or $DOWN if Price Update is Successful.
              if (outputResponse.repriceData && outputResponse.repriceData.isMultiplePriceBreakAvailable == false && outputResponse.repriceData.repriceDetails) {
                if (outputResponse.repriceData.repriceDetails.explained && outputResponse.repriceData.repriceDetails.explained.indexOf("#NEW") < 0) {
                  const priceStepValue = await getPriceStepValue(outputResponse.repriceData.repriceDetails);
                  outputResponse.repriceData.repriceDetails.explained = `${outputResponse.repriceData.repriceDetails.explained} | ${priceStepValue}`;
                }
              }
            }
          } catch (exception) {
            console.error({ FOR: mpid, EXCEPTION: exception });
          }

          return {
            cronResponse: outputResponse,
            priceUpdateResponse: priceUpdatedResponse.data,
          };
        }
      }
      return {
        cronResponse: outputResponse,
        priceUpdateResponse: null,
      };
    }
    //throw new Error("Sorry some error occurred!");
  } catch (exception) {
    console.error({ MPID: mpid, EXCEPTION: exception });
    //throw exception;
  }
}
