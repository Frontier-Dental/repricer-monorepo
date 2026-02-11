import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { excelRouter } from "./routes/excel.routes";
import { scrapeMonitorRouter } from "./routes/scrape-monitor.routes";
import { startScrapeLoop } from "./scrape-monitor/service";

dotenv.config();

const app = express();
const PORT = 3003;
process.env.TZ = "Canada/Eastern";
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(morgan("dev", { skip: (req) => req.url === "/health" }));

app.use("/api/excel", excelRouter);
app.use("/api/scrape-monitor", scrapeMonitorRouter);

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "excel-export",
    timestamp: new Date().toISOString(),
  });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Excel Export Service is running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
  console.log(`Excel download endpoint: POST http://localhost:${PORT}/api/excel/download`);
  startScrapeLoop();
});
