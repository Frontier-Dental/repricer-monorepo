import express from "express";
import * as indexController from "../controllers/user";
import { authMiddleware } from "../middleware/auth-middleware";
import { apiLimiter, loginLimiter } from "../middleware/rate-limiter";

export const userRouter = express.Router();

userRouter.get("/", indexController.homePageHandler);
userRouter.post("/login_post", loginLimiter, indexController.loginUser);
userRouter.get("/logout", authMiddleware, indexController.logout);
userRouter.post("/change_password", apiLimiter, authMiddleware, indexController.changePassword);
userRouter.post("/add_user", apiLimiter, authMiddleware, indexController.add_user);
userRouter.post("/update_user", apiLimiter, authMiddleware, indexController.update_user);
