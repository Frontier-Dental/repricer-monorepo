import * as cronMiniErpController from "../controllers/cron-mini-erp";
import { authMiddleware } from "../middleware/auth-middleware";
import express from "express";

export const miniErpRouter = express.Router();

miniErpRouter.use(authMiddleware);

miniErpRouter.post(
  "/toggle_cron_status",
  cronMiniErpController.toggleCronStatus,
);
miniErpRouter.post("/recreate", cronMiniErpController.RecreateCron);
miniErpRouter.post(
  "/update_mini_erp_cron",
  cronMiniErpController.UpdateMiniErpCronExpression,
);
