import {
  getAllProductDetails,
  updateV2AlgoOnly,
  getV2AlgoOnlyStatus,
} from "../services/algo_v2/products";
import { Request, Response } from "express";
import { getAlgoResultsWithExecutionData } from "../services/algo_v2/results";
import {
  getV2AlgoSettingsByMpId,
  updateV2AlgoSettings as updateSettings,
} from "../services/algo_v2/settings";
import { getAllV2AlgoErrors } from "../services/algo_v2/errors";

// Cache for products data
let productsCache: any[] | null = null;
let productsCacheTime: Date | null = null;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

export async function getAllProductsForCron(
  req: Request<{ cronName: string }>,
  res: Response,
) {
  const ignoreCache = req.query.ignoreCache === "true";
  const now = new Date();

  // Check if we should use cache
  if (!ignoreCache && productsCache && productsCacheTime) {
    const cacheAge = now.getTime() - productsCacheTime.getTime();
    if (cacheAge < CACHE_DURATION) {
      console.log(
        `Returning cached products data (age: ${Math.round(cacheAge / 1000)}s)`,
      );
      return res.json({
        data: productsCache,
        cacheTimestamp: productsCacheTime.toISOString(),
        isCached: true,
      });
    }
  }

  console.log("Fetching fresh products data from database...");
  const result = await getAllProductDetails();

  // Update cache
  productsCache = result;
  productsCacheTime = now;

  console.log(`Updated products cache with ${result.length} records`);
  return res.json({
    data: result,
    cacheTimestamp: now.toISOString(),
    isCached: false,
  });
}

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
      not_cheapest: setting.not_cheapest === 1,
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

export async function updateV2AlgoOnlyController(
  req: Request<{ mpId: string }>,
  res: Response,
) {
  const { mpId } = req.params;
  const { v2_algo_only } = req.body;
  const mpIdNumber = parseInt(mpId, 10);

  if (isNaN(mpIdNumber)) {
    return res.status(400).json({
      error: "Invalid mp_id parameter. Must be a valid number.",
    });
  }

  if (typeof v2_algo_only !== "boolean") {
    return res.status(400).json({
      error: "v2_algo_only must be a boolean value.",
    });
  }

  const updatedRows = await updateV2AlgoOnly(mpIdNumber, v2_algo_only);

  if (updatedRows === 0) {
    return res.status(404).json({
      error: "Product not found with the specified mp_id.",
    });
  }

  return res.json({
    success: true,
    message: "v2_algo_only field updated successfully",
    mp_id: mpIdNumber,
    v2_algo_only: v2_algo_only,
    updated_rows: updatedRows,
  });
}

export async function getV2AlgoOnlyStatusController(
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

  const v2AlgoOnly = await getV2AlgoOnlyStatus(mpIdNumber);

  return res.json({
    success: true,
    mp_id: mpIdNumber,
    v2_algo_only: v2AlgoOnly,
  });
}
