import axios from "axios";
import * as cacheHelper from "../utility/cache-helper";
import { Request, Response } from "express";
import { applicationConfig } from "../utility/config";
import CacheClient from "../client/cacheClient";
import { GetCacheClientOptions } from "../client/cacheClient";

export async function get_all_cache(req: Request, res: Response): Promise<any> {
  const cacheClient = CacheClient.getInstance(GetCacheClientOptions(applicationConfig));
  const cacheItems = await cacheClient.getAllKeys(true);
  await cacheClient.disconnect();
  return res.json({
    status: true,
    message: cacheItems,
  });
}

export async function get_cache_item(req: Request, res: Response): Promise<any> {
  const _key = req.params.key;
  console.info(`Fetching cache item for key: ${_key}`);
  const cacheClient = CacheClient.getInstance(GetCacheClientOptions(applicationConfig));
  const value = await cacheClient.get<any>(_key);
  await cacheClient.disconnect();
  return res.json({
    status: true,
    message: value,
  });
}

export async function delete_cache_item(req: Request, res: Response): Promise<any> {
  const _key = req.params.key;
  console.info(`Deleting cache item for key: ${_key}`);
  const cacheClient = CacheClient.getInstance(GetCacheClientOptions(applicationConfig));
  const deleteCount = await cacheClient.delete(_key);
  await cacheClient.disconnect();
  return res.json({
    status: true,
    message: `Deleted ${deleteCount} item(s) with key ${_key}`,
  });
}

export async function flush_all_cache(req: Request, res: Response): Promise<any> {
  console.info("Flushing all cache items");
  const cacheClient = CacheClient.getInstance(GetCacheClientOptions(applicationConfig));
  await cacheClient.flushAll();
  await cacheClient.disconnect();
  return res.json({
    status: true,
    message: "All cache flushed successfully",
  });
}

export async function GetAllCacheItems(): Promise<any> {
  console.info("Fetching all cache items");
  const cacheClient: CacheClient = CacheClient.getInstance(GetCacheClientOptions(applicationConfig));
  const keys = await cacheClient.getAllKeys(false);
  await cacheClient.disconnect();
  return keys;
}

export async function ClearRepricerCache(req: Request, res: Response): Promise<any> {
  console.info("Clearing all repricer cache items");
  await cacheHelper.FlushCache();
  return res.json({
    status: true,
    message: `All Cache Cleared.`,
  });
}
