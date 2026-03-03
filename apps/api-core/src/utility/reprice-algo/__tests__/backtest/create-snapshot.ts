/**
 * Creates a JSON snapshot of historical backtest data for offline testing.
 *
 * Usage:
 *   cd apps/api-core
 *   npx ts-node src/utility/reprice-algo/__tests__/backtest/create-snapshot.ts
 *
 * Environment variables:
 *   BACKTEST_SQL_HOST, BACKTEST_SQL_PORT, BACKTEST_SQL_USER,
 *   BACKTEST_SQL_PASSWORD, BACKTEST_SQL_DATABASE
 *   SNAPSHOT_DAYS    - How many days of data (default: 7)
 *   SNAPSHOT_LIMIT   - Max records (default: 200)
 *   SNAPSHOT_OUTPUT  - Output file path (default: ./backtest-snapshot.json)
 */

import { extractBacktestData, destroyBacktestKnex, saveSnapshot } from "./extract-data";
import path from "path";

async function main() {
  const days = Number(process.env.SNAPSHOT_DAYS ?? 7);
  const limit = Number(process.env.SNAPSHOT_LIMIT ?? 200);
  const output = process.env.SNAPSHOT_OUTPUT ?? path.join(__dirname, "backtest-snapshot.json");

  const dateTo = new Date();
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);

  console.log(`Extracting backtest data: last ${days} days, limit ${limit}`);
  console.log(`Date range: ${dateFrom.toISOString()} to ${dateTo.toISOString()}`);

  const records = await extractBacktestData({
    dateFrom,
    dateTo,
    limit,
    useV2Results: true,
  });

  if (records.length === 0) {
    console.error("No records found. Check your database connection and date range.");
    process.exit(1);
  }

  await saveSnapshot(records, output);
  console.log(`Snapshot saved to: ${output}`);

  await destroyBacktestKnex();
}

main().catch((err) => {
  console.error("Failed to create snapshot:", err);
  process.exit(1);
});
