import express from "express";
import { authMiddleware } from "../middleware/auth-middleware";
import * as productController from "../controllers/product";

export const productRouter = express.Router();

productRouter.use(authMiddleware);

productRouter.get("/", productController.getMasterItemController);
productRouter.post("/add_item_post", productController.addMasterItemToDatabase);
productRouter.get("/edit_item/:id", productController.editMasterItemController);
productRouter.post(
  "/delete_item",
  productController.deleteMasterItemController,
);
productRouter.post(
  "/update_item_post",
  productController.updateMasterItemController,
);
productRouter.post("/download_excel", productController.excelDownload);
productRouter.post("/add_excel_V2", productController.addExcelData);
productRouter.get("/runAllCron", productController.runAllCron);
productRouter.get("/resetCron", productController.resetCron);
productRouter.get("/delete_all", productController.deleteAll);
productRouter.get("/stop_all_cron", productController.stopAllCron);
productRouter.get("/start_override", productController.start_override);
productRouter.get(
  "/get_all_active_products",
  productController.getAllActiveProducts,
);
