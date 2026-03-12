import express from "express";
import { authMiddleware } from "../middleware/auth-middleware";
import * as productController from "../controllers/product";
import { apiLimiter } from "../middleware/rate-limiter";
import { asyncHandler } from "../utility/async-handler";

export const productRouter = express.Router();

productRouter.use(authMiddleware);
productRouter.use(apiLimiter);

productRouter.get("/", asyncHandler(productController.getMasterItemController));
productRouter.post("/add_item_post", asyncHandler(productController.addMasterItemToDatabase));
productRouter.get("/edit_item/:id", asyncHandler(productController.editMasterItemController));
productRouter.post("/delete_item", asyncHandler(productController.deleteMasterItemController));
productRouter.post("/update_item_post", asyncHandler(productController.updateMasterItemController));
productRouter.post("/download_excel", asyncHandler(productController.excelDownload));
productRouter.post("/add_excel_V2", asyncHandler(productController.addExcelData));
productRouter.get("/runAllCron", asyncHandler(productController.runAllCron));
productRouter.get("/resetCron", asyncHandler(productController.resetCron));
productRouter.get("/delete_all", asyncHandler(productController.deleteAll));
productRouter.get("/stop_all_cron", asyncHandler(productController.stopAllCron));
productRouter.get("/start_override", asyncHandler(productController.start_override));
productRouter.get("/get_all_active_products", asyncHandler(productController.getAllActiveProducts));
