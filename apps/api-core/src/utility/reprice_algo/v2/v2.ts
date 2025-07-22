import { RepriceModel } from "../../../model/repriceModel";
import { Net32PriceBreak } from "../../../types/net32";
import { writeRepriceHtmlReport } from "./html_builder";
import {
  InternalProduct,
  SimplifiedNet32Product,
  ExistingAnalytics,
  PriceSolutions,
  PriceCombinationWithRanks,
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

  const allProducts = rawNet32Products.filter((p) => p.inStock);

  // Iterate over all non-empty combinations of ownVendorsPresent
  const ownVendorSubsets = getAllNonEmptySubsets(ourVendorsProducts);

  let existingProductRankings: ExistingAnalytics = {};
  let priceSolutions: PriceSolutions = {};

  for (const quantityBreak of competitorQuantityBreaks.sort((a, b) => a - b)) {
    const competitorsForThisQuantityBreak = competitorProducts.filter((p) =>
      p.priceBreaks.find((pb) => pb.minQty === quantityBreak),
    );
    const allProductsForThisQuantityBreak = allProducts.filter((p) =>
      p.priceBreaks.find((pb) => pb.minQty === quantityBreak),
    );

    const competitorsRankedByBuyBoxShipping = getProductsSortedByBuyBoxRank(
      competitorsForThisQuantityBreak,
      quantityBreak,
      true,
    );
    const competitorsRankedByBuyBoxNonShipping = getProductsSortedByBuyBoxRank(
      competitorsForThisQuantityBreak,
      quantityBreak,
      false,
    );

    let priceSolutionsForThisQuantityBreak: PriceCombinationWithRanks[] = [];
    for (const vendorSubset of ownVendorSubsets) {
      // [ownProduct1, ownProduct2, ...]
      // Get possible solutions for each vendor in the combination

      const bestPrices: {
        vendorId: number;
        prices: number[];
      }[] = [];
      for (const ownVendor of vendorSubset) {
        const bestPriceToCompeteOnBuyBoxShipping = getBestCompetitivePrice(
          internalProducts.find((vp) => vp.ownVendorId === ownVendor.vendorId)!,
          ownVendor,
          competitorsRankedByBuyBoxShipping,
          quantityBreak,
          true,
        );
        const bestPriceToCompeteOnBuyBoxNonShipping = getBestCompetitivePrice(
          internalProducts.find((vp) => vp.ownVendorId === ownVendor.vendorId)!,
          ownVendor,
          competitorsRankedByBuyBoxNonShipping,
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
                bestPriceToCompeteOnBuyBoxShipping,
                bestPriceToCompeteOnBuyBoxNonShipping,
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
          const buyBoxRankShipping = getBuyBoxRank(
            price,
            ownProduct,
            competitorsRankedByBuyBoxShipping,
            quantityBreak,
            true,
          );
          const buyBoxRankNonShipping = getBuyBoxRank(
            price,
            ownProduct,
            competitorsRankedByBuyBoxNonShipping,
            quantityBreak,
            false,
          );
          return {
            vendor: {
              vendorId,
              price,
            },
            buyBoxRankShipping,
            buyBoxRankNonShipping,
          };
        });
        return {
          vendorPrices: effectiveRanks.map((x) => x.vendor),
          buyBoxRankShipping: Math.min(
            ...effectiveRanks.map((x) => x.buyBoxRankShipping),
          ),
          buyBoxRankNonShipping: Math.min(
            ...effectiveRanks.map((x) => x.buyBoxRankNonShipping),
          ),
        };
      });
      const priceCombinationsWithRanksWithTotalRank =
        priceCombinationsWithRanks.map((x) => ({
          ...x,
          totalRank: x.buyBoxRankShipping + x.buyBoxRankNonShipping,
          averagePrice: getAveragePriceOfSolution(x.vendorPrices),
        }));

      priceSolutionsForThisQuantityBreak.push(
        ...priceCombinationsWithRanksWithTotalRank,
      );
    }
    priceSolutions[quantityBreak] = priceSolutionsForThisQuantityBreak.sort(
      (a, b) => {
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
      },
    );

    const beforeShippingLadder = getProductsSortedByBuyBoxRank(
      allProductsForThisQuantityBreak,
      quantityBreak,
      true,
    );
    const beforeNonShippingLadder = getProductsSortedByBuyBoxRank(
      allProductsForThisQuantityBreak,
      quantityBreak,
      false,
    );
    const beforeOwnShippingRank = getMinOwnRank(
      beforeShippingLadder,
      quantityBreak,
      ownVendorIds,
      true,
    );
    const beforeOwnNonShippingRank = getMinOwnRank(
      beforeNonShippingLadder,
      quantityBreak,
      ownVendorIds,
      false,
    );
    const beforeOwnAveragePrice = getAveragePrice(
      allProductsForThisQuantityBreak.filter((p) =>
        ownVendorIds.includes(p.vendorId),
      ),
      quantityBreak,
    );

    let afterShippingLadder: SimplifiedNet32Product[] | undefined = undefined;
    let afterNonShippingLadder: SimplifiedNet32Product[] | undefined =
      undefined;
    let afterOwnShippingRank: number | undefined = undefined;
    let afterOwnNonShippingRank: number | undefined = undefined;
    let afterOwnAveragePrice: number | undefined = undefined;

    if (priceSolutions[quantityBreak] && priceSolutions[quantityBreak][0]) {
      const newLadder = insertPriceSolution(
        allProducts,
        allProductsForThisQuantityBreak,
        internalProducts,
        priceSolutions[quantityBreak][0],
        quantityBreak,
      );
      afterShippingLadder = getProductsSortedByBuyBoxRank(
        newLadder,
        quantityBreak,
        true,
      );
      afterNonShippingLadder = getProductsSortedByBuyBoxRank(
        newLadder,
        quantityBreak,
        false,
      );
      afterOwnShippingRank = getMinOwnRank(
        afterShippingLadder,
        quantityBreak,
        ownVendorIds,
        true,
      );
      afterOwnNonShippingRank = getMinOwnRank(
        afterNonShippingLadder,
        quantityBreak,
        ownVendorIds,
        false,
      );
      afterOwnAveragePrice = getAveragePrice(
        newLadder.filter((p) => ownVendorIds.includes(p.vendorId)),
        quantityBreak,
      );
    }
    existingProductRankings[quantityBreak] = {
      beforeShippingLadder: beforeShippingLadder,
      beforeNonShippingLadder: beforeNonShippingLadder,
      beforeOwnShippingRank: beforeOwnShippingRank,
      beforeOwnNonShippingRank: beforeOwnNonShippingRank,
      beforeOwnAveragePrice: beforeOwnAveragePrice,
      ...(afterShippingLadder && { afterShippingLadder }),
      ...(afterNonShippingLadder && { afterNonShippingLadder }),
      ...(afterOwnShippingRank !== undefined && { afterOwnShippingRank }),
      ...(afterOwnNonShippingRank !== undefined && { afterOwnNonShippingRank }),
      ...(afterOwnAveragePrice !== undefined && { afterOwnAveragePrice }),
    };
  }

  // TODO: Compute a final solution encompassing all quantity breaks
  // then compare with existing and execute change on net32 if necessary

  writeRepriceHtmlReport(
    mpid,
    internalProducts,
    rawNet32Products,
    existingProductRankings,
    ownVendorIds,
    priceSolutions,
    oldModelSolutions,
  );
}

function insertPriceSolution(
  allProducts: SimplifiedNet32Product[],
  productsForQuantity: SimplifiedNet32Product[],
  internalProducts: InternalProduct[],
  priceSolution: PriceCombinationWithRanks,
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
  priceCombination: PriceCombinationWithRanks["vendorPrices"],
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
  ourUnitPrice: number,
  ownProduct: SimplifiedNet32Product,
  competitors: SimplifiedNet32Product[],
  quantity: number,
  includeShipping: boolean,
) {
  for (let i = 0; i < competitors.length; i++) {
    const competitor = competitors[i];
    const competitorPriceBreak = competitor.priceBreaks.find(
      (pb) => pb.minQty === quantity,
    );
    if (!competitorPriceBreak) {
      throw new Error("Competitor has no price break for this quantity");
    }
    const beatingCompetitor = isBeatingCompetitor(
      ourUnitPrice,
      ownProduct,
      competitor,
      quantity,
      includeShipping,
    );
    if (beatingCompetitor) {
      return i;
    }
  }
  return competitors.length;
}

function isBeatingCompetitor(
  ourUnitPrice: number,
  ownProduct: SimplifiedNet32Product,
  competitor: SimplifiedNet32Product,
  quantity: number,
  includeShipping: boolean,
) {
  const competitorPriceBreak = competitor.priceBreaks.find(
    (pb) => pb.minQty === quantity,
  );
  if (!competitorPriceBreak) {
    throw new Error("Competitor has no price break for this quantity");
  }
  if (includeShipping) {
    const ourTotalPrice = getTotalCost(
      ourUnitPrice,
      quantity,
      ownProduct.standardShipping || 0,
      ownProduct.freeShippingGap || 0,
    );
    const competitorTotalPrice = getTotalCost(
      competitorPriceBreak.unitPrice,
      quantity,
      competitor.standardShipping || 0,
      competitor.freeShippingGap || 0,
    );
    return isBeatingCompetitorOnBuyBoxRules(
      ownProduct,
      competitor,
      ourTotalPrice,
      competitorTotalPrice,
    );
  } else {
    return isBeatingCompetitorOnBuyBoxRules(
      ownProduct,
      competitor,
      ourUnitPrice,
      competitorPriceBreak.unitPrice,
    );
  }
}

function getBestCompetitivePrice(
  ourVendor: InternalProduct,
  ourProduct: SimplifiedNet32Product,
  competitorsSortedByBuyBoxRank: SimplifiedNet32Product[],
  quantity: number,
  includeShipping: boolean,
) {
  for (const competitor of competitorsSortedByBuyBoxRank) {
    const competitorPriceBreak = competitor.priceBreaks.find(
      (pb) => pb.minQty === quantity,
    );
    if (!competitorPriceBreak) {
      throw new Error("Competitor has no price break for this quantity");
    }
    if (!includeShipping) {
      const undercutPrice = getUndercutPriceToCompete(
        competitorPriceBreak.unitPrice,
        ourProduct,
        competitor,
      );
      // Standard rounding to 2 decimal places. We can only submit 2 decimal places to net32.
      // TODO: is it better to just use this to create multiple solutions?
      const roundedUndercutUnitPrice = Math.round(undercutPrice * 100) / 100;
      if (
        roundedUndercutUnitPrice >= ourVendor.floorPrice &&
        roundedUndercutUnitPrice <= ourVendor.maxPrice
      ) {
        return roundedUndercutUnitPrice;
      }
    } else {
      const undercutTotalCost = getUndercutPriceToCompete(
        getTotalCost(
          competitorPriceBreak.unitPrice,
          quantity,
          competitor.standardShipping || 0,
          competitor.freeShippingGap,
        ),
        ourProduct,
        competitor,
      );
      const undercutUnitPrice = solveUnitPriceForTotalCost(
        quantity,
        ourProduct.standardShipping || 0,
        ourProduct.freeShippingGap || 0,
        undercutTotalCost,
      );
      // Standard rounding to 2 decimal places. We can only submit 2 decimal places to net32.
      // TODO: is it better to just use this to create multiple solutions?
      const roundedUndercutUnitPrice =
        Math.round(undercutUnitPrice * 100) / 100;
      if (
        roundedUndercutUnitPrice >= ourVendor.floorPrice &&
        roundedUndercutUnitPrice <= ourVendor.maxPrice
      ) {
        return roundedUndercutUnitPrice;
      }
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
  ourProductPrice: number,
  competitorProductPrice: number,
) {
  const weHaveBadge = hasBadge(ourProduct);
  const theyHaveBadge = hasBadge(competitorProduct);
  if (weHaveBadge && theyHaveBadge) {
    // We have worse shipping
    if (
      getShippingBucket(ourProduct.shippingTime) >
      getShippingBucket(competitorProduct.shippingTime)
    ) {
      return ourProductPrice < competitorProductPrice * 0.995;
    } else if (
      getShippingBucket(ourProduct.shippingTime) <
      getShippingBucket(competitorProduct.shippingTime)
    ) {
      // we have better shipping
      // TODO: Is this less or less than or equal to?
      return ourProductPrice < competitorProductPrice * 1.005;
    } else {
      // We have the same shipping
      return ourProductPrice <= competitorProductPrice - 0.01;
    }
  } else if (weHaveBadge && !theyHaveBadge) {
    // We have badge, they don't
    return ourProductPrice < competitorProductPrice * 1.1;
  } else if (!weHaveBadge && theyHaveBadge) {
    return ourProductPrice < competitorProductPrice * 0.9;
    // We don't have badge, they do
  } else if (
    getShippingBucket(ourProduct.shippingTime) >
    getShippingBucket(competitorProduct.shippingTime)
  ) {
    // We have worse shipping
    return ourProductPrice < competitorProductPrice * 0.995;
  } else if (
    getShippingBucket(ourProduct.shippingTime) <
    getShippingBucket(competitorProduct.shippingTime)
  ) {
    // We have better shipping
    return ourProductPrice < competitorProductPrice * 1.005;
  } else {
    // We have the same shipping
    return ourProductPrice <= competitorProductPrice - 0.01;
  }
}

function getUndercutPriceToCompete(
  targetPrice: number,
  ourProduct: SimplifiedNet32Product,
  targetProduct: SimplifiedNet32Product,
) {
  // Here we have to subtract another penny when undercutting
  // to make sure we are less than the threshold
  const targetHasBadge = hasBadge(targetProduct);
  const weHaveBadge = hasBadge(ourProduct);
  if (targetHasBadge && !weHaveBadge) {
    return targetPrice * 0.9 - 0.01;
  } else if (targetHasBadge && weHaveBadge) {
    if (
      getShippingBucket(targetProduct.shippingTime) >
      getShippingBucket(ourProduct.shippingTime)
    ) {
      // We have better shipping
      return targetPrice * 1.005 - 0.01;
    } else if (
      getShippingBucket(targetProduct.shippingTime) <
      getShippingBucket(ourProduct.shippingTime)
    ) {
      // We have worse shipping
      return targetPrice * 0.995 - 0.01;
    } else {
      // We have the same shipping
      return targetPrice - 0.01 - 0.01;
    }
  } else if (!targetHasBadge && weHaveBadge) {
    return targetPrice * 1.1 - 0.01;
  } else if (
    getShippingBucket(targetProduct.shippingTime) >
    getShippingBucket(ourProduct.shippingTime)
  ) {
    return targetPrice * 1.005 - 0.01;
  } else if (
    getShippingBucket(targetProduct.shippingTime) <
    getShippingBucket(ourProduct.shippingTime)
  ) {
    return targetPrice * 0.995 - 0.01;
  } else {
    return targetPrice - 0.01;
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
        if (b.price <= a.price * 0.995) return 1;
        return -1;
      }
      // If b is in a lower shipping bucket (faster) than a, need to be at least 0.5% cheaper
      if (b.shippingBucket < a.shippingBucket) {
        if (a.price <= b.price * 0.995) return -1;
        return 1;
      }
      // If both have the same shipping bucket, need to be at least 1c cheaper
      if (a.price <= b.price - 0.01) return -1;
      if (b.price <= a.price - 0.01) return 1;
      return 0;
    }
    // If a has badge, b does not, need to be at least 10% cheaper
    if (a.hasBadge && !b.hasBadge) {
      if (b.price <= a.price * 0.9) return 1;
      return -1;
    }
    // If b has badge, a does not, need to be at least 10% cheaper
    if (!a.hasBadge && b.hasBadge) {
      if (a.price <= b.price * 0.9) return -1;
      return 1;
    }
    // If a is in a lower shipping bucket (faster) than b, need to be at least 0.5% cheaper
    if (a.shippingBucket < b.shippingBucket) {
      if (b.price <= a.price * 0.995) return 1;
      return -1;
    }
    // If b is in a lower shipping bucket (faster) than a, need to be at least 0.5% cheaper
    if (b.shippingBucket < a.shippingBucket) {
      if (a.price <= b.price * 0.995) return -1;
      return 1;
    }
    // Otherwise, 0.01 cheaper wins
    if (a.price <= b.price - 0.01) return -1;
    if (b.price <= a.price - 0.01) return 1;
    return 0;
  });
  return sortedInfos.map((x) => x.product);
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
