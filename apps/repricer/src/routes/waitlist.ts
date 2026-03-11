import express from "express";
import { authMiddleware } from "../middleware/auth-middleware";
import * as waitlistController from "../controllers/waitlist";
import { apiLimiter } from "../middleware/rate-limiter";
export const waitlistRouter = express.Router();

waitlistRouter.use(authMiddleware);
waitlistRouter.use(apiLimiter);

waitlistRouter.get("/", waitlistController.getWaitlistItems);
waitlistRouter.delete("/:id", waitlistController.deleteWaitlistItem);
//bulk delete
waitlistRouter.delete("/bulk/items", waitlistController.bulkDeleteWaitlistItems);
