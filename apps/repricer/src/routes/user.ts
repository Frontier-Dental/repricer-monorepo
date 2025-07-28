import express from "express";
import * as indexController from "../controllers/user";
import { authMiddleware } from "../middleware/auth-middleware";

export const userRouter = express.Router();

userRouter.get("/", indexController.homePageHandler);
userRouter.post("/login_post", indexController.loginUser);
userRouter.get("/logout", authMiddleware, indexController.logout);
userRouter.post(
  "/change_password",
  authMiddleware,
  indexController.changePassword,
);
userRouter.post("/add_user", authMiddleware, indexController.add_user);
userRouter.post("/update_user", authMiddleware, indexController.update_user);
