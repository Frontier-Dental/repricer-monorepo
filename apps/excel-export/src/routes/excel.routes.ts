import { Router } from "express";
import { asyncHandler } from "../utility/async-handler";
import * as excelController from "../controllers/excel.controller";
import * as excelStreamController from "../controllers/excel.stream.controller";

export const excelRouter = Router();

excelRouter.get("/download", asyncHandler(excelController.exportItems));
excelRouter.get("/download/all_items", asyncHandler(excelStreamController.streamProductDetails));
