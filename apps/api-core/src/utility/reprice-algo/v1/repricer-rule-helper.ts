import _ from "lodash";
import { RepriceMessageEnum } from "../../../model/reprice-message";
import { RepriceRenewedMessageEnum } from "../../../model/reprice-renewed-message";
import * as filterMapper from "../../filter-mapper";
import * as globalParam from "../../../model/global-param";
import { RepriceModel } from "../../../model/reprice-model";
import { Net32Product } from "../../../types/net32";
import { FrontierProduct } from "../../../types/frontier";
import { applicationConfig } from "../../config";

export function ApplyRule(repriceResult: any, ruleIdentifier: number, isNcNeeded?: boolean, net32Details?: Net32Product) {
  let $eval = repriceResult;
  switch (ruleIdentifier) {
    case -1: // Please Select
    case 2: //Both
      /* do nothing */
      break;
    case 0: //Only Up
      if ($eval.listOfRepriceDetails && $eval.listOfRepriceDetails.length > 0) {
        for (let $ of $eval.listOfRepriceDetails) {
          if ($.newPrice != "N/A") {
            const calculatedOldPrice = isNcNeeded == false ? parseFloat($.oldPrice as unknown as string) : getNcCalculatedPrice($, net32Details);
            if (parseFloat($.newPrice as unknown as string) < calculatedOldPrice) {
              $.goToPrice = $.newPrice;
              $.newPrice = "N/A";
              $.isRepriced = false;
              $.explained = $.explained == RepriceRenewedMessageEnum.IGNORED_FLOOR_REACHED ? $.explained + "_" + RepriceMessageEnum.IGNORED_PRODUCT_SETTING_RULE_ONLY_UP : RepriceMessageEnum.IGNORED_PRODUCT_SETTING_RULE_ONLY_UP;
            }
          }
        }
      } else if ($eval.repriceDetails) {
        if ($eval.repriceDetails.newPrice != "N/A") {
          const calculatedOldPrice = isNcNeeded == false ? parseFloat($eval.repriceDetails.oldPrice as unknown as string) : getNcCalculatedPrice($eval.repriceDetails, net32Details);
          if (parseFloat($eval.repriceDetails.newPrice as unknown as string) < calculatedOldPrice) {
            $eval.repriceDetails.goToPrice = $eval.repriceDetails.newPrice as unknown as string;
            $eval.repriceDetails.newPrice = "N/A";
            $eval.repriceDetails.isRepriced = false;
            $eval.repriceDetails.explained = $eval.repriceDetails.explained == RepriceRenewedMessageEnum.IGNORED_FLOOR_REACHED ? $eval.repriceDetails.explained + "_" + RepriceMessageEnum.IGNORED_PRODUCT_SETTING_RULE_ONLY_UP : RepriceMessageEnum.IGNORED_PRODUCT_SETTING_RULE_ONLY_UP;
          }
        }
      }
      break;
    case 1: //Only Down
      if ($eval.listOfRepriceDetails && $eval.listOfRepriceDetails.length > 0) {
        for (let $ of $eval.listOfRepriceDetails) {
          if ($.oldPrice != 0 && $.newPrice != "N/A") {
            const calculatedOldPrice = isNcNeeded == false ? parseFloat($.oldPrice as unknown as string) : getNcCalculatedPrice($, net32Details);
            if (parseFloat($.newPrice as unknown as string) > calculatedOldPrice || $.explained == RepriceRenewedMessageEnum.SHUT_DOWN_NO_COMPETITOR || $.explained == RepriceRenewedMessageEnum.SHUT_DOWN_FLOOR_REACHED) {
              $.goToPrice = $.newPrice;
              $.newPrice = "N/A";
              $.isRepriced = false;
              $.explained = $.explained == RepriceRenewedMessageEnum.IGNORED_FLOOR_REACHED || RepriceRenewedMessageEnum.PRICE_UP_SECOND_FLOOR_HIT ? $.explained + "_" + RepriceMessageEnum.IGNORED_PRODUCT_SETTING_RULE_ONLY_DOWN : RepriceMessageEnum.IGNORED_PRODUCT_SETTING_RULE_ONLY_DOWN;
            }
          }
        }
      } else if ($eval.repriceDetails) {
        if ($eval.repriceDetails.newPrice != "N/A") {
          const calculatedOldPrice = isNcNeeded == false ? parseFloat($eval.repriceDetails.oldPrice as unknown as string) : getNcCalculatedPrice($eval.repriceDetails, net32Details);
          if (parseFloat($eval.repriceDetails.newPrice as unknown as string) > calculatedOldPrice) {
            $eval.repriceDetails.goToPrice = $eval.repriceDetails.newPrice as unknown as string;
            $eval.repriceDetails.newPrice = "N/A";
            $eval.repriceDetails.isRepriced = false;
            $eval.repriceDetails.explained = $eval.repriceDetails.explained == RepriceRenewedMessageEnum.IGNORED_FLOOR_REACHED || RepriceRenewedMessageEnum.PRICE_UP_SECOND_FLOOR_HIT ? $eval.repriceDetails.explained + "_" + RepriceMessageEnum.IGNORED_PRODUCT_SETTING_RULE_ONLY_DOWN : RepriceMessageEnum.IGNORED_PRODUCT_SETTING_RULE_ONLY_DOWN;
          }
        }
      }
      break;
    default:
      break;
  }
  return $eval;
}

export function ApplyMultiPriceBreakRule(repriceResult: RepriceModel) {
  repriceResult.listOfRepriceDetails = _.sortBy(repriceResult.listOfRepriceDetails, ["minQty"]);
  let $eval = _.cloneDeep(repriceResult);
  if ($eval.listOfRepriceDetails && $eval.listOfRepriceDetails.length > 0) {
    $eval.listOfRepriceDetails = [];
    let _eval_ = [];
    for (let idx = repriceResult.listOfRepriceDetails.length - 1; idx >= 0; idx--) {
      if (repriceResult.listOfRepriceDetails[idx].minQty === 1) {
        _eval_.push(repriceResult.listOfRepriceDetails[idx]);
      } else {
        const sourcePrice = repriceResult.listOfRepriceDetails[idx].newPrice !== "N/A" ? parseFloat(repriceResult.listOfRepriceDetails[idx].newPrice as unknown as string) : repriceResult.listOfRepriceDetails[idx].oldPrice;
        let success = true;
        for (let k = 0; k < idx; k++) {
          const comparablePrice = repriceResult.listOfRepriceDetails[k].newPrice !== "N/A" ? parseFloat(repriceResult.listOfRepriceDetails[k].newPrice as unknown as string) : repriceResult.listOfRepriceDetails[k].oldPrice;
          if (sourcePrice >= comparablePrice && comparablePrice !== 0) {
            success = false;
          }
        }
        if (success) {
          if (repriceResult.listOfRepriceDetails[idx].oldPrice !== 0) {
            _eval_.push(repriceResult.listOfRepriceDetails[idx]);
          } else if (repriceResult.listOfRepriceDetails[idx].oldPrice === 0 && repriceResult.listOfRepriceDetails[idx].newPrice !== "N/A") {
            _eval_.push(repriceResult.listOfRepriceDetails[idx]);
          }
        } else if (repriceResult.listOfRepriceDetails[idx].oldPrice !== 0) {
          let dummyPricePoint = _.cloneDeep(repriceResult.listOfRepriceDetails[idx]);
          if (dummyPricePoint.explained === RepriceRenewedMessageEnum.PRICE_UP_SECOND) {
            dummyPricePoint.newPrice = 0 as unknown as string;
            dummyPricePoint.isRepriced = true;
            dummyPricePoint.explained = dummyPricePoint.explained + "_" + RepriceRenewedMessageEnum.SHUT_DOWN_FLOOR_REACHED;
            dummyPricePoint.active = 0 as unknown as boolean;
          } else {
            dummyPricePoint.updatedOn = new Date();
            dummyPricePoint.newPrice = "N/A";
            dummyPricePoint.isRepriced = false;
            dummyPricePoint.explained = dummyPricePoint.explained + "_" + RepriceRenewedMessageEnum.IGNORE_LOWEST_PRICE_BREAK;
          }
          _eval_.push(dummyPricePoint);
        }
      }
    }
    $eval.listOfRepriceDetails = _.sortBy(_eval_, ["minQty"]);
  }

  return $eval;
}

export function ApplySuppressPriceBreakRule(repriceResult: RepriceModel, minQty: number, isOverrideEnabled: boolean) {
  let $eval = _.cloneDeep(repriceResult);
  const isOneQtyChanged = validateQtyReprice($eval.listOfRepriceDetails, minQty, isOverrideEnabled);
  if (isOverrideEnabled) {
    _.remove($eval.listOfRepriceDetails, (rp) => rp.oldPrice == 0);
  }
  if ($eval.listOfRepriceDetails && $eval.listOfRepriceDetails.length > 0) {
    $eval.listOfRepriceDetails.forEach(($) => {
      if ($.minQty != minQty && $.newPrice != "N/A" && parseFloat($.newPrice as unknown as string) != $.oldPrice && !isOneQtyChanged) {
        $.goToPrice = $.newPrice;
        $.newPrice = "N/A";
        $.isRepriced = false;
        $.explained = RepriceMessageEnum.IGNORED_ONE_QTY_SETTING;
      }
    });
    _.remove($eval.listOfRepriceDetails, (rp) => rp.newPrice == "N/A" && rp.oldPrice == 0);
  }
  return $eval;
}

export function ApplyBeatQPriceRule(repriceResult: RepriceModel) {
  let $eval = repriceResult;
  if ($eval.listOfRepriceDetails && $eval.listOfRepriceDetails.length > 0) {
    $eval.listOfRepriceDetails.forEach(($) => {
      if ($.minQty == 1) {
        $.goToPrice = $.newPrice;
        $.newPrice = "N/A";
        $.isRepriced = false;
        $.explained = RepriceMessageEnum.BEAT_Q_PRICE;
      }
    });
  } else if ($eval.repriceDetails) {
    $eval.repriceDetails.goToPrice = $eval.repriceDetails.newPrice as unknown as string;
    $eval.repriceDetails.newPrice = "N/A";
    $eval.repriceDetails.isRepriced = false;
    $eval.repriceDetails.explained = RepriceMessageEnum.BEAT_Q_PRICE_1;
  }
  return $eval;
}

export function ApplyPercentagePriceRule(repriceResult: RepriceModel, percentage: number) {
  let $eval = repriceResult;
  if ($eval.listOfRepriceDetails && $eval.listOfRepriceDetails.length > 0) {
    for (let $ of $eval.listOfRepriceDetails) {
      if ($.oldPrice != 0 && $.newPrice != "N/A" && parseFloat($.newPrice as unknown as string) > $.oldPrice) {
        const isValid = executePercentageCheck($, percentage);
        if (!isValid) {
          $.goToPrice = $.newPrice;
          $.newPrice = "N/A";
          $.isRepriced = false;
          $.explained = RepriceMessageEnum.IGNORED_PERCENTAGE_CHECK;
        }
      }
    }
  } else if ($eval.repriceDetails) {
    if ($eval.repriceDetails.newPrice != "N/A" && parseFloat($eval.repriceDetails.newPrice as unknown as string) > $eval.repriceDetails.oldPrice) {
      const isValid = executePercentageCheck($eval.repriceDetails, percentage);
      if (!isValid) {
        $eval.repriceDetails.goToPrice = $eval.repriceDetails.newPrice as unknown as string;
        $eval.repriceDetails.newPrice = "N/A";
        $eval.repriceDetails.isRepriced = false;
        $eval.repriceDetails.explained = RepriceMessageEnum.IGNORED_PERCENTAGE_CHECK;
      }
    }
  }
  return $eval;
}

export function ApplyDeactivateQPriceBreakRule(repriceResult: RepriceModel, abortDeactivatingQPriceBreak: boolean) {
  let $eval = _.cloneDeep(repriceResult);
  if ($eval.listOfRepriceDetails && $eval.listOfRepriceDetails.length > 0) {
    const isOneQtyChanged = validateQtyReprice($eval.listOfRepriceDetails, 1, false);
    for (let $ of $eval.listOfRepriceDetails) {
      if ($.minQty != 1) {
        const isContextQtyDeactivated = validateQtyDeactivation($eval.listOfRepriceDetails, $.minQty as unknown as number);
        if (isContextQtyDeactivated && !isOneQtyChanged && abortDeactivatingQPriceBreak) {
          $.goToPrice = $.newPrice;
          $.newPrice = "N/A";
          $.isRepriced = false;
          $.active = true;
          $.explained = $.explained + RepriceRenewedMessageEnum.IGNORED_ABORT_Q_DEACTIVATION;
        }
      }
    }
  }
  return $eval;
}

export function ApplyBuyBoxRule(repriceResult: RepriceModel, net32Result: Net32Product[]) {
  let $eval = _.cloneDeep(repriceResult);
  const contextVendorIds = ["17357", "20722", "20755", "20533", "20727", "5"];
  if ($eval.listOfRepriceDetails && $eval.listOfRepriceDetails.length > 0) {
    $eval.listOfRepriceDetails.forEach(($) => {
      if ($.oldPrice != 0 && $.newPrice != "N/A" && parseFloat($.newPrice as unknown as string) < parseFloat($.oldPrice as unknown as string)) {
        const firstItem = _.first(net32Result);
        if (firstItem && _.includes(contextVendorIds, (firstItem as any).vendorId.toString())) {
          $.goToPrice = $.newPrice;
          $.newPrice = "N/A";
          $.isRepriced = false;
          $.explained = RepriceRenewedMessageEnum.IGNORE_BUY_BOX;
        }
      }
    });
  } else if ($eval.repriceDetails) {
    if ($eval.repriceDetails.oldPrice != 0 && $eval.repriceDetails.newPrice != "N/A" && parseFloat($eval.repriceDetails.newPrice as unknown as string) < parseFloat($eval.repriceDetails.oldPrice as unknown as string)) {
      const firstItem = _.first(net32Result);
      if (firstItem && _.includes(contextVendorIds, (firstItem as any).vendorId.toString())) {
        $eval.repriceDetails.goToPrice = $eval.repriceDetails.newPrice as unknown as string;
        $eval.repriceDetails.newPrice = "N/A";
        $eval.repriceDetails.isRepriced = false;
        $eval.repriceDetails.explained = RepriceRenewedMessageEnum.IGNORE_BUY_BOX;
      }
    }
  }
  return $eval;
}

export function ApplyFloorCheckRule(repriceResult: RepriceModel, floorPrice: number) {
  let $eval = repriceResult;
  if ($eval.listOfRepriceDetails && $eval.listOfRepriceDetails.length > 0) {
    $eval.listOfRepriceDetails.forEach(($: any) => {
      if ($.active == false && $.active === 0) {
        //do nothing as it means Deactivating a price Break
      } else if (($.newPrice as unknown as number) <= floorPrice) {
        $.goToPrice = $.newPrice;
        $.newPrice = "N/A";
        $.isRepriced = false;
        $.explained = RepriceMessageEnum.IGNORE_LOGIC_FAULT;
      }
    });
  } else if ($eval.repriceDetails && ($eval.repriceDetails.newPrice as unknown as number) <= floorPrice) {
    $eval.repriceDetails.goToPrice = $eval.repriceDetails.newPrice as unknown as string;
    $eval.repriceDetails.newPrice = "N/A";
    $eval.repriceDetails.isRepriced = false;
    $eval.repriceDetails.explained = RepriceMessageEnum.IGNORE_LOGIC_FAULT;
  }
  return $eval;
}

export function ApplyKeepPositionLogic(repriceResult: RepriceModel, net32Result: Net32Product[], ownVendorId: string) {
  let $eval = _.cloneDeep(repriceResult);
  if ($eval.listOfRepriceDetails && $eval.listOfRepriceDetails.length > 0) {
    $eval.listOfRepriceDetails.forEach(($: any) => {
      if ($.oldPrice != 0 && $.newPrice != "N/A" && parseFloat($.newPrice) < parseFloat($.oldPrice)) {
        let ownVendorIndex = _.findIndex(net32Result, {
          vendorId: ownVendorId as unknown as number,
        });
        if (ownVendorIndex < 0) {
          ownVendorIndex = _.findIndex(net32Result, {
            vendorId: ownVendorId.toString() as any,
          });
        }
        const evalVendorIndex = _.findIndex(net32Result, {
          vendorName: $.lowestVendor,
        });
        if (evalVendorIndex > ownVendorIndex) {
          $.goToPrice = $.newPrice;
          $.newPrice = "N/A";
          $.isRepriced = false;
          $.explained = RepriceRenewedMessageEnum.IGNORE_KEEP_POSITION;
        }
      }
    });
  } else if ($eval.repriceDetails) {
    if ($eval.repriceDetails.oldPrice != 0 && $eval.repriceDetails.newPrice != "N/A" && parseFloat($eval.repriceDetails.newPrice as unknown as string) < parseFloat($eval.repriceDetails.oldPrice as unknown as string)) {
      let ownVendorIndex = _.findIndex(net32Result, {
        vendorId: ownVendorId as any,
      });
      if (ownVendorIndex < 0) {
        ownVendorIndex = _.findIndex(net32Result, {
          vendorId: ownVendorId.toString() as any,
        });
      }
      const evalVendorIndex = _.findIndex(net32Result, {
        vendorName: $eval.repriceDetails.lowestVendor as unknown as string,
      });
      if (evalVendorIndex > ownVendorIndex) {
        $eval.repriceDetails.goToPrice = $eval.repriceDetails.newPrice as unknown as string;
        $eval.repriceDetails.newPrice = "N/A";
        $eval.repriceDetails.isRepriced = false;
        $eval.repriceDetails.explained = RepriceRenewedMessageEnum.IGNORE_KEEP_POSITION;
      }
    }
  }
  return $eval;
}

export function AppendNewPriceBreakActivation(repriceResult: RepriceModel): RepriceModel {
  if (repriceResult.listOfRepriceDetails && repriceResult.listOfRepriceDetails.length > 0) {
    repriceResult.listOfRepriceDetails.forEach(($) => {
      if ($.oldPrice == 0 && $.newPrice != "N/A" && parseFloat($.newPrice as unknown as string) > parseFloat($.oldPrice as unknown as string)) {
        if ($.explained!.indexOf("#UP") >= 0) {
          $.explained = $.explained!.replace("#UP", "#NEW");
        } else $.explained = `${$.explained} #NEW`;
      }
    });
  } else if (repriceResult.repriceDetails) {
    if (repriceResult.repriceDetails.oldPrice == 0 && repriceResult.repriceDetails.newPrice != "N/A" && parseFloat(repriceResult.repriceDetails.newPrice as unknown as string) > parseFloat(repriceResult.repriceDetails.oldPrice as unknown as string)) {
      if (repriceResult.repriceDetails.explained!.indexOf("#UP") >= 0) {
        repriceResult.repriceDetails.explained = repriceResult.repriceDetails.explained!.replace("#UP", "#NEW");
      } else {
        repriceResult.repriceDetails.explained = `${repriceResult.repriceDetails.explained} #NEW`;
      }
    }
  }
  return repriceResult;
}

export async function ApplyRepriceDownBadgeCheckRule(repriceResult: RepriceModel, net32Result: any[], productItem: FrontierProduct, badgePercentageDown: number): Promise<RepriceModel> {
  if (badgePercentageDown == 0) return repriceResult;
  let $eval = repriceResult;
  let tempProductItem = _.cloneDeep(productItem);
  const $ = await globalParam.GetInfo(productItem.mpid, productItem);
  const excludedVendors = productItem.competeAll ? [] : $.EXCLUDED_VENDOR_ID.split(";");
  const ownVendorItem = net32Result.find((x: any) => x.vendorId.toString() == productItem.ownVendorId!.toString());
  const existingPrice = ownVendorItem ? ownVendorItem.priceBreaks!.find((x: any) => x.minQty == 1)!.unitPrice : 0;
  const heavyShippingPrice = ownVendorItem.heavyShipping ? parseFloat(ownVendorItem.heavyShipping) : 0;
  const calculatedSuggestedPrice = getSuggestedPriceForMinQty(repriceResult, 1);
  tempProductItem.badgeIndicator = "BADGE_ONLY";
  const listOfAuthorizedVendors = await filterMapper.FilterBasedOnParams(net32Result, tempProductItem, "BADGE_INDICATOR");
  if (listOfAuthorizedVendors != null && listOfAuthorizedVendors.length > 0) {
    let sortedAuthVendors: any[] = [];
    sortedAuthVendors = _.chain(listOfAuthorizedVendors)
      .filter((prod: any) => _.some(prod.priceBreaks, (x: any) => x.minQty === 1 && x.active === true))
      .sortBy((prod: any) => {
        const priceBreak = _.find(prod.priceBreaks, (x: any) => x.minQty === 1 && x.active === true);
        return priceBreak.unitPrice + GetShippingPrice(prod);
      })
      .value();
    if (_.includes(excludedVendors, _.first(sortedAuthVendors).vendorId.toString())) {
      return $eval;
    }
    _.remove(sortedAuthVendors, (data: any) => data.vendorId == productItem.ownVendorId);
    _.remove(sortedAuthVendors, (data: any) => _.includes(excludedVendors, data.vendorId.toString()));
    if (sortedAuthVendors.length > 0) {
      let lowestUnitPrice: number | null = null;
      if (!_.first(sortedAuthVendors).priceBreaks) return $eval;
      _.forEach(_.first(sortedAuthVendors).priceBreaks, (pb: any) => {
        if (pb.minQty == 1 && pb.active == true) {
          lowestUnitPrice = pb.unitPrice + GetShippingPrice(_.first(sortedAuthVendors));
        }
      });
      const lowestAuthVendorPrice = lowestUnitPrice;
      let effectivePrice = subtractPercentage((lowestAuthVendorPrice as unknown as number) + heavyShippingPrice, parseFloat(productItem.badgePercentageDown)) - heavyShippingPrice;
      const floorPriceOfProduct = parseFloat(productItem.floorPrice);

      if (calculatedSuggestedPrice <= effectivePrice) {
        //DO NOTHING
      } else if (calculatedSuggestedPrice > effectivePrice) {
        if (effectivePrice <= floorPriceOfProduct) {
          effectivePrice = calculatedSuggestedPrice;
          if (effectivePrice > floorPriceOfProduct) {
            if ($eval.listOfRepriceDetails && $eval.listOfRepriceDetails.length > 0) {
              $eval.listOfRepriceDetails.forEach(($: any) => {
                if ($.minQty == 1) {
                  $.goToPrice = null;
                  $.newPrice = effectivePrice;
                  $.explained = `${$.explained} #RepriceDownBadge%`;
                  $.triggeredByVendor = `1 @ ${_.first(sortedAuthVendors).vendorId}-${_.first(sortedAuthVendors).vendorName}`;
                }
              });
            } else if ($eval.repriceDetails) {
              if (true) {
                $eval.repriceDetails.goToPrice = null;
                $eval.repriceDetails.newPrice = effectivePrice as unknown as string;
                $eval.repriceDetails.explained = `${$eval.repriceDetails.explained} #RepriceDownBadge%`;
                $eval.repriceDetails.triggeredByVendor = `1 @ ${_.first(sortedAuthVendors).vendorId}-${_.first(sortedAuthVendors).vendorName}`;
              }
            }
          }
        } else if (effectivePrice > floorPriceOfProduct && effectivePrice != existingPrice) {
          if ($eval.listOfRepriceDetails && $eval.listOfRepriceDetails.length > 0) {
            $eval.listOfRepriceDetails.forEach(($: any) => {
              if ($.minQty == 1) {
                $.goToPrice = null;
                $.newPrice = effectivePrice;
                $.explained = `${$.explained} #RepriceDownBadge%`;
                $.triggeredByVendor = `${_.first(sortedAuthVendors).vendorId}-${_.first(sortedAuthVendors).vendorName}`;
              }
            });
          } else if ($eval.repriceDetails) {
            if (true) {
              $eval.repriceDetails.goToPrice = null;
              $eval.repriceDetails.newPrice = effectivePrice as unknown as string;
              $eval.repriceDetails.explained = `${$eval.repriceDetails.explained} #RepriceDownBadge%`;
              $eval.repriceDetails.triggeredByVendor = `1 @ ${_.first(sortedAuthVendors).vendorId}-${_.first(sortedAuthVendors).vendorName}`;
            }
          }
        }
      }
    }
  }
  return $eval;
}

export async function ApplySisterComparisonCheck(repriceResult: any, net32Result: Net32Product[], productItem: FrontierProduct): Promise<RepriceModel> {
  let $eval = _.cloneDeep(repriceResult);
  const $ = await globalParam.GetInfo(productItem.mpid, productItem);
  const sisterVendors = $.EXCLUDED_VENDOR_ID.split(";");
  const sisterVendorResults = net32Result.filter((x) => _.includes(sisterVendors, x.vendorId.toString()) && x.inStock == true);
  if ($eval.listOfRepriceDetails && $eval.listOfRepriceDetails.length > 0) {
    for (let $ of $eval.listOfRepriceDetails) {
      if ($.newPrice != "N/A") {
        const ownVendorSuggestedPrice = parseFloat($.newPrice as unknown as string);
        if (sisterVendorResults && sisterVendorResults.length > 0) {
          let sisterVendorSimilarPrice: any[] = [];
          for (const item of sisterVendorResults) {
            if (item.priceBreaks && item.priceBreaks.length > 0) {
              for (const pb of item.priceBreaks) {
                if (pb.minQty == $.minQty && pb.active == true && pb.unitPrice == ownVendorSuggestedPrice) {
                  sisterVendorSimilarPrice.push(item);
                }
              }
            }
          }
          if (sisterVendorSimilarPrice.length > 0) {
            let suggestedPrice = (parseFloat($.newPrice as unknown as string) - applicationConfig.OFFSET).toFixed(2);
            for (var i = 0; i < sisterVendorResults.length; i++) {
              const sisterVendorWithSuggestedPrice = sisterVendorResults.find((x) => {
                if (x.priceBreaks && x.priceBreaks.length > 0) {
                  const priceBreak = x.priceBreaks.find((pb) => pb.minQty == 1 && pb.active == true && (pb.unitPrice as unknown as string) == suggestedPrice);
                  return priceBreak ? true : false;
                }
              });
              if (sisterVendorWithSuggestedPrice) {
                suggestedPrice = (parseFloat(sisterVendorWithSuggestedPrice.priceBreaks!.find((pb) => pb.minQty == 1 && pb.active == true)!.unitPrice as unknown as string) - applicationConfig.OFFSET).toFixed(2);
              } else break;
            }
            $.newPrice = suggestedPrice;
            $.explained = $.explained + " #SISTERSAMEPRICE";
          }
        }
      }
    }
  } else if ($eval.repriceDetails && $eval.repriceDetails.newPrice != "N/A") {
    const ownVendorSuggestedPrice = parseFloat($eval.repriceDetails.newPrice as unknown as string);
    if (sisterVendorResults && sisterVendorResults.length > 0) {
      let sisterVendorSimilarPrice: Net32Product[] = [];
      for (const item of sisterVendorResults) {
        if (item.priceBreaks && item.priceBreaks.length > 0) {
          for (const pb of item.priceBreaks) {
            if (pb.minQty == 1 && pb.active == true && pb.unitPrice == ownVendorSuggestedPrice) {
              sisterVendorSimilarPrice.push(item);
            }
          }
        }
      }
      if (sisterVendorSimilarPrice.length > 0) {
        let suggestedPrice = (parseFloat($eval.repriceDetails.newPrice as unknown as string) - applicationConfig.OFFSET).toFixed(2);
        for (var i = 0; i < sisterVendorResults.length; i++) {
          const sisterVendorWithSuggestedPrice = sisterVendorResults.find((x) => {
            if (x.priceBreaks && x.priceBreaks.length > 0) {
              const priceBreak = x.priceBreaks.find((pb) => pb.minQty == 1 && pb.active == true && (pb.unitPrice as unknown as string) == suggestedPrice);
              return priceBreak ? true : false;
            }
          });
          if (sisterVendorWithSuggestedPrice) {
            suggestedPrice = (parseFloat(sisterVendorWithSuggestedPrice.priceBreaks!.find((pb) => pb.minQty == 1 && pb.active == true)!.unitPrice as unknown as string) - applicationConfig.OFFSET).toFixed(2);
          } else break;
        }
        $eval.repriceDetails.newPrice = suggestedPrice;
        $eval.repriceDetails.explained = $eval.repriceDetails.explained + " #SISTERSAMEPRICE";
      }
    }
  }
  return $eval;
}

export function OverrideRepriceResultForExpressCron(repriceResult: any): any {
  let $eval = repriceResult;
  if ($eval.listOfRepriceDetails && $eval.listOfRepriceDetails.length > 0) {
    $eval.listOfRepriceDetails.forEach(($: any) => {
      $.goToPrice = $.newPrice;
      $.newPrice = "N/A";
      $.isRepriced = false;
      $.explained = $.explained + "_#INEXPRESSCRON";
    });
  } else if ($eval.repriceDetails) {
    $eval.repriceDetails.goToPrice = $eval.repriceDetails.newPrice;
    $eval.repriceDetails.newPrice = "N/A";
    $eval.repriceDetails.isRepriced = false;
    $eval.repriceDetails.explained = $eval.repriceDetails.explained + "_#INEXPRESSCRON";
  }
  return $eval;
}

export async function AlignIsRepriced(repriceResult: any) {
  let $eval = repriceResult;
  try {
    if ($eval.listOfRepriceDetails && $eval.listOfRepriceDetails.length > 0) {
      $eval.listOfRepriceDetails.forEach(($: any) => {
        if ($.newPrice != "N/A" && parseFloat($.newPrice) == parseFloat($.oldPrice) && $.active != 0) {
          $.isRepriced = false;
          $.explained = $.explained + "_IGNORED_#SAMEPRICESUGGESTED";
        }
      });
    } else if ($eval.repriceDetails && $eval.repriceDetails.newPrice != "N/A" && parseFloat($eval.newPrice) == parseFloat($eval.oldPrice)) {
      $eval.repriceDetails.isRepriced = false;
      $eval.repriceDetails.explained = $eval.repriceDetails.explained + "_IGNORED_#SAMEPRICESUGGESTED";
    }
  } catch (exception) {
    console.log(`Exception while AlignIsRepriced : ${exception}`);
  }
  return $eval;
}

export async function ApplyMaxPriceCheck(repriceResult: any, productItem: FrontierProduct): Promise<RepriceModel> {
  let $eval = _.cloneDeep(repriceResult);
  if ($eval.repriceDetails && $eval.repriceDetails.newPrice == "N/A") {
    const existingPrice = calculatePriceWithNcContext($eval.repriceDetails.oldPrice, productItem, "ADD");
    const maxAllowedPrice = parseFloat(productItem.maxPrice);
    if (existingPrice > maxAllowedPrice) {
      $eval.repriceDetails.newPrice = calculatePriceWithNcContext(maxAllowedPrice, productItem, "DEL").toFixed(2);
      $eval.repriceDetails.explained = $eval.repriceDetails.explained + "_#MAXPRICEAPPLIED";
    }
  }
  return $eval;
}

// Helper functions (not exported)
function validateQtyReprice(listOfRepriceDetails: any[], minQty: number, isOverrideEnabled: boolean): boolean {
  if (isOverrideEnabled) return true;
  const contextPriceBreak = listOfRepriceDetails.find((x: any) => x.minQty == minQty);
  if (contextPriceBreak && contextPriceBreak.newPrice != "N/A" && contextPriceBreak.oldPrice != parseFloat(contextPriceBreak.newPrice)) {
    return true;
  }
  return false;
}

function executePercentageCheck(result: any, expectedPercentage: number): boolean {
  const percentageIncrease = ((parseFloat(result.newPrice) - result.oldPrice) / result.oldPrice) * 100;
  return percentageIncrease >= expectedPercentage;
}

function validateQtyDeactivation(listOfRepriceDetails: any[], minQty: number): boolean {
  const contextPriceBreak = listOfRepriceDetails.find((x: any) => x.minQty == minQty);
  if (contextPriceBreak && contextPriceBreak.newPrice != "N/A" && parseFloat(contextPriceBreak.newPrice) == 0) {
    return true;
  }
  return false;
}

function getNcCalculatedPrice(repriceDetails: any, net32Details: any): number {
  if (repriceDetails && repriceDetails.minQty) {
    // Means the details is of MultiplePriceBreaks
    const existingUnitPrice = net32Details.priceBreaks.find((x: any) => x.minQty == repriceDetails.minQty).unitPrice;
    const thresholdPrice = net32Details.freeShippingThreshold;
    if (existingUnitPrice < thresholdPrice) {
      const shippingCharges = parseFloat(net32Details.standardShipping);
      return shippingCharges + existingUnitPrice;
    }
    return existingUnitPrice;
  } else if (repriceDetails && !repriceDetails.minQty) {
    // Means the details is of SinglePriceBreak
    const existingUnitPrice = (_.first(net32Details.priceBreaks) as { unitPrice: number }).unitPrice;
    const thresholdPrice = net32Details.freeShippingThreshold;
    if (existingUnitPrice < thresholdPrice) {
      const shippingCharges = parseFloat(net32Details.standardShipping);
      return shippingCharges + existingUnitPrice;
    }
    return existingUnitPrice;
  }
  return 0;
}

function getSuggestedPriceForMinQty(repricerResult: any, minQty: number): number {
  let suggestedPrice = 0;
  if (repricerResult && repricerResult.listOfRepriceDetails && repricerResult.listOfRepriceDetails.length > 0) {
    const minQtyResult = repricerResult.listOfRepriceDetails.find((x: any) => x.minQty == minQty);
    suggestedPrice = minQtyResult && minQtyResult.newPrice != "N/A" ? parseFloat(minQtyResult.newPrice) : suggestedPrice;
  } else if (repricerResult && repricerResult.repriceDetails && repricerResult.repriceDetails.newPrice != "N/A") {
    suggestedPrice = parseFloat(repricerResult.repriceDetails.newPrice);
  }
  return suggestedPrice;
}

function GetShippingPrice(item: any): number {
  if (item?.priceBreaks && item?.priceBreaks.length > 0) {
    const thresholdPrice = item.freeShippingThreshold != null && item.freeShippingThreshold >= 0 ? item.freeShippingThreshold : 999999;
    const unitPrice = item.priceBreaks.find((x: any) => x.minQty == 1).unitPrice;
    const shippingCharge = item.standardShipping;
    return unitPrice < thresholdPrice ? parseFloat(shippingCharge) : 0;
  }
  return 0;
}

function calculatePriceWithNcContext(contextPrice: any, productItem: FrontierProduct, type: string): number {
  const existingPrice = parseFloat(contextPrice);
  const shippingPrice = GetShippingPrice(productItem);
  const ncPrice = type == "ADD" ? existingPrice + shippingPrice : existingPrice - shippingPrice;
  return productItem.is_nc_needed ? ncPrice : existingPrice;
}
const subtractPercentage = (originalNumber: number, percentage: number): number => parseFloat((Math.floor((originalNumber - originalNumber * percentage) * 100) / 100).toFixed(2));
