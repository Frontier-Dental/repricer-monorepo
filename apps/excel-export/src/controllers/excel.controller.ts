import { Request, Response } from "express";
import { ExcelService } from "../services/excel.service";

export async function downloadExcel(req: Request, res: Response) {
  try {
    console.log("Starting Excel download generation");

    const filters = {
      tags: req.body.tags as string,
      activated:
        req.body.activated === "true"
          ? true
          : req.body.activated === "false"
            ? false
            : undefined,
      cronId: req.body.cronId as string,
      channelName: req.body.channelName as string,
    };

    const workbook =
      filters.tags ||
      filters.activated !== undefined ||
      filters.cronId ||
      filters.channelName
        ? await ExcelService.generateFilteredExcel(filters)
        : await ExcelService.generateItemsExcel();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=items_export_${Date.now()}.xlsx`,
    );

    console.log("Excel file generated successfully, sending to client");

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error generating Excel file:", error);
    res.status(500).json({
      error: "Failed to generate Excel file",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function downloadExcelByMpids(req: Request, res: Response) {
  try {
    const mpids = req.body.mpids as string[];

    if (!mpids || !Array.isArray(mpids)) {
      return res.status(400).json({
        error: "Invalid request",
        message: "mpids array is required",
      });
    }

    console.log(`Generating Excel for ${mpids.length} MPIDs`);

    const query = { mpid: { $in: mpids } };
    const workbook = await ExcelService.generateItemsExcel(query);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=items_export_${Date.now()}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error generating Excel file:", error);
    res.status(500).json({
      error: "Failed to generate Excel file",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function getExportStatus(req: Request, res: Response) {
  try {
    res.json({
      status: "ready",
      message: "Excel export service is running",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Service is not available",
    });
  }
}
