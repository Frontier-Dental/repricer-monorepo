import express from "express";
import { authMiddleware } from "../middleware/is-auth";
import * as productV2Controller from "../controllers/product-v2";

export const productV2Router = express.Router();

productV2Router.use(authMiddleware);

productV2Router.post(
  "/productV2/runManualCron",
  productV2Controller.runManualReprice,
);
productV2Router.post(
  "/productV2/simulateManualReprice/:id",
  productV2Controller.simulateManualReprice,
);
productV2Router.get("/productV2/show_all", productV2Controller.showAllProducts);
productV2Router.get(
  "/productV2/load_initial",
  productV2Controller.collateProducts,
);
productV2Router.get(
  "/productV2/load_initial_product/:id",
  productV2Controller.collateProductsForId,
);
productV2Router.get(
  "/productV2/editItem/:mpid",
  productV2Controller.editItemView,
);
productV2Router.get("/productV2/add", productV2Controller.addItems);
productV2Router.post(
  "/productV2/add_item_post",
  productV2Controller.addItemToDatabase,
);
productV2Router.post(
  "/productV2/download_excel",
  productV2Controller.exportItems,
);
productV2Router.post(
  "/productV2/update_product_V2",
  productV2Controller.updateProductDetails,
);
productV2Router.post(
  "/productV2/save_branches",
  productV2Controller.saveBranches,
);
productV2Router.post(
  "/productV2/activate_all",
  productV2Controller.activateProductForAll,
);
productV2Router.post(
  "/productV2/deactivate_all",
  productV2Controller.deActivateProductForAll,
);
productV2Router.post(
  "/productV2/save/download_excel",
  productV2Controller.exportItems,
);
productV2Router.post(
  "/productV2/toggle_data_scrape",
  productV2Controller.toggleDataScrape,
);
productV2Router.post(
  "/productV2/save_rootDetails",
  productV2Controller.saveRootDetails,
);
productV2Router.get(
  "/productV2/runManualSync",
  productV2Controller.runManualSyncOfProducts,
);
productV2Router.post(
  "/productV2/removeFrom422",
  productV2Controller.removeFrom422,
);
productV2Router.get(
  "/productV2/removeFrom422ForAll",
  productV2Controller.removeFrom422ForAll,
);
productV2Router.get(
  "/help/sync_product/:id",
  productV2Controller.syncProductDetails,
);
productV2Router.post(
  "/masteritem/updateAllToMax",
  productV2Controller.updateToMax,
);
