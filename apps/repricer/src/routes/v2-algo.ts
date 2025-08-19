import express from "express";
import { authMiddleware } from "../middleware/auth-middleware";
import {
  getAllProductsForCron,
  getAlgoResultsWithExecution,
  getV2AlgoSettings,
  updateV2AlgoSettings,
} from "../controllers/v2-algo";
export const v2AlgoRouter = express.Router();

v2AlgoRouter.use(authMiddleware);

v2AlgoRouter.get("/get_all_products_for_cron", getAllProductsForCron);
v2AlgoRouter.get(
  "/get_algo_results_with_execution/:mpId",
  getAlgoResultsWithExecution,
);
v2AlgoRouter.get("/get_algo_settings/:mpId", getV2AlgoSettings);
v2AlgoRouter.put("/update_algo_settings/:mpId", updateV2AlgoSettings);
