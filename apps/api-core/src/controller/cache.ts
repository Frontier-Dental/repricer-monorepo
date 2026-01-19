import _ from "lodash";
import * as _codes from "http-status-codes";
import * as cacheHelper from "../utility/cache-helper";
import express, { Request, Response } from "express";

export const cacheController = express.Router();

cacheController.get("/cache/getall", async (req: Request, res: Response) => {
  const cacheResponse = cacheHelper.GetAllCache();
  res.status(_codes.StatusCodes.OK).json(cacheResponse);
});

cacheController.get("/cache/flush", async (req: Request, res: Response) => {
  cacheHelper.FlushCache();
  res.status(_codes.StatusCodes.OK).json(`Flushed all cache Successfully.`);
});

cacheController.get("/cache/flush/:key", async (req: Request, res: Response) => {
  const cacheKey = req.params.key;
  cacheHelper.DeleteCacheByKey(cacheKey);
  res.status(_codes.StatusCodes.OK).json(`Successfully deleted cache for key : ${cacheKey}`);
});

cacheController.get("/cache/getCache/:key", async (req: Request, res: Response) => {
  const cacheKey = req.params.key;
  const value = cacheHelper.Get(cacheKey);
  res.status(_codes.StatusCodes.OK).json(value);
});
