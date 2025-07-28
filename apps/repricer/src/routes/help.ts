import express from "express";
import * as helpController from "../controllers/help";
import { authMiddleware } from "../middleware/auth-middleware";

export const helpRouter = express.Router();

helpRouter.use(authMiddleware);

helpRouter.get("/GetLogsById/:id", helpController.getLogsById);
helpRouter.get("/ProductDetails/:id", helpController.getProductDetails);
helpRouter.get("/healthCheck", helpController.doHealthCheck);
helpRouter.get("/ip_health_check", helpController.doIpHealthCheck);

helpRouter.get("/ip_ping_check", helpController.pingCheck);
helpRouter.get("/let_me_in", helpController.troubleshoot);
helpRouter.post("/check_ip_status", helpController.debugIp);
helpRouter.post("/check_ip_status_v2", helpController.debugIpV2);

helpRouter.get("/load_product/:id", helpController.loadProductDetails);

helpRouter.get("/updateSecretKey", helpController.updateCronSecretKey);

helpRouter.get("/create_cron/:count", helpController.createCrons);
helpRouter.get(
  "/align_execution_priority",
  helpController.alignExecutionPriority,
);
helpRouter.get("/getProductDetailsById/:id", helpController.getProductDetails);
