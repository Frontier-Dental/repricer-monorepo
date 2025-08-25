import express from "express";
import { authMiddleware } from "../middleware/auth-middleware";
import {
  getAllProductsForCron,
  getAlgoResultsWithExecution,
  getV2AlgoSettings,
  updateV2AlgoSettings,
  getAllV2AlgoErrorsController,
  updateV2AlgoOnlyController,
  getV2AlgoOnlyStatusController,
  syncVendorSettings,
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

// V2 Algo Error route
v2AlgoRouter.get("/get_all_algo_errors", getAllV2AlgoErrorsController);

// Update v2_algo_only field
v2AlgoRouter.put("/update_v2_algo_only/:mpId", updateV2AlgoOnlyController);

// Get v2_algo_only status
v2AlgoRouter.get(
  "/get_v2_algo_only_status/:mpId",
  getV2AlgoOnlyStatusController,
);

// Sync vendor settings for specific MP ID
v2AlgoRouter.post("/sync_vendor_settings/:mpId", syncVendorSettings);
