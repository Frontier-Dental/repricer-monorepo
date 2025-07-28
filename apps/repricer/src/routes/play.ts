import express from "express";
import * as playController from "../controllers/play";
import { authMiddleware } from "../middleware/auth-middleware";

export const playRouter = express.Router();

playRouter.use(authMiddleware);

playRouter.get(
  "/scrape_data/:mpid/:proxyProviderId",
  playController.ScrapeProduct,
);
playRouter.get("/let_me_in", playController.onInit);
