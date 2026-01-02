import express from "express";
import * as debugController from "../controllers/debug";
import { authMiddleware } from "../middleware/auth-middleware";

export const debugRouter = express.Router();

//debugRouter.use(authMiddleware);

debugRouter.post("/delete_history", debugController.DeleteHistory);

debugRouter.get(
  "/reset_slow_cron_update",
  authMiddleware,
  debugController.ResetSlowCronUpdate,
);
debugRouter.post(
  "/refill_parent_cron",
  authMiddleware,
  debugController.RefillParentCronDetails,
);
debugRouter.post(
  "/correct_slow_cron",
  authMiddleware,
  debugController.CorrectSlowCronDetails,
);

debugRouter.post(
  "/map_vendor_to_root",
  authMiddleware,
  debugController.MapVendorToRoot,
);

debugRouter.get(
  "/get_floor_products",
  authMiddleware,
  debugController.GetFloorBelowProducts,
);
debugRouter.post(
  "/prod/delete_prod_history",
  authMiddleware,
  debugController.DeleteProdHistory,
);
