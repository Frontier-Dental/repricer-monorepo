import express from "express";
import * as historyController from "../controllers/history";
import { authMiddleware } from "../middleware/auth-middleware";

export const historyRouter = express.Router();

historyRouter.use(authMiddleware);

historyRouter.get("/", historyController.getHistory);
historyRouter.post("/exportHistoryById", historyController.getHistoryById);
historyRouter.post("/get_all", historyController.getAllHistory);
historyRouter.get("/download/:file", historyController.downloadFile);
