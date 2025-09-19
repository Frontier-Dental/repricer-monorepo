import { getKnexInstance } from "../../model/sql-models/knex-wrapper";

export interface TinyproxyConfigData {
  id?: number;
  proxy_username: string;
  proxy_password: string;
  subscription_key: string;
  ip: string;
  port: number;
  vendor_id: number;
}

export async function findTinyproxyConfigByVendorId(
  vendorId: number,
): Promise<TinyproxyConfigData | null> {
  const knex = getKnexInstance();

  const result = await knex("tinyproxy_configs")
    .where({ vendor_id: vendorId })
    .first();

  return result || null;
}

export async function findTinyproxyConfigsByVendorIds(
  vendorIds: number[],
): Promise<TinyproxyConfigData[]> {
  const knex = getKnexInstance();

  const result = await knex("tinyproxy_configs").whereIn(
    "vendor_id",
    vendorIds,
  );

  return result;
}
