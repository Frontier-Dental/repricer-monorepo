import express from "express";
import * as helpController from "../controllers/help";
import { authMiddleware } from "../middleware/is-auth";

export const helpRouter = express.Router();

helpRouter.use(authMiddleware);

helpRouter.get("/help/GetLogsById/:id", helpController.getLogsById);
helpRouter.get("/help/ProductDetails/:id", helpController.getProductDetails);
helpRouter.get("/help/healthCheck", helpController.doHealthCheck);
helpRouter.get("/help/ip_health_check", helpController.doIpHealthCheck);

helpRouter.get("/help/ip_ping_check", helpController.pingCheck);
helpRouter.get("/help/let_me_in", helpController.troubleshoot);
helpRouter.post("/help/check_ip_status", helpController.debugIp);
helpRouter.post("/help/check_ip_status_v2", helpController.debugIpV2);

helpRouter.get("/help/load_product/:id", helpController.loadProductDetails);

helpRouter.get("/help/updateSecretKey", helpController.updateCronSecretKey);

helpRouter.get("/help/create_cron/:count", helpController.createCrons);
helpRouter.get(
  "/help/align_execution_priority",
  helpController.alignExecutionPriority,
);
helpRouter.get(
  "/help/getProductDetailsById/:id",
  helpController.getProductDetails,
);
