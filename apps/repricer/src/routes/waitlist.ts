import express from "express";
import { authMiddleware } from "../middleware/auth-middleware";
import * as waitlistController from "../controllers/waitlist";
import { apiLimiter } from "../middleware/rate-limiter";
import { asyncHandler } from "../utility/async-handler";

export const waitlistRouter = express.Router();

waitlistRouter.use(authMiddleware);
waitlistRouter.use(apiLimiter);

waitlistRouter.get("/", asyncHandler(waitlistController.getWaitlistItems));
waitlistRouter.delete("/:id", asyncHandler(waitlistController.deleteWaitlistItem));
//bulk delete
waitlistRouter.delete("/bulk/items", asyncHandler(waitlistController.bulkDeleteWaitlistItems));
