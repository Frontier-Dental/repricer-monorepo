// Mock dependencies before imports
jest.mock("./algorithm", () => ({
  hasBadge: jest.fn(),
  Net32AlgoSolution: jest.fn(),
  Net32AlgoSolutionWithQBreakValid: jest.fn(),
  Net32AlgoSolutionWithResult: jest.fn(),
  QuantitySolution: jest.fn(),
}));
jest.mock("./utility", () => ({
  isShortExpiryProduct: jest.fn(),
  isChangeResult: jest.fn(),
}));

// Mock shared package BEFORE imports
jest.mock("@repricer-monorepo/shared", () => ({
  AlgoBadgeIndicator: {
    ALL: "ALL",
    BADGE: "BADGE",
  },
  AlgoHandlingTimeGroup: {
    ALL: "ALL",
    FAST_SHIPPING: "FAST_SHIPPING",
    STOCKED: "STOCKED",
    LONG_HANDLING: "LONG_HANDLING",
  },
  AlgoPriceDirection: {
    UP: "UP",
    DOWN: "DOWN",
  },
}));

import { AlgoBadgeIndicator, AlgoHandlingTimeGroup, AlgoPriceDirection } from "@repricer-monorepo/shared";
import Decimal from "decimal.js";
import { applyCompetitionFilters, applyShortExpiryFilter, applyBadgeIndicatorFilter, applyVendorExclusionFilter, applySuppressQBreakIfQ1NotUpdated, applyMinQuantityFilter, applyHandlingTimeGroup, applySuppressPriceBreakFilter, applyCompeteOnPriceBreaksOnly, applyOwnVendorThreshold, applyUpDownRestriction, applyKeepPosition, applyFloorCompeteWithNext } from "./settings";
import { hasBadge } from "./algorithm";
import { isShortExpiryProduct, isChangeResult } from "./utility";
import { V2AlgoSettingsData } from "../../mysql/v2-algo-settings";
import { AlgoResult, Net32AlgoProduct } from "./types";

describe("reprice-algo/v2/settings", () => {
  const mockHasBadge = hasBadge as jest.MockedFunction<typeof hasBadge>;
  const mockIsShortExpiryProduct = isShortExpiryProduct as jest.MockedFunction<typeof isShortExpiryProduct>;
  const mockIsChangeResult = isChangeResult as jest.MockedFunction<typeof isChangeResult>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockHasBadge.mockReturnValue(false);
    mockIsShortExpiryProduct.mockReturnValue(false);
    mockIsChangeResult.mockReturnValue(false);
  });

  describe("applyShortExpiryFilter", () => {
    it("should return products unchanged when quantity is undefined", () => {
      const products: Net32AlgoProduct[] = [{ vendorId: 1, priceBreaks: [] } as any, { vendorId: 2, priceBreaks: [] } as any];

      const result = applyShortExpiryFilter(products, undefined);
      expect(result).toBe(products);
      expect(mockIsShortExpiryProduct).not.toHaveBeenCalled();
    });

    it("should filter out short expiry products when quantity is provided", () => {
      const products: Net32AlgoProduct[] = [{ vendorId: 1, priceBreaks: [] } as any, { vendorId: 2, priceBreaks: [] } as any];

      mockIsShortExpiryProduct.mockReturnValueOnce(false).mockReturnValueOnce(true);

      const result = applyShortExpiryFilter(products, 1);
      expect(result).toHaveLength(1);
      expect(result[0].vendorId).toBe(1);
    });
  });

  describe("applyBadgeIndicatorFilter", () => {
    it("should return all products when badge_indicator is ALL", () => {
      const competitors: Net32AlgoProduct[] = [{ vendorId: 1 } as any, { vendorId: 2 } as any];
      const settings: V2AlgoSettingsData = {
        badge_indicator: AlgoBadgeIndicator.ALL,
      } as any;

      const result = applyBadgeIndicatorFilter(competitors, settings);
      expect(result).toEqual(competitors);
    });

    it("should filter to only products with badges when badge_indicator is BADGE", () => {
      const competitors: Net32AlgoProduct[] = [{ vendorId: 1 } as any, { vendorId: 2 } as any];
      const settings: V2AlgoSettingsData = {
        badge_indicator: AlgoBadgeIndicator.BADGE,
      } as any;

      // First call filters, second call checks if any badges exist in postFilter
      mockHasBadge
        .mockReturnValueOnce(true) // First competitor has badge (passes filter)
        .mockReturnValueOnce(false) // Second competitor has no badge (filtered out)
        .mockReturnValueOnce(true); // Check if any badges exist in postFilter (yes, vendorId 1)

      const result = applyBadgeIndicatorFilter(competitors, settings);
      expect(result).toHaveLength(1);
      expect(result[0].vendorId).toBe(1);
    });

    it("should return pre-filtered list when BADGE filter results in no badges", () => {
      const competitors: Net32AlgoProduct[] = [{ vendorId: 1 } as any, { vendorId: 2 } as any];
      const settings: V2AlgoSettingsData = {
        badge_indicator: AlgoBadgeIndicator.BADGE,
      } as any;

      mockHasBadge.mockReturnValue(false);

      const result = applyBadgeIndicatorFilter(competitors, settings);
      expect(result).toEqual(competitors); // Should return pre-filtered list
    });

    it("should throw error for invalid badge indicator", () => {
      const competitors: Net32AlgoProduct[] = [{ vendorId: 1 } as any];
      const settings: V2AlgoSettingsData = {
        badge_indicator: "INVALID" as any,
      } as any;

      expect(() => applyBadgeIndicatorFilter(competitors, settings)).toThrow("Invalid badge indicator: INVALID");
    });
  });

  describe("applyVendorExclusionFilter", () => {
    it("should exclude vendors in exclude_vendors list", () => {
      const competitors: Net32AlgoProduct[] = [{ vendorId: 1 } as any, { vendorId: 2 } as any, { vendorId: 3 } as any];
      const settings: V2AlgoSettingsData = {
        exclude_vendors: "1,3",
      } as any;

      const result = applyVendorExclusionFilter(competitors, settings);
      expect(result).toHaveLength(1);
      expect(result[0].vendorId).toBe(2);
    });

    it("should return all products when exclude_vendors is empty", () => {
      const competitors: Net32AlgoProduct[] = [{ vendorId: 1 } as any, { vendorId: 2 } as any];
      const settings: V2AlgoSettingsData = {
        exclude_vendors: "",
      } as any;

      const result = applyVendorExclusionFilter(competitors, settings);
      expect(result).toEqual(competitors);
    });
  });

  describe("applySuppressQBreakIfQ1NotUpdated", () => {
    it("should set qBreakValid to true when isSlowCron is true", () => {
      const solutionResults = [
        {
          quantity: 2,
          vendorSettings: {},
          algoResult: AlgoResult.IGNORE_SETTINGS,
        },
      ] as any;

      const result = applySuppressQBreakIfQ1NotUpdated(solutionResults, true);
      expect(result[0].qBreakValid).toBe(true);
    });

    it("should set qBreakValid to true when suppress_price_break_if_Q1_not_updated is false", () => {
      const solutionResults = [
        {
          quantity: 2,
          vendorSettings: {
            suppress_price_break_if_Q1_not_updated: false,
          },
          algoResult: AlgoResult.IGNORE_SETTINGS,
        },
      ] as any;

      const result = applySuppressQBreakIfQ1NotUpdated(solutionResults, false);
      expect(result[0].qBreakValid).toBe(true);
    });

    it("should set qBreakValid to true when quantity is 1", () => {
      const solutionResults = [
        {
          quantity: 1,
          vendorSettings: {
            suppress_price_break_if_Q1_not_updated: true,
          },
          algoResult: AlgoResult.IGNORE_SETTINGS,
        },
      ] as any;

      const result = applySuppressQBreakIfQ1NotUpdated(solutionResults, false);
      expect(result[0].qBreakValid).toBe(true);
    });

    it("should set qBreakValid to false when Q1 not updated", () => {
      const solutionResults = [
        {
          quantity: 2,
          vendor: { vendorId: 1 },
          vendorSettings: {
            suppress_price_break_if_Q1_not_updated: true,
          },
          algoResult: AlgoResult.IGNORE_SETTINGS,
        },
      ] as any;

      mockIsChangeResult.mockReturnValue(false);

      const result = applySuppressQBreakIfQ1NotUpdated(solutionResults, false);
      expect(result[0].qBreakValid).toBe(false);
    });

    it("should set qBreakValid to true when Q1 is updated", () => {
      const solutionResults = [
        {
          quantity: 2,
          vendor: { vendorId: 1 },
          vendorSettings: {
            suppress_price_break_if_Q1_not_updated: true,
          },
          algoResult: AlgoResult.IGNORE_SETTINGS,
        },
        {
          quantity: 1,
          vendor: { vendorId: 1 },
          vendorSettings: {
            suppress_price_break_if_Q1_not_updated: true,
          },
          algoResult: AlgoResult.CHANGE_UP,
        },
      ] as any;

      // Mock isChangeResult to return true for CHANGE_UP
      mockIsChangeResult.mockImplementation((result) => {
        return result === AlgoResult.CHANGE_UP || result === AlgoResult.CHANGE_DOWN || result === AlgoResult.CHANGE_NEW;
      });

      const result = applySuppressQBreakIfQ1NotUpdated(solutionResults, false);
      expect(result[0].qBreakValid).toBe(true);
    });
  });

  describe("applyMinQuantityFilter", () => {
    it("should include inactive vendors regardless of inventory", () => {
      const competitors: Net32AlgoProduct[] = [{ vendorId: 1, inventory: 0 } as any, { vendorId: 2, inventory: 10 } as any];
      const settings: V2AlgoSettingsData = {
        inactive_vendor_id: "1",
        inventory_competition_threshold: 5,
      } as any;

      const result = applyMinQuantityFilter(competitors, settings);
      expect(result).toHaveLength(2);
    });

    it("should filter by inventory threshold for active vendors", () => {
      const competitors: Net32AlgoProduct[] = [{ vendorId: 1, inventory: 3 } as any, { vendorId: 2, inventory: 10 } as any];
      const settings: V2AlgoSettingsData = {
        inactive_vendor_id: "",
        inventory_competition_threshold: 5,
      } as any;

      const result = applyMinQuantityFilter(competitors, settings);
      expect(result).toHaveLength(1);
      expect(result[0].vendorId).toBe(2);
    });
  });

  describe("applyHandlingTimeGroup", () => {
    it("should return all products when handling_time_group is ALL", () => {
      const competitors: Net32AlgoProduct[] = [{ shippingTime: 1 } as any, { shippingTime: 10 } as any];
      const settings: V2AlgoSettingsData = {
        handling_time_group: AlgoHandlingTimeGroup.ALL,
      } as any;

      const result = applyHandlingTimeGroup(competitors, settings);
      expect(result).toEqual(competitors);
    });

    it("should filter to FAST_SHIPPING (1-2 days)", () => {
      const competitors: Net32AlgoProduct[] = [{ shippingTime: 1 } as any, { shippingTime: 2 } as any, { shippingTime: 3 } as any];
      const settings: V2AlgoSettingsData = {
        handling_time_group: AlgoHandlingTimeGroup.FAST_SHIPPING,
      } as any;

      const result = applyHandlingTimeGroup(competitors, settings);
      expect(result).toHaveLength(2);
    });

    it("should filter to STOCKED (<=5 days)", () => {
      const competitors: Net32AlgoProduct[] = [{ shippingTime: 3 } as any, { shippingTime: 5 } as any, { shippingTime: 6 } as any];
      const settings: V2AlgoSettingsData = {
        handling_time_group: AlgoHandlingTimeGroup.STOCKED,
      } as any;

      const result = applyHandlingTimeGroup(competitors, settings);
      expect(result).toHaveLength(2);
    });

    it("should filter to LONG_HANDLING (>=6 days)", () => {
      const competitors: Net32AlgoProduct[] = [{ shippingTime: 5 } as any, { shippingTime: 6 } as any, { shippingTime: 10 } as any];
      const settings: V2AlgoSettingsData = {
        handling_time_group: AlgoHandlingTimeGroup.LONG_HANDLING,
      } as any;

      const result = applyHandlingTimeGroup(competitors, settings);
      expect(result).toHaveLength(2);
    });
  });

  describe("applySuppressPriceBreakFilter", () => {
    it("should return IGNORE_SETTINGS when suppress_price_break is true and quantity > 1", () => {
      const settings: V2AlgoSettingsData = {
        suppress_price_break: true,
      } as any;

      const result = applySuppressPriceBreakFilter(settings, 2);
      expect(result).toBe(AlgoResult.IGNORE_SETTINGS);
    });

    it("should return null when suppress_price_break is true and quantity is 1", () => {
      const settings: V2AlgoSettingsData = {
        suppress_price_break: true,
      } as any;

      const result = applySuppressPriceBreakFilter(settings, 1);
      expect(result).toBeNull();
    });

    it("should return null when suppress_price_break is false", () => {
      const settings: V2AlgoSettingsData = {
        suppress_price_break: false,
      } as any;

      const result = applySuppressPriceBreakFilter(settings, 2);
      expect(result).toBeNull();
    });
  });

  describe("applyCompeteOnPriceBreaksOnly", () => {
    it("should return null when compete_on_price_break_only is true and quantity > 1", () => {
      const settings: V2AlgoSettingsData = {
        compete_on_price_break_only: true,
      } as any;

      const result = applyCompeteOnPriceBreaksOnly(settings, 2);
      expect(result).toBeNull();
    });

    it("should return IGNORE_SETTINGS when compete_on_price_break_only is true and quantity is 1", () => {
      const settings: V2AlgoSettingsData = {
        compete_on_price_break_only: true,
      } as any;

      const result = applyCompeteOnPriceBreaksOnly(settings, 1);
      expect(result).toBe(AlgoResult.IGNORE_SETTINGS);
    });

    it("should return null when compete_on_price_break_only is false", () => {
      const settings: V2AlgoSettingsData = {
        compete_on_price_break_only: false,
      } as any;

      const result = applyCompeteOnPriceBreaksOnly(settings, 1);
      expect(result).toBeNull();
    });
  });

  describe("applyOwnVendorThreshold", () => {
    it("should return IGNORE_SETTINGS when inventory is below threshold", () => {
      const solution = {
        vendor: { inventory: 5 },
      } as any;
      const settings: V2AlgoSettingsData = {
        own_vendor_threshold: 10,
      } as any;

      const result = applyOwnVendorThreshold(solution, settings);
      expect(result).toBe(AlgoResult.IGNORE_SETTINGS);
    });

    it("should return null when inventory meets threshold", () => {
      const solution = {
        vendor: { inventory: 10 },
      } as any;
      const settings: V2AlgoSettingsData = {
        own_vendor_threshold: 10,
      } as any;

      const result = applyOwnVendorThreshold(solution, settings);
      expect(result).toBeNull();
    });
  });

  describe("applyUpDownRestriction", () => {
    it("should return null when existingPrice is not provided", () => {
      const suggestedPrice = new Decimal(10);
      const settings: V2AlgoSettingsData = {
        up_down: AlgoPriceDirection.UP,
      } as any;

      const result = applyUpDownRestriction(suggestedPrice, settings, false);
      expect(result).toBeNull();
    });

    it("should return null when isSlowCron is true", () => {
      const suggestedPrice = new Decimal(10);
      const settings: V2AlgoSettingsData = {
        up_down: AlgoPriceDirection.UP,
      } as any;
      const existingPrice = { unitPrice: new Decimal(9) } as any;

      const result = applyUpDownRestriction(suggestedPrice, settings, true, existingPrice);
      expect(result).toBeNull();
    });

    it("should return IGNORE_SETTINGS when UP direction and price goes down", () => {
      const suggestedPrice = new Decimal(8);
      const settings: V2AlgoSettingsData = {
        up_down: AlgoPriceDirection.UP,
      } as any;
      const existingPrice = { unitPrice: new Decimal(9) } as any;

      const result = applyUpDownRestriction(suggestedPrice, settings, false, existingPrice);
      expect(result).toBe(AlgoResult.IGNORE_SETTINGS);
    });

    it("should return IGNORE_SETTINGS when DOWN direction and price goes up", () => {
      const suggestedPrice = new Decimal(10);
      const settings: V2AlgoSettingsData = {
        up_down: AlgoPriceDirection.DOWN,
      } as any;
      const existingPrice = { unitPrice: new Decimal(9) } as any;

      const result = applyUpDownRestriction(suggestedPrice, settings, false, existingPrice);
      expect(result).toBe(AlgoResult.IGNORE_SETTINGS);
    });

    it("should return null when UP direction and price goes up", () => {
      const suggestedPrice = new Decimal(10);
      const settings: V2AlgoSettingsData = {
        up_down: AlgoPriceDirection.UP,
      } as any;
      const existingPrice = { unitPrice: new Decimal(9) } as any;

      const result = applyUpDownRestriction(suggestedPrice, settings, false, existingPrice);
      expect(result).toBeNull();
    });

    it("should return null when DOWN direction and price goes down", () => {
      const suggestedPrice = new Decimal(8);
      const settings: V2AlgoSettingsData = {
        up_down: AlgoPriceDirection.DOWN,
      } as any;
      const existingPrice = { unitPrice: new Decimal(9) } as any;

      const result = applyUpDownRestriction(suggestedPrice, settings, false, existingPrice);
      expect(result).toBeNull();
    });
  });

  describe("applyKeepPosition", () => {
    it("should return null when isSlowCron is true", () => {
      const settings: V2AlgoSettingsData = {
        keep_position: true,
      } as any;

      const result = applyKeepPosition(settings, true, 5, 10);
      expect(result).toBeNull();
    });

    it("should return IGNORE_SETTINGS when keep_position is true and lowestVendorPosition > preJsonPosition", () => {
      const settings: V2AlgoSettingsData = {
        keep_position: true,
      } as any;

      const result = applyKeepPosition(settings, false, 5, 10);
      expect(result).toBe(AlgoResult.IGNORE_SETTINGS);
    });

    it("should return null when keep_position is false", () => {
      const settings: V2AlgoSettingsData = {
        keep_position: false,
      } as any;

      const result = applyKeepPosition(settings, false, 5, 10);
      expect(result).toBeNull();
    });

    it("should return null when lowestVendorPosition is null", () => {
      const settings: V2AlgoSettingsData = {
        keep_position: true,
      } as any;

      const result = applyKeepPosition(settings, false, 5, null);
      expect(result).toBeNull();
    });

    it("should return null when lowestVendorPosition <= preJsonPosition", () => {
      const settings: V2AlgoSettingsData = {
        keep_position: true,
      } as any;

      const result = applyKeepPosition(settings, false, 10, 5);
      expect(result).toBeNull();
    });
  });

  describe("applyFloorCompeteWithNext", () => {
    it("should return IGNORE_FLOOR when quantity is 2, compare_q2_with_q1 is true, and buyBoxRank > 0", () => {
      const solution = {
        quantity: 2,
        buyBoxRank: 1,
      } as any;
      const settings: V2AlgoSettingsData = {
        compare_q2_with_q1: true,
        floor_compete_with_next: true,
      } as any;

      const result = applyFloorCompeteWithNext(solution, settings, false);
      expect(result).toBe(AlgoResult.IGNORE_FLOOR);
    });

    it("should return null when isSlowCron is true", () => {
      const solution = {
        quantity: 2,
        buyBoxRank: 1,
      } as any;
      const settings: V2AlgoSettingsData = {
        floor_compete_with_next: true,
      } as any;

      const result = applyFloorCompeteWithNext(solution, settings, true);
      expect(result).toBeNull();
    });

    it("should return IGNORE_FLOOR when floor_compete_with_next is false and buyBoxRank > 0", () => {
      const solution = {
        quantity: 1,
        buyBoxRank: 1,
      } as any;
      const settings: V2AlgoSettingsData = {
        floor_compete_with_next: false,
      } as any;

      const result = applyFloorCompeteWithNext(solution, settings, false);
      expect(result).toBe(AlgoResult.IGNORE_FLOOR);
    });

    it("should return null when floor_compete_with_next is true and buyBoxRank is 0", () => {
      const solution = {
        quantity: 1,
        buyBoxRank: 0,
      } as any;
      const settings: V2AlgoSettingsData = {
        floor_compete_with_next: true,
      } as any;

      const result = applyFloorCompeteWithNext(solution, settings, false);
      expect(result).toBeNull();
    });
  });

  describe("applyCompetitionFilters", () => {
    it("should apply all filters in sequence", () => {
      const products: Net32AlgoProduct[] = [{ vendorId: 1, inventory: 10, shippingTime: 1 } as any, { vendorId: 2, inventory: 10, shippingTime: 1 } as any];
      const settings: V2AlgoSettingsData = {
        exclude_vendors: "2",
        inactive_vendor_id: "",
        inventory_competition_threshold: 5,
        handling_time_group: AlgoHandlingTimeGroup.ALL,
        badge_indicator: AlgoBadgeIndicator.ALL,
      } as any;

      const result = applyCompetitionFilters(products, settings, 1);
      expect(result).toHaveLength(1);
      expect(result[0].vendorId).toBe(1);
    });
  });
});
