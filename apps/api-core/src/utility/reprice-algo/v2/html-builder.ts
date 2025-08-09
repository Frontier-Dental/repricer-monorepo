import * as fs from "fs";
import * as path from "path";
import { applicationConfig } from "../../config";
import { V2AlgoSettingsData } from "../../mysql/v2-algo-settings";
import {
  InternalProduct,
  Net32AlgoProduct,
  VendorId,
  VendorNameLookup,
} from "./types";
import {
  getHighestPriceBreakLessThanOrEqualTo,
  getShippingBucket,
  getTotalCostForQuantity,
  getTotalCostFreeShippingOverride,
  hasBadge,
  Net32AlgoSolution,
  Net32AlgoSolutionWithCombination,
} from "./v2_algorithm";

export function createHtmlFileContent(
  mpId: number,
  internalProducts: InternalProduct[],
  net32Products: Net32AlgoProduct[],
  solutions: Net32AlgoSolution[],
  beforeLadders: { quantity: number; ladder: Net32AlgoProduct[] }[],
  unavailableInternalProducts?: InternalProduct[],
  invalidInitialSolutions?: Net32AlgoSolutionWithCombination[],
  vendorSettings?: V2AlgoSettingsData[],
) {
  // Get net32url from the first internalProduct, if present
  const net32url = internalProducts[0]?.net32url;

  // Build internal products table
  const availableInternalProductsTable = buildInternalProductsTable(
    internalProducts,
    net32Products,
  );

  // Build unavailable internal products table
  const unavailableInternalProductsTable = unavailableInternalProducts
    ? buildInternalProductsTable(unavailableInternalProducts, net32Products)
    : "<p>Unavailable products were not supplied.</p>";

  // Build vendor settings table
  const vendorSettingsTable = vendorSettings
    ? buildVendorSettingsTable(vendorSettings)
    : "<p>Vendor settings were not supplied.</p>";

  // --- Build sections for each quantity ---
  let newAlgoSections = "";
  for (const beforeLadder of beforeLadders) {
    const quantity = beforeLadder.quantity;
    if (quantity === 0) continue; // Skip quantity 0

    newAlgoSections += `<h2>Quantity: ${quantity}</h2>`;
    newAlgoSections +=
      `<b>Existing Board</b>` + buildBeforeLadderTable(beforeLadder);

    // Find solutions for this quantity
    const solutionsForQuantity = solutions.filter(
      (s) => s.quantity === quantity,
    );
    newAlgoSections +=
      `<br/><br/><b>Price Solutions</b>` +
      buildSolutionsTable(
        solutionsForQuantity,
        quantity,
        invalidInitialSolutions,
      );

    // Add divider between quantities
    if (quantity < beforeLadders[beforeLadders.length - 1].quantity) {
      newAlgoSections += `<hr style="margin: 40px 0; border: 2px solid #ccc;">`;
    }
  }

  const currentTime = new Date().toISOString();
  const htmlContent = `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>repriceProductV3 Output</title>
    <style>
      body { margin-left: 20%; margin-right: 20%; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ccc; padding: 8px; }
      th { background: #eee; }
      pre { background: #f8f8f8; padding: 10px; border: 1px solid #ccc; }
      .header { text-align: center; margin-bottom: 30px; }
      .header h1 { color: #333; margin-bottom: 10px; }
      .header p { color: #666; font-size: 16px; }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>Product ID: ${mpId}</h1>
      <p>Generated at: ${currentTime} UTC</p>
    </div>
    ${net32url ? `<a href="${net32url}" target="_blank">${net32url}</a><br/><br/>` : ""}
    <h2>Available Internal Products</h2>
    ${availableInternalProductsTable}
    <h2>Unavailable Internal Products (In 422)</h2>
    ${unavailableInternalProductsTable}
    <h2>Vendor Settings</h2>
    ${vendorSettingsTable}
        ${newAlgoSections}
    <h2>net32Products (JSON)</h2>
    <pre>${JSON.stringify(net32Products, null, 2)}</pre>
  </body>
  </html>`;

  const htmlDir = path.resolve(process.cwd(), "html");
  if (!fs.existsSync(htmlDir)) {
    fs.mkdirSync(htmlDir);
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  if (applicationConfig.WRITE_HTML_CHAIN_OF_THOUGHT_TO_FILE) {
    const htmlFile = path.join(
      htmlDir,
      `repriceProductV3_${mpId}_${timestamp}.html`,
    );
    fs.writeFileSync(htmlFile, htmlContent, "utf8");
  }
  return htmlContent;
}

export function buildInternalProductsTable(
  internalProducts: InternalProduct[],
  net32Products: Net32AlgoProduct[],
) {
  const internalTableRows = internalProducts
    .map((p) => {
      const net32 = net32Products.find((n) => n.vendorId === p.ownVendorId);
      if (!net32) {
        return `<tr><td>${p.ownVendorId}(${p.ownVendorName})</td><td>N/A</td><td>N/A</td><td>N/A</td><td>N/A</td><td>N/A</td></tr>`;
      }
      const standardShipping = net32?.standardShipping ?? "";
      const shippingBucket = net32 ? getShippingBucket(net32.shippingTime) : "";
      return `<tr><td>${p.ownVendorId}(${p.ownVendorName})</td><td>${p.floorPrice}</td><td>${p.maxPrice}</td><td>${p.priority}</td><td>${standardShipping}</td><td>${shippingBucket}</td></tr>`;
    })
    .join("");
  return `<table>
    <thead>
      <tr><th>ownVendorId</th><th>floorPrice</th><th>maxPrice</th><th>priority</th><th>standardShipping</th><th>shippingBucket</th></tr>
    </thead>
    <tbody>
      ${internalTableRows}
    </tbody>
  </table>`;
}

function buildBeforeLadderTable(beforeLadder: {
  quantity: number;
  ladder: Net32AlgoProduct[];
}) {
  const ladder = beforeLadder.ladder;
  if (!ladder || ladder.length === 0) {
    return "<p>No existing products</p>";
  }

  const rows = ladder
    .map((product) => {
      const priceBreak = getHighestPriceBreakLessThanOrEqualTo(
        product,
        beforeLadder.quantity,
      );
      const unitPrice = priceBreak.unitPrice;
      const totalPrice = getTotalCostForQuantity(
        product,
        beforeLadder.quantity,
      );
      const badge = hasBadge(product);
      const vendorName =
        product.vendorName + (badge ? ' <span title="Badge">🏅</span>' : "");

      // Check if this is one of our vendors (FRONTIER, MVP, TRADENT, FIRSTDENT, TOPDENT)
      const isOurVendor = Object.values(VendorId).includes(product.vendorId);
      const rowStyle = isOurVendor ? ' style="background: #ffff99;"' : "";

      const priceBreaksDisplay =
        product.priceBreaks.length > 1
          ? product.priceBreaks
              .map((pb) => `${pb.minQty}@${pb.unitPrice}`)
              .join(", ")
          : "";
      return `<tr${rowStyle}><td>${vendorName}</td><td>${unitPrice}</td><td>${product.standardShipping}</td><td>${totalPrice}</td><td>${product.freeShippingThreshold}</td><td>${product.freeShippingGap}</td><td>${product.shippingTime}</td><td>${priceBreaksDisplay}</td></tr>`;
    })
    .join("");

  return `<table>
    <thead>
      <tr><th>Vendor Name</th><th>Unit Price</th><th>Shipping Cost</th><th>Total</th><th>Shipping Threshold</th><th>Free Shipping Gap</th><th>Shipping Time</th><th>Existing Price Breaks</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table><div><i>Rows highlighted in yellow are our vendors (FRONTIER, MVP, TRADENT, FIRSTDENT, TOPDENT).</i></div>`;
}

function buildSolutionsTable(
  solutions: Net32AlgoSolution[],
  quantity: number,
  invalidInitialSolutions?: Net32AlgoSolutionWithCombination[],
) {
  if (!solutions || solutions.length === 0) return "<p>No price solutions</p>";

  // Sort solutions by averageRank (lower is better)
  const sortedSolutions = solutions.sort(
    (a, b) => a.averageRank - b.averageRank,
  );

  // Get all unique vendors from all solutions
  const allVendors = new Set<number>();
  sortedSolutions.forEach((solution) => {
    solution.solution.forEach((s) => {
      allVendors.add(s.vendorId);
    });
  });

  const sortedVendors = Array.from(allVendors).sort((a, b) => a - b);

  // Create header with vendor columns
  const headerColumns = sortedVendors
    .map((vendorId) => {
      const vendorName = VendorNameLookup[vendorId] || vendorId;
      return `<th>${vendorName}</th>`;
    })
    .join("");

  let rows = sortedSolutions
    .map((solution, idx) => {
      const rowStyle = idx === 0 ? ' style="background: #b3e6b3;"' : "";

      // Create cells for each vendor
      const vendorCells = sortedVendors
        .map((vendorId) => {
          const vendorInSolution = solution.solution.find(
            (s) => s.vendorId === vendorId,
          );
          if (!vendorInSolution) {
            return "<td></td>"; // Empty cell if vendor not in this solution
          }
          const bestPrice = vendorInSolution.bestPrice;
          const priceDisplay = bestPrice
            ? bestPrice.toNumber().toString()
            : "N/A";

          return `<td>${priceDisplay}</td>`;
        })
        .join("");

      return `<tr${rowStyle}><td>${idx + 1}</td><td>${solution.solutionId}</td>${vendorCells}<td>${solution.averageRank.toFixed(2)}</td></tr>`;
    })
    .join("");

  let result = `<table>
    <thead>
      <tr><th>Solution</th><th>Solution ID</th>${headerColumns}<th>Average Rank</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table><div><i>The highlighted row (green) is the best solution (lowest average rank).</i></div>`;

  // Add invalid initial solutions for this quantity right under the price solutions table
  if (invalidInitialSolutions) {
    const invalidSolutionsForQuantity = invalidInitialSolutions.filter(
      (s) => s.quantity === quantity,
    );
    if (invalidSolutionsForQuantity.length > 0) {
      result +=
        `<br/><br/><b>Invalid Initial Solutions</b>` +
        buildInvalidSolutionsTable(invalidSolutionsForQuantity, quantity);
    }
  }

  // Add shipping combinations tables for each solution
  for (let i = 0; i < sortedSolutions.length; i++) {
    const solution = sortedSolutions[i];
    const solutionNumber = i + 1;

    // Add solution header
    result += `<br/><br/><h3>Solution ${solutionNumber} (ID: ${solution.solutionId})</h3>`;

    // Add source combinations table for this solution
    result += `<br/><b>Source Combinations for Solution ${solutionNumber}</b>`;
    result += buildSolutionPriceTable(solution, solutionNumber, sortedVendors);
    result += buildSourceCombinationsTable(solution, solutionNumber);

    result += `<br/><br/><b>Shipping Combinations for Solution ${solutionNumber}</b>`;
    result += buildSolutionShippingCombinationsTable(solution, solutionNumber);
  }

  return result;
}

function buildInvalidSolutionsTable(
  invalidSolutions: Net32AlgoSolutionWithCombination[],
  quantity: number,
) {
  if (!invalidSolutions || invalidSolutions.length === 0) {
    return "<p>No invalid initial solutions</p>";
  }

  // Get all unique vendors from all invalid solutions
  const allVendors = new Set<number>();
  invalidSolutions.forEach((solution) => {
    solution.solution.forEach((s) => {
      allVendors.add(s.vendorId);
    });
  });

  const sortedVendors = Array.from(allVendors).sort((a, b) => a - b);

  // Create header with vendor columns
  const headerColumns = sortedVendors
    .map((vendorId) => {
      const vendorName = VendorNameLookup[vendorId] || vendorId;
      return `<th>${vendorName}</th>`;
    })
    .join("");

  let rows = invalidSolutions
    .map((solution, idx) => {
      // Create cells for each vendor
      const vendorCells = sortedVendors
        .map((vendorId) => {
          const vendorInSolution = solution.solution.find(
            (s) => s.vendorId === vendorId,
          );
          if (!vendorInSolution) {
            return "<td></td>"; // Empty cell if vendor not in this solution
          }
          const bestPrice = vendorInSolution.bestPrice;
          const priceDisplay = bestPrice
            ? bestPrice.toNumber().toString()
            : "N/A";

          return `<td>${priceDisplay}</td>`;
        })
        .join("");

      return `<tr style="background: #ffebee;"><td>${idx + 1}</td>${vendorCells}</tr>`;
    })
    .join("");

  return `<table>
    <thead>
      <tr><th>Invalid Solution</th>${headerColumns}</tr>
    </thead>
    <tbody>${rows}</tbody>
  </table><div><i>Invalid solutions are tinted in faint red. These solutions were rejected due to free shipping threshold violations.</i></div>`;
}

function buildSolutionShippingCombinationsTable(
  solution: Net32AlgoSolution,
  solutionNumber: number,
) {
  if (!solution.boardCombinations || solution.boardCombinations.length === 0) {
    return "<p>No shipping combinations available for this solution</p>";
  }

  // Get all unique vendors from all combinations
  const allVendors = new Set<string>();
  solution.boardCombinations.forEach((combination) => {
    combination.forEach((product) => {
      allVendors.add(product.vendorName);
    });
  });

  const sortedVendors = Array.from(allVendors).sort((a, b) =>
    a.localeCompare(b),
  );

  // Create header with vendor names
  const headerColumns = sortedVendors
    .map((vendorName) => `<th>${vendorName}</th>`)
    .join("");

  // Create rows
  const rows = solution.boardCombinations
    .map((combination, idx) => {
      const cells = sortedVendors
        .map((vendorName) => {
          const product = combination.find((p) => p.vendorName === vendorName);
          if (!product) {
            return "<td></td>"; // Empty cell if vendor not in this combination
          }
          return `<td>${product.freeShipping ? "" : "X"}</td>`;
        })
        .join("");

      const effectiveRank = solution.ranksForCombination[idx];
      return `<tr>${cells}<td>${effectiveRank}</td></tr>`;
    })
    .join("");

  return `<table>
    <thead>
      <tr>${headerColumns}<th>Effective Rank</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table><div><i>Each row represents a shipping combination for Solution ${solutionNumber}. "X" = paid shipping, blank = free shipping or vendor not present. Effective Rank shows the best rank achieved by our vendors in this combination.</i></div>`;
}

function buildSolutionPriceTable(
  solution: Net32AlgoSolution,
  solutionNumber: number,
  sortedVendors: number[],
) {
  // Create header with vendor columns
  const headerColumns = sortedVendors
    .map((vendorId) => {
      const vendorName = VendorNameLookup[vendorId] || vendorId;
      return `<th>${vendorName}</th>`;
    })
    .join("");

  // Create cells for the solution
  const vendorCells = sortedVendors
    .map((vendorId) => {
      const vendorInSolution = solution.solution.find(
        (s) => s.vendorId === vendorId,
      );
      if (!vendorInSolution) {
        return "<td></td>"; // Empty cell if vendor not in this solution
      }
      const bestPrice = vendorInSolution.bestPrice;
      const priceDisplay = bestPrice ? bestPrice.toNumber().toString() : "N/A";

      return `<td>${priceDisplay}</td>`;
    })
    .join("");

  return `<table style="margin-bottom: 10px; font-size: 0.9em;">
    <thead>
      <tr><th>Solution</th>${headerColumns}<th>Average Rank</th></tr>
    </thead>
    <tbody>
      <tr style="background: #b3e6b3;"><td>${solutionNumber}</td>${vendorCells}<td>${solution.averageRank.toFixed(2)}</td></tr>
    </tbody>
  </table>`;
}

function buildSourceCombinationsTable(
  solution: Net32AlgoSolution,
  solutionNumber: number,
) {
  if (
    !solution.postSolutionInsertBoard ||
    solution.postSolutionInsertBoard.length === 0
  ) {
    return "<p>No source combination available for this solution. This was a permutated solution, not from a specific board configuration.</p>";
  }

  const rows = solution.postSolutionInsertBoard
    .map((product) => {
      const priceBreak = getHighestPriceBreakLessThanOrEqualTo(
        product,
        solution.quantity,
      );
      const unitPrice = product.bestPrice
        ? product.bestPrice.toNumber()
        : priceBreak.unitPrice;
      const totalCost = getTotalCostFreeShippingOverride(
        unitPrice,
        solution.quantity,
        product.freeShipping,
        product.standardShipping,
      );
      const badge = hasBadge(product);
      const vendorName =
        product.vendorName + (badge ? ' <span title="Badge">🏅</span>' : "");

      // Check if this is one of our vendors (FRONTIER, MVP, TRADENT, FIRSTDENT, TOPDENT)
      const isOurVendor = Object.values(VendorId).includes(product.vendorId);
      const rowStyle = isOurVendor ? ' style="background: #ffff99;"' : "";

      const priceBreaksDisplay =
        product.priceBreaks.length > 1
          ? product.priceBreaks
              .map((pb) => `${pb.minQty}@${pb.unitPrice}`)
              .join(", ")
          : "";

      // Show blank cells for unit price and total if it's our vendor
      const unitPriceDisplay = unitPrice;
      const totalCostDisplay = totalCost;

      return `<tr${rowStyle}><td>${vendorName}</td><td>${unitPriceDisplay}</td><td>${product.standardShipping}</td><td>${totalCostDisplay}</td><td>${product.freeShippingThreshold}</td><td>${product.freeShipping}</td><td>${product.shippingTime}</td><td>${priceBreaksDisplay}</td></tr>`;
    })
    .join("");

  return `<table>
    <thead>
      <tr><th>Vendor Name</th><th>Unit Price</th><th>Shipping Cost</th><th>Total</th><th>Free Shipping Threshold</th><th>Free Shipping</th><th>Shipping Time</th><th>Existing Price Breaks</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table><div><i>Shows the source combination used for this solution. Rows highlighted in yellow are our vendors (FRONTIER, MVP, TRADENT, FIRSTDENT, TOPDENT).</i></div>`;
}

function buildVendorSettingsTable(vendorSettings: V2AlgoSettingsData[]) {
  if (!vendorSettings || vendorSettings.length === 0) {
    return "<p>No vendor settings available</p>";
  }

  // Get all unique vendor IDs and create header
  const vendorIds = [...new Set(vendorSettings.map((s) => s.vendor_id))].sort(
    (a, b) => a - b,
  );
  const headerColumns = vendorIds
    .map((vendorId) => {
      const vendorName = VendorNameLookup[vendorId] || `Vendor ${vendorId}`;
      return `<th>${vendorName}</th>`;
    })
    .join("");

  // Define all settings fields to show as rows
  const settingsFields: Array<{
    key: keyof Omit<V2AlgoSettingsData, "id" | "mp_id" | "vendor_id">;
    label: string;
  }> = [
    {
      key: "suppress_price_break_if_Q1_not_updated",
      label: "Suppress Price Break if Q1 Not Updated",
    },
    { key: "suppress_price_break", label: "Suppress Price Break" },
    {
      key: "compete_on_price_break_only",
      label: "Compete on Price Break Only",
    },
    { key: "up_down", label: "Up/Down" },
    { key: "badge_indicator", label: "Badge Indicator" },
    { key: "execution_priority", label: "Execution Priority" },
    { key: "reprice_up_percentage", label: "Reprice Up Percentage" },
    { key: "compare_q2_with_q1", label: "Compare Q2 with Q1" },
    { key: "compete_with_all_vendors", label: "Compete with All Vendors" },
    {
      key: "reprice_up_badge_percentage",
      label: "Reprice Up Badge Percentage",
    },
    { key: "sister_vendor_ids", label: "Sister Vendor IDs" },
    { key: "exclude_vendors", label: "Exclude Vendors" },
    { key: "inactive_vendor_id", label: "Inactive Vendor ID" },
    { key: "handling_time_group", label: "Handling Time Group" },
    { key: "keep_position", label: "Keep Position" },
    {
      key: "inventory_competition_threshold",
      label: "Inventory Competition Threshold",
    },
    { key: "reprice_down_percentage", label: "Reprice Down Percentage" },
    {
      key: "reprice_down_badge_percentage",
      label: "Reprice Down Badge Percentage",
    },
    { key: "floor_compete_with_next", label: "Floor Compete with Next" },
    { key: "ignore_phantom_q_break", label: "Ignore Phantom Q Break" },
    {
      key: "compete_with_own_quantity_0",
      label: "Compete with Own Quantity 0",
    },
    { key: "not_cheapest", label: "Not Cheapest" },
  ];

  // Create rows for each setting
  const rows = settingsFields
    .map((field) => {
      const cells = vendorIds
        .map((vendorId) => {
          const setting = vendorSettings.find((s) => s.vendor_id === vendorId);
          const value = setting ? setting[field.key] : "-";

          // Format the value based on type
          let displayValue: string;
          if (typeof value === "boolean") {
            displayValue = value ? "Yes" : "No";
          } else if (typeof value === "string" && value === "") {
            displayValue = "-";
          } else {
            displayValue = String(value);
          }

          return `<td>${displayValue}</td>`;
        })
        .join("");

      return `<tr><td><strong>${field.label}</strong></td>${cells}</tr>`;
    })
    .join("");

  return `<table>
    <thead>
      <tr><th>Setting</th>${headerColumns}</tr>
    </thead>
    <tbody>${rows}</tbody>
  </table><div><i>Each row represents a setting, and each column represents a vendor. Empty values are shown as '-'.</i></div>`;
}
