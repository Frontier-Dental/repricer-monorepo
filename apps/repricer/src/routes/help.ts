import express from "express";
import * as helpController from "../controllers/help";
import { authMiddleware } from "../middleware/auth-middleware";
import AuthToken from "../middleware/auth-token";

export const helpRouter = express.Router();

//helpRouter.use(authMiddleware);

helpRouter.get("/GetLogsById/:id", authMiddleware, helpController.getLogsById);
helpRouter.get(
  "/ProductDetails/:id",
  authMiddleware,
  helpController.getProductDetails,
);
helpRouter.get("/healthCheck", authMiddleware, helpController.doHealthCheck);
helpRouter.get(
  "/ip_health_check",
  authMiddleware,
  helpController.doIpHealthCheck,
);

helpRouter.get("/ip_ping_check", authMiddleware, helpController.pingCheck);
helpRouter.get("/let_me_in", authMiddleware, helpController.troubleshoot);
helpRouter.post("/check_ip_status", authMiddleware, helpController.debugIp);
helpRouter.post(
  "/check_ip_status_v2",
  authMiddleware,
  helpController.debugIpV2,
);

helpRouter.get(
  "/load_product/:id",
  authMiddleware,
  helpController.loadProductDetails,
);

helpRouter.get(
  "/updateSecretKey",
  authMiddleware,
  helpController.updateCronSecretKey,
);

helpRouter.get(
  "/create_cron/:count",
  authMiddleware,
  helpController.createCrons,
);
helpRouter.get(
  "/align_execution_priority",
  authMiddleware,
  helpController.alignExecutionPriority,
);
helpRouter.get(
  "/getProductDetailsById/:id",
  AuthToken,
  helpController.getProductDetails,
);

helpRouter.post(
  "/migrate/cron-settings",
  AuthToken,
  helpController.migrateCronSettingsToSql,
);
