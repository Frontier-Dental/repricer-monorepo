import express from "express";
import { asyncHandler } from "../../utility/async-handler";
import { startAllFilterCronHandler } from "./start";
import { recreateFilterCronHandler } from "./recreate";
import { toggleFilterCronStatusHandler } from "./toggle-status";

export const filterCronRouter = express.Router();

filterCronRouter.get("/filter/StartFilterCron", asyncHandler(startAllFilterCronHandler));
filterCronRouter.post("/filter/RecreateFilterCron", asyncHandler(recreateFilterCronHandler));
filterCronRouter.post("/filter/toggleCronStatus", asyncHandler(toggleFilterCronStatusHandler));
