import { Date } from "mongoose";
import { getKnexInstance } from "../knex-wrapper";
import { VendorNameLookup } from "@repricer-monorepo/shared";

export interface V2AlgoResultWithExecution {
  // From v2_algo_results table
  id: number;
  job_id: string;
  suggested_price: number | null;
  comment: string;
  triggered_by_vendor: string | null;
  result: string;
  quantity: number;
  vendor_id: number;
  vendor_name: string; // New field for vendor name
  mp_id: number;
  cron_name: string;
  created_at: Date;
  updated_at: Date;
  q_break_valid: boolean;
  price_update_result: string | null;

  // Only the HTML content from v2_algo_execution
  chain_of_thought_html: string | null;
}

export async function getAlgoResultsWithExecutionData(
  mpId: number,
): Promise<V2AlgoResultWithExecution[]> {
  const knex = getKnexInstance();

  const results = await knex("v2_algo_results as r")
    .select([
      "r.id",
      "r.job_id",
      "r.suggested_price",
      "r.comment",
      "r.triggered_by_vendor",
      "r.result",
      "r.quantity",
      "r.vendor_id",
      "r.mp_id",
      "r.cron_name",
      "r.created_at as run_time",
      "r.q_break_valid",
      "r.price_update_result",
      "r.new_price_breaks",
      knex.raw(`
        (SELECT e.chain_of_thought_html 
         FROM v2_algo_execution e 
         WHERE e.job_id = r.job_id AND e.vendor_id = r.vendor_id
         LIMIT 1) as chain_of_thought_html
      `),
    ])
    .where("r.mp_id", mpId)
    .orderBy("r.created_at", "desc");

  // Convert Buffer to string for chain_of_thought_html and add vendor name
  return results.map((result) => ({
    ...result,
    vendor_name:
      VendorNameLookup[result.vendor_id] || `Vendor ${result.vendor_id}`,
    chain_of_thought_html: result.chain_of_thought_html
      ? result.chain_of_thought_html.toString("utf-8")
      : null,
  }));
}
