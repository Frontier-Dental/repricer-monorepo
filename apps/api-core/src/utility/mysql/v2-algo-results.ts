import { getKnexInstance } from "../../model/sql-models/knex-wrapper";
import { Decimal } from "decimal.js";

export interface V2AlgoResultData {
  job_id: string;
  suggested_price?: number | null;
  comment: string;
  triggered_by_vendor?: string | null;
  result: string;
  quantity: number;
  vendor_id: number;
  mp_id: number;
  cron_name: string;
  run_time: Date;
  q_break_valid: boolean;
  price_update_result?: string | null;
}

export async function insertV2AlgoResult(
  data: V2AlgoResultData,
): Promise<number> {
  const knex = getKnexInstance();

  const [insertId] = await knex("v2_algo_results").insert({
    job_id: data.job_id,
    suggested_price: data.suggested_price,
    comment: data.comment,
    triggered_by_vendor: data.triggered_by_vendor,
    result: data.result,
    quantity: data.quantity,
    vendor_id: data.vendor_id,
    mp_id: data.mp_id,
    cron_name: data.cron_name,
    run_time: data.run_time,
    q_break_valid: data.q_break_valid,
    price_update_result: data.price_update_result,
  });

  return insertId;
}

export async function insertMultipleV2AlgoResults(
  results: V2AlgoResultData[],
): Promise<number[]> {
  const knex = getKnexInstance();

  const insertIds = await knex("v2_algo_results").insert(results);
  return insertIds;
}

export async function findV2AlgoResultsByJobId(
  jobId: string,
): Promise<V2AlgoResultData[]> {
  const knex = getKnexInstance();

  return await knex("v2_algo_results").where("job_id", jobId).select("*");
}

export async function findV2AlgoResultsByMpId(
  mpId: number,
): Promise<V2AlgoResultData[]> {
  const knex = getKnexInstance();

  return await knex("v2_algo_results")
    .where("mp_id", mpId)
    .orderBy("run_time", "desc");
}

export async function findV2AlgoResultsByVendorId(
  vendorId: number,
  limit: number = 100,
): Promise<V2AlgoResultData[]> {
  const knex = getKnexInstance();

  return await knex("v2_algo_results")
    .where("vendor_id", vendorId)
    .orderBy("run_time", "desc")
    .limit(limit);
}
