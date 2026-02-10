import express, { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { getKnexInstance } from "../../model/sql-models/knex-wrapper";

export const directScrapeMonitorRouter = express.Router();

directScrapeMonitorRouter.get("/direct-scrape-monitor/status", async (_req: Request, res: Response) => {
  const db = getKnexInstance();
  const row = await db("service_toggles").where("service_name", "direct-scrape-monitor").first("is_enabled");
  return res.status(StatusCodes.OK).json({ is_enabled: row?.is_enabled ?? true });
});

directScrapeMonitorRouter.post("/direct-scrape-monitor/toggle", async (req: Request, res: Response) => {
  const { is_enabled } = req.body;
  const db = getKnexInstance();
  await db("service_toggles").where("service_name", "direct-scrape-monitor").update({ is_enabled: !!is_enabled });
  const action = is_enabled ? "enabled" : "disabled";
  return res.status(StatusCodes.OK).json({ message: `Direct scrape monitor ${action}`, is_enabled: !!is_enabled });
});
