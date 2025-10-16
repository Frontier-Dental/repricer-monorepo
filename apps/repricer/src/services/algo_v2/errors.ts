import { getKnexInstance, destroyKnexInstance } from "../knex-wrapper";

export interface V2AlgoErrorRecord {
  id: number;
  created_at: Date;
  error: string;
  net32_json: string;
  mp_id: number;
  cron_name: string;
}

export async function getAllV2AlgoErrors(): Promise<V2AlgoErrorRecord[]> {
  const knex = getKnexInstance();

  const errors = await knex("v2_algo_error")
    .select("*")
    .orderBy("created_at", "desc");
  //destroyKnexInstance();
  return errors;
}
