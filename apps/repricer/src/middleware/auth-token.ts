import { NextFunction, Request, Response } from "express";
import * as mongoMiddleware from "../services/mongo";

export default (req: Request, res: Response, next: NextFunction) => {
  if (req.headers.oprtype == "DEV_SYNC") {
    mongoMiddleware
      .GetEnvValueByKey("DEV_SYNC_API_KEY")
      .then((actualApiKey) => {
        const incomingApiKey = req.headers.apikey;
        if (actualApiKey != incomingApiKey) {
          res.status(403).json("Unauthorized");
        } else {
          next();
        }
      });
  } else {
    mongoMiddleware
      .GetEnvValueByKey("FRONTIER_API_KEY")
      .then((actualApiKey) => {
        const incomingApiKey = req.headers.apikey;
        if (actualApiKey != incomingApiKey) {
          res.status(403).json("Unauthorized");
        } else {
          next();
        }
      });
  }
};
