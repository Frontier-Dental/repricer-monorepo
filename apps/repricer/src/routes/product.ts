import express from "express";
import { authMiddleware } from "../middleware/is-auth";
import * as productController from "../controllers/product";

export const productRouter = express.Router();

productRouter.use(authMiddleware);

productRouter.get("/masteritem", productController.getMasterItemController);
productRouter.post(
  "/masteritem/add_item_post",
  productController.addMasterItemToDatabase,
);
productRouter.get(
  "/masteritem/edit_item/:id",
  productController.editMasterItemController,
);
productRouter.post(
  "/delete_item",
  productController.deleteMasterItemController,
);
productRouter.post(
  "/masteritem/update_item_post/",
  productController.updateMasterItemController,
);
productRouter.post("/download_excel", productController.excelDownload);
productRouter.post("/masteritem/add_excel_V2", productController.addExcelData);
productRouter.get("/masteritem/runAllCron", productController.runAllCron);
productRouter.get("/masteritem/resetCron", productController.resetCron);
productRouter.get("/masteritem/delete_all", productController.deleteAll);
productRouter.get("/masteritem/stop_all_cron", productController.stopAllCron);
productRouter.get(
  "/masteritem/start_override",
  productController.start_override,
);
productRouter.get(
  "/masteritem/get_all_active_products",
  productController.getAllActiveProducts,
);
