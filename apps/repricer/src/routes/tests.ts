import express from "express";
import * as testsController from "../controllers/tests";
import { authMiddleware } from "../middleware/auth-middleware";

export const testsRouter = express.Router();

testsRouter.use(authMiddleware);

testsRouter.get("/", testsController.GetTestResults);
testsRouter.post("/run", testsController.RunTests);
