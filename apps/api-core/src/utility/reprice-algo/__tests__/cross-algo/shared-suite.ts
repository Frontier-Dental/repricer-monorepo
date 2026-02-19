import { AlgoInput, AlgoRunner, Net32AlgoProductInput, VendorConfig } from "./normalized-types";

// ---------------------------------------------------------------------------
// Test-data builder helpers
// ---------------------------------------------------------------------------

/** Minimal competitor product with sensible defaults */
function makeCompetitor(overrides: Partial<Net32AlgoProductInput> = {}): Net32AlgoProductInput {
  return {
    vendorId: 9000,
    vendorName: "Competitor A",
    inStock: true,
    standardShipping: 5,
    shippingTime: 2,
    inventory: 100,
    badgeId: 0,
    badgeName: null,
    priceBreaks: [{ minQty: 1, unitPrice: 10.0 }],
    freeShippingGap: 0,
    freeShippingThreshold: 100,
    ...overrides,
  };
}

/** Minimal "our vendor" product with sensible defaults */
function makeOwnVendor(overrides: Partial<Net32AlgoProductInput> = {}): Net32AlgoProductInput {
  return {
    vendorId: 100,
    vendorName: "Our Vendor",
    inStock: true,
    standardShipping: 5,
    shippingTime: 2,
    inventory: 100,
    badgeId: 0,
    badgeName: null,
    priceBreaks: [{ minQty: 1, unitPrice: 12.0 }],
    freeShippingGap: 0,
    freeShippingThreshold: 100,
    ...overrides,
  };
}

/** Default vendor config for "our vendor" */
function makeVendorConfig(overrides: Partial<VendorConfig> = {}): VendorConfig {
  return {
    vendorId: 100,
    vendorName: "Our Vendor",
    floorPrice: 5.0,
    maxPrice: 50.0,
    direction: "UP_DOWN",
    priceStrategy: "UNIT",
    enabled: true,
    sisterVendorIds: "",
    excludeVendors: "",
    competeWithAllVendors: false,
    floorCompeteWithNext: false,
    ownVendorThreshold: 1,
    inventoryCompetitionThreshold: 1,
    standardShipping: 5,
    freeShippingThreshold: 100,
    ...overrides,
  };
}

/** Build a complete AlgoInput from parts */
function makeInput(
  overrides: {
    ownVendor?: Partial<Net32AlgoProductInput>;
    competitors?: Partial<Net32AlgoProductInput>[];
    vendorConfig?: Partial<VendorConfig>;
    isSlowCron?: boolean;
  } = {}
): AlgoInput {
  const ownVendor = makeOwnVendor(overrides.ownVendor);
  const competitors = (overrides.competitors ?? [makeCompetitor()]).map((c) => makeCompetitor(c));
  const config = makeVendorConfig(overrides.vendorConfig);

  return {
    mpId: 12345,
    net32Products: [ownVendor, ...competitors],
    allOwnVendorIds: [ownVendor.vendorId],
    non422VendorIds: [ownVendor.vendorId],
    vendorConfigs: [config],
    isSlowCron: overrides.isSlowCron ?? false,
  };
}

// ---------------------------------------------------------------------------
// Shared test suite
// ---------------------------------------------------------------------------

/**
 * Runs universal algorithm tests against any AlgoRunner implementation.
 *
 * Usage:
 *   import { V2Adapter } from './v2-adapter';
 *   import { runSharedAlgoTests } from './shared-suite';
 *   runSharedAlgoTests(new V2Adapter());
 */
export function runSharedAlgoTests(runner: AlgoRunner) {
  describe(`${runner.name}: Universal Pricing Rules`, () => {
    // -----------------------------------------------------------------------
    // Floor enforcement
    // -----------------------------------------------------------------------
    it("should never suggest a price below floor", async () => {
      const input = makeInput({
        ownVendor: {
          vendorId: 100,
          priceBreaks: [{ minQty: 1, unitPrice: 6.0 }],
        },
        competitors: [
          {
            vendorId: 9000,
            priceBreaks: [{ minQty: 1, unitPrice: 3.0 }],
          },
        ],
        vendorConfig: { vendorId: 100, floorPrice: 5.0, maxPrice: 50.0 },
      });

      const decisions = await runner.run(input);
      for (const d of decisions) {
        if (d.suggestedPrice !== null) {
          expect(d.suggestedPrice).toBeGreaterThanOrEqual(5.0);
        }
        if (d.category === "IGNORE_FLOOR") {
          expect(d.shouldChange).toBe(false);
        }
      }
    });

    // -----------------------------------------------------------------------
    // Max price enforcement
    // -----------------------------------------------------------------------
    it("should never suggest a price above max", async () => {
      const input = makeInput({
        ownVendor: {
          vendorId: 100,
          priceBreaks: [{ minQty: 1, unitPrice: 10.0 }],
        },
        competitors: [],
        vendorConfig: { vendorId: 100, floorPrice: 5.0, maxPrice: 20.0 },
      });

      const decisions = await runner.run(input);
      for (const d of decisions) {
        if (d.suggestedPrice !== null) {
          expect(d.suggestedPrice).toBeLessThanOrEqual(20.0);
        }
      }
    });

    // -----------------------------------------------------------------------
    // Own vendor already lowest
    // -----------------------------------------------------------------------
    it("should detect when own vendor is already lowest", async () => {
      const input = makeInput({
        ownVendor: {
          vendorId: 100,
          priceBreaks: [{ minQty: 1, unitPrice: 8.0 }],
        },
        competitors: [
          {
            vendorId: 9000,
            priceBreaks: [{ minQty: 1, unitPrice: 12.0 }],
          },
        ],
        vendorConfig: {
          vendorId: 100,
          floorPrice: 5.0,
          maxPrice: 50.0,
          direction: "DOWN",
        },
      });

      const decisions = await runner.run(input);
      const q1Decisions = decisions.filter((d) => d.quantity === 1);
      expect(q1Decisions.length).toBeGreaterThan(0);

      for (const d of q1Decisions) {
        expect(d.shouldChange).toBe(false);
      }
    });

    // -----------------------------------------------------------------------
    // Empty competitor list
    // -----------------------------------------------------------------------
    it("should handle empty competitor list gracefully", async () => {
      const input = makeInput({
        ownVendor: {
          vendorId: 100,
          priceBreaks: [{ minQty: 1, unitPrice: 10.0 }],
        },
        competitors: [],
        vendorConfig: { vendorId: 100, floorPrice: 5.0, maxPrice: 25.0 },
      });

      const decisions = await runner.run(input);
      expect(decisions).toBeDefined();
      for (const d of decisions) {
        if (d.suggestedPrice !== null) {
          expect(d.suggestedPrice).toBeGreaterThanOrEqual(5.0);
          expect(d.suggestedPrice).toBeLessThanOrEqual(25.0);
        }
      }
    });

    // -----------------------------------------------------------------------
    // Direction rule: only UP
    // -----------------------------------------------------------------------
    it("should respect direction rule: only up", async () => {
      const input = makeInput({
        ownVendor: {
          vendorId: 100,
          priceBreaks: [{ minQty: 1, unitPrice: 10.0 }],
        },
        competitors: [
          {
            vendorId: 9000,
            priceBreaks: [{ minQty: 1, unitPrice: 8.0 }],
          },
        ],
        vendorConfig: {
          vendorId: 100,
          floorPrice: 5.0,
          maxPrice: 50.0,
          direction: "UP",
        },
      });

      const decisions = await runner.run(input);
      const q1Decisions = decisions.filter((d) => d.quantity === 1);

      for (const d of q1Decisions) {
        if (d.shouldChange && d.suggestedPrice !== null) {
          expect(d.suggestedPrice).toBeGreaterThanOrEqual(d.existingPrice);
        }
      }
    });

    // -----------------------------------------------------------------------
    // Direction rule: only DOWN
    // -----------------------------------------------------------------------
    it("should respect direction rule: only down", async () => {
      const input = makeInput({
        ownVendor: {
          vendorId: 100,
          priceBreaks: [{ minQty: 1, unitPrice: 15.0 }],
        },
        competitors: [
          {
            vendorId: 9000,
            priceBreaks: [{ minQty: 1, unitPrice: 20.0 }],
          },
        ],
        vendorConfig: {
          vendorId: 100,
          floorPrice: 5.0,
          maxPrice: 50.0,
          direction: "DOWN",
        },
      });

      const decisions = await runner.run(input);
      const q1Decisions = decisions.filter((d) => d.quantity === 1);

      for (const d of q1Decisions) {
        if (d.shouldChange && d.suggestedPrice !== null) {
          expect(d.suggestedPrice).toBeLessThanOrEqual(d.existingPrice);
        }
      }
    });

    // -----------------------------------------------------------------------
    // Sister vendor handling
    // -----------------------------------------------------------------------
    it("should handle sister vendor as lowest", async () => {
      const sisterVendor = makeCompetitor({
        vendorId: 200,
        vendorName: "Sister Vendor",
        priceBreaks: [{ minQty: 1, unitPrice: 7.0 }],
      });

      const externalCompetitor = makeCompetitor({
        vendorId: 9000,
        vendorName: "External",
        priceBreaks: [{ minQty: 1, unitPrice: 15.0 }],
      });

      const input: AlgoInput = {
        mpId: 12345,
        net32Products: [
          makeOwnVendor({
            vendorId: 100,
            priceBreaks: [{ minQty: 1, unitPrice: 12.0 }],
          }),
          sisterVendor,
          externalCompetitor,
        ],
        allOwnVendorIds: [100, 200],
        non422VendorIds: [100, 200],
        vendorConfigs: [
          makeVendorConfig({
            vendorId: 100,
            competeWithAllVendors: false,
            sisterVendorIds: "200",
          }),
          makeVendorConfig({
            vendorId: 200,
            floorPrice: 5.0,
            maxPrice: 50.0,
            enabled: true,
          }),
        ],
        isSlowCron: false,
      };

      const decisions = await runner.run(input);
      const ourQ1 = decisions.filter((d) => d.vendorId === 100 && d.quantity === 1);

      for (const d of ourQ1) {
        if (d.category === "IGNORE_SISTER") {
          expect(d.shouldChange).toBe(false);
        }
      }
    });

    // -----------------------------------------------------------------------
    // Standard undercut scenario
    // -----------------------------------------------------------------------
    it("should undercut competitor when possible", async () => {
      const input = makeInput({
        ownVendor: {
          vendorId: 100,
          priceBreaks: [{ minQty: 1, unitPrice: 12.0 }],
        },
        competitors: [
          {
            vendorId: 9000,
            priceBreaks: [{ minQty: 1, unitPrice: 10.5 }],
          },
        ],
        vendorConfig: {
          vendorId: 100,
          floorPrice: 5.0,
          maxPrice: 50.0,
          direction: "UP_DOWN",
        },
      });

      const decisions = await runner.run(input);
      const q1Decisions = decisions.filter((d) => d.quantity === 1);

      expect(q1Decisions.length).toBeGreaterThan(0);
      const changeDecisions = q1Decisions.filter((d) => d.shouldChange);

      if (changeDecisions.length > 0) {
        for (const d of changeDecisions) {
          expect(d.suggestedPrice).not.toBeNull();
          expect(d.suggestedPrice!).toBeLessThan(10.5);
          expect(d.suggestedPrice!).toBeGreaterThanOrEqual(5.0);
        }
      }
    });
  });
}
