import { getKnexInstance } from "../../model/sql-models/knex-wrapper";

export interface V2AlgoExecutionData {
  scrape_product_id: number;
  created_at: Date;
  expires_at: Date;
  chain_of_thought_html: Buffer;
  vendor_id: number;
  mp_id: number;
  job_id: string;
}

export async function insertV2AlgoExecution(
  data: V2AlgoExecutionData,
): Promise<number> {
  const knex = getKnexInstance();

  const [insertId] = await knex("v2_algo_execution").insert({
    scrape_product_id: data.scrape_product_id,
    created_at: data.created_at,
    expires_at: data.expires_at,
    chain_of_thought_html: data.chain_of_thought_html,
    vendor_id: data.vendor_id,
    mp_id: data.mp_id,
    job_id: data.job_id,
  });

  return insertId;
}
