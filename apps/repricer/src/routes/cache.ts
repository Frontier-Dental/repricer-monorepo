import express from "express";
import * as cacheController from "../controllers/cache";
import { authMiddleware } from "../middleware/auth-middleware";

export const cacheRouter = express.Router();

cacheRouter.use(authMiddleware);
cacheRouter.get("/get_all_cache", cacheController.get_all_cache);
cacheRouter.get("/flush_all_cache", cacheController.flush_all_cache);
cacheRouter.get("/get_cache_item/:key", cacheController.get_cache_item);
cacheRouter.get("/delete_cache_item/:key", cacheController.delete_cache_item);
cacheRouter.get("/flush_repricer_all", cacheController.ClearRepricerCache);
