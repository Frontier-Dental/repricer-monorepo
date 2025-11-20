import { Router } from "express";
import * as excelController from "../controllers/excel.controller";
import * as excelStreamController from "../controllers/excel.stream.controller";

export const excelRouter = Router();

excelRouter.get("/download", excelController.exportItems);
excelRouter.get(
  "/download/all_items",
  excelStreamController.streamProductDetails,
);
