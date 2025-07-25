import { Decimal } from "decimal.js";
import { RepriceModel } from "../../../model/reprice-model";
import { Net32PriceBreak } from "../../../types/net32";
import { writeRepriceHtmlReport } from "./html-builder";
import {
  InternalProduct,
  SimplifiedNet32Product,
  ExistingAnalytics,
  PriceSolutions,
  PriceSolutionWithRanks,
  SimplifiedNet32ProductFreeShippingAlgo,
  AggregatePriceSolution,
} from "./types";

function getUniqueQuantityBreaks(net32Products: SimplifiedNet32Product[]) {
  const quantityBreaks = new Set<number>();
  for (const product of net32Products) {
    for (const breakInfo of product.priceBreaks) {
      quantityBreaks.add(breakInfo.minQty);
    }
  }
  return Array.from(quantityBreaks).sort((a, b) => a - b);
}

function findHighestQuantitySuchThatAllFreeShipping(
  rawNet32Products: SimplifiedNet32Product[],
) {
  // The idea here is we find the lowest quantity at which everyone is free shipping, which will
  // end up being the max
  let lowestOrganicQuantity = 1;
  for (const product of rawNet32Products.filter(
    (p) => p.freeShippingGap !== 0,
  )) {
    const breakOne = product.priceBreaks.find((pb) => pb.minQty === 1);
    if (!breakOne) {
      throw new Error(
        `No price break found for quantity 1 for product ${product.vendorId}`,
      );
    }
    const threshold = breakOne.unitPrice + product.freeShippingGap;
    const lowestQuantity = Math.ceil(threshold / breakOne.unitPrice);
    if (lowestQuantity > lowestOrganicQuantity) {
      lowestOrganicQuantity = lowestQuantity;
    }
  }
  return lowestOrganicQuantity;
}

export function repriceProductV2(
  mpid: string,
  rawNet32Products: SimplifiedNet32Product[],
  internalProducts: InternalProduct[],
  oldModelSolutions?: RepriceModel[],
) {
  // 1. Quantity breaks that competitors have (compete)
  // 2. Quantity breaks that we have but competitors don't (remove these quantity breaks)

  // Get all quantity breaks that competitors have (exclude our own vendors)
  const ownVendorIds = internalProducts.map((vp) => vp.ownVendorId);
  const competitorProducts = rawNet32Products
    .filter((p) => !ownVendorIds.includes(p.vendorId))
    .filter((p) => p.inStock);
  const ourVendorsProducts = rawNet32Products
    .filter((p) => ownVendorIds.includes(p.vendorId))
    .filter((p) => p.inStock);

  const competitorQuantityBreaks = getUniqueQuantityBreaks(competitorProducts);
  const highestQuantitySuchThatAllFreeShipping =
    findHighestQuantitySuchThatAllFreeShipping(rawNet32Products);
  const highestQuantity = Math.max(
    ...competitorQuantityBreaks,
    highestQuantitySuchThatAllFreeShipping,
  );

  const allProducts = rawNet32Products.filter((p) => p.inStock);

  // Iterate over all non-empty combinations of ownVendorsPresent
  const ownVendorSubsets = getAllNonEmptySubsets(ourVendorsProducts);

  let existingProductRankings: ExistingAnalytics = {};
  let priceSolutions: PriceSolutions = {};

  for (
    let quantityBreak = 1;
    quantityBreak <= highestQuantity;
    quantityBreak++
  ) {
    const competitorsForThisQuantityBreak = competitorProducts.filter((p) =>
      p.priceBreaks.find((pb) => pb.minQty === quantityBreak),
    );
    const allProductsForThisQuantityBreak = allProducts.filter((p) =>
      p.priceBreaks.find((pb) => pb.minQty === quantityBreak),
    );
    const competitorConfigPermutations = permutateFreeShippingPossibilities(
      competitorsForThisQuantityBreak,
    );

    let priceSolutionsForThisQuantityBreak: PriceSolutionWithRanks[] = [];

    for (const competitorPermutation of competitorConfigPermutations) {
      const competitorsRankedByBuyBox =
        getProductSortedByBuyBoxRankFreeShippingAlgo(
          competitorPermutation,
          quantityBreak,
        );

      for (const vendorSubset of ownVendorSubsets) {
        // [ownProduct1, ownProduct2, ...]
        // Get possible solutions for each vendor in the combination

        const bestPrices: {
          vendorId: number;
          prices: number[];
        }[] = [];
        for (const ownVendor of vendorSubset) {
          // Here we compute two, if we have free shipping or not.
          const bestPriceToCompeteWithShipping = getBestCompetitivePrice(
            internalProducts.find(
              (vp) => vp.ownVendorId === ownVendor.vendorId,
            )!,
            ownVendor,
            competitorsRankedByBuyBox,
            quantityBreak,
            true,
          );
          const bestPriceToCompeteFreeShipping = getBestCompetitivePrice(
            internalProducts.find(
              (vp) => vp.ownVendorId === ownVendor.vendorId,
            )!,
            ownVendor,
            competitorsRankedByBuyBox,
            quantityBreak,
            false,
          );
          // If the above functions return undefined, there is no solution to beat any
          // non-zero number of competitors
          // We also do not need duplicate prices
          bestPrices.push({
            vendorId: ownVendor.vendorId,
            prices: [
              ...new Set(
                [
                  bestPriceToCompeteWithShipping?.toNumber(),
                  bestPriceToCompeteFreeShipping?.toNumber(),
                ].filter((x) => x !== undefined),
              ),
            ],
          });
        }

        // Generate all price combinations for this vendor subset
        const priceCombinations = getAllPriceCombinations(bestPrices);

        // Now need to compute the effective rank in both shipping and non-shipping for each price combination
        const priceCombinationsWithRanks = priceCombinations.map((pc) => {
          const effectiveRanks = pc.map(({ vendorId, price }) => {
            const ownProduct = allProducts.find(
              (vp) => vp.vendorId === vendorId,
            )!;
            const buyBoxRankFreeShipping = getBuyBoxRank(
              { ...ownProduct, freeShipping: true },
              competitorsRankedByBuyBox,
              quantityBreak,
            );
            const buyBoxRankIncludingShipping = getBuyBoxRank(
              { ...ownProduct, freeShipping: false },
              competitorsRankedByBuyBox,
              quantityBreak,
            );
            return {
              vendor: {
                vendorId,
                price,
              },
              buyBoxRankFreeShipping,
              buyBoxRankIncludingShipping,
            };
          });
          return {
            vendorPrices: effectiveRanks.map((x) => x.vendor),
            buyBoxRankFreeShipping: Math.min(
              ...effectiveRanks.map((x) => x.buyBoxRankFreeShipping),
            ),
            buyBoxRankIncludingShipping: Math.min(
              ...effectiveRanks.map((x) => x.buyBoxRankIncludingShipping),
            ),
          };
        });

        const priceCombinationsWithRanksWithTotalRank =
          priceCombinationsWithRanks.map((x) => ({
            ...x,
            totalRank: x.buyBoxRankFreeShipping + x.buyBoxRankIncludingShipping,
            // averagePrice: getAveragePriceOfSolution(x.vendorPrices),
          }));

        priceSolutionsForThisQuantityBreak.push(
          ...priceCombinationsWithRanksWithTotalRank.map((x) => ({
            ...x,
            combination: competitorsRankedByBuyBox,
          })),
        );
      }
    }

    const groupedByVendorCombination: AggregatePriceSolution[] = Object.entries(
      Object.groupBy(priceSolutionsForThisQuantityBreak, (x) =>
        getVendorCombinationString(x.vendorPrices),
      ),
    )
      .map(([vendorCombination, solutions]) => {
        if (!solutions || solutions.length === 0) {
          throw new Error(
            `No solutions found for vendor combination: ${vendorCombination}. This is likely a bug.`,
          );
        }
        return {
          vendorPrices: solutions[0].vendorPrices,
          vendorPriceId: vendorCombination,
          consideredConfigurations: solutions.length,
          solutions: solutions.sort((a, b) => a.totalRank - b.totalRank)[0],
          totalRank: solutions.reduce((sum, x) => sum + x.totalRank, 0),
          averagePrice:
            solutions[0].vendorPrices.reduce((sum, x) => sum + x.price, 0) /
            solutions[0].vendorPrices.length,
        };
      })
      .sort((a, b) => {
        // 1. Sort by totalRank (lower is better)
        if (a.totalRank !== b.totalRank) {
          return a.totalRank - b.totalRank;
        }
        // 2. Sort by averagePrice (higher is better)
        if (a.averagePrice !== b.averagePrice) {
          return b.averagePrice - a.averagePrice;
        }
        // 3. Sort by sum of vendor priorities (lower is better)
        const getPrioritySum = (combo: typeof a) => {
          return Object.keys(combo.vendorPrices).reduce((sum, vendorId) => {
            const found = internalProducts.find(
              (v) => v.ownVendorId === parseInt(vendorId),
            );
            return sum + (found ? found.priority : 9999);
          }, 0);
        };
        const aPrioritySum = getPrioritySum(a);
        const bPrioritySum = getPrioritySum(b);
        return aPrioritySum - bPrioritySum;
      });

    priceSolutions[quantityBreak] = groupedByVendorCombination;

    //   const beforeShippingLadder = getProductsSortedByBuyBoxRank(
    //     allProductsForThisQuantityBreak,
    //     quantityBreak,
    //     true,
    //   );
    //   const beforeNonShippingLadder = getProductsSortedByBuyBoxRank(
    //     allProductsForThisQuantityBreak,
    //     quantityBreak,
    //     false,
    //   );
    //   const beforeOwnShippingRank = getMinOwnRank(
    //     beforeShippingLadder,
    //     quantityBreak,
    //     ownVendorIds,
    //     true,
    //   );
    //   const beforeOwnNonShippingRank = getMinOwnRank(
    //     beforeNonShippingLadder,
    //     quantityBreak,
    //     ownVendorIds,
    //     false,
    //   );
    //   const beforeOwnAveragePrice = getAveragePrice(
    //     allProductsForThisQuantityBreak.filter((p) =>
    //       ownVendorIds.includes(p.vendorId),
    //     ),
    //     quantityBreak,
    //   );

    //   let afterShippingLadder: SimplifiedNet32Product[] | undefined = undefined;
    //   let afterNonShippingLadder: SimplifiedNet32Product[] | undefined =
    //     undefined;
    //   let afterOwnShippingRank: number | undefined = undefined;
    //   let afterOwnNonShippingRank: number | undefined = undefined;
    //   let afterOwnAveragePrice: number | undefined = undefined;

    //   if (priceSolutions[quantityBreak] && priceSolutions[quantityBreak][0]) {
    //     const newLadder = insertPriceSolution(
    //       allProducts,
    //       allProductsForThisQuantityBreak,
    //       internalProducts,
    //       priceSolutions[quantityBreak][0],
    //       quantityBreak,
    //     );
    //     afterShippingLadder = getProductsSortedByBuyBoxRank(
    //       newLadder,
    //       quantityBreak,
    //       true,
    //     );
    //     afterNonShippingLadder = getProductsSortedByBuyBoxRank(
    //       newLadder,
    //       quantityBreak,
    //       false,
    //     );
    //     afterOwnShippingRank = getMinOwnRank(
    //       afterShippingLadder,
    //       quantityBreak,
    //       ownVendorIds,
    //       true,
    //     );
    //     afterOwnNonShippingRank = getMinOwnRank(
    //       afterNonShippingLadder,
    //       quantityBreak,
    //       ownVendorIds,
    //       false,
    //     );
    //     afterOwnAveragePrice = getAveragePrice(
    //       newLadder.filter((p) => ownVendorIds.includes(p.vendorId)),
    //       quantityBreak,
    //     );
    //   }
    //   existingProductRankings[quantityBreak] = {
    //     beforeShippingLadder: beforeShippingLadder,
    //     beforeNonShippingLadder: beforeNonShippingLadder,
    //     beforeOwnShippingRank: beforeOwnShippingRank,
    //     beforeOwnNonShippingRank: beforeOwnNonShippingRank,
    //     beforeOwnAveragePrice: beforeOwnAveragePrice,
    //     ...(afterShippingLadder && { afterShippingLadder }),
    //     ...(afterNonShippingLadder && { afterNonShippingLadder }),
    //     ...(afterOwnShippingRank !== undefined && { afterOwnShippingRank }),
    //     ...(afterOwnNonShippingRank !== undefined && { afterOwnNonShippingRank }),
    //     ...(afterOwnAveragePrice !== undefined && { afterOwnAveragePrice }),
  }

  // // TODO: Compute a final solution encompassing all quantity breaks
  // // then compare with existing and execute change on net32 if necessary

  writeRepriceHtmlReport(
    mpid,
    internalProducts,
    rawNet32Products,
    priceSolutions,
    oldModelSolutions,
  );
}

function insertPriceSolution(
  allProducts: SimplifiedNet32Product[],
  productsForQuantity: SimplifiedNet32Product[],
  internalProducts: InternalProduct[],
  priceSolution: PriceSolutionWithRanks,
  quantity: number,
) {
  const ownVendorIds = internalProducts.map((vp) => vp.ownVendorId);
  const competitorProducts = productsForQuantity.filter(
    (p) => !ownVendorIds.includes(p.vendorId),
  );
  const newProducts: SimplifiedNet32Product[] = priceSolution.vendorPrices.map(
    (vp) => {
      const existingProduct = allProducts.find(
        (p) => p.vendorId === vp.vendorId,
      );
      if (!existingProduct) {
        throw new Error(
          `Product not found in ladder: vendorId: ${vp.vendorId} price: ${vp.price} quantity: ${quantity}`,
        );
      }
      const existingPriceBreak = existingProduct.priceBreaks.find(
        (pb) => pb.minQty === quantity,
      );
      let updatedPriceBreaks: Net32PriceBreak[];

      if (existingPriceBreak) {
        // Update existing price break
        updatedPriceBreaks = existingProduct.priceBreaks.map((pb) => {
          if (pb.minQty === quantity) {
            return {
              ...pb,
              unitPrice: vp.price,
            };
          }
          return pb;
        });
      } else {
        // Create new price break
        const newPriceBreak: Net32PriceBreak = {
          minQty: quantity,
          unitPrice: vp.price,
          active: true,
        };
        updatedPriceBreaks = [...existingProduct.priceBreaks, newPriceBreak];
      }

      return {
        ...existingProduct,
        priceBreaks: updatedPriceBreaks,
      };
    },
  );
  return [...competitorProducts, ...newProducts];
}

function getAveragePriceOfSolution(
  priceCombination: PriceSolutionWithRanks["vendorPrices"],
) {
  const totalPrice = priceCombination.reduce((sum, vp) => sum + vp.price, 0);
  const numberOfVendors = priceCombination.length;
  if (numberOfVendors === 0) {
    throw new Error("No vendors in price combination");
  }
  return totalPrice / numberOfVendors;
}

function getAveragePrice(products: SimplifiedNet32Product[], quantity: number) {
  if (products.length === 0) {
    return Infinity;
  }
  const totalPrice = products.reduce((sum, p) => {
    const priceBreak = p.priceBreaks.find((pb) => pb.minQty === quantity);
    if (!priceBreak) {
      throw new Error("Product has no price break for this quantity");
    }
    return sum + priceBreak.unitPrice;
  }, 0);
  return totalPrice / products.length;
}

function getMinOwnRank(
  products: SimplifiedNet32Product[],
  quantity: number,
  ownVendorIds: number[],
  includeShipping: boolean,
) {
  const productsWithConsideredPrice = products.map((p) => {
    const priceBreak = p.priceBreaks.find((pb) => pb.minQty === quantity);
    if (!priceBreak) {
      throw new Error("Competitor has no price break for this quantity");
    }
    return {
      ...p,
      consideredPrice: includeShipping
        ? getTotalCost(
            priceBreak.unitPrice,
            quantity,
            p.standardShipping || 0,
            p.freeShippingGap || 0,
          )
        : priceBreak.unitPrice,
    };
  });
  for (let i = 0; i < productsWithConsideredPrice.length; i++) {
    const product = productsWithConsideredPrice[i];
    const priceBreak = product.priceBreaks.find((pb) => pb.minQty === quantity);
    if (!priceBreak) {
      throw new Error("Competitor has no price break for this quantity");
    }
    if (isOwnVendor(product, ownVendorIds)) {
      // TODO: What if tie?
      return i;
    }
  }
  return Infinity;
}

function isOwnVendor(product: SimplifiedNet32Product, ownVendorIds: number[]) {
  return ownVendorIds.includes(product.vendorId);
}

function getBuyBoxRank(
  ownProduct: SimplifiedNet32ProductFreeShippingAlgo,
  competitors: SimplifiedNet32ProductFreeShippingAlgo[],
  quantity: number,
) {
  for (let i = 0; i < competitors.length; i++) {
    const competitor = competitors[i];
    const competitorPriceBreak = competitor.priceBreaks.find(
      (pb) => pb.minQty === quantity,
    );
    if (!competitorPriceBreak) {
      throw new Error("Competitor has no price break for this quantity");
    }
    const competitorTotalCost = getTotalCostForQuantity(competitor, quantity);
    const ourTotalCost = getTotalCostForQuantity(ownProduct, quantity);
    const beatingCompetitor = isBeatingCompetitorOnBuyBoxRules(
      ownProduct,
      competitor,
      ourTotalCost,
      competitorTotalCost,
    );
    if (beatingCompetitor) {
      return i;
    }
  }
  return competitors.length;
}

function getFreeShippingThreshold(product: SimplifiedNet32Product) {
  const priceBreakQ1 = product.priceBreaks.find((b) => b.minQty === 1);
  if (!priceBreakQ1) {
    throw new Error(
      "No price break found for quantity 1. This is likely a bug.",
    );
  }
  if (product.freeShippingGap > 0) {
    return priceBreakQ1.unitPrice + product.freeShippingGap;
  } else {
    return 0;
  }
}

function getTotalCostForQuantity(
  product: SimplifiedNet32ProductFreeShippingAlgo,
  quantity: number,
) {
  const unitPrice = getUnitPrice(product, quantity);
  const totalPreShipping = new Decimal(unitPrice).mul(quantity);
  if (product.freeShipping) {
    return totalPreShipping;
  } else {
    return totalPreShipping.add(new Decimal(product.standardShipping));
  }
}

function getBestCompetitivePrice(
  ourVendorDetails: InternalProduct,
  ourProduct: SimplifiedNet32Product,
  competitorsSortedByBuyBoxRank: SimplifiedNet32ProductFreeShippingAlgo[],
  quantity: number,
  weHaveFreeShipping: boolean,
) {
  for (const competitor of competitorsSortedByBuyBoxRank) {
    const competitorTotalCost = getTotalCostForQuantity(competitor, quantity);
    const undercutTotalCost = getUndercutPriceToCompete(
      competitorTotalCost,
      ourProduct,
      competitor,
    );
    const undercutUnitPrice = weHaveFreeShipping
      ? undercutTotalCost.div(quantity)
      : undercutTotalCost.sub(ourProduct.standardShipping).div(quantity);

    const roundedUnderCutUnitPrice = undercutUnitPrice.toDecimalPlaces(2);
    if (
      roundedUnderCutUnitPrice.gte(ourVendorDetails.floorPrice) &&
      roundedUnderCutUnitPrice.lte(ourVendorDetails.maxPrice)
    ) {
      return roundedUnderCutUnitPrice;
    }
  }
}

export function hasBadge(product: SimplifiedNet32Product): boolean {
  return product.badgeId > 0 && product.badgeName !== "";
}

// Helper to determine shipping bucket
export function getShippingBucket(shippingTimeDays: number): number {
  if (shippingTimeDays <= 2) return 1;
  if (shippingTimeDays <= 5) return 2;
  return 3;
}

function isBeatingCompetitorOnBuyBoxRules(
  ourProduct: SimplifiedNet32Product,
  competitorProduct: SimplifiedNet32Product,
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

function getUndercutPriceToCompete(
  targetPrice: Decimal,
  ourProduct: SimplifiedNet32Product,
  targetProduct: SimplifiedNet32Product,
) {
  // Here we have to subtract another penny when undercutting
  // to make sure we are less than the threshold
  const targetHasBadge = hasBadge(targetProduct);
  const weHaveBadge = hasBadge(ourProduct);
  if (targetHasBadge && !weHaveBadge) {
    return targetPrice.mul(0.9).sub(0.01);
  } else if (targetHasBadge && weHaveBadge) {
    if (
      getShippingBucket(targetProduct.shippingTime) >
      getShippingBucket(ourProduct.shippingTime)
    ) {
      // We have better shipping
      return targetPrice.mul(1.005).sub(0.01);
    } else if (
      getShippingBucket(targetProduct.shippingTime) <
      getShippingBucket(ourProduct.shippingTime)
    ) {
      // We have worse shipping
      return targetPrice.mul(0.995).sub(0.01);
    } else {
      // We have the same shipping
      return targetPrice.sub(0.01).sub(0.01);
    }
  } else if (!targetHasBadge && weHaveBadge) {
    return targetPrice.mul(1.1).sub(0.01);
  } else if (
    getShippingBucket(targetProduct.shippingTime) >
    getShippingBucket(ourProduct.shippingTime)
  ) {
    return targetPrice.mul(1.005).sub(0.01);
  } else if (
    getShippingBucket(targetProduct.shippingTime) <
    getShippingBucket(ourProduct.shippingTime)
  ) {
    return targetPrice.mul(0.995).sub(0.01);
  } else {
    return targetPrice.sub(0.01);
  }
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
/**
 * This function takes in a list of products and returns all possible permutations of them,
 * where each product can be either free shipping or not.
 * If a product already has a free shipping gap of 0, it will always be free shipping, so
 * we can reduce the problem to only those with a gap, and then add back in the free shipping products.
 * @param net32Products - The list of products to permutate.
 * @returns All possible permutations of the products, where each product can be either free shipping or not.
 */
function permutateFreeShippingPossibilities(
  net32Products: SimplifiedNet32Product[],
): SimplifiedNet32ProductFreeShippingAlgo[][] {
  const nonFreeShippingProducts = net32Products.filter(
    (x) => x.freeShippingGap !== 0,
  );
  const freeShippingProducts = net32Products.filter(
    (x) => x.freeShippingGap === 0,
  );
  const n = nonFreeShippingProducts.length;
  const total = 1 << n; // 2^n
  const permutations: SimplifiedNet32ProductFreeShippingAlgo[][] = [];

  for (let mask = 0; mask < total; mask++) {
    const permutation: SimplifiedNet32ProductFreeShippingAlgo[] = [];
    for (let i = 0; i < n; i++) {
      permutation.push({
        ...nonFreeShippingProducts[i],
        freeShipping: (mask & (1 << i)) !== 0,
      });
    }
    permutations.push(permutation);
  }

  return permutations.map((x) => [
    ...x,
    ...freeShippingProducts.map((x) => ({ ...x, freeShipping: true })),
  ]);
}

function getUnitPrice(net32Product: SimplifiedNet32Product, quantity: number) {
  const priceBreakQ1 = net32Product.priceBreaks.find((b) => b.minQty === 1);
  if (!priceBreakQ1) {
    throw new Error(
      "No price break found for quantity 1. This is likely a bug.",
    );
  }
  if (quantity === 1) {
    return priceBreakQ1.unitPrice;
  } else {
    const priceBreak = net32Product.priceBreaks.find(
      (b) => b.minQty === quantity,
    );
    if (!priceBreak) {
      return priceBreakQ1.unitPrice;
    }
    return priceBreak.unitPrice;
  }
}

function getProductSortedByBuyBoxRankFreeShippingAlgo(
  net32Products: SimplifiedNet32ProductFreeShippingAlgo[],
  quantity: number,
): SimplifiedNet32ProductFreeShippingAlgo[] {
  const productInfos = net32Products.map((prod) => {
    const unitPrice = getUnitPrice(prod, quantity);
    return {
      product: prod,
      price: getTotalCostFreeShippingOverride(
        unitPrice,
        quantity,
        prod.freeShipping,
        prod.standardShipping,
      ),
      hasBadge: prod.badgeId > 0 && prod.badgeName !== undefined,
      shippingBucket: getShippingBucket(prod.shippingTime),
    };
  });
  // Sort by total cost ascending as a base
  productInfos.sort((a, b) => a.price - b.price);

  // Sort using the compare function
  const sortedInfos = [...productInfos].sort((a, b) => {
    // If both have badge
    if (a.hasBadge && b.hasBadge) {
      // If a is in a lower shipping bucket (faster) than b, need to be at least 0.5% cheaper
      if (a.shippingBucket < b.shippingBucket) {
        if (new Decimal(b.price).lte(new Decimal(a.price).mul(0.995))) return 1;
        return -1;
      }
      // If b is in a lower shipping bucket (faster) than a, need to be at least 0.5% cheaper
      if (b.shippingBucket < a.shippingBucket) {
        if (new Decimal(a.price).lte(new Decimal(b.price).mul(0.995)))
          return -1;
        return 1;
      }
      // If both have the same shipping bucket, need to be at least 1c cheaper
      if (new Decimal(a.price).lte(new Decimal(b.price).sub(0.01))) return -1;
      if (new Decimal(b.price).lte(new Decimal(a.price).sub(0.01))) return 1;
      return 0;
    }
    // If a has badge, b does not, need to be at least 10% cheaper
    if (a.hasBadge && !b.hasBadge) {
      if (new Decimal(b.price).lte(new Decimal(a.price).mul(0.9))) return 1;
      return -1;
    }
    // If b has badge, a does not, need to be at least 10% cheaper
    if (!a.hasBadge && b.hasBadge) {
      if (new Decimal(a.price).lte(new Decimal(b.price).mul(0.9))) return -1;
      return 1;
    }
    // If a is in a lower shipping bucket (faster) than b, need to be at least 0.5% cheaper
    if (a.shippingBucket < b.shippingBucket) {
      if (new Decimal(b.price).lte(new Decimal(a.price).mul(0.995))) return 1;
      return -1;
    }
    // If b is in a lower shipping bucket (faster) than a, need to be at least 0.5% cheaper
    if (b.shippingBucket < a.shippingBucket) {
      if (new Decimal(a.price).lte(new Decimal(b.price).mul(0.995))) return -1;
      return 1;
    }
    // Otherwise, 0.01 cheaper wins
    if (new Decimal(a.price).lte(new Decimal(b.price).sub(0.01))) return -1;
    if (new Decimal(b.price).lte(new Decimal(a.price).sub(0.01))) return 1;
    return 0;
  });
  return sortedInfos.map((x) => x.product);
}

function getProductsSortedByBuyBoxRank(
  net32Products: SimplifiedNet32Product[],
  quantity: number,
  includeShipping: boolean,
): SimplifiedNet32Product[] {
  // Prepare info for all products
  const productInfos = net32Products.map((prod) => {
    const pb = prod.priceBreaks.find((b) => b.minQty === quantity);
    if (!pb) {
      throw new Error("No price break found for this quantity");
    }
    return {
      product: prod,
      price: includeShipping
        ? getTotalCost(
            pb.unitPrice,
            quantity,
            prod.standardShipping || 0,
            prod.freeShippingGap,
          )
        : pb.unitPrice,
      hasBadge: prod.badgeId > 0 && prod.badgeName !== undefined,
      shippingBucket: getShippingBucket(prod.shippingTime),
    };
  });

  // Sort by total cost ascending as a base
  productInfos.sort((a, b) => a.price - b.price);

  // Sort using the compare function
  const sortedInfos = [...productInfos].sort((a, b) => {
    // If both have badge
    if (a.hasBadge && b.hasBadge) {
      // If a is in a lower shipping bucket (faster) than b, need to be at least 0.5% cheaper
      if (a.shippingBucket < b.shippingBucket) {
        if (new Decimal(b.price).lte(new Decimal(a.price).mul(0.995))) return 1;
        return -1;
      }
      // If b is in a lower shipping bucket (faster) than a, need to be at least 0.5% cheaper
      if (b.shippingBucket < a.shippingBucket) {
        if (new Decimal(a.price).lte(new Decimal(b.price).mul(0.995)))
          return -1;
        return 1;
      }
      // If both have the same shipping bucket, need to be at least 1c cheaper
      if (new Decimal(a.price).lte(new Decimal(b.price).sub(0.01))) return -1;
      if (new Decimal(b.price).lte(new Decimal(a.price).sub(0.01))) return 1;
      return 0;
    }
    // If a has badge, b does not, need to be at least 10% cheaper
    if (a.hasBadge && !b.hasBadge) {
      if (new Decimal(b.price).lte(new Decimal(a.price).mul(0.9))) return 1;
      return -1;
    }
    // If b has badge, a does not, need to be at least 10% cheaper
    if (!a.hasBadge && b.hasBadge) {
      if (new Decimal(a.price).lte(new Decimal(b.price).mul(0.9))) return -1;
      return 1;
    }
    // If a is in a lower shipping bucket (faster) than b, need to be at least 0.5% cheaper
    if (a.shippingBucket < b.shippingBucket) {
      if (new Decimal(b.price).lte(new Decimal(a.price).mul(0.995))) return 1;
      return -1;
    }
    // If b is in a lower shipping bucket (faster) than a, need to be at least 0.5% cheaper
    if (b.shippingBucket < a.shippingBucket) {
      if (new Decimal(a.price).lte(new Decimal(b.price).mul(0.995))) return -1;
      return 1;
    }
    // Otherwise, 0.01 cheaper wins
    if (new Decimal(a.price).lte(new Decimal(b.price).sub(0.01))) return -1;
    if (new Decimal(b.price).lte(new Decimal(a.price).sub(0.01))) return 1;
    return 0;
  });
  return sortedInfos.map((x) => x.product);
}

function getTotalCostFreeShippingOverride(
  unitPrice: number,
  quantity: number,
  freeShipping: boolean,
  standardShipping: number,
) {
  if (freeShipping) {
    return unitPrice * quantity;
  } else {
    return unitPrice * quantity + standardShipping;
  }
}

function getVendorCombinationString(
  combination: { vendorId: number; price: number }[],
) {
  return combination
    .sort((a, b) => a.vendorId - b.vendorId)
    .map((x) => `${x.vendorId}:${x.price}`)
    .join(",");
}

export function getTotalCost(
  unitPrice: number,
  quantity: number,
  standardShipping: number,
  freeShippingGap?: number,
): number {
  // Free shipping gap is the price at which the product becomes free shipping,
  // relative to the current unit price. So a gap of $10 with a unit price of $5 means that
  // you need to spend $10 more on top of the $5 unit price to get free shipping
  const freeShippingThreshold = unitPrice + (freeShippingGap || 0);
  const totalCostPreShipping = unitPrice * quantity;
  if (totalCostPreShipping < freeShippingThreshold) {
    return totalCostPreShipping + standardShipping;
  } else {
    return totalCostPreShipping;
  }
}

function solveUnitPriceForTotalCost(
  quantity: number,
  standardShipping: number,
  freeShippingGap: number,
  targetTotalCost: number,
): number {
  // Threshold where shipping is no longer charged
  // unitPrice * minQty >= unitPrice + freeShippingGap
  // unitPrice * (minQty - 1) >= freeShippingGap
  // unitPrice >= freeShippingGap / (minQty - 1)
  let thresholdUnitPrice =
    quantity > 1 ? freeShippingGap / (quantity - 1) : Infinity;

  // Case 1: Shipping is charged
  let unitPriceWithShipping = (targetTotalCost - standardShipping) / quantity;
  let totalCostWithShipping = getTotalCost(
    unitPriceWithShipping,
    quantity,
    standardShipping,
    freeShippingGap,
  );
  // Check if this solution is in the shipping region
  if (
    unitPriceWithShipping < thresholdUnitPrice &&
    Math.abs(totalCostWithShipping - targetTotalCost) < 0.01
  ) {
    return unitPriceWithShipping;
  }

  // Case 2: No shipping charged
  let unitPriceNoShipping = targetTotalCost / quantity;
  let totalCostNoShipping = getTotalCost(
    unitPriceNoShipping,
    quantity,
    standardShipping,
    freeShippingGap,
  );
  if (
    unitPriceNoShipping >= thresholdUnitPrice &&
    Math.abs(totalCostNoShipping - targetTotalCost) < 0.01
  ) {
    return unitPriceNoShipping;
  }

  // Fallback: return the closest valid solution
  if (
    Math.abs(totalCostWithShipping - targetTotalCost) <
    Math.abs(totalCostNoShipping - targetTotalCost)
  ) {
    return unitPriceWithShipping;
  } else {
    return unitPriceNoShipping;
  }
}

// Helper to generate all price combinations (2^n)
function getAllPriceCombinations(
  bestPrices: { vendorId: number; prices: number[] }[],
): { vendorId: number; price: number }[][] {
  const result: { vendorId: number; price: number }[][] = [];

  function helper(idx: number, current: { vendorId: number; price: number }[]) {
    if (idx === bestPrices.length) {
      result.push([...current]);
      return;
    }
    const { vendorId, prices } = bestPrices[idx];
    for (const price of prices) {
      current.push({ vendorId, price });
      helper(idx + 1, current);
      current.pop();
    }
  }

  helper(0, []);
  return result;
}
