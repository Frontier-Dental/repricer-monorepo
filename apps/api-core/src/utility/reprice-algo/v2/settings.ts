import Decimal from "decimal.js";
import { flow } from "lodash/fp";
import { V2AlgoSettingsData } from "../../mysql/v2-algo-settings";
import {
  getShippingBucket,
  hasBadge,
  Net32AlgoSolution,
  Net32AlgoSolutionWithQBreakValid,
  Net32AlgoSolutionWithResult,
  QuantitySolution,
} from "./algorithm";
import { AlgoResult, Net32AlgoProduct } from "./types";
import { isChangeResult } from "./utility";

export function applyCompetitionFilters(
  competitors: Net32AlgoProduct[],
  ourProduct: Net32AlgoProduct,
  ourVendorSettings: V2AlgoSettingsData,
) {
  return flow(
    (competitors) => applyBadgeIndicatorFilter(competitors, ourVendorSettings),
    (competitors) =>
      applyInactiveVendorIdFilter(competitors, ourVendorSettings),
    (competitors) => applyVendorExclusionFilter(competitors, ourVendorSettings),
    (competitors) => applyQuantityFilter(competitors, ourVendorSettings),
    (competitors) => applyHandlingTimeGroup(competitors, ourVendorSettings),
  )(competitors);
}

export function applyInactiveVendorIdFilter(
  competitors: Net32AlgoProduct[],
  ourVendorSettings: V2AlgoSettingsData,
) {
  const competeOnZeroQuantityVendors = ourVendorSettings.inactive_vendor_id
    .split(",")
    .map(parseInt)
    .filter((x) => !isNaN(x));
  return competitors.filter((c) => {
    if (competeOnZeroQuantityVendors.includes(c.vendorId)) {
      return c.inventory >= 0;
    } else {
      return c.inventory > 0;
    }
  });
}

export function applyBadgeIndicatorFilter(
  competitors: Net32AlgoProduct[],
  ourVendorSettings: V2AlgoSettingsData,
) {
  return competitors.filter((c) => {
    if (ourVendorSettings.badge_indicator === "ALL") {
      return c;
    } else if (ourVendorSettings.badge_indicator === "BADGE") {
      return hasBadge(c);
    } else {
      throw new Error(
        `Invalid badge indicator: ${ourVendorSettings.badge_indicator}`,
      );
    }
  });
}

export function applyVendorExclusionFilter(
  competitors: Net32AlgoProduct[],
  ourVendorSettings: V2AlgoSettingsData,
) {
  return competitors.filter((c) => {
    if (ourVendorSettings.exclude_vendors !== "") {
      const excludedVendors = ourVendorSettings.exclude_vendors
        .split(",")
        .map(parseInt);
      return excludedVendors.includes(c.vendorId) === false;
    } else {
      return true;
    }
  });
}

export function applySuppressQBreakIfQ1NotUpdated(
  solutionResults: Net32AlgoSolutionWithResult[],
): Net32AlgoSolutionWithQBreakValid[] {
  return solutionResults.map((s) => {
    if (!s.vendorSettings.suppress_price_break_if_Q1_not_updated) {
      return {
        ...s,
        qBreakValid: true,
      };
    } else {
      if (s.quantity === 1) {
        return {
          ...s,
          qBreakValid: true,
        };
      }
      const q1 = solutionResults.find(
        (s) =>
          s.quantity === 1 &&
          s.vendor.vendorId === s.vendor.vendorId &&
          isChangeResult(s.algoResult),
      );
      if (!q1) {
        return {
          ...s,
          qBreakValid: false,
        };
      } else {
        return {
          ...s,
          qBreakValid: true,
        };
      }
    }
  });
}

export function applyQuantityFilter(
  competitors: Net32AlgoProduct[],
  ourVendorSettings: V2AlgoSettingsData,
) {
  return competitors.filter((c) => {
    return c.inventory >= ourVendorSettings.inventory_competition_threshold;
  });
}

export function applyHandlingTimeGroup(
  competitors: Net32AlgoProduct[],
  ourVendorSettings: V2AlgoSettingsData,
) {
  return competitors.filter((c) => {
    switch (ourVendorSettings.handling_time_group) {
      case "ALL":
        return true;
      case "FAST_SHIPPING":
        return c.shippingTime === 1 || c.shippingTime === 2;
      case "STOCKED":
        return c.shippingTime <= 5;
      case "LONG_HANDLING":
        return c.shippingTime >= 6;
      default:
        return true;
    }
  });
}

export function applySuppressPriceBreakFilter(
  ourVendorSettings: V2AlgoSettingsData,
  quantity: number,
) {
  if (ourVendorSettings.suppress_price_break) {
    return quantity > 1 ? AlgoResult.IGNORE_SETTINGS : null;
  } else {
    return null;
  }
}

export function applyCompeteOnPriceBreaksOnly(
  ourVendorSettings: V2AlgoSettingsData,
  quantity: number,
) {
  if (ourVendorSettings.compete_on_price_break_only) {
    return quantity > 1 ? null : AlgoResult.IGNORE_SETTINGS;
  } else {
    return null;
  }
}

export function applyOwnVendorThreshold(
  solution: Net32AlgoSolution,
  vendorSetting: V2AlgoSettingsData,
) {
  if (solution.vendor.inventory < vendorSetting.own_vendor_threshold) {
    return AlgoResult.IGNORE_SETTINGS;
  } else {
    return null;
  }
}

export function applyUpDownRestriction(
  suggestedPrice: Decimal,
  vendorSetting: V2AlgoSettingsData,
  existingPrice?: QuantitySolution,
) {
  if (!existingPrice) {
    return null;
  }
  if (
    vendorSetting.up_down === "UP" &&
    suggestedPrice.lt(existingPrice.unitPrice)
  ) {
    return AlgoResult.IGNORE_SETTINGS;
  } else if (
    vendorSetting.up_down === "DOWN" &&
    suggestedPrice.gt(existingPrice.unitPrice)
  ) {
    return AlgoResult.IGNORE_SETTINGS;
  }
  return null;
}

export function applyFloorCompeteWithNext(
  solution: Net32AlgoSolution,
  vendorSetting: V2AlgoSettingsData,
) {
  if (!vendorSetting.floor_compete_with_next && solution.buyBoxRank > 0) {
    return AlgoResult.IGNORE_SETTINGS;
  } else {
    return null;
  }
}

export function applyUpDownPercentage(
  newPrice: Decimal,
  setting: V2AlgoSettingsData,
  oldPrice?: Decimal,
) {
  // If there's nothing to compare to, then we can just return the new price
  if (!oldPrice) {
    return newPrice;
  }
  if (newPrice.gt(oldPrice) && setting.reprice_up_percentage > 0) {
    let minimumPrice = oldPrice.mul(100 + setting.reprice_up_percentage / 100);
    if (minimumPrice.gt(new Decimal(setting.max_price))) {
      minimumPrice = new Decimal(setting.max_price);
    }
    if (newPrice.gte(minimumPrice)) {
      return newPrice;
    } else {
      return minimumPrice;
    }
  } else if (newPrice.lt(oldPrice) && setting.reprice_down_percentage > 0) {
    let maximumPrice = oldPrice.mul(
      100 - setting.reprice_down_percentage / 100,
    );
    if (maximumPrice.lt(new Decimal(setting.floor_price))) {
      // If we're below the floor, then we basically ignore this setting
      // by returning the original, unmodified proposed price.
      return newPrice;
    }
    if (newPrice.lte(maximumPrice)) {
      return newPrice;
    } else {
      return maximumPrice;
    }
  } else {
    return newPrice;
  }
}
