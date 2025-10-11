import { Request, Response, NextFunction } from "express";
import { applicationConfig } from "../utility/config";

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const stored_session = (req as any).session;
  const users_id = (stored_session as any).users_id;
  const isDowntimeOn = applicationConfig.DOWNTIME_ON;
  if (isDowntimeOn) {
    res.redirect("/");
  } else {
    if (applicationConfig.AUTHENTICATION_DISABLED) {
      (req as any).session.users_id = {
        id: "dummySessionId",
        userName: "dummyUserName",
        userRole: "user", // Default role for now
      };
      next();
    } else if (!users_id) {
      res.redirect("/");
    } else {
      console.log(
        `REQUEST URL : ${req.originalUrl} || USER : ${users_id.userName}`,
      );
      next();
    }
  }
}
