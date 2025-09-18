import { Router } from "express";
import * as excelController from "../controllers/excel.controller";

export const excelRouter = Router();

excelRouter.get("/download", excelController.exportItems);
