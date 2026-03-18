import express from "express";
import * as historyController from "../controllers/history";
import { authMiddleware } from "../middleware/auth-middleware";
import { apiLimiter } from "../middleware/rate-limiter";
import { asyncHandler } from "../utility/async-handler";

export const historyRouter = express.Router();

historyRouter.use(authMiddleware);
historyRouter.use(apiLimiter);

historyRouter.get("/", asyncHandler(historyController.getHistory));
historyRouter.post("/exportHistoryById", asyncHandler(historyController.getHistoryById));
historyRouter.post("/get_all", asyncHandler(historyController.getAllHistory));
historyRouter.get("/download/:file", asyncHandler(historyController.downloadFile));
