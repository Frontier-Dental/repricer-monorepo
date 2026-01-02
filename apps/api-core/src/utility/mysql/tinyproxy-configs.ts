import { getKnexInstance, destroyKnexInstance } from "../../model/sql-models/knex-wrapper";

export interface TinyProxyConfigData {
  id?: number;
  proxy_username: string;
  proxy_password: string;
  subscription_key: string;
  ip: string;
  port: number;
  vendor_id: number;
}

export async function findTinyProxyConfigByVendorId(vendorId: number): Promise<TinyProxyConfigData | null> {
  const knex = getKnexInstance();
  const result = await knex("tinyproxy_configs").where({ vendor_id: vendorId }).first();
  return result || null;
}

export async function findTinyProxyConfigsByVendorIds(vendorIds: number[]): Promise<TinyProxyConfigData[]> {
  const knex = getKnexInstance();
  const result = await knex("tinyproxy_configs").whereIn("vendor_id", vendorIds);
  return result;
}
