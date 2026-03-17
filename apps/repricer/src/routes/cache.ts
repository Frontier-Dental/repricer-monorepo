import express from "express";
import * as cacheController from "../controllers/cache";
import { authMiddleware } from "../middleware/auth-middleware";
import { apiLimiter } from "../middleware/rate-limiter";
import { asyncHandler } from "../utility/async-handler";

export const cacheRouter = express.Router();

cacheRouter.use(apiLimiter);
//cacheRouter.use(authMiddleware);
cacheRouter.get("/get_all_cache", asyncHandler(cacheController.get_all_cache));
cacheRouter.get("/flush_all_cache", authMiddleware, asyncHandler(cacheController.flush_all_cache));
cacheRouter.get("/get_cache_item/:key", authMiddleware, asyncHandler(cacheController.get_cache_item));
cacheRouter.get("/delete_cache_item/:key", authMiddleware, asyncHandler(cacheController.delete_cache_item));
cacheRouter.get("/flush_repricer_all", authMiddleware, asyncHandler(cacheController.ClearRepricerCache));
