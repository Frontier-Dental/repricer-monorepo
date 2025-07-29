import express from "express";
import { authMiddleware } from "../middleware/auth-middleware";
import * as productV2Controller from "../controllers/product-v2";

export const productV2Router = express.Router();

productV2Router.use(authMiddleware);

productV2Router.post("/runManualCron", productV2Controller.runManualReprice);
productV2Router.post(
  "/simulateManualReprice/:id",
  productV2Controller.simulateManualReprice,
);
productV2Router.get("/show_all", productV2Controller.showAllProducts);
productV2Router.get("/load_initial", productV2Controller.collateProducts);
productV2Router.get(
  "/load_initial_product/:id",
  productV2Controller.collateProductsForId,
);
productV2Router.get("/editItem/:mpid", productV2Controller.editItemView);
productV2Router.get("/add", productV2Controller.addItems);
productV2Router.post("/add_item_post", productV2Controller.addItemToDatabase);
productV2Router.post("/download_excel", productV2Controller.exportItems);
productV2Router.post(
  "/update_product_V2",
  productV2Controller.updateProductDetails,
);
productV2Router.post("/save_branches", productV2Controller.saveBranches);
productV2Router.post(
  "/activate_all",
  productV2Controller.activateProductForAll,
);
productV2Router.post(
  "/deactivate_all",
  productV2Controller.deActivateProductForAll,
);
productV2Router.post("/save/download_excel", productV2Controller.exportItems);
productV2Router.post(
  "/toggle_data_scrape",
  productV2Controller.toggleDataScrape,
);
productV2Router.post("/save_rootDetails", productV2Controller.saveRootDetails);
productV2Router.get(
  "/runManualSync",
  productV2Controller.runManualSyncOfProducts,
);
productV2Router.post("/removeFrom422", productV2Controller.removeFrom422);
productV2Router.get(
  "/removeFrom422ForAll",
  productV2Controller.removeFrom422ForAll,
);
productV2Router.get(
  "/sync_product/:id",
  productV2Controller.syncProductDetails,
);
productV2Router.post("/updateAllToMax", productV2Controller.updateToMax);
productV2Router.get(
  "/get_all_products_for_cron",
  productV2Controller.getAllProductsForCron,
);
productV2Router.get(
  "/v2_algo_execution/:productId",
  productV2Controller.getV2AlgoExecutionByProductId,
);
