import express from "express";
import { startAllFilterCronHandler } from "./start";
import { recreateFilterCronHandler } from "./recreate";
import { toggleFilterCronStatusHandler } from "./toggle-status";

export const filterCronRouter = express.Router();

filterCronRouter.get("/filter/StartFilterCron", startAllFilterCronHandler);
filterCronRouter.post("/filter/RecreateFilterCron", recreateFilterCronHandler);
filterCronRouter.post("/filter/toggleCronStatus", toggleFilterCronStatusHandler);
