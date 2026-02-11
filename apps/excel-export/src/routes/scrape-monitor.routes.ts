import { Router, Request, Response } from "express";
import { isScrapingEnabled, setScrapingEnabled } from "../scrape-monitor/service";
import { scrapeViaProxy } from "../scrape-monitor/scraper";

export const scrapeMonitorRouter = Router();

scrapeMonitorRouter.get("/status", (req: Request, res: Response) => {
  res.json({ enabled: isScrapingEnabled() });
});

scrapeMonitorRouter.post("/toggle", (req: Request, res: Response) => {
  const { enabled } = req.body;
  if (typeof enabled !== "boolean") {
    res.status(400).json({ error: "expected { enabled: boolean }" });
    return;
  }
  setScrapingEnabled(enabled);
  res.json({ enabled: isScrapingEnabled() });
});

scrapeMonitorRouter.get("/scrape-url/:mpId", async (req: Request, res: Response) => {
  const mpId = Number(req.params.mpId);
  if (!mpId || isNaN(mpId)) {
    res.status(400).json({ error: "invalid mpId" });
    return;
  }
  const result = await scrapeViaProxy(mpId);
  res.json(result);
});
