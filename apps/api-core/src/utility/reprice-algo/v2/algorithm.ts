import {
  AlgoPriceDirection,
  AlgoPriceStrategy,
} from "@repricer-monorepo/shared";
import { Decimal } from "decimal.js";
import uniqBy from "lodash/uniqBy";
import { Net32PriceBreak } from "../../../types/net32";
import { V2AlgoSettingsData } from "../../mysql/v2-algo-settings";
import { createHtmlFileContent } from "./html-builder";
import {
  applyCompeteOnPriceBreaksOnly,
  applyCompetitionFilters,
  applyFloorCompeteWithNext,
  applyKeepPosition,
  applyOwnVendorThreshold,
  applySuppressPriceBreakFilter,
  applySuppressQBreakIfQ1NotUpdated,
  applyUpDownPercentage,
  applyUpDownRestriction,
} from "./settings";
import {
  AlgoResult,
  ChangeResult,
  InternalProduct,
  Net32AlgoProduct,
  Net32AlgoProductWithBestPrice,
  Net32AlgoProductWrapperWithBuyBoxRank,
  QbreakInvalidReason,
} from "./types";
import { isShortExpiryProduct } from "./utility";

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
  everyoneFromViewOfOwnVendorRanked: Net32AlgoProductWrapperWithBuyBoxRank[];
  everyoneIncludingOwnVendorBefore: Net32AlgoProductWrapperWithBuyBoxRank[];
  rawTriggeredByVendor?: string;
  pushedToMax?: boolean;
  beforeLadder: Net32AlgoProductWrapperWithBuyBoxRank[];
  lowestPrice: number | null;
  lowestVendorId: number | null;
  lowestVendorPosition: number | null;
  preJsonPosition: number;
}

export interface Net32AlgoSolutionWithResult extends Net32AlgoSolution {
  algoResult: AlgoResult;
  comment: string;
  suggestedPrice: number | null;
  triggeredByVendor: string | null;
}

export interface Net32AlgoSolutionWithQBreakValid
  extends Net32AlgoSolutionWithResult {
  qBreakValid: boolean;
  qBreakInvalidReason?: QbreakInvalidReason[];
}

export interface Net32AlgoSolutionWithChangeResult
  extends Net32AlgoSolutionWithQBreakValid {
  changeResult: ChangeResult | null;
  priceList: { minQty: number; price: number }[] | null;
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
  non422VendorIds: number[],
  allOwnVendorIds: number[],
  vendorSettings: V2AlgoSettingsData[],
  jobId: string,
  isSlowCron: boolean,
  net32url: string,
) {
  const validProducts = rawNet32Products.filter((p) =>
    Array.isArray(p.priceBreaks),
  );

  const competitorProducts = validProducts.filter(
    (p) => !allOwnVendorIds.includes(p.vendorId),
  );
  // All products that we have available to use to make changes.
  const ourAvailableVendorProducts = validProducts
    .filter((p) => non422VendorIds.find((id) => id === p.vendorId))
    .filter((p) => {
      const setting = vendorSettings.find((s) => s.vendor_id === p.vendorId);
      return setting?.enabled;
    });

  const availableProducts = ourAvailableVendorProducts.map((v) => v.vendorId);

  const lowestVendor = getLowestVendor(rawNet32Products);

  const solutions: Net32AlgoSolution[] = [];

  for (const ourVendor of ourAvailableVendorProducts) {
    const vendorSetting = vendorSettings.find(
      (v) => v.vendor_id === ourVendor.vendorId,
    );
    if (!vendorSetting) {
      throw new Error(
        `No vendor settings found for vendor ${ourVendor.vendorId}`,
      );
    }
    const preJsonPosition = rawNet32Products.findIndex(
      (p) => p.vendorId === ourVendor.vendorId,
    );

    const filteredCompetitors = applyCompetitionFilters(
      [
        ...competitorProducts,
        ...(vendorSetting.compete_with_all_vendors
          ? ourAvailableVendorProducts.filter(
              (p) => p.vendorId !== ourVendor.vendorId,
            )
          : []),
      ],
      vendorSetting,
    );

    const competitorQuantityBreaks =
      getUniqueValidQuantityBreaks(filteredCompetitors);

    for (const quantity of competitorQuantityBreaks) {
      const competeQuantity = getCompeteQuantity(vendorSetting, quantity);

      const rawCompetitorsRanked = getProductsSortedWithRank(
        competitorProducts,
        competeQuantity,
        vendorSetting.price_strategy,
      );

      const beforeLadder = getProductsSortedWithRank(
        uniqBy(
          [
            ...filteredCompetitors,
            ...applyCompetitionFilters(
              ourAvailableVendorProducts.filter(
                (p) => p.vendorId !== ourVendor.vendorId,
              ),
              vendorSetting,
            ),
            ourVendor,
          ],
          (p) => p.vendorId,
        ),
        quantity,
        AlgoPriceStrategy.BUY_BOX,
      );

      const {
        solution: vendorSolution,
        competitorsFromViewOfOwnVendorRanked,
        rawTriggeredByVendor,
        pushedToMax,
        everyoneFromViewOfOwnVendorRanked,
        everyoneIncludingOwnVendorBefore,
      } = getOptimalSolutionForBoard(
        rawCompetitorsRanked.map((x) => x.product),
        ourVendor,
        competeQuantity,
        vendorSetting,
        ourAvailableVendorProducts,
      );

      const solutionId = `Q${quantity}-${vendorSolution.vendorName}@${vendorSolution.bestPrice?.toNumber()}`;
      const rank = vendorSolution.bestPrice
        ? getExpectedRank(
            vendorSolution,
            competitorsFromViewOfOwnVendorRanked,
            competeQuantity,
            vendorSetting.price_strategy,
          )
        : Infinity;

      const postSolutionInsertBoard = getProductsSortedWithRank(
        [
          vendorSolution,
          ...everyoneFromViewOfOwnVendorRanked.map((x) => x.product),
        ],
        // If Compare Q2 on Q1, we are still inserting on Q2, eventhough we are ranking on Q1.
        quantity,
        vendorSetting.price_strategy,
      );

      solutions.push({
        quantity,
        buyBoxRank: rank,
        vendor: vendorSolution,
        vendorSettings: vendorSetting,
        postSolutionInsertBoard: postSolutionInsertBoard.map((x) => x.product),
        solutionId,
        beforeLadder,
        rawTriggeredByVendor,
        pushedToMax,
        everyoneFromViewOfOwnVendorRanked,
        everyoneIncludingOwnVendorBefore,
        lowestPrice: lowestVendor.lowestPrice,
        lowestVendorId: lowestVendor.lowestVendorId,
        lowestVendorPosition: lowestVendor.lowestVendorPosition,
        preJsonPosition,
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

  const solutionResults = solutions.map((s) => {
    const baseResult = getSolutionResult(
      s,
      existingPriceBreaks,
      availableProducts,
      isSlowCron,
    );
    const pushedToMax = s.pushedToMax;
    return {
      ...s,
      ...baseResult,
      comment: baseResult.comment + (pushedToMax ? " Pushed to max." : ""),
    };
  });
  const solutionResultsWithQBreakValid = removeUnnecessaryQuantityBreaks(
    solutionResults,
    isSlowCron,
  );

  const htmlFiles = availableProducts.map((vendorId) => {
    const html = createHtmlFileContent(
      mpId,
      rawNet32Products,
      solutionResultsWithQBreakValid.filter(
        (s) => s.vendor.vendorId === vendorId,
      ),
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
  isSlowCron: boolean,
): Net32AlgoSolutionWithQBreakValid[] {
  const invalidQuantityBreaks = removeInvalidQuantityBreaks(solutionResults);
  const suppressQBreakIfQ1NotUpdated = applySuppressQBreakIfQ1NotUpdated(
    solutionResults,
    isSlowCron,
  );
  return solutionResults.map((s, i) => {
    const invalidReasons: QbreakInvalidReason[] = [];
    if (!invalidQuantityBreaks[i].qBreakValid) {
      invalidReasons.push(QbreakInvalidReason.UNNECESSARY);
    }
    if (!suppressQBreakIfQ1NotUpdated[i].qBreakValid) {
      invalidReasons.push(QbreakInvalidReason.SUPPRESS_BECAUSE_Q1_NOT_UPDATED);
    }
    const qBreakValid =
      invalidQuantityBreaks[i].qBreakValid &&
      suppressQBreakIfQ1NotUpdated[i].qBreakValid;
    return {
      ...s,
      qBreakValid,
      qBreakInvalidReason:
        invalidReasons.length > 0 ? invalidReasons : undefined,
      comment: getNewComment(
        s.comment,
        invalidQuantityBreaks[i].qBreakValid === false,
        suppressQBreakIfQ1NotUpdated[i].qBreakValid === false,
      ),
      algoResult: qBreakValid ? s.algoResult : AlgoResult.IGNORE_SETTINGS,
    };
  });
}

function getNewComment(
  oldComment: string,
  qBreakUnneccessary: boolean,
  qBreakSuppressed: boolean,
) {
  let comment = oldComment;
  if (qBreakUnneccessary) {
    comment += " This quantity break is unnecessary.";
  }
  if (qBreakSuppressed) {
    comment += " This quantity break is suppressed because Q1 is not updated.";
  }
  return comment;
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
  availableVendorIds: number[],
  isSlowCron: boolean,
) {
  const vendorSetting = solution.vendorSettings;
  const existingPriceBreak = existingPriceBreaks.find(
    (pb) =>
      pb.quantity === solution.quantity &&
      pb.vendorId === solution.vendor.vendorId,
  );
  if (!solution.vendor.bestPrice) {
    return {
      algoResult: AlgoResult.IGNORE_FLOOR,
      suggestedPrice: null,
      comment: "Hit the floor price.",
      triggeredByVendor: null,
      rawTriggeredByVendor: solution.rawTriggeredByVendor,
    };
  }

  const suggestedPrice = applyUpDownPercentage(
    solution.vendor.bestPrice,
    vendorSetting,
    hasBadge(solution.vendor),
    existingPriceBreak && new Decimal(existingPriceBreak.unitPrice),
  ).toDecimalPlaces(2);

  const ownVendorThreshold = applyOwnVendorThreshold(solution, vendorSetting);
  if (ownVendorThreshold) {
    return {
      algoResult: ownVendorThreshold,
      suggestedPrice: suggestedPrice.toNumber(),
      comment: "Below own vendor quantity threshold.",
      triggeredByVendor: null,
      rawTriggeredByVendor: solution.rawTriggeredByVendor,
    };
  }

  if (isShortExpiryProduct(solution.vendor.priceBreaks, solution.quantity)) {
    return {
      algoResult: AlgoResult.IGNORE_SHORT_EXPIRY,
      suggestedPrice: suggestedPrice.toNumber(),
      comment: "Short expiry product.",
      triggeredByVendor: null,
      rawTriggeredByVendor: solution.rawTriggeredByVendor,
    };
  }

  // Check if a sister is already in the buy box position
  // from the perspective of this vendor.
  const sisterInBuyBox = solution.everyoneIncludingOwnVendorBefore.find(
    (s) =>
      s.buyBoxRank === 0 &&
      availableVendorIds
        .filter((x) => x !== solution.vendor.vendorId)
        .includes(s.product.vendorId),
  );
  const competeAll = vendorSetting.compete_with_all_vendors;
  if (sisterInBuyBox && !competeAll) {
    return {
      algoResult: AlgoResult.IGNORE_SISTER_LOWEST,
      suggestedPrice: suggestedPrice.toNumber(),
      comment: "A sister is already in the buy box position.",
      triggeredByVendor: null,
      rawTriggeredByVendor: solution.rawTriggeredByVendor,
    };
  }
  const simulatedSisterVendorIds = vendorSetting.sister_vendor_ids
    .split(",")
    .map((x) => parseInt(x, 10))
    .filter((x) => !isNaN(x));
  const simulatedSisterInBuyBox =
    solution.everyoneIncludingOwnVendorBefore.find(
      (s) =>
        s.buyBoxRank === 0 &&
        simulatedSisterVendorIds.includes(s.product.vendorId),
    );
  if (simulatedSisterInBuyBox && !competeAll) {
    return {
      algoResult: AlgoResult.IGNORE_SISTER_LOWEST,
      suggestedPrice: suggestedPrice.toNumber(),
      comment: "A simulated sister is already in the buy box position.",
      triggeredByVendor: null,
      rawTriggeredByVendor: solution.rawTriggeredByVendor,
    };
  }

  // If we are already in the buybox, and we are only set to down, then there is nothing to do.
  if (
    solution.everyoneIncludingOwnVendorBefore.find(
      (s) =>
        s.buyBoxRank === 0 && s.product.vendorId === solution.vendor.vendorId,
    ) &&
    vendorSetting.up_down === AlgoPriceDirection.DOWN
  ) {
    return {
      algoResult: AlgoResult.IGNORE_LOWEST,
      suggestedPrice: suggestedPrice.toNumber(),
      comment: "Already winning buy box.",
      triggeredByVendor: null,
      rawTriggeredByVendor: solution.rawTriggeredByVendor,
    };
  }

  const floorCompeteWithNext = applyFloorCompeteWithNext(
    solution,
    vendorSetting,
    isSlowCron,
  );
  if (floorCompeteWithNext) {
    return {
      algoResult: floorCompeteWithNext,
      suggestedPrice: suggestedPrice.toNumber(),
      comment:
        "Floor compete with next is off and own vendor has hit the floor.",
      triggeredByVendor: null,
      rawTriggeredByVendor: solution.rawTriggeredByVendor,
    };
  }

  const competeOnPriceBreaksOnly = applyCompeteOnPriceBreaksOnly(
    vendorSetting,
    solution.quantity,
  );
  if (competeOnPriceBreaksOnly) {
    return {
      algoResult: competeOnPriceBreaksOnly,
      suggestedPrice: suggestedPrice.toNumber(),
      comment: "Only competes on price breaks.",
      triggeredByVendor: null,
      rawTriggeredByVendor: solution.rawTriggeredByVendor,
    };
  }
  const suppressPriceBreak = applySuppressPriceBreakFilter(
    vendorSetting,
    solution.quantity,
  );
  if (suppressPriceBreak) {
    return {
      algoResult: suppressPriceBreak,
      suggestedPrice: suggestedPrice.toNumber(),
      comment: "Suppresses price breaks.",
      triggeredByVendor: null,
      rawTriggeredByVendor: solution.rawTriggeredByVendor,
    };
  }

  const upDownRestriction = applyUpDownRestriction(
    suggestedPrice,
    vendorSetting,
    isSlowCron,
    existingPriceBreak,
  );
  if (upDownRestriction) {
    let comment;
    if (vendorSetting.up_down === AlgoPriceDirection.UP) {
      comment = "Set to only price up and trying to price down.";
    } else if (vendorSetting.up_down === AlgoPriceDirection.DOWN) {
      comment = "Set to only price down and trying to price up.";
    } else {
      throw new Error(
        `Invalid up/down setting: ${vendorSetting.up_down} to trigger this restriction. We should not be here.`,
      );
    }
    return {
      algoResult: upDownRestriction,
      suggestedPrice: suggestedPrice.toNumber(),
      comment,
      triggeredByVendor: null,
      rawTriggeredByVendor: solution.rawTriggeredByVendor,
    };
  }
  if (
    existingPriceBreak &&
    new Decimal(existingPriceBreak.unitPrice).eq(suggestedPrice)
  ) {
    if (solution.buyBoxRank === 0) {
      return {
        algoResult: AlgoResult.IGNORE_LOWEST,
        suggestedPrice: suggestedPrice.toNumber(),
        comment: "Already winning buy box and suggested price is the same.",
        triggeredByVendor: null,
        rawTriggeredByVendor: solution.rawTriggeredByVendor,
      };
    } else {
      return {
        algoResult: AlgoResult.IGNORE_FLOOR,
        suggestedPrice: suggestedPrice.toNumber(),
        comment:
          "Floor compete with next is on and own vendor has the same price.",
        triggeredByVendor: null,
        rawTriggeredByVendor: solution.rawTriggeredByVendor,
      };
    }
  }

  const keepPosition = applyKeepPosition(
    vendorSetting,
    isSlowCron,
    solution.preJsonPosition,
    solution.lowestVendorPosition,
  );
  if (keepPosition) {
    return {
      algoResult: keepPosition,
      suggestedPrice: suggestedPrice.toNumber(),
      comment: "Keep position is on.",
      triggeredByVendor: null,
      rawTriggeredByVendor: solution.rawTriggeredByVendor,
    };
  }

  // Okay now we know we can make a change as everything else has been ruled out.
  if (!existingPriceBreak) {
    return {
      algoResult: AlgoResult.CHANGE_NEW,
      suggestedPrice: suggestedPrice.toNumber(),
      comment: "New price break.",
      triggeredByVendor: solution.rawTriggeredByVendor || null,
      rawTriggeredByVendor: solution.rawTriggeredByVendor,
    };
  } else if (suggestedPrice.lt(existingPriceBreak.unitPrice)) {
    return {
      algoResult: AlgoResult.CHANGE_DOWN,
      suggestedPrice: suggestedPrice.toNumber(),
      comment: "Pricing down.",
      triggeredByVendor: solution.rawTriggeredByVendor || null,
      rawTriggeredByVendor: solution.rawTriggeredByVendor,
    };
  } else if (suggestedPrice.gt(existingPriceBreak.unitPrice)) {
    return {
      algoResult: AlgoResult.CHANGE_UP,
      suggestedPrice: suggestedPrice.toNumber(),
      comment: "Pricing up to undercut a competitor.",
      triggeredByVendor: solution.rawTriggeredByVendor || null,
      rawTriggeredByVendor: solution.rawTriggeredByVendor,
    };
  }
  return {
    algoResult: AlgoResult.ERROR,
    suggestedPrice: null,
    comment: "Hit an error. We should not be here.",
    triggeredByVendor: null,
    rawTriggeredByVendor: solution.rawTriggeredByVendor,
  };
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
  everyoneFromViewOfOwnVendorRanked: Net32AlgoProductWrapperWithBuyBoxRank[];
  everyoneIncludingOwnVendorBefore: Net32AlgoProductWrapperWithBuyBoxRank[];
  rawTriggeredByVendor?: string;
  pushedToMax?: boolean;
} {
  const sisterVendors = ourVendors.filter(
    (v) => v.vendorId !== ownVendor.vendorId,
  );

  const competitorsView = applyCompetitionFilters(
    [
      ...competitors,
      ...(vendorSetting.compete_with_all_vendors ? sisterVendors : []),
    ],
    vendorSetting,
    quantity,
  );

  const competitorsRanked = getProductsSortedWithRank(
    competitorsView,
    quantity,
    vendorSetting.price_strategy,
  );

  const everyoneFromViewOfOwnVendor = getProductsSortedWithRank(
    applyCompetitionFilters(
      [...competitors, ...sisterVendors],
      vendorSetting,
      quantity,
    ),
    quantity,
    vendorSetting.price_strategy,
  );

  const everyoneIncludingOwnVendorBefore = getProductsSortedWithRank(
    [
      ...applyCompetitionFilters(
        [...competitors, ...sisterVendors],
        vendorSetting,
        quantity,
      ),
      ownVendor,
    ],
    quantity,
    vendorSetting.price_strategy,
  );

  const bestCompetitivePrice = getBestCompetitivePrice(
    ownVendor,
    competitorsRanked.map((x) => x.product),
    quantity,
    vendorSetting,
  );
  return {
    solution: {
      ...ownVendor,
      bestPrice: bestCompetitivePrice.price,
    },
    competitorsFromViewOfOwnVendorRanked: competitorsRanked.map(
      (x) => x.product,
    ),
    rawTriggeredByVendor: bestCompetitivePrice.triggeredByVendor,
    pushedToMax: bestCompetitivePrice.pushedToMax,
    everyoneFromViewOfOwnVendorRanked: everyoneFromViewOfOwnVendor,
    everyoneIncludingOwnVendorBefore,
  };
}

function getBestCompetitivePrice(
  ourProduct: Net32AlgoProduct,
  competitorsSorted: Net32AlgoProduct[],
  quantity: number,
  ownVendorSetting: V2AlgoSettingsData,
) {
  switch (ownVendorSetting.price_strategy) {
    case AlgoPriceStrategy.UNIT:
      return getBestCompetitivePriceByUnitPrice(
        competitorsSorted,
        quantity,
        ownVendorSetting,
      );
    case AlgoPriceStrategy.TOTAL:
      return getBestCompetitivePriceByTotalPrice(
        ourProduct,
        competitorsSorted,
        quantity,
        ownVendorSetting,
        false,
      );
    case AlgoPriceStrategy.BUY_BOX:
      return getBestCompetitivePriceByTotalPrice(
        ourProduct,
        competitorsSorted,
        quantity,
        ownVendorSetting,
        true,
      );
    default:
      throw new Error(
        `Invalid price strategy: ${ownVendorSetting.price_strategy}`,
      );
  }
}

function getExpectedRank(
  ownProduct: Net32AlgoProductWithBestPrice,
  competitors: Net32AlgoProduct[],
  quantity: number,
  priceStrategy: AlgoPriceStrategy,
) {
  switch (priceStrategy) {
    case AlgoPriceStrategy.UNIT:
      return getExpectedRankByUnitPrice(ownProduct, competitors, quantity);
    case AlgoPriceStrategy.TOTAL:
      return getExpectedRankByTotalPrice(
        ownProduct,
        competitors,
        quantity,
        priceStrategy,
      );
    case AlgoPriceStrategy.BUY_BOX:
      return getExpectedRankByBuyBox(
        ownProduct,
        competitors,
        quantity,
        priceStrategy,
      );
    default:
      throw new Error(`Invalid price strategy: ${priceStrategy}`);
  }
}

function getExpectedRankByUnitPrice(
  ownProduct: Net32AlgoProductWithBestPrice,
  competitors: Net32AlgoProduct[],
  quantity: number,
) {
  if (!ownProduct.bestPrice) {
    throw new Error("Own product has no best price. This is an error");
  }
  const competitorsSorted = getProductsSortedWithRank(
    competitors,
    quantity,
    AlgoPriceStrategy.UNIT,
  );
  for (let i = 0; i < competitorsSorted.length; i++) {
    const competitor = competitorsSorted[i];
    const competitorUnitPrice = getHighestPriceBreakLessThanOrEqualTo(
      competitor.product,
      quantity,
    ).unitPrice;
    if (ownProduct.bestPrice!.lt(competitorUnitPrice)) {
      return i;
    }
  }
  return competitors.length;
}

function getExpectedRankByTotalPrice(
  ownProduct: Net32AlgoProductWithBestPrice,
  competitors: Net32AlgoProduct[],
  quantity: number,
  priceStrategy: AlgoPriceStrategy,
) {
  if (!ownProduct.bestPrice) {
    throw new Error("Own product has no best price. This is an error");
  }
  const competitorsSorted = getProductsSortedWithRank(
    competitors,
    quantity,
    priceStrategy,
  );
  for (let i = 0; i < competitorsSorted.length; i++) {
    const competitor = competitorsSorted[i];
    const competitorTotalCost = getTotalCostForQuantity(
      competitor.product,
      quantity,
    );
    const ourTotalCost = getTotalCostForQuantityWithUnitPriceOverride(
      ownProduct,
      quantity,
      ownProduct.bestPrice,
    );
    if (ourTotalCost.lt(competitorTotalCost)) {
      return i;
    }
  }
  return competitors.length;
}

function getExpectedRankByBuyBox(
  ownProduct: Net32AlgoProductWithBestPrice,
  competitors: Net32AlgoProduct[],
  quantity: number,
  priceStrategy: AlgoPriceStrategy,
) {
  if (!ownProduct.bestPrice) {
    throw new Error("Own product has no best price. This is an error");
  }
  const competitorsSorted = getProductsSortedWithRank(
    competitors,
    quantity,
    priceStrategy,
  );
  for (let i = 0; i < competitorsSorted.length; i++) {
    const competitor = competitorsSorted[i];
    const competitorTotalCost = getTotalCostForQuantity(
      competitor.product,
      quantity,
    );
    const ourTotalCost = getTotalCostForQuantityWithUnitPriceOverride(
      ownProduct,
      quantity,
      ownProduct.bestPrice,
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
) {
  // Consider both solutions if target unit price is above or below threshold
  const undercutUnitPriceAboveThreshold = undercutTotalCost.div(quantity);
  const undercutUnitPriceBelowThreshold = undercutTotalCost
    .sub(ourProduct.standardShipping)
    .div(quantity);

  // If the target price is above the threshold,
  // then there's no shipping, so we can use that
  // OR if NC is set -> we ignore our own shipping cost
  if (undercutTotalCost.gte(ourProduct.freeShippingThreshold)) {
    return undercutUnitPriceAboveThreshold;
  } else {
    // If it's below, then we know we have to have shipping, so we use the solution with shipping
    return undercutUnitPriceBelowThreshold;
  }
}

function getBestCompetitivePriceByTotalPrice(
  ourProduct: Net32AlgoProduct,
  competitorsSorted: Net32AlgoProduct[],
  quantity: number,
  ownVendorSetting: V2AlgoSettingsData,
  applyBuyBoxRules: boolean,
) {
  // If there's no competitors, we should just price to max
  if (competitorsSorted.length === 0) {
    return {
      price: new Decimal(ownVendorSetting.max_price),
      pushedToMax: true,
    };
  }
  for (const competitor of competitorsSorted) {
    const competitorTotalCost = getTotalCostForQuantity(competitor, quantity);
    const undercutTotalCost = getUndercutPriceToCompete(
      competitorTotalCost,
      ourProduct,
      competitor,
      applyBuyBoxRules,
    );

    const undercutUnitPrice = computeTargetUnitPrice(
      undercutTotalCost,
      ourProduct,
      quantity,
    );

    if (undercutUnitPrice.gt(ownVendorSetting.max_price)) {
      return {
        triggeredByVendor: `${competitor.vendorId}-${competitor.vendorName}`,
        price: new Decimal(ownVendorSetting.max_price),
        pushedToMax: true,
      };
    }

    const undercutUnitPriceRoundUp = undercutUnitPrice.toDecimalPlaces(2, 0);
    const undercutUnitPriceRoundDown = undercutUnitPrice.toDecimalPlaces(2, 1);

    const resultingTotalRoundUp = getTotalCostForQuantityWithUnitPriceOverride(
      ourProduct,
      quantity,
      undercutUnitPriceRoundUp,
    );
    const resultingTotalRoundDown =
      getTotalCostForQuantityWithUnitPriceOverride(
        ourProduct,
        quantity,
        undercutUnitPriceRoundDown,
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

function getBestCompetitivePriceByUnitPrice(
  competitorsSorted: Net32AlgoProduct[],
  quantity: number,
  ownVendorSetting: V2AlgoSettingsData,
) {
  // If there's no competitors, we should just price to max
  if (competitorsSorted.length === 0) {
    return {
      price: new Decimal(ownVendorSetting.max_price),
      pushedToMax: true,
    };
  }
  for (const competitor of competitorsSorted) {
    const competitorUnitPrice = new Decimal(
      getHighestPriceBreakLessThanOrEqualTo(competitor, quantity).unitPrice,
    );
    const undercutUnitPrice = competitorUnitPrice.sub(0.01);

    if (undercutUnitPrice.gt(ownVendorSetting.max_price)) {
      return {
        triggeredByVendor: `${competitor.vendorId}-${competitor.vendorName}`,
        price: new Decimal(ownVendorSetting.max_price),
        pushedToMax: true,
      };
    }
    if (
      undercutUnitPrice.gte(ownVendorSetting.floor_price) &&
      undercutUnitPrice.lte(ownVendorSetting.max_price)
    ) {
      return {
        triggeredByVendor: `${competitor.vendorId}-${competitor.vendorName}`,
        price: undercutUnitPrice,
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
  applyBuyBoxRules: boolean,
) {
  if (!applyBuyBoxRules) {
    return targetPrice;
  }
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
  applyBuyBoxRules: boolean,
) {
  const strictlyLessThanPriceToCompete =
    getStrictlyLessThanUndercutPriceToCompete(
      targetPrice,
      ourProduct,
      targetProduct,
      applyBuyBoxRules,
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

function sortBasedOnBuyBoxRules(
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

function sortByUnitPrice(
  a: { effectiveUnitPrice: Decimal | null | undefined },
  b: { effectiveUnitPrice: Decimal | null | undefined },
) {
  const unitPriceA = a.effectiveUnitPrice
    ? a.effectiveUnitPrice
    : new Decimal(Infinity);
  const unitPriceB = b.effectiveUnitPrice
    ? b.effectiveUnitPrice
    : new Decimal(Infinity);
  return unitPriceA.cmp(unitPriceB);
}

function sortByTotalCost(a: { totalCost: Decimal }, b: { totalCost: Decimal }) {
  return a.totalCost.cmp(b.totalCost);
}

function getProductsSortedByUnitPrice(
  net32Products: (Net32AlgoProduct | Net32AlgoProductWithBestPrice)[],
  quantity: number,
) {
  const wrappers = getWrapperForProduct(net32Products, quantity);
  return wrappers.toSorted(sortByUnitPrice);
}

function getProductsSortedByTotalCost(
  net32Products: (Net32AlgoProduct | Net32AlgoProductWithBestPrice)[],
  quantity: number,
) {
  const wrappers = getWrapperForProduct(net32Products, quantity);
  return wrappers.toSorted(sortByTotalCost);
}

function getProductsSortedByBuyBoxRank(
  net32Products: (Net32AlgoProduct | Net32AlgoProductWithBestPrice)[],
  quantity: number,
) {
  const wrappers = getWrapperForProduct(net32Products, quantity);
  return wrappers.toSorted(sortBasedOnBuyBoxRules);
}

function getWrapperForProduct(
  net32Products: (Net32AlgoProduct | Net32AlgoProductWithBestPrice)[],
  quantity: number,
) {
  return net32Products.map((prod) => {
    const unitPrice = (prod as Net32AlgoProductWithBestPrice).bestPrice
      ? (prod as Net32AlgoProductWithBestPrice).bestPrice
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
}

function getProductsSorted(
  net32Products: (Net32AlgoProduct | Net32AlgoProductWithBestPrice)[],
  quantity: number,
  sortMethod: AlgoPriceStrategy,
) {
  switch (sortMethod) {
    case AlgoPriceStrategy.UNIT:
      return getProductsSortedByUnitPrice(net32Products, quantity);
    case AlgoPriceStrategy.TOTAL:
      return getProductsSortedByTotalCost(net32Products, quantity);
    case AlgoPriceStrategy.BUY_BOX:
      return getProductsSortedByBuyBoxRank(net32Products, quantity);
    default:
      throw new Error(`Invalid sort method: ${sortMethod}`);
  }
}

function getSortMethod(sortMethod: AlgoPriceStrategy) {
  switch (sortMethod) {
    case AlgoPriceStrategy.UNIT:
      return sortByUnitPrice;
    case AlgoPriceStrategy.TOTAL:
      return sortByTotalCost;
    case AlgoPriceStrategy.BUY_BOX:
      return sortBasedOnBuyBoxRules;
    default:
      throw new Error(`Invalid sort method: ${sortMethod}`);
  }
}

function getProductsSortedWithRank(
  net32Products: (Net32AlgoProduct | Net32AlgoProductWithBestPrice)[],
  quantity: number,
  sortMethod: AlgoPriceStrategy,
) {
  const sortedProducts = getProductsSorted(net32Products, quantity, sortMethod);

  // Assign buy box ranks, handling ties
  let currentRank = 0;
  let currentRankCount = 0;
  const productsWithRank: Net32AlgoProductWrapperWithBuyBoxRank[] = [];

  for (let i = 0; i < sortedProducts.length; i++) {
    const product = sortedProducts[i];

    // If this is the first product or if it's different from the previous one
    if (
      i === 0 ||
      getSortMethod(sortMethod)(sortedProducts[i - 1], product) !== 0
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
      priceStrategy: sortMethod,
    });
  }

  return productsWithRank;
}
export function getTotalCostForQuantityWithUnitPriceOverride(
  net32Product: Net32AlgoProduct,
  quantity: number,
  unitPriceOverride: Decimal,
) {
  const totalCost = unitPriceOverride.mul(quantity);
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
    { minQty: 0, unitPrice: Infinity },
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

function getLowestVendor(net32Products: Net32AlgoProduct[]) {
  const sortedByLowestPrice = net32Products
    .filter((prod) => prod.priceBreaks.find((pb) => pb.minQty === 1))
    .toSorted((a, b) => {
      const aPrice = a.priceBreaks.find((pb) => pb.minQty === 1)!.unitPrice;
      const bPrice = b.priceBreaks.find((pb) => pb.minQty === 1)!.unitPrice;
      return aPrice - bPrice;
    });
  if (sortedByLowestPrice.length === 0) {
    return {
      lowestPrice: null,
      lowestVendorId: null,
      lowestVendorPosition: null,
    };
  }
  const lowestVendor = sortedByLowestPrice[0];
  return {
    lowestPrice: lowestVendor.priceBreaks.find((pb) => pb.minQty === 1)!
      .unitPrice,
    lowestVendorId:
      typeof lowestVendor.vendorId === "number"
        ? lowestVendor.vendorId
        : parseInt(lowestVendor.vendorId as string),
    lowestVendorPosition: net32Products.findIndex(
      (v) => v.vendorId === lowestVendor.vendorId,
    ),
  };
}
