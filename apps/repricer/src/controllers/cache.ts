import axios from "axios";
import * as cacheHelper from "../utility/cache-helper";
import { Request, Response } from "express";

export async function get_all_cache(req: Request, res: Response): Promise<any> {
  const cacheResponse: any = await GetAllCacheItems();
  return res.json({
    status: true,
    message: cacheResponse.data,
  });
}

export async function get_cache_item(
  req: Request,
  res: Response,
): Promise<any> {
  const _key = req.params.key;
  const getCacheItemUrl = `http://localhost:5001/cache/getCache/${_key}`;
  const config = {
    method: "get",
    url: getCacheItemUrl,
  };
  const getResponse = await axios(config);
  return res.json({
    status: true,
    message: getResponse.data,
  });
}

export async function delete_cache_item(
  req: Request,
  res: Response,
): Promise<any> {
  const _key = req.params.key;
  const deleteCacheUrl = `http://localhost:5001/cache/flush/${_key}`;
  const config = {
    method: "get",
    url: deleteCacheUrl,
  };
  const getResponse = await axios(config);
  return res.json({
    status: true,
    message: getResponse.data,
  });
}

export async function flush_all_cache(
  req: Request,
  res: Response,
): Promise<any> {
  const flushAllCacheUrl = `http://localhost:5001/cache/flush`;
  const config = {
    method: "get",
    url: flushAllCacheUrl,
  };
  const getResponse = await axios(config);
  return res.json({
    status: true,
    message: getResponse.data,
  });
}

export async function GetAllCacheItems(): Promise<any> {
  const getAllCacheUrl = `http://localhost:5001/cache/getall/`;
  const config = {
    method: "get",
    url: getAllCacheUrl,
  };
  return await axios(config);
}

export async function ClearRepricerCache(
  req: Request,
  res: Response,
): Promise<any> {
  await cacheHelper.FlushCache();
  return res.json({
    status: true,
    message: `All Cache Cleared.`,
  });
}
