import { AlgoInput, AlgoRunner, NormalizedCategory, NormalizedDecision, VendorConfig } from "./normalized-types";

/**
 * Maps V1 "explained" strings (from RepriceRenewedMessageEnum and RepriceMessageEnum)
 * to normalized categories.
 *
 * V1 explained strings are freeform and may be concatenated with "_" separators.
 * We check from most-specific to least-specific.
 */
export function mapV1ExplainedToCategory(explained: string | null, isRepriced: boolean, oldPrice: number, newPrice: string | number | null): NormalizedCategory {
  if (!explained) return "ERROR";
  const upper = explained.toUpperCase();

  // --- IGNORE categories ---

  // Floor-related ignores (check before generic IGNORE)
  if (upper.includes("IGNORE") && upper.includes("#HITFLOOR")) {
    return "IGNORE_FLOOR";
  }
  if (upper.includes("IGNORE") && upper.includes("#LOGICALERROR")) {
    return "IGNORE_FLOOR"; // Logical error means price fell below floor
  }

  // Sister vendor ignore
  if (upper.includes("IGNORE") && upper.includes("#SISTER")) {
    return "IGNORE_SISTER";
  }
  if (upper.includes("IGNORE") && upper.includes("SISTER VENDOR")) {
    return "IGNORE_SISTER";
  }

  // Buy box ignore
  if (upper.includes("IGNORE") && upper.includes("#HASBUYBOX")) {
    return "IGNORE_BUYBOX";
  }

  // Own vendor is lowest
  if (upper.includes("IGNORE") && upper.includes("#LOWEST")) {
    return "IGNORE_LOWEST";
  }
  if (upper.includes("IGNORE") && upper.includes("ALREADY THE LOWEST")) {
    return "IGNORE_LOWEST";
  }

  // Direction rule ignores
  if (upper.includes("IGNORE") && upper.includes("#DOWN")) {
    return "IGNORE_SETTINGS";
  }
  if (upper.includes("IGNORE") && upper.includes("#UP")) {
    return "IGNORE_SETTINGS";
  }

  // Settings-related ignores (suppress, keep position, etc.)
  if (upper.includes("IGNORE") && (upper.includes("#SUPPRESSQBREAKRULE") || upper.includes("#SUPRESSQBREAKRULE"))) {
    return "IGNORE_SETTINGS";
  }
  if (upper.includes("IGNORE") && upper.includes("#KEEPPOSITION")) {
    return "IGNORE_SETTINGS";
  }
  if (upper.includes("IGNORE") && (upper.includes("#COMPETEONQBREAKSONLY") || upper.includes("#COMPETEONQBREAKONLY"))) {
    return "IGNORE_SETTINGS";
  }
  if (upper.includes("IGNORE") && upper.includes("NOT FOUND IN API")) {
    return "IGNORE_OTHER";
  }
  if (upper.includes("IGNORE") && upper.includes("NOT IN STOCK")) {
    return "IGNORE_OTHER";
  }
  if (upper.includes("IGNORE") && upper.includes("#OTHERBREAKSLOWER")) {
    return "IGNORE_SETTINGS";
  }

  // Generic ignore (catch-all for any remaining IGNORE)
  if (upper.includes("IGNORE") && !isRepriced) {
    return "IGNORE_OTHER";
  }

  // --- CHANGE categories ---

  if (upper.includes("CHANGE") || isRepriced) {
    // New price break
    if (upper.includes("NEW BREAK") || upper.includes("#NEW")) {
      return "CHANGE_NEW";
    }
    // QBreak made inactive
    if (upper.includes("INACTIVE")) {
      return "CHANGE_REMOVED";
    }
    // Determine direction from price comparison
    const numericNew = typeof newPrice === "number" ? newPrice : newPrice !== null && newPrice !== "N/A" ? parseFloat(newPrice) : null;
    if (numericNew !== null && !isNaN(numericNew)) {
      if (numericNew < oldPrice) return "CHANGE_DOWN";
      if (numericNew > oldPrice) return "CHANGE_UP";
    }
    // If MAXED, it is going up
    if (upper.includes("MAXED")) {
      return "CHANGE_UP";
    }
    return "CHANGE_DOWN"; // Default change direction if ambiguous
  }

  return "ERROR";
}

/**
 * Extracts tags from V1 explained strings.
 * V1 uses tags like #HitFloor, #Sister, #DOWN, #UP, #HasBuyBox, etc.
 */
export function extractV1Tags(explained: string | null): string[] {
  if (!explained) return [];
  const tags: string[] = [];
  const match = explained.match(/#\w+/g);
  if (match) {
    tags.push(...match);
  }
  return tags;
}

/**
 * V1 Adapter for cross-algo testing.
 *
 * Uses pre-computed mode: you provide V1 results as pre-computed
 * RepriceModel data (e.g. from golden file snapshots or recorded cron runs).
 * The adapter just normalizes them.
 */
export class V1Adapter implements AlgoRunner {
  name = "V1";

  private precomputedResults: V1PrecomputedResult[] = [];

  constructor(precomputedResults?: V1PrecomputedResult[]) {
    this.precomputedResults = precomputedResults ?? [];
  }

  setPrecomputedResults(results: V1PrecomputedResult[]): void {
    this.precomputedResults = results;
  }

  async run(input: AlgoInput): Promise<NormalizedDecision[]> {
    return this.precomputedResults.map((result) => {
      const category = mapV1ExplainedToCategory(result.explained, result.isRepriced, result.oldPrice, result.newPrice);

      const numericNew = typeof result.newPrice === "number" ? result.newPrice : result.newPrice !== null && result.newPrice !== "N/A" ? parseFloat(result.newPrice) : null;

      const suggestedPrice = numericNew !== null && !isNaN(numericNew) ? numericNew : null;

      return {
        vendorId: result.vendorId,
        quantity: result.minQty,
        existingPrice: result.oldPrice,
        suggestedPrice,
        shouldChange: result.isRepriced,
        category,
        tags: extractV1Tags(result.explained),
        rawExplained: result.explained ?? "",
      };
    });
  }
}

/**
 * Shape of a pre-computed V1 result.
 * Mirrors the relevant fields from RepriceData.
 */
export interface V1PrecomputedResult {
  vendorId: number;
  minQty: number;
  oldPrice: number;
  newPrice: string | number | null;
  isRepriced: boolean;
  explained: string | null;
  goToPrice?: string | number | null;
}
