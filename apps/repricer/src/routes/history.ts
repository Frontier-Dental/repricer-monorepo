import express from "express";
import * as historyController from "../controllers/history";
import { authMiddleware } from "../middleware/is-auth";

export const historyRouter = express.Router();

historyRouter.use(authMiddleware);

historyRouter.get("/history", historyController.getHistory);
historyRouter.post(
  "/history/exportHistoryById",
  historyController.getHistoryById,
);
historyRouter.post("/history/get_all", historyController.getAllHistory);
historyRouter.get("/history/:file", historyController.downloadFile);
