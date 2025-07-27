import { authMiddleware } from "../middleware/is-auth";
import express from "express";
import * as configController from "../controllers/config";

export const configRouter = express.Router();

configRouter.use(authMiddleware);

configRouter.get("/configuration", configController.GetConfigSetup);
configRouter.post("/config/update", configController.UpdateConfig);
configRouter.post("/config/envUpdate", configController.UpdateEnvInfo);
