import * as fs from "fs";
import * as path from "path";
import { applicationConfig } from "../../config";
import { V2AlgoSettingsData } from "../../mysql/v2-algo-settings";
import { Net32AlgoProduct, Net32AlgoProductWrapper } from "./types";
import { VendorId, VendorNameLookup } from "@repricer-monorepo/shared";
import {
  getHighestPriceBreakLessThanOrEqualTo,
  getTotalCostForQuantity,
  getTotalCostForQuantityWithUnitPriceOverride,
  hasBadge,
  Net32AlgoSolution,
  Net32AlgoSolutionWithQBreakValid,
} from "./algorithm";
import { Decimal } from "decimal.js";

export function createHtmlFileContent(
  mpId: number,
  net32Products: Net32AlgoProduct[],
  solutions: Net32AlgoSolutionWithQBreakValid[],
  net32url: string,
  jobId: string,
) {
  // Check if solutions is empty
  if (solutions.length === 0) {
    // Return minimal HTML with just basic info when no solutions
    const currentTime = new Date().toISOString();
    return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>repriceProductV3 Output - No Solutions</title>
    <style>
      body { margin-left: 20%; margin-right: 20%; }
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
    <p><strong>Job ID:</strong> ${jobId}</p>
    <h2>net32Products (JSON)</h2>
    <pre>${JSON.stringify(net32Products, null, 2)}</pre>
  </body>
  </html>`;
  }

  // Get vendor info from the first solution (all solutions are for the same vendor)
  const vendorId = solutions[0].vendor.vendorId;
  const vendorName = VendorNameLookup[vendorId] || `Vendor ${vendorId}`;
  const vendorSettings = solutions[0].vendorSettings;

  // --- Build sections for each quantity ---
  let newAlgoSections = "";

  // Group solutions by quantity
  const solutionsByQuantity = new Map<
    number,
    Net32AlgoSolutionWithQBreakValid[]
  >();
  for (const solution of solutions) {
    const quantity = solution.quantity;
    if (!solutionsByQuantity.has(quantity)) {
      solutionsByQuantity.set(quantity, []);
    }
    solutionsByQuantity.get(quantity)!.push(solution);
  }

  // Sort quantities in ascending order
  const sortedQuantities = Array.from(solutionsByQuantity.keys()).sort(
    (a, b) => a - b,
  );

  for (const quantity of sortedQuantities) {
    if (quantity === 0) continue; // Skip quantity 0

    const solutionsForQuantity = solutionsByQuantity.get(quantity)!;

    newAlgoSections += `<h2>Quantity: ${quantity}</h2>`;

    // Get beforeLadder from the first solution for this quantity
    const firstSolution = solutionsForQuantity[0];
    if (firstSolution.beforeLadder) {
      newAlgoSections +=
        `<b>Existing Board</b>` +
        buildBeforeLadderTable({
          quantity: quantity,
          ladder: firstSolution.beforeLadder.map((x: any) => x.product),
        });
    }

    newAlgoSections +=
      `<br/><br/><b>Price Solutions</b>` +
      buildSolutionsTable(solutionsForQuantity);

    // Add divider between quantities
    if (quantity < sortedQuantities[sortedQuantities.length - 1]) {
      newAlgoSections += `<hr style="margin: 40px 0; border: 2px solid #ccc;">`;
    }
  }

  const currentTime = new Date().toISOString();
  const htmlContent = `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>repriceProductV3 Output - ${vendorName}</title>
    <style>
      body { margin-left: 20%; margin-right: 20%; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ccc; padding: 8px; }
      th { background: #eee; }
      pre { background: #f8f8f8; padding: 10px; border: 1px solid #ccc; }
      .header { text-align: center; margin-bottom: 30px; }
      .header h1 { color: #333; margin-bottom: 10px; }
      .header p { color: #666; font-size: 16px; }
      .vendor-info { text-align: center; margin-bottom: 20px; }
      .vendor-info h2 { color: #555; margin-bottom: 5px; }
      .vendor-info p { color: #777; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>Product ID: ${mpId}</h1>
      <p>Generated at: ${currentTime} UTC</p>
    </div>
    ${net32url ? `<a href="${net32url}" target="_blank">${net32url}</a><br/><br/>` : ""}
    <div class="vendor-info">
      <h2>Vendor ID: ${vendorId}</h2>
      <p>Vendor Name: ${vendorName}</p>
      <p>Job ID: ${jobId}</p>
    </div>
    <h2>Vendor Settings</h2>
    ${buildVendorSettingsTableSingleVendor(vendorSettings)}
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
      `repriceProductV3_${mpId}_${vendorId}_${timestamp}.html`,
    );
    fs.writeFileSync(htmlFile, htmlContent, "utf8");
  }
  return htmlContent;
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

      // Check if this is one of our vendors (FRONTIER, MVP, TRADENT, FIRSTDENT, TOPDENT, TRIAD)
      const isOurVendor = Object.values(VendorId).includes(product.vendorId);
      const rowStyle = isOurVendor ? ' style="background: #ffff99;"' : "";

      const priceBreaksDisplay =
        product.priceBreaks.length > 1
          ? product.priceBreaks
              .map((pb) => `${pb.minQty}@${pb.unitPrice}`)
              .join(", ")
          : "";
      return `<tr${rowStyle}><td>${vendorName}</td><td>${unitPrice}</td><td>${product.standardShipping}</td><td>${totalPrice}</td><td>${product.freeShippingThreshold}</td><td>${product.shippingTime}</td><td>${product.inventory}</td><td>${priceBreaksDisplay}</td></tr>`;
    })
    .join("");

  return `<table>
    <thead>
      <tr><th>Vendor Name</th><th>Unit Price</th><th>Shipping Cost</th><th>Total</th><th>Shipping Threshold</th><th>Shipping Time</th><th>Inventory</th><th>Existing Price Breaks</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table><div><i>Rows highlighted in yellow are our vendors (FRONTIER, MVP, TRADENT, FIRSTDENT, TOPDENT).</i></div>`;
}

function buildSolutionsTable(solutions: Net32AlgoSolutionWithQBreakValid[]) {
  if (!solutions || solutions.length === 0) return "<p>No price solutions</p>";

  // Sort solutions by buyBoxRank (lower is better)
  const sortedSolutions = solutions.sort((a, b) => a.buyBoxRank - b.buyBoxRank);

  // Get all unique vendor IDs from solutions
  const allVendors = solutions.map((s) => s.vendor.vendorId);
  const sortedVendors = Array.from(new Set(allVendors)).sort((a, b) => a - b);

  // Create header with vendor columns
  const headerColumns = sortedVendors
    .map((vendorId) => {
      const vendorName = VendorNameLookup[vendorId] || vendorId;
      return `<th>${vendorName}</th>`;
    })
    .join("");

  let rows = sortedSolutions
    .map((solution, idx) => {
      // Create cells for each vendor
      const vendorCells = sortedVendors
        .map((vendorId) => {
          if (solution.vendor.vendorId === vendorId) {
            const bestPrice = solution.vendor.bestPrice;
            const priceDisplay = bestPrice
              ? bestPrice.toNumber().toString()
              : "N/A";
            return `<td>${priceDisplay}</td>`;
          }
          return "<td></td>"; // Empty cell if vendor not in this solution
        })
        .join("");

      return `<tr><td>${idx + 1}</td><td>${solution.solutionId}</td>${vendorCells}<td>${solution.buyBoxRank.toFixed(2)}</td></tr>`;
    })
    .join("");

  let result = `<table>
    <thead>
      <tr><th>Solution</th><th>Solution ID</th>${headerColumns}<th>Buy Box Rank</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;

  // Add shipping combinations tables for each solution
  for (let i = 0; i < sortedSolutions.length; i++) {
    const solution = sortedSolutions[i];
    const solutionNumber = i + 1;

    // Add solution header
    result += `<br/><br/><h3>Solution ${solutionNumber} (ID: ${solution.solutionId})</h3>`;

    // Add vendor view of board table for this solution
    result += `<br/><b>Vendor View Of Board for Solution ${solutionNumber}</b>`;
    result += buildVendorViewOfBoardTable(solution);

    // Add source combinations table for this solution
    result += `<br/><b>Local Post-Insert Board for Solution ${solutionNumber}</b>`;
    result += buildSourceCombinationsTable(solution);

    // Add results section for this solution
    result += `<br/><b>Results for Solution ${solutionNumber}</b>`;
    result += buildResultsTable(solution);
  }

  return result;
}

function buildSourceCombinationsTable(solution: Net32AlgoSolution) {
  if (
    !solution.postSolutionInsertBoard ||
    solution.postSolutionInsertBoard.length === 0
  ) {
    return "<p>No source combination available for this solution. </p>";
  }

  const rows = solution.postSolutionInsertBoard
    .map((product) => {
      const priceBreak = getHighestPriceBreakLessThanOrEqualTo(
        product,
        solution.quantity,
      );
      const unitPrice = product.bestPrice
        ? product.bestPrice
        : new Decimal(priceBreak.unitPrice);
      const totalCost = getTotalCostForQuantityWithUnitPriceOverride(
        product,
        solution.quantity,
        unitPrice,
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

      return `<tr${rowStyle}><td>${vendorName}</td><td>${unitPrice}</td><td>${product.standardShipping}</td><td>${totalCost}</td><td>${product.freeShippingThreshold}</td><td>${product.shippingTime}</td><td>${product.inventory}</td><td>${priceBreaksDisplay}</td></tr>`;
    })
    .join("");

  return `<table>
    <thead>
      <tr><th>Vendor Name</th><th>Unit Price</th><th>Shipping Cost</th><th>Total</th><th>Free Shipping Threshold</th><th>Shipping Time</th><th>Inventory</th><th>Existing Price Breaks</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table><div><i>Shows the source combination used for this solution. Rows highlighted in yellow are our vendors (FRONTIER, MVP, TRADENT, FIRSTDENT, TOPDENT, TRIAD).</i></div>`;
}

function buildVendorViewOfBoardTable(solution: Net32AlgoSolution) {
  if (
    !solution.everyoneFromViewOfOwnVendorRanked ||
    solution.everyoneFromViewOfOwnVendorRanked.length === 0
  ) {
    return "<p>No competitors or sisters available for this solution.</p>";
  }

  const rows = solution.everyoneFromViewOfOwnVendorRanked
    .map((productWrapper) => {
      const product = productWrapper.product;
      const unitPrice = productWrapper.effectiveUnitPrice;
      const totalCost = productWrapper.totalCost;
      const badge = hasBadge(product);
      const vendorName =
        product.vendorName + (badge ? ' <span title="Badge">🏅</span>' : "");

      // Check if this is one of our vendors (FRONTIER, MVP, TRADENT, FIRSTDENT, TOPDENT, TRIAD)
      const isOurVendor = Object.values(VendorId).includes(product.vendorId);
      const rowStyle = isOurVendor ? ' style="background: #ffff99;"' : "";

      const priceBreaksDisplay =
        product.priceBreaks.length > 1
          ? product.priceBreaks
              .map((pb) => `${pb.minQty}@${pb.unitPrice}`)
              .join(", ")
          : "";

      return `<tr${rowStyle}><td>${vendorName}</td><td>${unitPrice}</td><td>${product.standardShipping}</td><td>${totalCost}</td><td>${product.freeShippingThreshold}</td><td>${product.shippingTime}</td><td>${product.inventory}</td><td>${priceBreaksDisplay}</td><td>${productWrapper.buyBoxRank}</td></tr>`;
    })
    .join("");

  return `<table>
    <thead>
      <tr><th>Vendor Name</th><th>Unit Price</th><th>Shipping Cost</th><th>Total</th><th>Free Shipping Threshold</th><th>Shipping Time</th><th>Inventory</th><th>Existing Price Breaks</th><th>Buy Box Rank</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table><div><i>Shows the competitors and sisters ranked by their position in the board for this solution. Rows highlighted in yellow are our vendors (FRONTIER, MVP, TRADENT, FIRSTDENT, TOPDENT, TRIAD).</i></div>`;
}

function buildResultsTable(solution: Net32AlgoSolutionWithQBreakValid) {
  const result = solution.algoResult || "N/A";
  const qBreakValid = solution.qBreakValid ? "Yes" : "No";
  const comment = solution.comment || "N/A";
  const suggestedPrice =
    solution.suggestedPrice !== null
      ? solution.suggestedPrice.toString()
      : "N/A";
  const triggeredByVendor = solution.triggeredByVendor || "N/A";
  const rawTriggeredByVendor = solution.rawTriggeredByVendor || "N/A";

  return `<table style="margin-bottom: 10px; font-size: 0.9em;">
    <thead>
      <tr><th>Field</th><th>Value</th></tr>
    </thead>
    <tbody>
      <tr><td>Result</td><td>${result}</td></tr>
      <tr><td>Q-Break Valid</td><td>${qBreakValid}</td></tr>
      <tr><td>Q-Break Invalid Reason</td><td>${solution.qBreakInvalidReason ? solution.qBreakInvalidReason.join(", ") : "N/A"}</td></tr>
      <tr><td>Comment</td><td>${comment}</td></tr>
      <tr><td>Suggested Price</td><td>${suggestedPrice}</td></tr>
      <tr><td>Triggered By Vendor</td><td>${triggeredByVendor}</td></tr>
      <tr><td>Raw Triggered By Vendor</td><td>${rawTriggeredByVendor}</td></tr>
    </tbody>
  </table>`;
}

function buildVendorSettingsTableSingleVendor(
  vendorSetting: V2AlgoSettingsData,
) {
  if (!vendorSetting) {
    return "<p>No vendor settings available</p>";
  }

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
    { key: "floor_price", label: "Floor Price" },
    { key: "max_price", label: "Max Price" },
    { key: "floor_compete_with_next", label: "Floor Compete with Next" },
    {
      key: "own_vendor_threshold",
      label: "Own Vendor Threshold",
    },
    { key: "price_strategy", label: "Price Strategy" },
  ];

  // Create rows for each setting
  const rows = settingsFields
    .map((field) => {
      const value = vendorSetting[field.key];

      // Format the value based on type
      let displayValue: string;
      if (typeof value === "boolean") {
        displayValue = value ? "Yes" : "No";
      } else if (typeof value === "string" && value === "") {
        displayValue = "-";
      } else {
        displayValue = String(value);
      }

      return `<tr><td><strong>${field.label}</strong></td><td>${displayValue}</td></tr>`;
    })
    .join("");

  return `<table>
    <thead>
      <tr><th>Setting</th><th>Value</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}
