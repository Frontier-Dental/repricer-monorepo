import express from "express";
import rateLimit from "express-rate-limit";
import * as helpController from "../controllers/help";
import { authMiddleware } from "../middleware/auth-middleware";
import AuthToken from "../middleware/auth-token";
import { applicationConfig } from "../utility/config";
import { apiLimiter } from "../middleware/rate-limiter";
import { asyncHandler } from "../utility/async-handler";

export const helpRouter = express.Router();
//helpRouter.use(authMiddleware);
helpRouter.use(apiLimiter);

helpRouter.get("/GetLogsById/:id", authMiddleware, asyncHandler(helpController.getLogsById));
helpRouter.get("/ProductDetails/:id", authMiddleware, asyncHandler(helpController.getProductDetails));
helpRouter.get("/healthCheck", authMiddleware, asyncHandler(helpController.doHealthCheck));
helpRouter.get("/ip_health_check", authMiddleware, asyncHandler(helpController.doIpHealthCheck));

helpRouter.get("/ip_ping_check", authMiddleware, asyncHandler(helpController.pingCheck));
helpRouter.get("/let_me_in", authMiddleware, asyncHandler(helpController.troubleshoot));
helpRouter.post("/check_ip_status", authMiddleware, asyncHandler(helpController.debugIp));
helpRouter.post("/check_ip_status_v2", authMiddleware, asyncHandler(helpController.debugIpV2));

helpRouter.get("/load_product/:id", authMiddleware, asyncHandler(helpController.loadProductDetails));

helpRouter.get("/updateSecretKey", authMiddleware, asyncHandler(helpController.updateCronSecretKey));

helpRouter.get("/create_cron/:count", authMiddleware, asyncHandler(helpController.createCrons));
helpRouter.get("/align_execution_priority", authMiddleware, asyncHandler(helpController.alignExecutionPriority));
helpRouter.get("/getProductDetailsById/:id", AuthToken, asyncHandler(helpController.getProductDetails));

helpRouter.post("/migrate/cron-settings", AuthToken, asyncHandler(helpController.migrateCronSettingsToSql));
