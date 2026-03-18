import express from "express";
import * as debugController from "../controllers/debug";
import { authMiddleware } from "../middleware/auth-middleware";
import { apiLimiter } from "../middleware/rate-limiter";
import { asyncHandler } from "../utility/async-handler";

export const debugRouter = express.Router();

//debugRouter.use(authMiddleware);
debugRouter.use(apiLimiter);

debugRouter.post("/delete_history", asyncHandler(debugController.DeleteHistory));

debugRouter.get("/reset_slow_cron_update", authMiddleware, asyncHandler(debugController.ResetSlowCronUpdate));
debugRouter.post("/refill_parent_cron", authMiddleware, asyncHandler(debugController.RefillParentCronDetails));
debugRouter.post("/correct_slow_cron", authMiddleware, asyncHandler(debugController.CorrectSlowCronDetails));

debugRouter.post("/map_vendor_to_root", authMiddleware, asyncHandler(debugController.MapVendorToRoot));

debugRouter.get("/get_floor_products", authMiddleware, asyncHandler(debugController.GetFloorBelowProducts));
debugRouter.post("/prod/delete_prod_history", authMiddleware, asyncHandler(debugController.DeleteProdHistory));
debugRouter.post("/archive_history", asyncHandler(debugController.ArchiveHistory));
