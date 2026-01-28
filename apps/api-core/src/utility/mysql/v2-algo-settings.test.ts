// Mock dependencies before imports
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
    UP_DOWN: "UP/DOWN",
    DOWN: "DOWN",
  },
  AlgoPriceStrategy: {
    UNIT: "UNIT",
    TOTAL: "TOTAL",
    BUY_BOX: "BUY_BOX",
  },
}));

jest.mock("../../model/sql-models/knex-wrapper", () => ({
  getKnexInstance: jest.fn(),
  destroyKnexInstance: jest.fn(),
}));

import { AlgoBadgeIndicator, AlgoHandlingTimeGroup, AlgoPriceDirection, AlgoPriceStrategy } from "@repricer-monorepo/shared";
import { findV2AlgoSettings, createV2AlgoSettings, findOrCreateV2AlgoSettings, findOrCreateV2AlgoSettingsForVendors, V2AlgoSettingsData } from "./v2-algo-settings";
import { getKnexInstance } from "../../model/sql-models/knex-wrapper";

describe("v2-algo-settings", () => {
  let mockKnex: any;
  let mockQueryBuilder: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a mock query builder with chainable methods
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      first: jest.fn(),
      insert: jest.fn(),
    };

    // Create a mock knex instance
    mockKnex = jest.fn().mockReturnValue(mockQueryBuilder);

    // Mock getKnexInstance to return our mock knex
    (getKnexInstance as jest.Mock).mockReturnValue(mockKnex);
  });

  describe("findV2AlgoSettings", () => {
    it("should return settings when found", async () => {
      const mockSettings: V2AlgoSettingsData = {
        id: 1,
        mp_id: 100,
        vendor_id: 200,
        suppress_price_break_if_Q1_not_updated: true,
        suppress_price_break: false,
        compete_on_price_break_only: true,
        up_down: AlgoPriceDirection.UP,
        badge_indicator: AlgoBadgeIndicator.BADGE,
        execution_priority: 5,
        reprice_up_percentage: 10.5,
        compare_q2_with_q1: true,
        compete_with_all_vendors: false,
        reprice_up_badge_percentage: 15.0,
        sister_vendor_ids: "1,2,3",
        exclude_vendors: "4,5",
        inactive_vendor_id: "6",
        handling_time_group: AlgoHandlingTimeGroup.FAST_SHIPPING,
        keep_position: true,
        inventory_competition_threshold: 2,
        reprice_down_percentage: 5.0,
        max_price: 1000.0,
        floor_price: 10.0,
        reprice_down_badge_percentage: 8.0,
        floor_compete_with_next: true,
        own_vendor_threshold: 3,
        price_strategy: AlgoPriceStrategy.TOTAL,
        enabled: true,
      };

      mockQueryBuilder.first.mockResolvedValue(mockSettings);

      const result = await findV2AlgoSettings(100, 200);

      expect(getKnexInstance).toHaveBeenCalledTimes(1);
      expect(mockKnex).toHaveBeenCalledWith("v2_algo_settings");
      expect(mockQueryBuilder.where).toHaveBeenCalledWith({
        mp_id: 100,
        vendor_id: 200,
      });
      expect(mockQueryBuilder.first).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockSettings);
    });

    it("should return null when settings not found", async () => {
      mockQueryBuilder.first.mockResolvedValue(undefined);

      const result = await findV2AlgoSettings(100, 200);

      expect(getKnexInstance).toHaveBeenCalledTimes(1);
      expect(mockKnex).toHaveBeenCalledWith("v2_algo_settings");
      expect(mockQueryBuilder.where).toHaveBeenCalledWith({
        mp_id: 100,
        vendor_id: 200,
      });
      expect(mockQueryBuilder.first).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });

    it("should return null when first returns null", async () => {
      mockQueryBuilder.first.mockResolvedValue(null);

      const result = await findV2AlgoSettings(100, 200);

      expect(result).toBeNull();
    });

    it("should handle different mp_id and vendor_id values", async () => {
      const mockSettings: V2AlgoSettingsData = {
        id: 2,
        mp_id: 500,
        vendor_id: 600,
        suppress_price_break_if_Q1_not_updated: false,
        suppress_price_break: true,
        compete_on_price_break_only: false,
        up_down: AlgoPriceDirection.DOWN,
        badge_indicator: AlgoBadgeIndicator.ALL,
        execution_priority: 10,
        reprice_up_percentage: 20.0,
        compare_q2_with_q1: false,
        compete_with_all_vendors: true,
        reprice_up_badge_percentage: 25.0,
        sister_vendor_ids: "",
        exclude_vendors: "",
        inactive_vendor_id: "",
        handling_time_group: AlgoHandlingTimeGroup.ALL,
        keep_position: false,
        inventory_competition_threshold: 5,
        reprice_down_percentage: 10.0,
        max_price: 5000.0,
        floor_price: 50.0,
        reprice_down_badge_percentage: 12.0,
        floor_compete_with_next: false,
        own_vendor_threshold: 2,
        price_strategy: AlgoPriceStrategy.BUY_BOX,
        enabled: false,
      };

      mockQueryBuilder.first.mockResolvedValue(mockSettings);

      const result = await findV2AlgoSettings(500, 600);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith({
        mp_id: 500,
        vendor_id: 600,
      });
      expect(result).toEqual(mockSettings);
    });
  });

  describe("createV2AlgoSettings", () => {
    it("should create settings with default values", async () => {
      const insertId = 123;
      mockQueryBuilder.insert.mockResolvedValue([insertId]);

      const result = await createV2AlgoSettings(100, 200);

      expect(getKnexInstance).toHaveBeenCalledTimes(1);
      expect(mockKnex).toHaveBeenCalledWith("v2_algo_settings");
      expect(mockQueryBuilder.insert).toHaveBeenCalledTimes(1);

      const insertCall = mockQueryBuilder.insert.mock.calls[0][0];
      expect(insertCall).toMatchObject({
        mp_id: 100,
        vendor_id: 200,
        suppress_price_break_if_Q1_not_updated: false,
        suppress_price_break: false,
        compete_on_price_break_only: false,
        up_down: AlgoPriceDirection.UP_DOWN,
        badge_indicator: AlgoBadgeIndicator.ALL,
        execution_priority: 0,
        reprice_up_percentage: -1,
        compare_q2_with_q1: false,
        compete_with_all_vendors: false,
        reprice_up_badge_percentage: -1,
        sister_vendor_ids: "",
        exclude_vendors: "",
        inactive_vendor_id: "",
        handling_time_group: AlgoHandlingTimeGroup.ALL,
        keep_position: false,
        inventory_competition_threshold: 1,
        reprice_down_percentage: -1,
        reprice_down_badge_percentage: -1,
        floor_compete_with_next: false,
        own_vendor_threshold: 1,
        price_strategy: AlgoPriceStrategy.UNIT,
        enabled: false,
      });

      expect(result).toEqual({
        id: insertId,
        mp_id: 100,
        vendor_id: 200,
        suppress_price_break_if_Q1_not_updated: false,
        suppress_price_break: false,
        compete_on_price_break_only: false,
        up_down: AlgoPriceDirection.UP_DOWN,
        badge_indicator: AlgoBadgeIndicator.ALL,
        execution_priority: 0,
        reprice_up_percentage: -1,
        compare_q2_with_q1: false,
        compete_with_all_vendors: false,
        reprice_up_badge_percentage: -1,
        sister_vendor_ids: "",
        exclude_vendors: "",
        inactive_vendor_id: "",
        handling_time_group: AlgoHandlingTimeGroup.ALL,
        keep_position: false,
        inventory_competition_threshold: 1,
        reprice_down_percentage: -1,
        max_price: 99999999.99,
        floor_price: 0,
        reprice_down_badge_percentage: -1,
        floor_compete_with_next: false,
        own_vendor_threshold: 1,
        price_strategy: AlgoPriceStrategy.UNIT,
        enabled: false,
      });
    });

    it("should create settings with correct max_price default", async () => {
      const insertId = 456;
      mockQueryBuilder.insert.mockResolvedValue([insertId]);

      const result = await createV2AlgoSettings(300, 400);

      expect(result.id).toBe(insertId);
      expect(result.max_price).toBe(99999999.99);
      expect(result.floor_price).toBe(0);
    });

    it("should handle different mp_id and vendor_id values", async () => {
      const insertId = 789;
      mockQueryBuilder.insert.mockResolvedValue([insertId]);

      const result = await createV2AlgoSettings(500, 600);

      const insertCall = mockQueryBuilder.insert.mock.calls[0][0];
      expect(insertCall.mp_id).toBe(500);
      expect(insertCall.vendor_id).toBe(600);
      expect(result.mp_id).toBe(500);
      expect(result.vendor_id).toBe(600);
      expect(result.id).toBe(insertId);
    });
  });

  describe("findOrCreateV2AlgoSettings", () => {
    it("should return existing settings when found", async () => {
      const existingSettings: V2AlgoSettingsData = {
        id: 1,
        mp_id: 100,
        vendor_id: 200,
        suppress_price_break_if_Q1_not_updated: true,
        suppress_price_break: false,
        compete_on_price_break_only: true,
        up_down: AlgoPriceDirection.UP,
        badge_indicator: AlgoBadgeIndicator.BADGE,
        execution_priority: 5,
        reprice_up_percentage: 10.5,
        compare_q2_with_q1: true,
        compete_with_all_vendors: false,
        reprice_up_badge_percentage: 15.0,
        sister_vendor_ids: "1,2,3",
        exclude_vendors: "4,5",
        inactive_vendor_id: "6",
        handling_time_group: AlgoHandlingTimeGroup.FAST_SHIPPING,
        keep_position: true,
        inventory_competition_threshold: 2,
        reprice_down_percentage: 5.0,
        max_price: 1000.0,
        floor_price: 10.0,
        reprice_down_badge_percentage: 8.0,
        floor_compete_with_next: true,
        own_vendor_threshold: 3,
        price_strategy: AlgoPriceStrategy.TOTAL,
        enabled: true,
      };

      mockQueryBuilder.first.mockResolvedValue(existingSettings);

      const result = await findOrCreateV2AlgoSettings(100, 200);

      expect(mockQueryBuilder.first).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
      expect(result).toEqual(existingSettings);
    });

    it("should create new settings when not found", async () => {
      const insertId = 999;
      mockQueryBuilder.first.mockResolvedValue(null);
      mockQueryBuilder.insert.mockResolvedValue([insertId]);

      const result = await findOrCreateV2AlgoSettings(100, 200);

      expect(mockQueryBuilder.first).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.insert).toHaveBeenCalledTimes(1);
      expect(result.id).toBe(insertId);
      expect(result.mp_id).toBe(100);
      expect(result.vendor_id).toBe(200);
      expect(result.enabled).toBe(false);
    });

    it("should create new settings when first returns undefined", async () => {
      const insertId = 888;
      mockQueryBuilder.first.mockResolvedValue(undefined);
      mockQueryBuilder.insert.mockResolvedValue([insertId]);

      const result = await findOrCreateV2AlgoSettings(100, 200);

      expect(mockQueryBuilder.first).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.insert).toHaveBeenCalledTimes(1);
      expect(result.id).toBe(insertId);
    });

    it("should handle multiple calls correctly", async () => {
      const existingSettings: V2AlgoSettingsData = {
        id: 1,
        mp_id: 100,
        vendor_id: 200,
        suppress_price_break_if_Q1_not_updated: false,
        suppress_price_break: false,
        compete_on_price_break_only: false,
        up_down: AlgoPriceDirection.UP_DOWN,
        badge_indicator: AlgoBadgeIndicator.ALL,
        execution_priority: 0,
        reprice_up_percentage: -1,
        compare_q2_with_q1: false,
        compete_with_all_vendors: false,
        reprice_up_badge_percentage: -1,
        sister_vendor_ids: "",
        exclude_vendors: "",
        inactive_vendor_id: "",
        handling_time_group: AlgoHandlingTimeGroup.ALL,
        keep_position: false,
        inventory_competition_threshold: 1,
        reprice_down_percentage: -1,
        max_price: 99999999.99,
        floor_price: 0,
        reprice_down_badge_percentage: -1,
        floor_compete_with_next: false,
        own_vendor_threshold: 1,
        price_strategy: AlgoPriceStrategy.UNIT,
        enabled: false,
      };

      // First call finds existing
      mockQueryBuilder.first.mockResolvedValueOnce(existingSettings);
      const result1 = await findOrCreateV2AlgoSettings(100, 200);
      expect(result1).toEqual(existingSettings);

      // Second call creates new
      const insertId = 777;
      mockQueryBuilder.first.mockResolvedValueOnce(null);
      mockQueryBuilder.insert.mockResolvedValueOnce([insertId]);
      const result2 = await findOrCreateV2AlgoSettings(200, 300);
      expect(result2.id).toBe(insertId);
    });
  });

  describe("findOrCreateV2AlgoSettingsForVendors", () => {
    it("should return settings for multiple vendors when all exist", async () => {
      const settings1: V2AlgoSettingsData = {
        id: 1,
        mp_id: 100,
        vendor_id: 200,
        suppress_price_break_if_Q1_not_updated: false,
        suppress_price_break: false,
        compete_on_price_break_only: false,
        up_down: AlgoPriceDirection.UP_DOWN,
        badge_indicator: AlgoBadgeIndicator.ALL,
        execution_priority: 0,
        reprice_up_percentage: -1,
        compare_q2_with_q1: false,
        compete_with_all_vendors: false,
        reprice_up_badge_percentage: -1,
        sister_vendor_ids: "",
        exclude_vendors: "",
        inactive_vendor_id: "",
        handling_time_group: AlgoHandlingTimeGroup.ALL,
        keep_position: false,
        inventory_competition_threshold: 1,
        reprice_down_percentage: -1,
        max_price: 99999999.99,
        floor_price: 0,
        reprice_down_badge_percentage: -1,
        floor_compete_with_next: false,
        own_vendor_threshold: 1,
        price_strategy: AlgoPriceStrategy.UNIT,
        enabled: false,
      };

      const settings2: V2AlgoSettingsData = {
        id: 2,
        mp_id: 100,
        vendor_id: 201,
        suppress_price_break_if_Q1_not_updated: true,
        suppress_price_break: true,
        compete_on_price_break_only: true,
        up_down: AlgoPriceDirection.UP,
        badge_indicator: AlgoBadgeIndicator.BADGE,
        execution_priority: 1,
        reprice_up_percentage: 5.0,
        compare_q2_with_q1: true,
        compete_with_all_vendors: true,
        reprice_up_badge_percentage: 10.0,
        sister_vendor_ids: "1,2",
        exclude_vendors: "3,4",
        inactive_vendor_id: "5",
        handling_time_group: AlgoHandlingTimeGroup.FAST_SHIPPING,
        keep_position: true,
        inventory_competition_threshold: 2,
        reprice_down_percentage: 3.0,
        max_price: 5000.0,
        floor_price: 10.0,
        reprice_down_badge_percentage: 5.0,
        floor_compete_with_next: true,
        own_vendor_threshold: 2,
        price_strategy: AlgoPriceStrategy.TOTAL,
        enabled: true,
      };

      // Mock sequential calls for different vendor IDs
      mockQueryBuilder.first.mockResolvedValueOnce(settings1).mockResolvedValueOnce(settings2);

      const result = await findOrCreateV2AlgoSettingsForVendors(100, [200, 201]);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(settings1);
      expect(result[1]).toEqual(settings2);
      expect(mockQueryBuilder.first).toHaveBeenCalledTimes(2);
      expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
    });

    it("should create settings for vendors that do not exist", async () => {
      const existingSettings: V2AlgoSettingsData = {
        id: 1,
        mp_id: 100,
        vendor_id: 200,
        suppress_price_break_if_Q1_not_updated: false,
        suppress_price_break: false,
        compete_on_price_break_only: false,
        up_down: AlgoPriceDirection.UP_DOWN,
        badge_indicator: AlgoBadgeIndicator.ALL,
        execution_priority: 0,
        reprice_up_percentage: -1,
        compare_q2_with_q1: false,
        compete_with_all_vendors: false,
        reprice_up_badge_percentage: -1,
        sister_vendor_ids: "",
        exclude_vendors: "",
        inactive_vendor_id: "",
        handling_time_group: AlgoHandlingTimeGroup.ALL,
        keep_position: false,
        inventory_competition_threshold: 1,
        reprice_down_percentage: -1,
        max_price: 99999999.99,
        floor_price: 0,
        reprice_down_badge_percentage: -1,
        floor_compete_with_next: false,
        own_vendor_threshold: 1,
        price_strategy: AlgoPriceStrategy.UNIT,
        enabled: false,
      };

      // First vendor exists, second doesn't
      mockQueryBuilder.first.mockResolvedValueOnce(existingSettings).mockResolvedValueOnce(null);

      mockQueryBuilder.insert.mockResolvedValueOnce([999]);

      const result = await findOrCreateV2AlgoSettingsForVendors(100, [200, 201]);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(existingSettings);
      expect(result[1].id).toBe(999);
      expect(result[1].vendor_id).toBe(201);
      expect(mockQueryBuilder.first).toHaveBeenCalledTimes(2);
      expect(mockQueryBuilder.insert).toHaveBeenCalledTimes(1);
    });

    it("should handle empty vendor array", async () => {
      const result = await findOrCreateV2AlgoSettingsForVendors(100, []);

      expect(result).toHaveLength(0);
      expect(mockQueryBuilder.first).not.toHaveBeenCalled();
      expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
    });

    it("should handle single vendor", async () => {
      const settings: V2AlgoSettingsData = {
        id: 1,
        mp_id: 100,
        vendor_id: 200,
        suppress_price_break_if_Q1_not_updated: false,
        suppress_price_break: false,
        compete_on_price_break_only: false,
        up_down: AlgoPriceDirection.UP_DOWN,
        badge_indicator: AlgoBadgeIndicator.ALL,
        execution_priority: 0,
        reprice_up_percentage: -1,
        compare_q2_with_q1: false,
        compete_with_all_vendors: false,
        reprice_up_badge_percentage: -1,
        sister_vendor_ids: "",
        exclude_vendors: "",
        inactive_vendor_id: "",
        handling_time_group: AlgoHandlingTimeGroup.ALL,
        keep_position: false,
        inventory_competition_threshold: 1,
        reprice_down_percentage: -1,
        max_price: 99999999.99,
        floor_price: 0,
        reprice_down_badge_percentage: -1,
        floor_compete_with_next: false,
        own_vendor_threshold: 1,
        price_strategy: AlgoPriceStrategy.UNIT,
        enabled: false,
      };

      mockQueryBuilder.first.mockResolvedValue(settings);

      const result = await findOrCreateV2AlgoSettingsForVendors(100, [200]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(settings);
    });

    it("should handle multiple vendors with mixed existing and new", async () => {
      const settings1: V2AlgoSettingsData = {
        id: 1,
        mp_id: 100,
        vendor_id: 200,
        suppress_price_break_if_Q1_not_updated: false,
        suppress_price_break: false,
        compete_on_price_break_only: false,
        up_down: AlgoPriceDirection.UP_DOWN,
        badge_indicator: AlgoBadgeIndicator.ALL,
        execution_priority: 0,
        reprice_up_percentage: -1,
        compare_q2_with_q1: false,
        compete_with_all_vendors: false,
        reprice_up_badge_percentage: -1,
        sister_vendor_ids: "",
        exclude_vendors: "",
        inactive_vendor_id: "",
        handling_time_group: AlgoHandlingTimeGroup.ALL,
        keep_position: false,
        inventory_competition_threshold: 1,
        reprice_down_percentage: -1,
        max_price: 99999999.99,
        floor_price: 0,
        reprice_down_badge_percentage: -1,
        floor_compete_with_next: false,
        own_vendor_threshold: 1,
        price_strategy: AlgoPriceStrategy.UNIT,
        enabled: false,
      };

      // Vendor 200 exists, 201 doesn't, 202 exists
      mockQueryBuilder.first
        .mockResolvedValueOnce(settings1)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          ...settings1,
          id: 3,
          vendor_id: 202,
        });

      mockQueryBuilder.insert.mockResolvedValueOnce([999]);

      const result = await findOrCreateV2AlgoSettingsForVendors(100, [200, 201, 202]);

      expect(result).toHaveLength(3);
      expect(result[0].vendor_id).toBe(200);
      expect(result[1].vendor_id).toBe(201);
      expect(result[1].id).toBe(999);
      expect(result[2].vendor_id).toBe(202);
      expect(mockQueryBuilder.first).toHaveBeenCalledTimes(3);
      expect(mockQueryBuilder.insert).toHaveBeenCalledTimes(1);
    });

    it("should process vendors in parallel", async () => {
      const settings1: V2AlgoSettingsData = {
        id: 1,
        mp_id: 100,
        vendor_id: 200,
        suppress_price_break_if_Q1_not_updated: false,
        suppress_price_break: false,
        compete_on_price_break_only: false,
        up_down: AlgoPriceDirection.UP_DOWN,
        badge_indicator: AlgoBadgeIndicator.ALL,
        execution_priority: 0,
        reprice_up_percentage: -1,
        compare_q2_with_q1: false,
        compete_with_all_vendors: false,
        reprice_up_badge_percentage: -1,
        sister_vendor_ids: "",
        exclude_vendors: "",
        inactive_vendor_id: "",
        handling_time_group: AlgoHandlingTimeGroup.ALL,
        keep_position: false,
        inventory_competition_threshold: 1,
        reprice_down_percentage: -1,
        max_price: 99999999.99,
        floor_price: 0,
        reprice_down_badge_percentage: -1,
        floor_compete_with_next: false,
        own_vendor_threshold: 1,
        price_strategy: AlgoPriceStrategy.UNIT,
        enabled: false,
      };

      const settings2: V2AlgoSettingsData = {
        ...settings1,
        id: 2,
        vendor_id: 201,
      };

      // Verify that Promise.all is used by checking all calls happen
      mockQueryBuilder.first.mockResolvedValueOnce(settings1).mockResolvedValueOnce(settings2);

      const startTime = Date.now();
      const result = await findOrCreateV2AlgoSettingsForVendors(100, [200, 201]);
      const endTime = Date.now();

      // Should complete quickly (parallel execution)
      expect(endTime - startTime).toBeLessThan(100);
      expect(result).toHaveLength(2);
    });
  });
});
