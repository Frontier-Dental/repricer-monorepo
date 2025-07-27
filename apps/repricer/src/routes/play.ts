import express from "express";
import * as playController from "../controllers/play";
import { authMiddleware } from "../middleware/is-auth";

export const playRouter = express.Router();

playRouter.use(authMiddleware);

playRouter.get(
  "/play/scrape_data/:mpid/:proxyProviderId",
  playController.ScrapeProduct,
);
playRouter.get("/play/let_me_in", playController.onInit);
