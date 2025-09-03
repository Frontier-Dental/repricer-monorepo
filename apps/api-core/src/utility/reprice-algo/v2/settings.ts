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
import { isChangeResult, isShortExpiryProduct } from "./utility";
import {
  AlgoBadgeIndicator,
  AlgoHandlingTimeGroup,
  AlgoPriceDirection,
} from "@repricer-monorepo/shared";

export function applyCompetitionFilters(
  products: Net32AlgoProduct[],
  ourVendorSettings: V2AlgoSettingsData,
  quantity?: number,
) {
  return flow(
    (products) => applyVendorExclusionFilter(products, ourVendorSettings),
    (products) => applyMinQuantityFilter(products, ourVendorSettings),
    (products) => applyHandlingTimeGroup(products, ourVendorSettings),
    (products) => applyBadgeIndicatorFilter(products, ourVendorSettings),
    (products) => applyShortExpiryFilter(products, quantity),
  )(products);
}

export function applyShortExpiryFilter(
  products: Net32AlgoProduct[],
  quantity?: number,
) {
  if (quantity === undefined) {
    return products;
  }
  return products.filter((c) => !isShortExpiryProduct(c.priceBreaks, quantity));
}

export function applyBadgeIndicatorFilter(
  competitors: Net32AlgoProduct[],
  ourVendorSettings: V2AlgoSettingsData,
) {
  const preFilter = competitors;
  const postFilter = competitors.filter((c) => {
    if (ourVendorSettings.badge_indicator === AlgoBadgeIndicator.ALL) {
      return c;
    } else if (ourVendorSettings.badge_indicator === AlgoBadgeIndicator.BADGE) {
      return hasBadge(c);
    } else {
      throw new Error(
        `Invalid badge indicator: ${ourVendorSettings.badge_indicator}`,
      );
    }
  });

  // Special behavior. If we set to only compete on badge and there are
  // no badges in the list, then we just return the pre-filtered list.
  if (
    ourVendorSettings.badge_indicator === AlgoBadgeIndicator.BADGE &&
    !postFilter.find((c) => hasBadge(c))
  ) {
    return preFilter;
  } else {
    return postFilter;
  }
}

export function applyVendorExclusionFilter(
  competitors: Net32AlgoProduct[],
  ourVendorSettings: V2AlgoSettingsData,
) {
  return competitors.filter((c) => {
    if (ourVendorSettings.exclude_vendors !== "") {
      const excludedVendors = ourVendorSettings.exclude_vendors.split(",");
      return excludedVendors.includes(c.vendorId.toString()) === false;
    } else {
      return true;
    }
  });
}

export function applySuppressQBreakIfQ1NotUpdated(
  solutionResults: Net32AlgoSolutionWithResult[],
  isSlowCron: boolean,
): Net32AlgoSolutionWithQBreakValid[] {
  return solutionResults.map((s) => {
    if (isSlowCron) {
      return {
        ...s,
        qBreakValid: true,
      };
    }
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

export function applyMinQuantityFilter(
  competitors: Net32AlgoProduct[],
  ourVendorSettings: V2AlgoSettingsData,
) {
  const inactiveVendorId = ourVendorSettings.inactive_vendor_id.split(",");
  return competitors.filter((c) => {
    if (inactiveVendorId.includes(c.vendorId.toString())) {
      return true;
    }
    return c.inventory >= ourVendorSettings.inventory_competition_threshold;
  });
}

export function applyHandlingTimeGroup(
  competitors: Net32AlgoProduct[],
  ourVendorSettings: V2AlgoSettingsData,
) {
  return competitors.filter((c) => {
    switch (ourVendorSettings.handling_time_group) {
      case AlgoHandlingTimeGroup.ALL:
        return true;
      case AlgoHandlingTimeGroup.FAST_SHIPPING:
        return c.shippingTime === 1 || c.shippingTime === 2;
      case AlgoHandlingTimeGroup.STOCKED:
        return c.shippingTime <= 5;
      case AlgoHandlingTimeGroup.LONG_HANDLING:
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
  isSlowCron: boolean,
  existingPrice?: QuantitySolution,
) {
  if (!existingPrice) {
    return null;
  }
  if (isSlowCron) {
    return null;
  }
  if (
    vendorSetting.up_down === AlgoPriceDirection.UP &&
    suggestedPrice.lt(existingPrice.unitPrice)
  ) {
    return AlgoResult.IGNORE_SETTINGS;
  } else if (
    vendorSetting.up_down === AlgoPriceDirection.DOWN &&
    suggestedPrice.gt(existingPrice.unitPrice)
  ) {
    return AlgoResult.IGNORE_SETTINGS;
  }
  return null;
}

export function applyKeepPosition(
  vendorSetting: V2AlgoSettingsData,
  isSlowCron: boolean,
  preJsonPosition: number,
  lowestVendorPosition: number | null,
) {
  if (isSlowCron) {
    return null;
  }
  if (
    vendorSetting.keep_position &&
    lowestVendorPosition !== null &&
    lowestVendorPosition > preJsonPosition
  ) {
    return AlgoResult.IGNORE_SETTINGS;
  } else {
    return null;
  }
}

export function applyFloorCompeteWithNext(
  solution: Net32AlgoSolution,
  vendorSetting: V2AlgoSettingsData,
  isSlowCron: boolean,
) {
  if (isSlowCron) {
    return null;
  }
  if (!vendorSetting.floor_compete_with_next && solution.buyBoxRank > 0) {
    return AlgoResult.IGNORE_FLOOR;
  } else {
    return null;
  }
}

export function applyUpDownPercentage(
  newPrice: Decimal,
  setting: V2AlgoSettingsData,
  hasBadge: boolean,
  oldPrice?: Decimal,
) {
  // If there's nothing to compare to, then we can just return the new price
  if (!oldPrice) {
    return newPrice;
  }
  const upSetting = hasBadge
    ? setting.reprice_up_badge_percentage
    : setting.reprice_up_percentage;
  const downSetting = hasBadge
    ? setting.reprice_down_badge_percentage
    : setting.reprice_down_percentage;
  if (newPrice.gt(oldPrice) && upSetting > 0) {
    let minimumPrice = oldPrice.mul(100 + upSetting / 100);
    if (minimumPrice.gt(new Decimal(setting.max_price))) {
      minimumPrice = new Decimal(setting.max_price);
    }
    if (newPrice.gte(minimumPrice)) {
      return newPrice;
    } else {
      return minimumPrice;
    }
  } else if (newPrice.lt(oldPrice) && downSetting > 0) {
    let maximumPrice = oldPrice.mul(100 - downSetting / 100);
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
