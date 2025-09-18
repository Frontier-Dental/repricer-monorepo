import nodeCache from "node-cache";
import axios from "axios";
import { applicationConfig } from "./config";

const repricerCache = new nodeCache({ stdTTL: 0 });

export function Set(key: string, value: any) {
  repricerCache.set(key, value);
}

export function Has(key: string) {
  if (key) {
    return repricerCache.has(key);
  } else return false;
}

export function Get(key: string) {
  if (key) {
    return repricerCache.get(key);
  }
  return null;
}

export function GetAllCache() {
  return repricerCache.keys();
}

export function DeleteCacheByKey(key: string) {
  if (key) {
    return repricerCache.del(key);
  }
  return "";
}

export function FlushCache() {
  return repricerCache.flushAll();
}

export async function DeleteExternalCache(key: string) {
  const deleteCacheUrl = `${applicationConfig.REPRICER_API_BASE_URL}/cache/flush/${key}`;
  const config = {
    method: "get",
    url: deleteCacheUrl,
  };
  await axios(config);
}
