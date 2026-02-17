// Mock shared package BEFORE imports
jest.mock("@repricer-monorepo/shared", () => ({
  VendorId: {
    TRADENT: 1,
    FRONTIER: 2,
    MVP: 3,
    TOPDENT: 4,
    FIRSTDENT: 5,
    TRIAD: 6,
    BITESUPPLY: 7,
  },
  VendorName: {
    TRADENT: "TRADENT",
    FRONTIER: "FRONTIER",
    MVP: "MVP",
    TOPDENT: "TOPDENT",
    FIRSTDENT: "FIRSTDENT",
    TRIAD: "TRIAD",
    BITESUPPLY: "BITESUPPLY",
  },
}));

import { getAllOwnVendorNames, isShortExpiryProduct, isChangeResult, getAllOwnVendorIds, getPriceListFormatted, getInternalProducts } from "../utility";
import { AlgoResult } from "../types";
import { VendorId, VendorName } from "@repricer-monorepo/shared";
import { Net32PriceBreak } from "../../../../types/net32";
import { ProductDetailsListItem } from "../../../mysql/mySql-mapper";

describe("reprice-algo/v2/utility", () => {
  describe("getAllOwnVendorNames", () => {
    it("should return all own vendor names", () => {
      const result = getAllOwnVendorNames();
      expect(result).toHaveLength(7);
      expect(result).toContainEqual({ name: VendorName.TRADENT });
      expect(result).toContainEqual({ name: VendorName.FRONTIER });
      expect(result).toContainEqual({ name: VendorName.MVP });
      expect(result).toContainEqual({ name: VendorName.TOPDENT });
      expect(result).toContainEqual({ name: VendorName.FIRSTDENT });
      expect(result).toContainEqual({ name: VendorName.TRIAD });
      expect(result).toContainEqual({ name: VendorName.BITESUPPLY });
    });
  });

  describe("isShortExpiryProduct", () => {
    it("should return true when price break has EXP in promoAddlDescr", () => {
      const priceBreaks: Net32PriceBreak[] = [
        {
          minQty: 1,
          price: 10,
          promoAddlDescr: "EXP 12/31/2024",
        } as any,
      ];

      expect(isShortExpiryProduct(priceBreaks, 1)).toBe(true);
    });

    it("should return false when price break does not have EXP in promoAddlDescr", () => {
      const priceBreaks: Net32PriceBreak[] = [
        {
          minQty: 1,
          price: 10,
          promoAddlDescr: "Regular product",
        } as any,
      ];

      expect(isShortExpiryProduct(priceBreaks, 1)).toBe(false);
    });

    it("should return false when price break for quantity is not found", () => {
      const priceBreaks: Net32PriceBreak[] = [
        {
          minQty: 1,
          price: 10,
          promoAddlDescr: "EXP 12/31/2024",
        } as any,
      ];

      expect(isShortExpiryProduct(priceBreaks, 2)).toBeFalsy();
    });

    it("should return false when promoAddlDescr is undefined", () => {
      const priceBreaks: Net32PriceBreak[] = [
        {
          minQty: 1,
          price: 10,
        } as any,
      ];

      expect(isShortExpiryProduct(priceBreaks, 1)).toBeFalsy();
    });

    it("should handle case-insensitive EXP matching", () => {
      const priceBreaks: Net32PriceBreak[] = [
        {
          minQty: 1,
          price: 10,
          promoAddlDescr: "exp 12/31/2024",
        } as any,
      ];

      expect(isShortExpiryProduct(priceBreaks, 1)).toBe(false); // includes is case-sensitive
    });
  });

  describe("isChangeResult", () => {
    it("should return true for CHANGE_UP", () => {
      expect(isChangeResult(AlgoResult.CHANGE_UP)).toBe(true);
    });

    it("should return true for CHANGE_DOWN", () => {
      expect(isChangeResult(AlgoResult.CHANGE_DOWN)).toBe(true);
    });

    it("should return true for CHANGE_NEW", () => {
      expect(isChangeResult(AlgoResult.CHANGE_NEW)).toBe(true);
    });

    it("should return false for IGNORE_SETTINGS", () => {
      expect(isChangeResult(AlgoResult.IGNORE_SETTINGS)).toBe(false);
    });

    it("should return false for IGNORE_FLOOR", () => {
      expect(isChangeResult(AlgoResult.IGNORE_FLOOR)).toBe(false);
    });

    it("should return false for ERROR", () => {
      expect(isChangeResult(AlgoResult.ERROR)).toBe(false);
    });
  });

  describe("getAllOwnVendorIds", () => {
    it("should return all own vendor IDs", () => {
      const result = getAllOwnVendorIds();
      expect(result).toHaveLength(7);
      expect(result).toContain(VendorId.TRADENT);
      expect(result).toContain(VendorId.FRONTIER);
      expect(result).toContain(VendorId.MVP);
      expect(result).toContain(VendorId.TOPDENT);
      expect(result).toContain(VendorId.FIRSTDENT);
      expect(result).toContain(VendorId.TRIAD);
      expect(result).toContain(VendorId.BITESUPPLY);
    });
  });

  describe("getPriceListFormatted", () => {
    it("should format price list correctly", () => {
      const priceList = [
        { minQty: 1, activeCd: 1, price: 10.5 },
        { minQty: 2, activeCd: 1, price: 9.99 },
        { minQty: 3, activeCd: 0, price: 8.5 },
      ];

      const result = getPriceListFormatted(priceList);
      expect(result).toBe("Q1@10.50, Q2@9.99, Q3@8.50REMOVED");
    });

    it("should handle missing price", () => {
      const priceList = [
        { minQty: 1, activeCd: 1, price: undefined },
        { minQty: 2, activeCd: 1, price: 9.99 },
      ];

      const result = getPriceListFormatted(priceList);
      expect(result).toBe("Q1@, Q2@9.99");
    });

    it("should handle empty price list", () => {
      const priceList: any[] = [];
      const result = getPriceListFormatted(priceList);
      expect(result).toBe("");
    });

    it("should handle REMOVED flag correctly", () => {
      const priceList = [
        { minQty: 1, activeCd: 0, price: 10.5 },
        { minQty: 2, activeCd: 1, price: 9.99 },
      ];

      const result = getPriceListFormatted(priceList);
      expect(result).toBe("Q1@10.50REMOVED, Q2@9.99");
    });
  });

  describe("getInternalProducts", () => {
    it("should return FRONTIER product when vendor is FRONTIER", () => {
      const prod: ProductDetailsListItem = {
        frontierDetails: {
          activated: true,
          floorPrice: "5.00",
          maxPrice: "20.00",
        },
      } as any;

      const allVendors = [{ name: VendorName.FRONTIER }];
      const result = getInternalProducts(prod, allVendors);

      expect(result).toHaveLength(1);
      expect(result[0].ownVendorId).toBe(VendorId.FRONTIER);
      expect(result[0].ownVendorName).toBe(VendorName.FRONTIER);
      expect(result[0].floorPrice).toBe(5.0);
      expect(result[0].maxPrice).toBe(20.0);
    });

    it("should return MVP product when vendor is MVP", () => {
      const prod: ProductDetailsListItem = {
        mvpDetails: {
          activated: true,
          floorPrice: "6.00",
          maxPrice: "25.00",
        },
      } as any;

      const allVendors = [{ name: VendorName.MVP }];
      const result = getInternalProducts(prod, allVendors);

      expect(result).toHaveLength(1);
      expect(result[0].ownVendorId).toBe(VendorId.MVP);
      expect(result[0].ownVendorName).toBe(VendorName.MVP);
    });

    it("should return TRADENT product when vendor is TRADENT", () => {
      const prod: ProductDetailsListItem = {
        tradentDetails: {
          activated: true,
          floorPrice: "7.00",
          maxPrice: "30.00",
        },
      } as any;

      const allVendors = [{ name: VendorName.TRADENT }];
      const result = getInternalProducts(prod, allVendors);

      expect(result).toHaveLength(1);
      expect(result[0].ownVendorId).toBe(VendorId.TRADENT);
    });

    it("should return FIRSTDENT product when vendor is FIRSTDENT", () => {
      const prod: ProductDetailsListItem = {
        firstDentDetails: {
          activated: true,
          floorPrice: "8.00",
          maxPrice: "35.00",
        },
      } as any;

      const allVendors = [{ name: VendorName.FIRSTDENT }];
      const result = getInternalProducts(prod, allVendors);

      expect(result).toHaveLength(1);
      expect(result[0].ownVendorId).toBe(VendorId.FIRSTDENT);
    });

    it("should return TOPDENT product when vendor is TOPDENT", () => {
      const prod: ProductDetailsListItem = {
        topDentDetails: {
          activated: true,
          floorPrice: "9.00",
          maxPrice: "40.00",
        },
      } as any;

      const allVendors = [{ name: VendorName.TOPDENT }];
      const result = getInternalProducts(prod, allVendors);

      expect(result).toHaveLength(1);
      expect(result[0].ownVendorId).toBe(VendorId.TOPDENT);
    });

    it("should return TRIAD product when vendor is TRIAD", () => {
      const prod: ProductDetailsListItem = {
        triadDetails: {
          activated: true,
          floorPrice: "10.00",
          maxPrice: "45.00",
        },
      } as any;

      const allVendors = [{ name: VendorName.TRIAD }];
      const result = getInternalProducts(prod, allVendors);

      expect(result).toHaveLength(1);
      expect(result[0].ownVendorId).toBe(VendorId.TRIAD);
    });

    it("should return BITESUPPLY product when vendor is BITESUPPLY", () => {
      const prod: ProductDetailsListItem = {
        biteSupplyDetails: {
          activated: true,
          floorPrice: "11.00",
          maxPrice: "50.00",
        },
      } as any;

      const allVendors = [{ name: VendorName.BITESUPPLY }];
      const result = getInternalProducts(prod, allVendors);

      expect(result).toHaveLength(1);
      expect(result[0].ownVendorId).toBe(VendorId.BITESUPPLY);
    });

    it("should throw error for unknown vendor", () => {
      const prod: ProductDetailsListItem = {} as any;
      const allVendors = [{ name: "UNKNOWN_VENDOR" as any }];

      expect(() => getInternalProducts(prod, allVendors)).toThrow("Unknown vendor: UNKNOWN_VENDOR");
    });

    it("should filter out null and non-activated products", () => {
      const prod: ProductDetailsListItem = {
        frontierDetails: {
          activated: false,
        },
        mvpDetails: {
          activated: true,
        },
        tradentDetails: null,
      } as any;

      const allVendors = [{ name: VendorName.FRONTIER }, { name: VendorName.MVP }, { name: VendorName.TRADENT }];
      const result = getInternalProducts(prod, allVendors);

      expect(result).toHaveLength(1);
      expect(result[0].ownVendorName).toBe(VendorName.MVP);
    });

    it("should handle missing floorPrice and maxPrice", () => {
      const prod: ProductDetailsListItem = {
        frontierDetails: {
          activated: true,
        },
      } as any;

      const allVendors = [{ name: VendorName.FRONTIER }];
      const result = getInternalProducts(prod, allVendors);

      expect(result).toHaveLength(1);
      expect(result[0].floorPrice).toBe(0);
      expect(result[0].maxPrice).toBe(Infinity);
    });

    it("should set priority based on index", () => {
      const prod: ProductDetailsListItem = {
        frontierDetails: { activated: true },
        mvpDetails: { activated: true },
      } as any;

      const allVendors = [{ name: VendorName.FRONTIER }, { name: VendorName.MVP }];
      const result = getInternalProducts(prod, allVendors);

      expect(result).toHaveLength(2);
      expect(result[0].priority).toBe(0);
      expect(result[1].priority).toBe(1);
    });

    it("should handle multiple vendors", () => {
      const prod: ProductDetailsListItem = {
        frontierDetails: { activated: true, floorPrice: "5.00", maxPrice: "20.00" },
        mvpDetails: { activated: true, floorPrice: "6.00", maxPrice: "25.00" },
        tradentDetails: { activated: true, floorPrice: "7.00", maxPrice: "30.00" },
      } as any;

      const allVendors = [{ name: VendorName.FRONTIER }, { name: VendorName.MVP }, { name: VendorName.TRADENT }];
      const result = getInternalProducts(prod, allVendors);

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.ownVendorName)).toEqual([VendorName.FRONTIER, VendorName.MVP, VendorName.TRADENT]);
    });
  });
});
