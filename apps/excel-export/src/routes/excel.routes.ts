import { Router } from "express";
import * as excelController from "../controllers/excel.controller";

export const excelRouter = Router();

excelRouter.post("/download", excelController.downloadExcel);
excelRouter.post("/download-by-mpids", excelController.downloadExcelByMpids);
excelRouter.get("/status", excelController.getExportStatus);
