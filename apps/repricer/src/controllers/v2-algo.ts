import { AlgoExecutionMode } from "@repricer-monorepo/shared";
import { Request, Response } from "express";
import { getAllV2AlgoErrors } from "../services/algo_v2/errors";
import {
  getAlgoExecutionMode,
  updateAlgoExecutionMode,
} from "../services/algo_v2/products";
import { getAlgoResultsWithExecutionData } from "../services/algo_v2/results";
import {
  getAllProductsWithAlgoData,
  getNet32Url,
  getV2AlgoSettingsByMpId,
  syncAllVendorSettings,
  syncVendorSettingsForMpId,
  toggleV2AlgoEnabled,
  updateV2AlgoSettings as updateSettings,
} from "../services/algo_v2/settings";

export async function getAlgoResultsWithExecution(
  req: Request<{ mpId: string }>,
  res: Response,
) {
  const { mpId } = req.params;
  const mpIdNumber = parseInt(mpId, 10);

  if (isNaN(mpIdNumber)) {
    return res.status(400).json({
      error: "Invalid mp_id parameter. Must be a valid number.",
    });
  }

  const results = await getAlgoResultsWithExecutionData(mpIdNumber);

  return res.json({
    data: results,
    mp_id: mpIdNumber,
    count: results.length,
  });
}

export async function getV2AlgoSettings(
  req: Request<{ mpId: string }>,
  res: Response,
) {
  const { mpId } = req.params;
  const mpIdNumber = parseInt(mpId, 10);

  if (isNaN(mpIdNumber)) {
    return res.status(400).json({
      error: "Invalid mp_id parameter. Must be a valid number.",
    });
  }

  const settings = await getV2AlgoSettingsByMpId(mpIdNumber);
  const formattedSettings = settings.map((setting) => {
    return {
      ...setting,
      reprice_up_percentage: Number(setting.reprice_up_percentage),
      reprice_down_percentage: Number(setting.reprice_down_percentage),
      reprice_up_badge_percentage: Number(setting.reprice_up_badge_percentage),
      reprice_down_badge_percentage: Number(
        setting.reprice_down_badge_percentage,
      ),
      max_price: Number(setting.max_price),
      floor_price: Number(setting.floor_price),
      suppress_price_break: setting.suppress_price_break === 1,
      floor_compete_with_next: setting.floor_compete_with_next === 1,
      keep_position: setting.keep_position === 1,
      compare_q2_with_q1: setting.compare_q2_with_q1 === 1,
      compete_on_price_break_only: setting.compete_on_price_break_only === 1,
      suppress_price_break_if_Q1_not_updated:
        setting.suppress_price_break_if_Q1_not_updated === 1,
      compete_with_all_vendors: setting.compete_with_all_vendors === 1,
      enabled: setting.enabled === 1,
    };
  });

  return res.json({
    data: formattedSettings,
    mp_id: mpIdNumber,
    count: settings.length,
  });
}

export async function updateV2AlgoSettings(
  req: Request<{ mpId: string }>,
  res: Response,
) {
  const { mpId } = req.params;
  const mpIdNumber = parseInt(mpId, 10);
  const settingsData = req.body;

  if (isNaN(mpIdNumber)) {
    return res.status(400).json({
      error: "Invalid mp_id parameter. Must be a valid number.",
    });
  }

  // Validate required fields
  if (!settingsData.vendor_id) {
    return res.status(400).json({
      error: "vendor_id is required in request body",
    });
  }

  // Ensure mp_id matches the URL parameter
  if (settingsData.mp_id !== mpIdNumber) {
    return res.status(400).json({
      error: "mp_id in body must match mp_id in URL",
    });
  }

  const updatedId: number = await updateSettings(settingsData);

  return res.json({
    success: true,
    id: updatedId,
    message: "Settings updated successfully",
  });
}

export async function getAllV2AlgoErrorsController(
  req: Request,
  res: Response,
) {
  const errors = await getAllV2AlgoErrors();

  return res.json({
    data: errors,
    count: errors.length,
  });
}

export async function updateAlgoExecutionModeController(
  req: Request<{ mpId: string }>,
  res: Response,
) {
  const { mpId } = req.params;
  const { algo_execution_mode } = req.body;
  const mpIdNumber = parseInt(mpId, 10);

  if (isNaN(mpIdNumber)) {
    return res.status(400).json({
      error: "Invalid mp_id parameter. Must be a valid number.",
    });
  }

  // Validate the algo_execution_mode value
  const validModes = [
    AlgoExecutionMode.V2_ONLY,
    AlgoExecutionMode.V1_ONLY,
    AlgoExecutionMode.V2_EXECUTE_V1_DRY,
    AlgoExecutionMode.V1_EXECUTE_V2_DRY,
  ];
  if (!validModes.includes(algo_execution_mode)) {
    return res.status(400).json({
      error: `algo_execution_mode must be one of: ${validModes.join(", ")}`,
    });
  }

  const updatedRows = await updateAlgoExecutionMode(
    mpIdNumber,
    algo_execution_mode,
  );

  if (updatedRows === 0) {
    return res.status(404).json({
      error: "Product not found with the specified mp_id.",
    });
  }

  return res.json({
    success: true,
    message: "algo_execution_mode field updated successfully",
    mp_id: mpIdNumber,
    algo_execution_mode: algo_execution_mode,
    updated_rows: updatedRows,
  });
}

export async function getAlgoExecutionModeController(
  req: Request<{ mpId: string }>,
  res: Response,
) {
  const { mpId } = req.params;
  const mpIdNumber = parseInt(mpId, 10);

  if (isNaN(mpIdNumber)) {
    return res.status(400).json({
      error: "Invalid mp_id parameter. Must be a valid number.",
    });
  }

  const algoExecutionMode = await getAlgoExecutionMode(mpIdNumber);

  return res.json({
    success: true,
    mp_id: mpIdNumber,
    algo_execution_mode: algoExecutionMode,
  });
}

export async function syncVendorSettings(
  req: Request<{ mpId: string }>,
  res: Response,
) {
  const { mpId } = req.params;
  const mpIdNumber = parseInt(mpId, 10);

  if (isNaN(mpIdNumber)) {
    return res.status(400).json({
      error: "Invalid mp_id parameter. Must be a valid number.",
    });
  }

  const result = await syncVendorSettingsForMpId(mpIdNumber);

  return res.json({
    success: true,
    mp_id: mpIdNumber,
    message: `Successfully synced vendor settings for MP ID ${mpIdNumber}`,
    data: result,
  });
}

// Cache for products with algo data
let productsWithAlgoCache: any[] | null = null;
let productsWithAlgoCacheTime: Date | null = null;
const PRODUCTS_WITH_ALGO_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

export async function getAllProductsWithAlgoDataController(
  req: Request,
  res: Response,
) {
  const ignoreCache = req.query.ignoreCache === "true";
  const now = new Date();

  // Check if we should use cache
  if (!ignoreCache && productsWithAlgoCache && productsWithAlgoCacheTime) {
    const cacheAge = now.getTime() - productsWithAlgoCacheTime.getTime();
    if (cacheAge < PRODUCTS_WITH_ALGO_CACHE_DURATION) {
      console.log(
        `Returning cached products with algo data (age: ${Math.round(cacheAge / 1000)}s)`,
      );
      return res.json({
        data: productsWithAlgoCache,
        cacheTimestamp: productsWithAlgoCacheTime.toISOString(),
        isCached: true,
      });
    }
  }

  console.log("Fetching fresh products with algo data from database...");

  const products = await getAllProductsWithAlgoData();

  // Update cache
  productsWithAlgoCache = products;
  productsWithAlgoCacheTime = now;

  console.log(
    `Updated products with algo cache with ${products.length} records`,
  );
  return res.json({
    data: products,
    cacheTimestamp: now.toISOString(),
    isCached: false,
  });
}

export async function toggleV2AlgoEnabledController(
  req: Request<{ mpId: string; vendorId: string }>,
  res: Response,
) {
  const { mpId, vendorId } = req.params;
  const mpIdNumber = parseInt(mpId, 10);
  const vendorIdNumber = parseInt(vendorId, 10);

  if (isNaN(mpIdNumber)) {
    return res.status(400).json({
      error: "Invalid mp_id parameter. Must be a valid number.",
    });
  }

  if (isNaN(vendorIdNumber)) {
    return res.status(400).json({
      error: "Invalid vendor_id parameter. Must be a valid number.",
    });
  }

  const result = await toggleV2AlgoEnabled(mpIdNumber, vendorIdNumber);

  return res.json({
    success: true,
    mp_id: mpIdNumber,
    vendor_id: vendorIdNumber,
    enabled: result.enabled,
    message: `Successfully toggled enabled status to ${result.enabled}`,
  });
}

export async function getNet32UrlController(
  req: Request<{ mpId: string }>,
  res: Response,
) {
  const { mpId } = req.params;
  const mpIdNumber = parseInt(mpId, 10);

  if (isNaN(mpIdNumber)) {
    return res.status(400).json({
      error: "Invalid mp_id parameter. Must be a valid number.",
    });
  }

  try {
    const net32Url = await getNet32Url(mpIdNumber);

    return res.json({
      success: true,
      mp_id: mpIdNumber,
      net32_url: net32Url,
    });
  } catch (error) {
    console.error("Error fetching net32 URL:", error);
    return res.status(500).json({
      error: "Internal server error while fetching net32 URL",
    });
  }
}

export async function syncAllVendorSettingsController(
  req: Request,
  res: Response,
) {
  console.log("🚀 Starting sync of all vendor settings and channel IDs...");

  const result = await syncAllVendorSettings();

  return res.json({
    success: true,
    message: "Successfully synced all vendor settings and channel IDs",
    data: result,
  });
}
