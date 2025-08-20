import { Decimal } from "decimal.js";
import { Net32PriceBreak } from "../../../types/net32";
import { V2AlgoSettingsData } from "../../mysql/v2-algo-settings";
import { createHtmlFileContent } from "./html-builder";
import {
  applyCompeteOnPriceBreaksOnly,
  applyCompeteWithOwnQuantityZero,
  applyCompetitionFilters,
  applyFloorCompeteWithNext,
  applySuppressPriceBreakFilter,
  applySuppressQBreakIfQ1NotUpdated,
  applyUpDownPercentage,
  applyUpDownRestriction,
} from "./settings";
import {
  AlgoResult,
  InternalProduct,
  Net32AlgoProduct,
  Net32AlgoProductWithBestPrice,
  Net32AlgoProductWrapperWithBuyBoxRank,
  ChangeResult,
} from "./types";

export interface QuantitySolution {
  quantity: number;
  vendorId: number;
  unitPrice: number;
}

export interface QuantitySolutionWithBuyBoxRank extends QuantitySolution {
  buyBoxRank: number;
}

export interface Net32AlgoSolution {
  solutionId: string;
  vendor: Net32AlgoProductWithBestPrice;
  buyBoxRank: number;
  quantity: number;
  vendorSettings: V2AlgoSettingsData;
  postSolutionInsertBoard: Net32AlgoProductWithBestPrice[];
  competitorsAndSistersFromViewOfOwnVendorRanked: Net32AlgoProductWrapperWithBuyBoxRank[];
  rawTriggeredByVendor?: string;
}

export interface Net32AlgoSolutionWithResult
  extends Omit<Net32AlgoSolution, "rawTriggeredByVendor"> {
  algoResult: AlgoResult;
  comment: string;
  suggestedPrice: number | null;
  triggeredByVendor: string | null;
}

export interface Net32AlgoSolutionWithQBreakValid
  extends Net32AlgoSolutionWithResult {
  qBreakValid: boolean;
}

export interface Net32AlgoSolutionWithChangeResult
  extends Net32AlgoSolutionWithQBreakValid {
  changeResult: ChangeResult | null;
}

export interface Net32AlgoSolutionWithCombination {
  solution: Net32AlgoProductWithBestPrice[];
  targetCombination: Net32AlgoProductWithBestPrice[];
  quantity: number;
  postSolutionInsertBoard: Net32AlgoProductWithBestPrice[];
}

export interface BuyBoxPosition {
  quantity: number;
  buyBoxRank: number;
  vendorId: number;
  unitPrice: Decimal;
}

export function repriceProductV2(
  mpId: number,
  rawNet32Products: Net32AlgoProduct[],
  availableInternalProducts: InternalProduct[],
  ownVendorIds: number[],
  vendorSettings: V2AlgoSettingsData[],
  jobId: string,
) {
  const net32url = availableInternalProducts[0].net32url;
  if (!net32url) {
    throw new Error("No net32url found for own vendor");
  }
  const validProducts = rawNet32Products
    .filter((p) => Array.isArray(p.priceBreaks))
    .filter((p) => p.priceBreaks.find((pb) => pb.minQty === 1));

  const competitorProducts = validProducts.filter(
    (p) => !ownVendorIds.includes(p.vendorId),
  );
  // All products that we have available to use to make changes.
  const ourAvailableVendorProducts = validProducts
    .filter((p) => ownVendorIds.includes(p.vendorId))
    .filter((p) =>
      availableInternalProducts.find((vp) => vp.ownVendorId === p.vendorId),
    );

  const availableVendorIds = ourAvailableVendorProducts.map((v) => v.vendorId);

  const competitorQuantityBreaks =
    getUniqueValidQuantityBreaks(competitorProducts);

  const solutions: Net32AlgoSolution[] = [];

  const beforeLadders = competitorQuantityBreaks.map((quantity) => {
    const ladder = getProductsSortedByBuyBoxRank(validProducts, quantity);
    return {
      quantity,
      ladder,
    };
  });

  for (const quantity of competitorQuantityBreaks) {
    for (const ourVendor of ourAvailableVendorProducts) {
      const vendorSetting = vendorSettings.find(
        (v) => v.vendor_id === ourVendor.vendorId,
      );
      if (!vendorSetting) {
        throw new Error(
          `No vendor settings found for vendor ${ourVendor.vendorId}`,
        );
      }

      const competeQuantity = getCompeteQuantity(vendorSetting, quantity);

      const rawCompetitorsRankedByBuyBox = getProductsSortedByBuyBoxRank(
        competitorProducts,
        competeQuantity,
      );

      const {
        solution: vendorSolution,
        competitorsFromViewOfOwnVendorRanked,
        competitorsAndSistersFromViewOfOwnVendorRanked,
        rawTriggeredByVendor,
      } = getOptimalSolutionForBoard(
        rawCompetitorsRankedByBuyBox.map((x) => x.product),
        ourVendor,
        competeQuantity,
        vendorSetting,
        ourAvailableVendorProducts,
      );

      const solutionId = `Q${quantity}-${vendorSolution.vendorName}@${vendorSolution.bestPrice?.toNumber()}`;
      const buyBoxRank = vendorSolution.bestPrice
        ? getExpectedBuyBoxRank(
            vendorSolution,
            competitorsFromViewOfOwnVendorRanked,
            competeQuantity,
            vendorSetting.not_cheapest,
          )
        : Infinity;

      const postSolutionInsertBoard = getProductsSortedByBuyBoxRank(
        [vendorSolution, ...competitorsFromViewOfOwnVendorRanked],
        // If Compare Q2 on Q1, we are still inserting on Q2, eventhough we are ranking on Q1.
        quantity,
      );
      solutions.push({
        quantity,
        buyBoxRank,
        vendor: vendorSolution,
        vendorSettings: vendorSetting,
        postSolutionInsertBoard: postSolutionInsertBoard.map((x) => x.product),
        solutionId,
        competitorsAndSistersFromViewOfOwnVendorRanked,
        rawTriggeredByVendor,
      });
    }
  }

  const existingPriceBreaks = validProducts
    .map((p) =>
      p.priceBreaks
        .map(
          (priceBreak) =>
            ({
              quantity: priceBreak.minQty,
              vendorId: p.vendorId,
              unitPrice: priceBreak.unitPrice,
            }) as QuantitySolution,
        )
        .flat(),
    )
    .flat();

  const solutionResults = solutions.map((s) =>
    getSolutionResult(
      s,
      existingPriceBreaks,
      vendorSettings,
      availableVendorIds,
    ),
  );
  const solutionResultsWithQBreakValid =
    removeUnnecessaryQuantityBreaks(solutionResults);
  const htmlFiles = availableVendorIds.map((vendorId) => {
    const html = createHtmlFileContent(
      mpId,
      rawNet32Products,
      solutionResultsWithQBreakValid.filter(
        (s) => s.vendor.vendorId === vendorId,
      ),
      beforeLadders,
      net32url,
      jobId,
    );
    return { vendorId, html };
  });
  return solutionResultsWithQBreakValid.map((result) => {
    const html = htmlFiles.find((h) => h.vendorId === result.vendor.vendorId);
    if (!html) {
      throw new Error(
        `No html file found for vendor ${result.vendor.vendorId}`,
      );
    }
    return {
      ...result,
      html: html.html,
    };
  });
}

function getCompeteQuantity(
  vendorSetting: V2AlgoSettingsData,
  quantity: number,
) {
  if (quantity !== 2) {
    return quantity;
  }
  if (vendorSetting.compare_q2_with_q1) {
    return 1;
  } else {
    return 2;
  }
}

function removeUnnecessaryQuantityBreaks(
  solutionResults: Net32AlgoSolutionWithResult[],
): Net32AlgoSolutionWithQBreakValid[] {
  const invalidQuantityBreaks = removeInvalidQuantityBreaks(solutionResults);
  const suppressQBreakIfQ1NotUpdated =
    applySuppressQBreakIfQ1NotUpdated(solutionResults);
  // TODO: More advanced filtering if we are already beating all competitors on a lower Q break
  return solutionResults.map((s, i) => {
    return {
      ...s,
      qBreakValid:
        invalidQuantityBreaks[i].qBreakValid &&
        suppressQBreakIfQ1NotUpdated[i].qBreakValid,
    };
  });
}

function removeInvalidQuantityBreaks(
  solutionResults: Net32AlgoSolutionWithResult[],
): Net32AlgoSolutionWithQBreakValid[] {
  const uniqueVendorIds = [
    ...new Set(solutionResults.map((s) => s.vendor.vendorId)),
  ];

  // Create a map to track which solutions should be marked as invalid
  const invalidSolutionIds = new Set<string>();

  for (const vendorId of uniqueVendorIds) {
    // Get all solutions for this vendor
    const vendorSolutions = solutionResults.filter(
      (s) => s.vendor.vendorId === vendorId,
    );

    // Sort by quantity ascending
    const sortedSolutions = vendorSolutions.toSorted(
      (a, b) => a.quantity - b.quantity,
    );

    for (let i = 0; i < sortedSolutions.length; i++) {
      const currentSolution = sortedSolutions[i];

      // Check all lower quantity solutions
      for (let j = 0; j < i; j++) {
        const lowerSolution = sortedSolutions[j];

        // If lower quantity has same or lower price, mark current solution as invalid
        if (
          lowerSolution.suggestedPrice !== null &&
          currentSolution.suggestedPrice !== null &&
          lowerSolution.suggestedPrice <= currentSolution.suggestedPrice
        ) {
          invalidSolutionIds.add(currentSolution.solutionId);
          break;
        }
      }
    }
  }

  // Return new array with qBreakValid property
  return solutionResults.map((solution) => ({
    ...solution,
    qBreakValid: !invalidSolutionIds.has(solution.solutionId),
  }));
}

function getSolutionResult(
  solution: Net32AlgoSolution,
  existingPriceBreaks: QuantitySolution[],
  vendorSettings: V2AlgoSettingsData[],
  ownVendorIds: number[],
): Net32AlgoSolutionWithResult {
  const existingPriceBreak = existingPriceBreaks.find(
    (pb) =>
      pb.quantity === solution.quantity &&
      pb.vendorId === solution.vendor.vendorId,
  );
  const vendorSetting = vendorSettings.find(
    (v) => v.vendor_id === solution.vendor.vendorId,
  );
  if (!vendorSetting) {
    throw new Error(
      `No vendor settings found for vendor ${solution.vendor.vendorId}`,
    );
  }
  if (!solution.vendor.bestPrice) {
    return {
      ...solution,
      algoResult: AlgoResult.IGNORE_FLOOR,
      suggestedPrice: null,
      comment: "We have hit the floor price.",
      triggeredByVendor: null,
    };
  }
  const suggestedPrice = applyUpDownPercentage(
    solution.vendor.bestPrice,
    vendorSetting,
    existingPriceBreak && new Decimal(existingPriceBreak.unitPrice),
  ).toDecimalPlaces(2);
  const competeOnPriceBreaksOnly = applyCompeteOnPriceBreaksOnly(
    vendorSetting,
    solution.quantity,
  );
  if (competeOnPriceBreaksOnly) {
    return {
      ...solution,
      algoResult: competeOnPriceBreaksOnly,
      suggestedPrice: suggestedPrice.toNumber(),
      comment: "This vendor only competes on price breaks.",
      triggeredByVendor: null,
    };
  }
  const suppressPriceBreak = applySuppressPriceBreakFilter(
    vendorSetting,
    solution.quantity,
  );
  if (suppressPriceBreak) {
    return {
      ...solution,
      algoResult: suppressPriceBreak,
      suggestedPrice: suggestedPrice.toNumber(),
      comment: "This vendor suppresses price breaks.",
      triggeredByVendor: null,
    };
  }
  const competeWithOwnQuantityZero = applyCompeteWithOwnQuantityZero(
    solution,
    vendorSetting,
  );
  if (competeWithOwnQuantityZero) {
    return {
      ...solution,
      algoResult: competeWithOwnQuantityZero,
      suggestedPrice: suggestedPrice.toNumber(),
      comment: "We have quantity 0, so we can't compete.",
      triggeredByVendor: null,
    };
  }
  const upDownRestriction = applyUpDownRestriction(
    suggestedPrice,
    vendorSetting,
    existingPriceBreak,
  );
  if (upDownRestriction) {
    return {
      ...solution,
      algoResult: upDownRestriction,
      suggestedPrice: suggestedPrice.toNumber(),
      comment: "We have hit the up/down restriction.",
      triggeredByVendor: null,
    };
  }
  const floorCompeteWithNext = applyFloorCompeteWithNext(
    solution,
    vendorSetting,
  );
  if (floorCompeteWithNext) {
    return {
      ...solution,
      algoResult: floorCompeteWithNext,
      suggestedPrice: suggestedPrice.toNumber(),
      comment: "Floor compete with next is off and we have hit the floor.",
      triggeredByVendor: null,
    };
  }
  if (
    existingPriceBreak &&
    new Decimal(existingPriceBreak.unitPrice).eq(suggestedPrice)
  ) {
    if (solution.buyBoxRank === 0) {
      return {
        ...solution,
        algoResult: AlgoResult.IGNORE_LOWEST,
        suggestedPrice: suggestedPrice.toNumber(),
        comment: "We are already winning buy box.",
        triggeredByVendor: null,
      };
    } else {
      return {
        ...solution,
        algoResult: AlgoResult.IGNORE_FLOOR,
        suggestedPrice: suggestedPrice.toNumber(),
        comment: "Floor compete with next is on and we have the same price.",
        triggeredByVendor: null,
      };
    }
  }
  // Check if a sister is already in the buy box position
  // from the perspective of this vendor.
  const sisterInBuyBox =
    solution.competitorsAndSistersFromViewOfOwnVendorRanked.find(
      (s) => s.buyBoxRank === 0 && ownVendorIds.includes(s.product.vendorId),
    );
  if (sisterInBuyBox) {
    return {
      ...solution,
      algoResult: AlgoResult.IGNORE_SISTER_LOWEST,
      suggestedPrice: suggestedPrice.toNumber(),
      comment: "A sister is already in the buy box position.",
      triggeredByVendor: null,
    };
  }
  const simulatedSisterVendorIds = vendorSetting.sister_vendor_ids
    .split(",")
    .map(parseInt)
    .filter((x) => !isNaN(x));
  const simulatedSisterInBuyBox =
    solution.competitorsAndSistersFromViewOfOwnVendorRanked.find(
      (s) =>
        s.buyBoxRank === 0 &&
        simulatedSisterVendorIds.includes(s.product.vendorId),
    );
  if (simulatedSisterInBuyBox) {
    return {
      ...solution,
      algoResult: AlgoResult.IGNORE_SETTINGS,
      suggestedPrice: suggestedPrice.toNumber(),
      comment: "A simulated sister is already in the buy box position.",
      triggeredByVendor: null,
    };
  }
  // Okay now we know we can make a change as everything else has been ruled out.
  if (!existingPriceBreak) {
    return {
      ...solution,
      algoResult: AlgoResult.CHANGE_NEW,
      suggestedPrice: suggestedPrice.toNumber(),
      comment: "We are a new price break.",
      triggeredByVendor: null,
    };
  } else if (suggestedPrice.lt(existingPriceBreak.unitPrice)) {
    if (!solution.rawTriggeredByVendor) {
      throw new Error(
        "No triggered by vendor found for change down. We should not get here",
      );
    }
    return {
      ...solution,
      algoResult: AlgoResult.CHANGE_DOWN,
      suggestedPrice: suggestedPrice.toNumber(),
      comment: "We are pricing down.",
      triggeredByVendor: solution.rawTriggeredByVendor,
    };
  } else if (suggestedPrice.gt(existingPriceBreak.unitPrice)) {
    return {
      ...solution,
      algoResult: AlgoResult.CHANGE_UP,
      suggestedPrice: suggestedPrice.toNumber(),
      comment: solution.rawTriggeredByVendor
        ? "We are pricing up to just undercut a competitor."
        : "We are pushing to max.",
      // This can be caused by pushing to max.
      // There might not be a vendor triggering the change in this case.
      triggeredByVendor: solution.rawTriggeredByVendor || null,
    };
  }
  return {
    ...solution,
    algoResult: AlgoResult.ERROR,
    suggestedPrice: null,
    comment: "We have hit an error. We should not be here.",
    triggeredByVendor: null,
  };
}

function getRankedCompetitorsToCompeteWith(
  vendorSetting: V2AlgoSettingsData,
  ownVendors: Net32AlgoProductWithBestPrice[],
  competitorsOnly: Net32AlgoProductWithBestPrice[],
  quantity: number,
  ownVendor: Net32AlgoProductWithBestPrice,
) {
  if (vendorSetting.compete_with_all_vendors) {
    return getProductsSortedByBuyBoxRank(
      [
        ...competitorsOnly,
        ...ownVendors.filter((v) => v.vendorId !== ownVendor.vendorId),
      ],
      quantity,
    );
  } else {
    return getProductsSortedByBuyBoxRank(competitorsOnly, quantity);
  }
}

function getOptimalSolutionForBoard(
  competitors: Net32AlgoProduct[],
  ownVendor: Net32AlgoProduct,
  quantity: number,
  vendorSetting: V2AlgoSettingsData,
  ourVendors: Net32AlgoProduct[],
): {
  solution: Net32AlgoProductWithBestPrice;
  competitorsFromViewOfOwnVendorRanked: Net32AlgoProduct[];
  competitorsAndSistersFromViewOfOwnVendorRanked: Net32AlgoProductWrapperWithBuyBoxRank[];
  rawTriggeredByVendor?: string;
} {
  const sisterVendors = ourVendors.filter(
    (v) => v.vendorId !== ownVendor.vendorId,
  );

  const competitorsFromViewOfOwnVendor = applyCompetitionFilters(
    competitors,
    ownVendor,
    vendorSetting,
  );

  const competitorsRankedByBuyBox = getRankedCompetitorsToCompeteWith(
    vendorSetting,
    ourVendors,
    competitorsFromViewOfOwnVendor,
    quantity,
    ownVendor,
  );
  const bestCompetitivePrice = getBestCompetitivePrice(
    ownVendor,
    competitorsRankedByBuyBox.map((x) => x.product),
    quantity,
    vendorSetting,
  );
  return {
    solution: {
      ...ownVendor,
      bestPrice: bestCompetitivePrice.price,
    },
    competitorsFromViewOfOwnVendorRanked: competitorsRankedByBuyBox.map(
      (x) => x.product,
    ),
    competitorsAndSistersFromViewOfOwnVendorRanked:
      getProductsSortedByBuyBoxRank(
        [...competitorsRankedByBuyBox.map((x) => x.product), ...sisterVendors],
        quantity,
      ),
    rawTriggeredByVendor: bestCompetitivePrice.triggeredByVendor,
  };
}

function getExpectedBuyBoxRank(
  ownProduct: Net32AlgoProductWithBestPrice,
  competitors: Net32AlgoProduct[],
  quantity: number,
  notCheapest: boolean,
) {
  if (!ownProduct.bestPrice) {
    throw new Error("Own product has no best price. This is an error");
  }
  const competitorsSortedByBuyBoxRank = getProductsSortedByBuyBoxRank(
    competitors,
    quantity,
  );
  for (let i = 0; i < competitorsSortedByBuyBoxRank.length; i++) {
    const competitor = competitorsSortedByBuyBoxRank[i];
    const competitorTotalCost = getTotalCostForQuantity(
      competitor.product,
      quantity,
    );
    const ourTotalCost = getTotalCostForQuantityWithUnitPriceOverride(
      ownProduct,
      quantity,
      ownProduct.bestPrice,
      notCheapest,
    );
    const beatingCompetitor = isBeatingCompetitorOnBuyBoxRules(
      ownProduct,
      competitor.product,
      ourTotalCost,
      competitorTotalCost,
    );
    if (beatingCompetitor) {
      return i;
    }
  }
  return competitors.length;
}

function computeTargetUnitPrice(
  undercutTotalCost: Decimal,
  ourProduct: Net32AlgoProduct,
  quantity: number,
  notCheapest: boolean,
) {
  // Consider both solutions if target unit price is above or below threshold
  const undercutUnitPriceAboveThreshold = undercutTotalCost.div(quantity);
  const undercutUnitPriceBelowThreshold = undercutTotalCost
    .sub(ourProduct.standardShipping)
    .div(quantity);

  // If the target price is above the threshold,
  // then there's no shipping, so we can use that
  // OR if NC is set -> we ignore our own shipping cost
  if (
    undercutUnitPriceAboveThreshold.gte(ourProduct.freeShippingThreshold) ||
    notCheapest
  ) {
    return undercutUnitPriceAboveThreshold;
  } else {
    // If it's below, then we know we have to have shipping, so we use the solution with shipping
    return undercutUnitPriceBelowThreshold;
  }
}

function getBestCompetitivePrice(
  ourProduct: Net32AlgoProduct,
  competitorsSortedByBuyBoxRank: Net32AlgoProduct[],
  quantity: number,
  ownVendorSetting: V2AlgoSettingsData,
) {
  // If there's no competitors, we should just price to max
  if (competitorsSortedByBuyBoxRank.length === 0) {
    return {
      price: new Decimal(ownVendorSetting.max_price),
    };
  }
  for (const competitor of competitorsSortedByBuyBoxRank) {
    const competitorTotalCost = getTotalCostForQuantity(competitor, quantity);
    const undercutTotalCost = getUndercutPriceToCompete(
      competitorTotalCost,
      ourProduct,
      competitor,
    );

    const undercutUnitPrice = computeTargetUnitPrice(
      undercutTotalCost,
      ourProduct,
      quantity,
      ownVendorSetting.not_cheapest,
    );

    if (undercutUnitPrice.gt(ownVendorSetting.max_price)) {
      return {
        price: new Decimal(ownVendorSetting.max_price),
      };
    }

    const undercutUnitPriceRoundUp = undercutUnitPrice.toDecimalPlaces(2, 0);
    const undercutUnitPriceRoundDown = undercutUnitPrice.toDecimalPlaces(2, 1);

    const resultingTotalRoundUp = getTotalCostForQuantityWithUnitPriceOverride(
      ourProduct,
      quantity,
      undercutUnitPriceRoundUp,
      ownVendorSetting.not_cheapest,
    );
    const resultingTotalRoundDown =
      getTotalCostForQuantityWithUnitPriceOverride(
        ourProduct,
        quantity,
        undercutUnitPriceRoundDown,
        ownVendorSetting.not_cheapest,
      );

    // Prefer the higher price if it's within the range and
    // creates a valid solution
    if (
      undercutUnitPriceRoundUp.gte(ownVendorSetting.floor_price) &&
      undercutUnitPriceRoundUp.lte(ownVendorSetting.max_price) &&
      resultingTotalRoundUp.lte(undercutTotalCost)
    ) {
      return {
        triggeredByVendor: `${competitor.vendorId}-${competitor.vendorName}`,
        price: undercutUnitPriceRoundUp,
      };
    } else if (
      undercutUnitPriceRoundDown.gte(ownVendorSetting.floor_price) &&
      undercutUnitPriceRoundDown.lte(ownVendorSetting.max_price) &&
      resultingTotalRoundDown.lte(undercutTotalCost)
    ) {
      return {
        triggeredByVendor: `${competitor.vendorId}-${competitor.vendorName}`,
        price: undercutUnitPriceRoundDown,
      };
    }
  }
  return { price: null };
}

export function hasBadge(product: Net32AlgoProduct): boolean {
  return product.badgeId > 0 && product.badgeName !== "";
}

// Helper to determine shipping bucket
export function getShippingBucket(shippingTimeDays: number): number {
  if (shippingTimeDays <= 2) return 1;
  if (shippingTimeDays <= 5) return 2;
  return 3;
}

function isBeatingCompetitorOnBuyBoxRules(
  ourProduct: Net32AlgoProduct,
  competitorProduct: Net32AlgoProduct,
  ourProductPrice: Decimal,
  competitorProductPrice: Decimal,
) {
  const weHaveBadge = hasBadge(ourProduct);
  const theyHaveBadge = hasBadge(competitorProduct);
  if (weHaveBadge && theyHaveBadge) {
    // We have worse shipping
    if (
      getShippingBucket(ourProduct.shippingTime) >
      getShippingBucket(competitorProduct.shippingTime)
    ) {
      return ourProductPrice.lt(competitorProductPrice.mul(0.995));
    } else if (
      getShippingBucket(ourProduct.shippingTime) <
      getShippingBucket(competitorProduct.shippingTime)
    ) {
      // we have better shipping
      // TODO: Is this less or less than or equal to?
      return ourProductPrice.lt(competitorProductPrice.mul(1.005));
    } else {
      // We have the same shipping
      return ourProductPrice.lte(competitorProductPrice.sub(0.01));
    }
  } else if (weHaveBadge && !theyHaveBadge) {
    // We have badge, they don't
    return ourProductPrice.lt(competitorProductPrice.mul(1.1));
  } else if (!weHaveBadge && theyHaveBadge) {
    return ourProductPrice.lt(competitorProductPrice.mul(0.9));
    // We don't have badge, they do
  } else if (
    getShippingBucket(ourProduct.shippingTime) >
    getShippingBucket(competitorProduct.shippingTime)
  ) {
    // We have worse shipping
    return ourProductPrice.lt(competitorProductPrice.mul(0.995));
  } else if (
    getShippingBucket(ourProduct.shippingTime) <
    getShippingBucket(competitorProduct.shippingTime)
  ) {
    // We have better shipping
    return ourProductPrice.lt(competitorProductPrice.mul(1.005));
  } else {
    // We have the same shipping
    return ourProductPrice.lte(competitorProductPrice.sub(0.01));
  }
}

function getStrictlyLessThanUndercutPriceToCompete(
  targetPrice: Decimal,
  ourProduct: Net32AlgoProduct,
  targetProduct: Net32AlgoProduct,
) {
  // Here we have to subtract another penny when undercutting
  // to make sure we are less than the threshold
  const targetHasBadge = hasBadge(targetProduct);
  const weHaveBadge = hasBadge(ourProduct);
  if (targetHasBadge && !weHaveBadge) {
    return targetPrice.mul(0.9);
  } else if (targetHasBadge && weHaveBadge) {
    if (
      getShippingBucket(targetProduct.shippingTime) >
      getShippingBucket(ourProduct.shippingTime)
    ) {
      // We have better shipping
      return targetPrice.mul(1.005);
    } else if (
      getShippingBucket(targetProduct.shippingTime) <
      getShippingBucket(ourProduct.shippingTime)
    ) {
      // We have worse shipping
      return targetPrice.mul(0.995);
    } else {
      // We have the same shipping
      return targetPrice;
    }
  } else if (!targetHasBadge && weHaveBadge) {
    return targetPrice.mul(1.1);
  } else if (
    getShippingBucket(targetProduct.shippingTime) >
    getShippingBucket(ourProduct.shippingTime)
  ) {
    return targetPrice.mul(1.005);
  } else if (
    getShippingBucket(targetProduct.shippingTime) <
    getShippingBucket(ourProduct.shippingTime)
  ) {
    return targetPrice.mul(0.995);
  } else {
    return targetPrice;
  }
}

function getUndercutPriceToCompete(
  targetPrice: Decimal,
  ourProduct: Net32AlgoProduct,
  targetProduct: Net32AlgoProduct,
) {
  const strictlyLessThanPriceToCompete =
    getStrictlyLessThanUndercutPriceToCompete(
      targetPrice,
      ourProduct,
      targetProduct,
    );
  // Here we round down as the price has to be strictly less than the target price
  // Example would be $10.02 * 0.9 = $9.018, which we round down to $9.01 as $9.02 would not pass the undercut rules
  let roundedUndercutPriceToCompete =
    strictlyLessThanPriceToCompete.toDecimalPlaces(2, 1);
  // If there is no multiplication, i.e., it's a situation where we're undercutting by just a penny,
  // we'll have to manually take out a penny
  if (!roundedUndercutPriceToCompete.lt(strictlyLessThanPriceToCompete)) {
    roundedUndercutPriceToCompete = roundedUndercutPriceToCompete.sub(0.01);
  }
  return roundedUndercutPriceToCompete;
}

// Helper to get all non-empty subsets of an array
function getAllNonEmptySubsets<T>(arr: T[]): T[][] {
  const result: T[][] = [];
  const n = arr.length;
  for (let i = 1; i < 1 << n; i++) {
    const subset: T[] = [];
    for (let j = 0; j < n; j++) {
      if (i & (1 << j)) {
        subset.push(arr[j]);
      }
    }
    result.push(subset);
  }
  return result;
}

function sortBasedOnBuyBoxRulesV2(
  a: {
    totalCost: Decimal;
    hasBadge: boolean;
    shippingBucket: number;
  },
  b: {
    totalCost: Decimal;
    hasBadge: boolean;
    shippingBucket: number;
  },
) {
  // If both have badge
  if (a.hasBadge && b.hasBadge) {
    // If a is in a lower shipping bucket (faster) than b, need to be at least 0.5% cheaper
    if (a.shippingBucket < b.shippingBucket) {
      if (new Decimal(b.totalCost).lte(new Decimal(a.totalCost).mul(0.995)))
        return 1;
      return -1;
    }
    // If b is in a lower shipping bucket (faster) than a, need to be at least 0.5% cheaper
    if (b.shippingBucket < a.shippingBucket) {
      if (new Decimal(a.totalCost).lte(new Decimal(b.totalCost).mul(0.995)))
        return -1;
      return 1;
    }
    // If both have the same shipping bucket, need to be at least 1c cheaper
    if (new Decimal(a.totalCost).lte(new Decimal(b.totalCost).sub(0.01)))
      return -1;
    if (new Decimal(b.totalCost).lte(new Decimal(a.totalCost).sub(0.01)))
      return 1;
    return 0;
  }
  // If a has badge, b does not, need to be at least 10% cheaper
  if (a.hasBadge && !b.hasBadge) {
    if (new Decimal(b.totalCost).lte(new Decimal(a.totalCost).mul(0.9)))
      return 1;
    return -1;
  }
  // If b has badge, a does not, need to be at least 10% cheaper
  if (!a.hasBadge && b.hasBadge) {
    if (new Decimal(a.totalCost).lte(new Decimal(b.totalCost).mul(0.9)))
      return -1;
    return 1;
  }
  // If a is in a lower shipping bucket (faster) than b, need to be at least 0.5% cheaper
  if (a.shippingBucket < b.shippingBucket) {
    if (new Decimal(b.totalCost).lte(new Decimal(a.totalCost).mul(0.995)))
      return 1;
    return -1;
  }
  // If b is in a lower shipping bucket (faster) than a, need to be at least 0.5% cheaper
  if (b.shippingBucket < a.shippingBucket) {
    if (new Decimal(a.totalCost).lte(new Decimal(b.totalCost).mul(0.995)))
      return -1;
    return 1;
  }
  // Otherwise, 0.01 cheaper wins
  if (new Decimal(a.totalCost).lte(new Decimal(b.totalCost).sub(0.01)))
    return -1;
  if (new Decimal(b.totalCost).lte(new Decimal(a.totalCost).sub(0.01)))
    return 1;
  return 0;
}

function getProductsSortedByBuyBoxRank(
  net32Products: (Net32AlgoProduct | Net32AlgoProductWithBestPrice)[],
  quantity: number,
): Net32AlgoProductWrapperWithBuyBoxRank[] {
  const productInfos = net32Products.map((prod) => {
    const unitPrice =
      (prod as Net32AlgoProductWithBestPrice).bestPrice !== undefined
        ? (prod as Net32AlgoProductWithBestPrice).bestPrice!
        : new Decimal(
            getHighestPriceBreakLessThanOrEqualTo(prod, quantity).unitPrice,
          );

    return {
      product: prod,
      totalCost: getTotalCostForQuantity(prod, quantity),
      effectiveUnitPrice: unitPrice,
      hasBadge: hasBadge(prod),
      shippingBucket: getShippingBucket(prod.shippingTime),
    };
  });

  const sortedProducts = productInfos.toSorted((a, b) =>
    sortBasedOnBuyBoxRulesV2(a, b),
  );

  // Assign buy box ranks, handling ties
  let currentRank = 0;
  let currentRankCount = 0;
  const productsWithRank: Net32AlgoProductWrapperWithBuyBoxRank[] = [];

  for (let i = 0; i < sortedProducts.length; i++) {
    const product = sortedProducts[i];

    // If this is the first product or if it's different from the previous one
    if (
      i === 0 ||
      sortBasedOnBuyBoxRulesV2(sortedProducts[i - 1], product) !== 0
    ) {
      currentRank = i;
      currentRankCount = 1;
    } else {
      // Same rank as previous product
      currentRankCount++;
    }

    productsWithRank.push({
      ...product,
      buyBoxRank: currentRank,
    });
  }

  return productsWithRank;
}

export function getTotalCostForQuantityWithUnitPriceOverride(
  net32Product: Net32AlgoProduct,
  quantity: number,
  unitPriceOverride: Decimal,
  ignoreShipping: boolean,
) {
  const totalCost = unitPriceOverride.mul(quantity);
  if (ignoreShipping) {
    return totalCost;
  }
  if (totalCost.lt(net32Product.freeShippingThreshold)) {
    return totalCost.add(net32Product.standardShipping);
  } else {
    return totalCost;
  }
}

/**
 * This function calculates the total cost for a given quantity of a product.
 * It uses the highest price break less than or equal to the quantity to find the unit price.
 * @param net32Product - The product to calculate the total cost for.
 * @param quantity - The quantity to calculate the total cost for.
 * @returns The total cost for the given quantity of the product.
 */
export function getTotalCostForQuantity(
  net32Product: Net32AlgoProductWithBestPrice,
  quantity: number,
) {
  const highestPriceBreak = getHighestPriceBreakLessThanOrEqualTo(
    net32Product,
    quantity,
  );
  const breakOne = net32Product.priceBreaks.find((pb) => pb.minQty === 1);
  if (!breakOne) {
    throw new Error(
      `No price break found for quantity 1 for product ${net32Product.vendorId}`,
    );
  }
  let totalCost: Decimal;
  if (net32Product.bestPrice) {
    totalCost = net32Product.bestPrice.mul(quantity);
  } else {
    totalCost = new Decimal(highestPriceBreak.unitPrice).mul(quantity);
  }
  const threshold = new Decimal(net32Product.freeShippingThreshold);
  if (totalCost.lt(threshold)) {
    return totalCost.add(new Decimal(net32Product.standardShipping));
  } else {
    return totalCost;
  }
}

export function getHighestPriceBreakLessThanOrEqualTo(
  net32Product: Net32AlgoProduct,
  maxQuantity: number,
): Net32PriceBreak {
  return net32Product.priceBreaks.reduce(
    (max, b) => {
      if (b.minQty <= maxQuantity) {
        if (b.minQty > max.minQty) {
          return b;
        }
      }
      return max;
    },
    { minQty: 0, unitPrice: 0 },
  );
}

export function getTotalCostFreeShippingOverride(
  unitPrice: number | Decimal,
  quantity: number,
  freeShipping: boolean,
  standardShipping: number,
) {
  if (freeShipping) {
    return new Decimal(unitPrice).mul(quantity);
  } else {
    return new Decimal(unitPrice).mul(quantity).add(standardShipping);
  }
}

/**
 * This function returns the unique valid quantity breaks for a given list of products.
 * It does this by checking that the price breaks are in ascending order and that the price breaks
 * are valid. There is one caveat that for price breaks not 1, there needs to be a price break with lower quantity
 * with higher price, otherwise the price break is invalid. For example,
 * Q1 = $5, Q2 = $4 is valid
 * Q1 = $5, Q2 = $6 is invalid
 * @param net32Products - The list of products to get the unique valid quantity breaks for.
 * @returns The unique valid quantity breaks for the given list of products.
 */
function getUniqueValidQuantityBreaks(net32Products: Net32AlgoProduct[]) {
  const quantityBreaks = new Set<number>();

  for (const product of net32Products) {
    // Sort price breaks by minQty to validate them in order
    const sortedPriceBreaks = [...product.priceBreaks].toSorted(
      (a, b) => a.minQty - b.minQty,
    );

    for (let i = 0; i < sortedPriceBreaks.length; i++) {
      const currentBreak = sortedPriceBreaks[i];
      const currentMinQty = currentBreak.minQty;
      const currentPrice = currentBreak.unitPrice;

      // minQty = 1 is always valid
      if (currentMinQty === 1) {
        quantityBreaks.add(currentMinQty);
        continue;
      }

      // For other quantities, check if there's a lower quantity with a higher price
      let hasLowerQuantityWithHigherPrice = false;
      for (let j = 0; j < i; j++) {
        const lowerBreak = sortedPriceBreaks[j];
        if (
          lowerBreak.minQty < currentMinQty &&
          lowerBreak.unitPrice > currentPrice
        ) {
          hasLowerQuantityWithHigherPrice = true;
          break;
        }
      }
      // This was the old phantom Q break setting.
      // We want to ignore any quantity breaks that are invalid due to insufficient inventory.
      const hasSufficientInventory = product.inventory >= currentMinQty;

      if (hasLowerQuantityWithHigherPrice && hasSufficientInventory) {
        quantityBreaks.add(currentMinQty);
      }
    }
  }

  return Array.from(quantityBreaks).toSorted((a, b) => a - b);
}
