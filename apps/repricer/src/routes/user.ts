import express from "express";
import * as indexController from "../controllers/user";
import { authMiddleware } from "../middleware/auth-middleware";
import { apiLimiter, loginLimiter } from "../middleware/rate-limiter";
import { asyncHandler } from "../utility/async-handler";

export const userRouter = express.Router();

userRouter.get("/", asyncHandler(indexController.homePageHandler));
userRouter.post("/login_post", loginLimiter, asyncHandler(indexController.loginUser));
userRouter.get("/logout", authMiddleware, asyncHandler(indexController.logout));
userRouter.post("/change_password", apiLimiter, authMiddleware, asyncHandler(indexController.changePassword));
userRouter.post("/add_user", apiLimiter, authMiddleware, asyncHandler(indexController.add_user));
userRouter.post("/update_user", apiLimiter, authMiddleware, asyncHandler(indexController.update_user));
