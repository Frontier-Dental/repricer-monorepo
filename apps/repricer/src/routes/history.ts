import express from "express";
import * as historyController from "../controllers/history";
import { authMiddleware } from "../middleware/auth-middleware";
import { apiLimiter } from "../middleware/rate-limiter";

export const historyRouter = express.Router();

historyRouter.use(authMiddleware);
historyRouter.use(apiLimiter);

historyRouter.get("/", historyController.getHistory);
historyRouter.post("/exportHistoryById", historyController.getHistoryById);
historyRouter.post("/get_all", historyController.getAllHistory);
historyRouter.get("/download/:file", historyController.downloadFile);
