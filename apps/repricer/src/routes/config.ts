import { authMiddleware } from "../middleware/auth-middleware";
import express from "express";
import * as configController from "../controllers/config";

export const configRouter = express.Router();

configRouter.use(authMiddleware);

configRouter.get("/", configController.GetConfigSetup);
configRouter.post("/update", configController.UpdateConfig);
configRouter.post("/envUpdate", configController.UpdateEnvInfo);
