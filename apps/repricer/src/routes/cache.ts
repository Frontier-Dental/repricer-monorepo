import express from "express";
import * as cacheController from "../controllers/cache";
import { authMiddleware } from "../middleware/auth-middleware";

export const cacheRouter = express.Router();

//cacheRouter.use(authMiddleware);
cacheRouter.get("/get_all_cache", cacheController.get_all_cache);
cacheRouter.get("/flush_all_cache", authMiddleware, cacheController.flush_all_cache);
cacheRouter.get("/get_cache_item/:key", authMiddleware, cacheController.get_cache_item);
cacheRouter.get("/delete_cache_item/:key", authMiddleware, cacheController.delete_cache_item);
cacheRouter.get("/flush_repricer_all", authMiddleware, cacheController.ClearRepricerCache);
