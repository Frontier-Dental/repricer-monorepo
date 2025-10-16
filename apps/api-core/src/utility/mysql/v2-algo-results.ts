import {
  getKnexInstance,
  destroyKnexInstance,
} from "../../model/sql-models/knex-wrapper";

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
  created_at?: Date;
  updated_at?: Date;
  q_break_valid: boolean;
  price_update_result?: string | null;
  new_price_breaks?: string | null;
  lowest_price: number | null;
  lowest_vendor_id: number | null;
}

export async function insertMultipleV2AlgoResults(
  results: V2AlgoResultData[],
): Promise<number[]> {
  const knex = getKnexInstance();

  const insertIds = await knex("v2_algo_results").insert(results);
  //destroyKnexInstance();
  return insertIds;
}
