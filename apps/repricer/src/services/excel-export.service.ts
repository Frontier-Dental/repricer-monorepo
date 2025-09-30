import axios from "axios";
import { Response } from "express";

const EXCEL_EXPORT_SERVICE_URL =
  process.env.EXCEL_EXPORT_SERVICE_URL || "http://localhost:3003";

export interface ExcelExportFilters {
  tags?: string;
  activated?: boolean | string;
  cronId?: string;
  channelName?: string;
}

export class ExcelExportService {
  static async downloadExcel(
    filters: ExcelExportFilters,
    res: Response,
  ): Promise<void> {
    try {
      console.log("Forwarding Excel download request to export service");

      const response = await axios.post(
        `${EXCEL_EXPORT_SERVICE_URL}/api/excel/download`,
        filters,
        {
          responseType: "stream",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        response.headers["content-disposition"] ||
          `attachment; filename=items_export_${Date.now()}.xlsx`,
      );

      response.data.pipe(res);
    } catch (error) {
      console.error("Error forwarding Excel download request:", error);
      throw error;
    }
  }

  static async downloadExcelByMpids(
    mpids: string[],
    res: Response,
  ): Promise<void> {
    try {
      console.log(
        `Forwarding Excel download request for ${mpids.length} MPIDs to export service`,
      );

      const response = await axios.post(
        `${EXCEL_EXPORT_SERVICE_URL}/api/excel/download-by-mpids`,
        { mpids },
        {
          responseType: "stream",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        response.headers["content-disposition"] ||
          `attachment; filename=items_export_${Date.now()}.xlsx`,
      );

      response.data.pipe(res);
    } catch (error) {
      console.error("Error forwarding Excel download request:", error);
      throw error;
    }
  }

  static async checkServiceStatus(): Promise<boolean> {
    try {
      const response = await axios.get(`${EXCEL_EXPORT_SERVICE_URL}/health`);
      return response.status === 200;
    } catch (error) {
      console.error("Excel export service is not available:", error);
      return false;
    }
  }
}
