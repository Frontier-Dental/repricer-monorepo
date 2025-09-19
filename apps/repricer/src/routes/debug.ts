import express from "express";
import * as debugController from "../controllers/debug";
import { authMiddleware } from "../middleware/auth-middleware";

export const debugRouter = express.Router();

debugRouter.use(authMiddleware);

debugRouter.post("/delete_history", debugController.DeleteHistory);

debugRouter.get("/reset_slow_cron_update", debugController.ResetSlowCronUpdate);
debugRouter.post(
  "/refill_parent_cron",
  debugController.RefillParentCronDetails,
);
debugRouter.post("/correct_slow_cron", debugController.CorrectSlowCronDetails);

debugRouter.post("/map_vendor_to_root", debugController.MapVendorToRoot);

debugRouter.get("/get_floor_products", debugController.GetFloorBelowProducts);
debugRouter.post(
  "/live/delete_live_history",
  debugController.DeleteProdHistory,
);
