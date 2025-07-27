import express from "express";
import * as debugController from "../controllers/debug";
import { authMiddleware } from "../middleware/is-auth";

export const debugRouter = express.Router();

debugRouter.use(authMiddleware);

debugRouter.post("/debug/delete_history", debugController.DeleteHistory);

debugRouter.get(
  "/debug/reset_slow_cron_update",
  debugController.ResetSlowCronUpdate,
);
debugRouter.post(
  "/debug/refill_parent_cron",
  debugController.RefillParentCronDetails,
);
debugRouter.post(
  "/debug/correct_slow_cron",
  debugController.CorrectSlowCronDetails,
);

debugRouter.post("/debug/map_vendor_to_root", debugController.MapVendorToRoot);

debugRouter.get(
  "/debug/get_floor_products",
  debugController.GetFloorBelowProducts,
);
debugRouter.post(
  "/debug/live/delete_live_history",
  debugController.DeleteProdHistory,
);
