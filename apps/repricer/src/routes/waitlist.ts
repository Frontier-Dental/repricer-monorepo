import express from "express";
import { authMiddleware } from "../middleware/auth-middleware";
import * as waitlistController from "../controllers/waitlist";

export const waitlistRouter = express.Router();

waitlistRouter.use(authMiddleware);

waitlistRouter.get("/", waitlistController.getWaitlistItems);
waitlistRouter.delete("/:id", waitlistController.deleteWaitlistItem);
//bulk delete
waitlistRouter.delete(
  "/bulk/items",
  waitlistController.bulkDeleteWaitlistItems,
);
