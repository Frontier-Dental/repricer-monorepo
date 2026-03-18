import * as cronMiniErpController from "../controllers/cron-mini-erp";
import { authMiddleware } from "../middleware/auth-middleware";
import express from "express";
import { apiLimiter } from "../middleware/rate-limiter";
import { asyncHandler } from "../utility/async-handler";

export const miniErpRouter = express.Router();

miniErpRouter.use(authMiddleware);
miniErpRouter.use(apiLimiter);

miniErpRouter.post("/toggle_cron_status", asyncHandler(cronMiniErpController.toggleCronStatus));
miniErpRouter.post("/recreate", asyncHandler(cronMiniErpController.RecreateCron));
miniErpRouter.post("/update_mini_erp_cron", asyncHandler(cronMiniErpController.UpdateMiniErpCronExpression));
