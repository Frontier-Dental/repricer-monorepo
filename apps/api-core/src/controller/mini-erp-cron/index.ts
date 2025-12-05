import express from "express";
import { startMiniErpCron } from "./start-cron";
import { toggleMiniErpCronStatusHandler } from "./toggle-status";
import { recreateMiniErpCronHandler } from "./recreate";

export const minErpCronController = express.Router();

minErpCronController.post("/mini_erp/start", startMiniErpCron);
minErpCronController.post(
  "/mini_erp/toggleCronStatus",
  toggleMiniErpCronStatusHandler,
);
minErpCronController.post("/mini_erp/recreate", recreateMiniErpCronHandler);
