import { getKnexInstance } from "../../model/sql-models/knex-wrapper";

export interface V2AlgoExecutionData {
  scrape_product_id: number;
  time: Date;
  chain_of_thought_html: Buffer;
  comment: string;
}

export async function insertV2AlgoExecution(
  data: V2AlgoExecutionData,
): Promise<number> {
  const knex = getKnexInstance();

  const [insertId] = await knex("v2_algo_execution").insert({
    scrape_product_id: data.scrape_product_id,
    time: data.time,
    chain_of_thought_html: data.chain_of_thought_html,
    comment: data.comment,
  });

  return insertId;
}
