import express from "express";
import { authMiddleware } from "../middleware/auth-middleware";
import {
  getAlgoResultsWithExecution,
  getV2AlgoSettings,
  updateV2AlgoSettings,
  getAllV2AlgoErrorsController,
  updateAlgoExecutionModeController,
  getAlgoExecutionModeController,
  syncVendorSettings,
  getAllProductsWithAlgoDataController,
  toggleV2AlgoEnabledController,
  getNet32UrlController,
  syncAllVendorSettingsController,
} from "../controllers/v2-algo";
export const v2AlgoRouter = express.Router();

v2AlgoRouter.use(authMiddleware);

v2AlgoRouter.get(
  "/get_algo_results_with_execution/:mpId",
  getAlgoResultsWithExecution,
);
v2AlgoRouter.get("/get_algo_settings/:mpId", getV2AlgoSettings);
v2AlgoRouter.put("/update_algo_settings/:mpId", updateV2AlgoSettings);

// V2 Algo Error route
v2AlgoRouter.get("/get_all_algo_errors", getAllV2AlgoErrorsController);

// Update algo_execution_mode field
v2AlgoRouter.put(
  "/update_algo_execution_mode/:mpId",
  updateAlgoExecutionModeController,
);

// Get algo_execution_mode status
v2AlgoRouter.get(
  "/get_algo_execution_mode/:mpId",
  getAlgoExecutionModeController,
);

// Sync vendor settings for specific MP ID
v2AlgoRouter.post("/sync_vendor_settings/:mpId", syncVendorSettings);

// Get all products with algo data
v2AlgoRouter.get(
  "/get_all_products_with_algo_data",
  getAllProductsWithAlgoDataController,
);

// Toggle enabled status for specific mp_id and vendor_id
v2AlgoRouter.put(
  "/toggle_enabled/:mpId/:vendorId",
  toggleV2AlgoEnabledController,
);

// Get net32 URL from table_scrapeProductList
v2AlgoRouter.get("/get_net32_url/:mpId", getNet32UrlController);

// Sync all vendor settings and channel IDs across all tables
v2AlgoRouter.post("/sync_all_vendor_settings", syncAllVendorSettingsController);
