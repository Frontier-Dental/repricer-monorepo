import { Router, Request, Response } from "express";
import { asyncHandler } from "../utility/async-handler";
import { ValidationError } from "../errors/custom-errors";
import { isScrapingEnabled, setScrapingEnabled } from "../scrape-monitor/service";
import { scrapeViaProxy } from "../scrape-monitor/scraper";

export const scrapeMonitorRouter = Router();

scrapeMonitorRouter.get(
  "/status",
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ enabled: isScrapingEnabled() });
  })
);

scrapeMonitorRouter.post(
  "/toggle",
  asyncHandler(async (req: Request, res: Response) => {
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      throw new ValidationError("expected { enabled: boolean }");
    }
    setScrapingEnabled(enabled);
    res.json({ enabled: isScrapingEnabled() });
  })
);

scrapeMonitorRouter.get(
  "/scrape-url/:mpId",
  asyncHandler(async (req: Request, res: Response) => {
    const mpId = Number(req.params.mpId);
    if (!mpId || isNaN(mpId)) {
      throw new ValidationError("invalid mpId");
    }
    const result = await scrapeViaProxy(mpId);
    res.json(result);
  })
);
