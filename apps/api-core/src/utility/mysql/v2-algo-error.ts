import {
  getKnexInstance,
  destroyKnexInstance,
} from "../../model/sql-models/knex-wrapper";
import { Net32Product } from "../../types/net32";

export interface V2AlgoError {
  error_message: string;
  net32_products: Net32Product[];
  mp_id: number;
  cron_name: string;
  created_at: Date;
}

export async function insertV2AlgoError(
  errorData: V2AlgoError,
): Promise<number> {
  const knex = getKnexInstance();

  const [insertId] = await knex("v2_algo_error").insert({
    created_at: errorData.created_at,
    error: errorData.error_message,
    net32_json: JSON.stringify(errorData.net32_products),
    mp_id: errorData.mp_id,
    cron_name: errorData.cron_name,
  });
  destroyKnexInstance();
  return insertId;
}
