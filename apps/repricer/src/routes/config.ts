import { authMiddleware } from "../middleware/auth-middleware";
import express from "express";
import * as configController from "../controllers/config";
import { apiLimiter } from "../middleware/rate-limiter";
import { asyncHandler } from "../utility/async-handler";

export const configRouter = express.Router();

configRouter.use(authMiddleware);
configRouter.use(apiLimiter);
configRouter.get("/", asyncHandler(configController.GetConfigSetup));
configRouter.post("/update", asyncHandler(configController.UpdateConfig));
configRouter.post("/envUpdate", asyncHandler(configController.UpdateEnvInfo));
