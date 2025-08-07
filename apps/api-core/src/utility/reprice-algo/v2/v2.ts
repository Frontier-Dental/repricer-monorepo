import { Decimal } from "decimal.js";
import _ from "lodash";
import { Net32PriceBreak } from "../../../types/net32";
import { createHtmlFileContent } from "./html-builder";
import {
  InternalProduct,
  Net32AlgoProduct,
  Net32AlgoProductWithFreeShipping,
  Net32AlgoProductWithBestPrice,
} from "./types";

export interface Net32AlgoSolution {
  solutionId: string;
  solution: Net32AlgoProductWithBestPrice[];
  averageRank: number;
  quantity: number;
  boardCombinations: Net32AlgoProductWithFreeShipping[][];
  ranksForCombination: number[];
  sourceCombination: Net32AlgoProductWithFreeShipping[];
}

export function repriceProductV3(
  mpId: number,
  rawNet32Products: Net32AlgoProduct[],
  availableInternalProducts: InternalProduct[],
  ownVendorIds: number[],
  unavailableInternalProducts?: InternalProduct[],
) {
  const validProducts = rawNet32Products
    .filter((p) => Array.isArray(p.priceBreaks))
    .filter((p) => p.priceBreaks.find((pb) => pb.minQty === 1))
    .filter((p) => p.inStock);
  // 1. Quantity breaks that competitors have (compete)
  // 2. Quantity breaks that we have but competitors don't (remove these quantity breaks)

  // Get all quantity breaks that competitors have (exclude our own vendors)
  const competitorProducts = validProducts.filter(
    (p) => !ownVendorIds.includes(p.vendorId),
  );
  // All products that we have available to use to make changes.
  const ourAvailableVendorProducts = validProducts
    .filter((p) => ownVendorIds.includes(p.vendorId))
    .filter((p) =>
      availableInternalProducts.find((vp) => vp.ownVendorId === p.vendorId),
    );

  const competitorQuantityBreaks =
    getUniqueValidQuantityBreaks(competitorProducts);
  const highestQuantitySuchThatAllFreeShipping =
    findHighestQuantitySuchThatAllFreeShipping(validProducts);
  const highestQuantity = Math.max(
    ...competitorQuantityBreaks,
    highestQuantitySuchThatAllFreeShipping,
  );

  const ownVendorSubsets = getAllNonEmptySubsets(ourAvailableVendorProducts);

  const solutions: Net32AlgoSolution[] = [];

  const beforeLadders = [
    0,
    ...Array.from({ length: highestQuantity }, (_, i) => i + 1),
  ].map((quantity) => {
    const ladder = getProductsSortedByBuyBoxRank(validProducts, quantity);
    return {
      quantity,
      ladder,
    };
  });

  for (let quantity = 1; quantity <= highestQuantity; quantity++) {
    const allPossibleShippingCombinations = ownVendorSubsets.flatMap(
      (vendorSubset) =>
        permutateFreeShippingPosibilities(
          [...competitorProducts, ...vendorSubset],
          ownVendorIds,
          quantity,
        ),
    );

    const optimalSolutionForCombinations = allPossibleShippingCombinations.map(
      (combination) => {
        const rankedByBuyBox = getProductSortedByBuyBoxRankFreeShippingAlgo(
          combination,
          quantity,
        );
        return {
          solution: getOptimalSolutionForBoard(
            combination,
            ownVendorIds,
            availableInternalProducts,
            quantity,
          ),
          combination: rankedByBuyBox,
        };
      },
    );
    // Now we have an optimal solution for each combination. Remove all duplicate solutions.
    // First we must sort to guarnatee that the same solution is not counted twice.
    // const uniquePriceSets = _.uniqBy(optimalSolutionForCombinations, (x) =>
    //   x.solution
    //     .sort((a, b) => a.vendorId - b.vendorId)
    //     .map((y) => `${y.vendorId}-${y.bestPrice?.toNumber()}`)
    //     .join(","),
    // );

    // Generate all unique price combinations including not picking vendors
    const uniquePriceSets = generateAllUniquePriceCombinations(
      optimalSolutionForCombinations,
    );

    // const uniquePriceSets2 = _.uniqBy(allPriceCombinations, (x) =>
    //   x.solution
    //     .sort((a, b) => a.vendorId - b.vendorId)
    //     .map((y) => `${y.vendorId}-${y.bestPrice?.toNumber()}`)
    //     .join(","),
    // );

    for (const priceSet of uniquePriceSets) {
      const solutionId = `Q${quantity}-${priceSet.solution
        .sort((a, b) => a.vendorId - b.vendorId)
        .map((x) => `${x.vendorName}@${x.bestPrice?.toNumber()}`)
        .join(",")}`;
      // Now recreate all the price combinations, fixing these vendors and their prices
      // but this time using the optimal solution for each vendor.
      // This time we can remove any invalid shipping possibilities because
      // all prices are known.
      const boardCombinationsForSolution =
        permutateFreeShippingPossibilitesWithFixedPrices(
          [
            ...priceSet.solution.map(({ freeShipping, ...rest }) => rest),
            ...competitorProducts,
          ],
          quantity,
        );
      const ranksForCombination = boardCombinationsForSolution.map(
        (boardCombination) => {
          const effectiveRank = Math.min(
            ...priceSet.solution.map((x) =>
              getBuyBoxRank(
                x,
                boardCombination.filter(
                  (p) => !ownVendorIds.includes(p.vendorId),
                ), // Only consider competitors
                quantity,
                x.bestPrice,
              ),
            ),
          );
          return effectiveRank;
        },
      );
      const averageRank =
        ranksForCombination.reduce((sum, x) => sum + x, 0) /
        ranksForCombination.length;
      solutions.push({
        quantity,
        solution: priceSet.solution,
        sourceCombination: priceSet.combination,
        averageRank,
        boardCombinations: boardCombinationsForSolution,
        ranksForCombination: ranksForCombination,
        solutionId,
      });
    }
  }
  const html = createHtmlFileContent(
    mpId,
    availableInternalProducts,
    rawNet32Products,
    solutions,
    beforeLadders,
    unavailableInternalProducts,
  );
  return { html, priceSolutions: solutions };
}

/**
 * Generates all unique price combinations for vendors, including the option to not pick a vendor entirely.
 * For each vendor, we can either pick one of their unique prices or not pick them at all.
 * The total number of combinations is (n1 + 1)(n2 + 1)...(nk + 1) - 1, where ni is the number of unique prices for vendor i.
 * We subtract 1 because we must pick at least one vendor.
 * @param optimalSolutionForCombinations - Array of solutions with their optimal prices
 * @returns Array of unique price combinations
 */
function generateAllUniquePriceCombinations(
  optimalSolutionForCombinations: {
    solution: Net32AlgoProductWithBestPrice[];
    combination: Net32AlgoProductWithFreeShipping[];
  }[],
): {
  solution: Net32AlgoProductWithBestPrice[];
  combination: Net32AlgoProductWithFreeShipping[];
}[] {
  // Group solutions by vendor to get unique prices for each vendor
  const vendorPriceMap = new Map<number, Set<number>>();

  // Collect all unique prices for each vendor
  optimalSolutionForCombinations.forEach(({ solution }) => {
    solution.forEach((product) => {
      if (!vendorPriceMap.has(product.vendorId)) {
        vendorPriceMap.set(product.vendorId, new Set());
      }
      vendorPriceMap.get(product.vendorId)!.add(product.bestPrice.toNumber());
    });
  });

  // Convert to arrays for easier processing
  const vendorPrices: { vendorId: number; prices: number[] }[] = [];
  vendorPriceMap.forEach((prices, vendorId) => {
    vendorPrices.push({
      vendorId,
      prices: Array.from(prices).sort((a, b) => a - b),
    });
  });

  // Sort by vendorId for consistent ordering
  vendorPrices.sort((a, b) => a.vendorId - b.vendorId);

  // Generate all combinations using cartesian product
  const combinations: Net32AlgoProductWithBestPrice[][] = [];

  function generateCombinations(
    currentCombination: Net32AlgoProductWithBestPrice[],
    vendorIndex: number,
  ) {
    if (vendorIndex === vendorPrices.length) {
      // We've processed all vendors
      if (currentCombination.length > 0) {
        // Only add if we have at least one vendor (not empty)
        combinations.push([...currentCombination]);
      }
      return;
    }

    const currentVendor = vendorPrices[vendorIndex];

    // Option 1: Don't pick this vendor
    generateCombinations(currentCombination, vendorIndex + 1);

    // Option 2: Pick this vendor with one of their prices
    currentVendor.prices.forEach((price) => {
      // Find the original product data for this vendor and price
      const originalProduct = optimalSolutionForCombinations
        .flatMap(({ solution }) => solution)
        .find(
          (p) =>
            p.vendorId === currentVendor.vendorId &&
            p.bestPrice.toNumber() === price,
        );

      if (originalProduct) {
        currentCombination.push(originalProduct);
        generateCombinations(currentCombination, vendorIndex + 1);
        currentCombination.pop(); // Backtrack
      }
    });
  }

  generateCombinations([], 0);

  // Convert back to the expected format with combination data
  return combinations.map((solution) => {
    // Find a matching combination from the original data
    const matchingOriginal = optimalSolutionForCombinations.find(
      ({ solution: origSolution }) => {
        if (origSolution.length !== solution.length) return false;
        return solution.every((product) =>
          origSolution.some(
            (orig) =>
              orig.vendorId === product.vendorId &&
              orig.bestPrice.toNumber() === product.bestPrice.toNumber(),
          ),
        );
      },
    );

    return {
      solution,
      combination: matchingOriginal?.combination || [],
    };
  });
}

function getOptimalSolutionForBoard(
  combination: Net32AlgoProductWithFreeShipping[],
  ownVendorIds: number[],
  availableInternalProducts: InternalProduct[],
  quantity: number,
): Net32AlgoProductWithBestPrice[] {
  const ownVendors = combination.filter((p) =>
    ownVendorIds.includes(p.vendorId),
  );
  const competitorsOnly = combination.filter(
    (p) => !ownVendorIds.includes(p.vendorId),
  );
  const competitorsRankedByBuyBox =
    getProductSortedByBuyBoxRankFreeShippingAlgo(competitorsOnly, quantity);
  const ownVendorsWithBestPrices = ownVendors.map((ownVendor) => ({
    ...ownVendor,
    bestPrice: getBestCompetitivePrice(
      availableInternalProducts.find(
        (vp) => vp.ownVendorId === ownVendor.vendorId,
      )!,
      ownVendor,
      competitorsRankedByBuyBox,
      quantity,
      ownVendor.freeShipping,
    ),
  }));
  return ownVendorsWithBestPrices.filter(
    (x) => x.bestPrice !== undefined,
  ) as Net32AlgoProductWithBestPrice[];
}

function getBuyBoxRank(
  ownProduct: Net32AlgoProductWithFreeShipping,
  competitors: Net32AlgoProductWithFreeShipping[],
  quantity: number,
  unitPriceOverride?: Decimal,
) {
  const competitorsSortedByBuyBoxRank =
    getProductSortedByBuyBoxRankFreeShippingAlgo(competitors, quantity);
  for (let i = 0; i < competitorsSortedByBuyBoxRank.length; i++) {
    const competitor = competitorsSortedByBuyBoxRank[i];
    const competitorTotalCost = getTotalCostForQuantity(
      competitor,
      quantity,
      competitor.freeShipping,
    );
    const ourTotalCost = unitPriceOverride
      ? getTotalCostForQuantityWithUnitPriceOverride(
          ownProduct,
          quantity,
          unitPriceOverride,
          ownProduct.freeShipping,
        )
      : getTotalCostForQuantity(ownProduct, quantity, ownProduct.freeShipping);
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

function getBestCompetitivePrice(
  ourVendorDetails: InternalProduct,
  ourProduct: Net32AlgoProduct,
  competitorsSortedByBuyBoxRank: Net32AlgoProductWithFreeShipping[],
  quantity: number,
  weHaveFreeShipping: boolean,
) {
  for (const competitor of competitorsSortedByBuyBoxRank) {
    const competitorTotalCost = getTotalCostForQuantity(
      competitor,
      quantity,
      competitor.freeShipping,
    );
    const undercutTotalCost = getUndercutPriceToCompete(
      competitorTotalCost,
      ourProduct,
      competitor,
    );
    const undercutUnitPrice = weHaveFreeShipping
      ? undercutTotalCost.div(quantity)
      : undercutTotalCost.sub(ourProduct.standardShipping).div(quantity);

    // Always round the price down
    const roundedUnderCutUnitPrice = undercutUnitPrice.toDecimalPlaces(2, 1);
    if (
      roundedUnderCutUnitPrice.gte(ourVendorDetails.floorPrice) &&
      roundedUnderCutUnitPrice.lte(ourVendorDetails.maxPrice)
    ) {
      return roundedUnderCutUnitPrice;
    }
  }
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

function getUndercutPriceToCompete(
  targetPrice: Decimal,
  ourProduct: Net32AlgoProduct,
  targetProduct: Net32AlgoProduct,
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

function isFreeShippingForQuantity(
  net32Product: Net32AlgoProduct,
  quantity: number,
  unitPriceOverride?: Decimal,
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
  if (unitPriceOverride !== undefined) {
    const totalCost = unitPriceOverride.mul(quantity);
    if (totalCost.lt(net32Product.freeShippingThreshold)) {
      return false;
    } else {
      return true;
    }
  } else {
    const totalCost = highestPriceBreak.unitPrice * quantity;
    if (totalCost < net32Product.freeShippingThreshold) {
      return false;
    } else {
      return true;
    }
  }
}

function permutateFreeShippingPossibilitesWithFixedPrices(
  net32Products: (Net32AlgoProduct | Net32AlgoProductWithBestPrice)[],
  quantity: number,
): Net32AlgoProductWithFreeShipping[][] {
  const nonFreeShippingProducts = net32Products.filter(
    (p) =>
      isFreeShippingForQuantity(
        p,
        quantity,
        (p as Net32AlgoProductWithBestPrice).bestPrice
          ? (p as Net32AlgoProductWithBestPrice).bestPrice
          : undefined,
      ) === false,
  );
  const freeShippingProducts = net32Products.filter(
    (p) =>
      isFreeShippingForQuantity(
        p,
        quantity,
        (p as Net32AlgoProductWithBestPrice).bestPrice
          ? (p as Net32AlgoProductWithBestPrice).bestPrice
          : undefined,
      ) === true,
  );
  const n = nonFreeShippingProducts.length;
  const total = 1 << n; // 2^n
  const permutations: Net32AlgoProductWithFreeShipping[][] = [];

  for (let mask = 0; mask < total; mask++) {
    const permutation: Net32AlgoProductWithFreeShipping[] = [];
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
/**
 * This function takes in a list of products and returns all possible permutations of them,
 * where each product can be either free shipping or not.
 * If a product already has a standard shipping of 0, it will always be free shipping, so
 * we can reduce the problem to only those with standard shipping of 0, and then add back in the free shipping products.
 * @param net32Products - The list of products to permutate.
 * @returns All possible permutations of the products, where each product can be either free shipping or not.
 */
function permutateFreeShippingPosibilities(
  net32Products: Net32AlgoProduct[],
  ownVendorIds: number[],
  quantity: number,
): Net32AlgoProductWithFreeShipping[][] {
  // If it's one of our vendors, we don't know the price, so we only
  // know if it's free shipping ALWAYS if the standard shipping is 0 as the price could
  // change and trigger the gap depending ont he solution
  // If it's not one of our vendors, price is fixed, so we know if it's free shipping or not
  const alwaysFreeShippingProducts = net32Products.filter((x) => {
    if (ownVendorIds.includes(x.vendorId)) {
      return x.standardShipping === 0;
    } else {
      return isFreeShippingForQuantity(x, quantity) === true;
    }
  });
  // Everything else could be free shipping depending on the price
  // and gap and what else is in the cart.
  const couldBeFreeShippingProducts = net32Products.filter(
    (x) =>
      alwaysFreeShippingProducts.map((y) => y.vendorId).includes(x.vendorId) ===
      false,
  );
  const n = couldBeFreeShippingProducts.length;
  const total = 1 << n; // 2^n
  const permutations: Net32AlgoProductWithFreeShipping[][] = [];

  for (let mask = 0; mask < total; mask++) {
    const permutation: Net32AlgoProductWithFreeShipping[] = [];
    for (let i = 0; i < n; i++) {
      permutation.push({
        ...couldBeFreeShippingProducts[i],
        freeShipping: (mask & (1 << i)) !== 0,
      });
    }
    permutations.push(permutation);
  }

  return permutations.map((x) => [
    ...x,
    ...alwaysFreeShippingProducts.map((x) => ({ ...x, freeShipping: true })),
  ]);
}

function sortedBasedOnByBoxRules(
  products: {
    product: Net32AlgoProduct;
    price: Decimal;
    hasBadge: boolean;
    shippingBucket: number;
  }[],
): {
  product: Net32AlgoProduct;
  price: Decimal;
  hasBadge: boolean;
  shippingBucket: number;
}[] {
  const clonedArray = [...products];
  return clonedArray
    .sort((a, b) => a.price.sub(b.price).toNumber())
    .sort((a, b) => {
      // If both have badge
      if (a.hasBadge && b.hasBadge) {
        // If a is in a lower shipping bucket (faster) than b, need to be at least 0.5% cheaper
        if (a.shippingBucket < b.shippingBucket) {
          if (new Decimal(b.price).lte(new Decimal(a.price).mul(0.995)))
            return 1;
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
        if (new Decimal(a.price).lte(new Decimal(b.price).mul(0.995)))
          return -1;
        return 1;
      }
      // Otherwise, 0.01 cheaper wins
      if (new Decimal(a.price).lte(new Decimal(b.price).sub(0.01))) return -1;
      if (new Decimal(b.price).lte(new Decimal(a.price).sub(0.01))) return 1;
      return 0;
    });
}

function getProductSortedByBuyBoxRankFreeShippingAlgo(
  net32Products: Net32AlgoProductWithFreeShipping[],
  quantity: number,
): Net32AlgoProductWithFreeShipping[] {
  const productInfos = net32Products.map((prod) => {
    const unitPrice = getHighestPriceBreakLessThanOrEqualTo(
      prod,
      quantity,
    ).unitPrice;
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
  const sortedProducts = sortedBasedOnByBoxRules(productInfos);
  return sortedProducts.map(
    (x) => x.product,
  ) as Net32AlgoProductWithFreeShipping[];
}

export function getTotalCostForQuantityWithUnitPriceOverride(
  net32Product: Net32AlgoProduct,
  quantity: number,
  unitPriceOverride: Decimal,
  freeShipping: boolean,
) {
  if (freeShipping) {
    return unitPriceOverride.mul(quantity);
  } else {
    return unitPriceOverride.mul(quantity).add(net32Product.standardShipping);
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
  net32Product: Net32AlgoProduct,
  quantity: number,
  freeShippingOverride?: boolean,
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

  const totalCost = highestPriceBreak.unitPrice * quantity;

  if (freeShippingOverride !== undefined) {
    if (freeShippingOverride === true) {
      return new Decimal(totalCost);
    } else {
      return new Decimal(totalCost + net32Product.standardShipping);
    }
  }

  const threshold = net32Product.freeShippingThreshold;
  if (totalCost < threshold) {
    return new Decimal(totalCost + net32Product.standardShipping);
  } else {
    return new Decimal(totalCost);
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

function getProductsSortedByBuyBoxRank(
  net32Products: Net32AlgoProduct[],
  quantity: number,
): Net32AlgoProduct[] {
  // Prepare info for all products
  const productInfos = net32Products.map((prod) => {
    return {
      product: prod,
      price: getTotalCostForQuantity(prod, quantity),
      hasBadge: hasBadge(prod),
      shippingBucket: getShippingBucket(prod.shippingTime),
    };
  });

  const sortedProducts = sortedBasedOnByBoxRules(productInfos);
  return sortedProducts.map((x) => x.product);
}

export function getTotalCostFreeShippingOverride(
  unitPrice: number,
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
    const sortedPriceBreaks = [...product.priceBreaks].sort(
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

      // For other quantities, check if there's a lower quantity with a lower price
      let isValid = false;
      for (let j = 0; j < i; j++) {
        const lowerBreak = sortedPriceBreaks[j];
        if (
          lowerBreak.minQty < currentMinQty &&
          lowerBreak.unitPrice > currentPrice
        ) {
          isValid = true;
          break;
        }
      }

      if (isValid) {
        quantityBreaks.add(currentMinQty);
      }
    }
  }

  return Array.from(quantityBreaks).sort((a, b) => a - b);
}

function findHighestQuantitySuchThatAllFreeShipping(
  rawNet32Products: Net32AlgoProduct[],
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
