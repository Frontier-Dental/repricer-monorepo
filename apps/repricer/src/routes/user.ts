import express from "express";
import * as indexController from "../controllers/user";
import { authMiddleware } from "../middleware/is-auth";

export const userRouter = express.Router();

userRouter.get("/", indexController.index);
userRouter.post("/login_post", indexController.login_post);
userRouter.get("/logout", indexController.logout);

userRouter.post(
  "/change_password",
  authMiddleware,
  indexController.changePassword,
);
userRouter.post("/add_user", indexController.add_user);
userRouter.post("/update_user", indexController.update_user);
