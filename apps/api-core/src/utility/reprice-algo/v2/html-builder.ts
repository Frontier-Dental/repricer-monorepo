import { RepriceData, RepriceModel } from "../../../model/reprice-model";
import {
  InternalProduct,
  SimplifiedNet32Product,
  ExistingAnalytics,
  PriceSolutions,
  VendorNameLookup,
  AggregatePriceSolution,
} from "./types";
import { getShippingBucket, getTotalCost, hasBadge } from "./v2";
import * as fs from "fs";
import * as path from "path";

export function writeRepriceHtmlReport(
  mpid: string,
  internalProducts: InternalProduct[],
  net32Products: SimplifiedNet32Product[],
  priceSolutions: PriceSolutions,
  oldModelSolutions?: RepriceModel[],
) {
  try {
    const htmlDir = path.resolve(process.cwd(), "html");
    if (!fs.existsSync(htmlDir)) {
      fs.mkdirSync(htmlDir);
    }
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const htmlFile = path.join(
      htmlDir,
      `repriceProductV3_${mpid}_${timestamp}.html`,
    );
    // Get net32url from the first internalProduct, if present
    const net32url = internalProducts[0]?.net32url;

    // Build internal products table
    const internalProductsTable = buildInternalProductsTable(
      internalProducts,
      net32Products,
    );

    // --- Before tables for each quantity ---
    let newAlgoSections = "";
    for (const quantity of Object.keys(priceSolutions)) {
      const q = Number(quantity);
      newAlgoSections += `<h2>Quantity: ${q}</h2>`;
      newAlgoSections +=
        `<b>Price Solutions</b>` + buildPriceSolutionsTable(priceSolutions, q);
    }

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
    </style>
  </head>
  <body>
    ${net32url ? `<a href="${net32url}" target="_blank">${net32url}</a><br/><br/>` : ""}
    <h2>Internal Products</h2>
    ${internalProductsTable}
    <h2>New Algorithm</h2>
        ${newAlgoSections}
    <h2>net32Products (JSON)</h2>
    <pre>${JSON.stringify(net32Products, null, 2)}</pre>
    <hr style="margin:40px 0;border:3px solid #333;">
    ${oldModelSolutions && oldModelSolutions.length > 0 ? buildOldAlgorithmSection(oldModelSolutions) : ""}
  </body>
  </html>`;
    fs.writeFileSync(htmlFile, htmlContent, "utf8");
  } catch (err) {
    console.error("Failed to write HTML output:", err);
  }
}

export function buildInternalProductsTable(
  internalProducts: InternalProduct[],
  net32Products: SimplifiedNet32Product[],
) {
  const internalTableRows = internalProducts
    .map((p) => {
      const net32 = net32Products.find((n) => n.vendorId === p.ownVendorId);
      if (!net32) {
        return `<tr><td>${p.ownVendorId}(${p.ownVendorName})</td><td>N/A</td><td>N/A</td><td>N/A</td><td>N/A</td><td>N/A</td><td>N/A</td><td>N/A</td></tr>`;
      }
      const unitPrice = net32?.priceBreaks?.[0]?.unitPrice ?? "";
      const standardShipping = net32?.standardShipping ?? "";
      const freeShippingGap = net32?.freeShippingGap ?? "";
      const shippingBucket = net32 ? getShippingBucket(net32.shippingTime) : "";
      return `<tr><td>${p.ownVendorId}(${p.ownVendorName})</td><td>${p.floorPrice}</td><td>${p.maxPrice}</td><td>${p.priority}</td><td>${unitPrice}</td><td>${standardShipping}</td><td>${freeShippingGap}</td><td>${shippingBucket}</td></tr>`;
    })
    .join("");
  return `<table>
    <thead>
      <tr><th>ownVendorId</th><th>floorPrice</th><th>maxPrice</th><th>priority</th><th>unitPrice</th><th>standardShipping</th><th>freeShippingGap</th><th>shippingBucket</th></tr>
    </thead>
    <tbody>
      ${internalTableRows}
    </tbody>
  </table>`;
}

function buildProductTable(
  products: SimplifiedNet32Product[],
  quantity: number,
  ownVendorIds: number[],
) {
  if (!products || products.length === 0) return "<p>No products</p>";
  const rows = products
    .map((p) => {
      const priceBreak = p.priceBreaks.find((b) => b.minQty === quantity);
      const unitPrice = priceBreak ? priceBreak.unitPrice : "N/A";
      const totalPrice =
        priceBreak && typeof unitPrice === "number"
          ? getTotalCost(
              unitPrice,
              quantity,
              p.standardShipping || 0,
              p.freeShippingGap,
            )
          : "N/A";
      const shippingBucket = getShippingBucket(p.shippingTime);
      const badge = hasBadge(p);
      const vendorName =
        p.vendorName + (badge ? ' <span title="Badge">🏅</span>' : "");
      const isOwnVendor = ownVendorIds.includes(p.vendorId);
      const rowStyle = isOwnVendor ? ' style="background: #ffff99;"' : "";
      return `<tr${rowStyle}><td>${vendorName}</td><td>${unitPrice}</td><td>${totalPrice}</td><td>${shippingBucket} (${p.shippingTime} days)</td></tr>`;
    })
    .join("");
  return `<table><thead><tr><th>vendorName</th><th>unitPrice</th><th>totalPrice</th><th>shippingBucket (shippingTime)</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function buildPriceSolutionsTable(
  priceSolutions: PriceSolutions,
  quantity: number,
) {
  const solutions = priceSolutions[quantity];
  if (!solutions || solutions.length === 0) return "<p>No price solutions</p>";
  // Get all vendorIds in any solution
  const allVendorIds = Array.from(
    new Set(
      solutions.flatMap((sol) => sol.vendorPrices.map((vp) => vp.vendorId)),
    ),
  );
  let header =
    "<tr>" +
    allVendorIds.map((id) => `<th>${VendorNameLookup[id]}</th>`).join("") +
    "<th>averagePrice</th><th>totalRank</th><th>consideredConfigurations</th></tr>";
  let rows = solutions
    .map((sol, idx) => {
      const rowStyle = idx === 0 ? ' style="background: #b3e6b3;"' : "";
      return (
        `<tr${rowStyle}>` +
        allVendorIds
          .map(
            (id) =>
              `<td>${sol.vendorPrices.find((vp) => vp.vendorId === id)?.price !== undefined ? sol.vendorPrices.find((vp) => vp.vendorId === id)?.price : ""}</td>`,
          )
          .join("") +
        `<td>${sol.averagePrice.toFixed(2)}</td><td>${sol.totalRank}</td><td>${sol.consideredConfigurations}</td>` +
        "</tr>"
      );
    })
    .join("");
  return `<table><thead>${header}</thead><tbody>${rows}</tbody></table><div><i>The highlighted row (green) is the chosen solution (0th element).</i></div>`;
}

function buildOldAlgorithmSection(oldModelSolutions: RepriceModel[]) {
  let section = "<h2>Old Algorithm</h2>";
  for (const model of oldModelSolutions) {
    section += `<h3>${model.vendorName}</h3>`;
    section += buildOldAlgorithmTable(model.listOfRepriceDetails);
  }
  return section;
}

function buildOldAlgorithmTable(listOfRepriceDetails: RepriceData[]) {
  if (!listOfRepriceDetails || listOfRepriceDetails.length === 0)
    return "<p>No details available.</p>";
  const columns = [
    "minQty",
    "oldPrice",
    "newPrice",
    "isRepriced",
    "explained",
    "active",
    "goToPrice",
  ];
  let header =
    "<tr>" + columns.map((col) => `<th>${col}</th>`).join("") + "</tr>";
  let rows = listOfRepriceDetails
    .map((item) => {
      return (
        "<tr>" +
        columns
          .map((col) => {
            let val = item[col as keyof RepriceData];
            return `<td>${val !== undefined ? val : ""}</td>`;
          })
          .join("") +
        "</tr>"
      );
    })
    .join("");
  return `<table><thead>${header}</thead><tbody>${rows}</tbody></table>`;
}
