import express from "express";
import * as cacheController from "../controllers/cache";
import { authMiddleware } from "../middleware/is-auth";

export const cacheRouter = express.Router();

cacheRouter.use(authMiddleware);
cacheRouter.get("/cache/get_all_cache", cacheController.get_all_cache);
cacheRouter.get("/cache/flush_all_cache", cacheController.flush_all_cache);
cacheRouter.get("/cache/get_cache_item/:key", cacheController.get_cache_item);
cacheRouter.get(
  "/cache/delete_cache_item/:key",
  cacheController.delete_cache_item,
);
cacheRouter.get(
  "/cache/flush_repricer_all",
  cacheController.ClearRepricerCache,
);
