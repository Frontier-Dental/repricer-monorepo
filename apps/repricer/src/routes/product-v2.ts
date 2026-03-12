import express from "express";
import { authMiddleware } from "../middleware/auth-middleware";
import * as productV2Controller from "../controllers/product-v2";
import { apiLimiter } from "../middleware/rate-limiter";
import { asyncHandler } from "../utility/async-handler";

export const productV2Router = express.Router();

productV2Router.use(authMiddleware);
productV2Router.use(apiLimiter);

productV2Router.post("/runManualCron", asyncHandler(productV2Controller.runManualReprice));
productV2Router.post("/simulateManualReprice/:id", asyncHandler(productV2Controller.simulateManualReprice));
productV2Router.get("/show_all", asyncHandler(productV2Controller.showAllProducts));
productV2Router.get("/load_initial", asyncHandler(productV2Controller.collateProducts));
productV2Router.get("/load_initial_product/:id", asyncHandler(productV2Controller.collateProductsForId));
productV2Router.get("/editItem/:mpid", asyncHandler(productV2Controller.editItemView));
productV2Router.get("/add", asyncHandler(productV2Controller.addItems));
productV2Router.post("/add_item_post", asyncHandler(productV2Controller.addItemToDatabase));
productV2Router.post("/download_excel", asyncHandler(productV2Controller.exportItems));
productV2Router.post("/update_product_V2", asyncHandler(productV2Controller.updateProductDetails));
productV2Router.post("/save_branches", asyncHandler(productV2Controller.saveBranches));
productV2Router.post("/activate_all", asyncHandler(productV2Controller.activateProductForAll));
productV2Router.post("/deactivate_all", asyncHandler(productV2Controller.deActivateProductForAll));
productV2Router.post("/save/download_excel", asyncHandler(productV2Controller.exportItems));
productV2Router.post("/toggle_data_scrape", asyncHandler(productV2Controller.toggleDataScrape));
productV2Router.post("/save_rootDetails", asyncHandler(productV2Controller.saveRootDetails));
productV2Router.get("/runManualSync", asyncHandler(productV2Controller.runManualSyncOfProducts));
productV2Router.post("/removeFrom422", asyncHandler(productV2Controller.removeFrom422));
productV2Router.get("/removeFrom422ForAll", asyncHandler(productV2Controller.removeFrom422ForAll));
productV2Router.get("/sync_product/:id", asyncHandler(productV2Controller.syncProductDetails));
productV2Router.post("/updateAllToMax", asyncHandler(productV2Controller.updateToMax));
productV2Router.post("/updateProductQuantity", asyncHandler(productV2Controller.updateProductQuantity));
productV2Router.get("/express_cron_details/:mpId", asyncHandler(productV2Controller.getExpressCronDetails));
productV2Router.post("/remove_vendor_express_cron/:mpId", asyncHandler(productV2Controller.updateExpressCronForMpId));
