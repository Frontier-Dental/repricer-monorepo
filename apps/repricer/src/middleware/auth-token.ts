import { NextFunction, Request, Response } from "express";
import * as sqlV2Service from "../services/mysql-v2";

export default (req: Request, res: Response, next: NextFunction) => {
  if (req.headers.oprtype == "DEV_SYNC") {
    sqlV2Service.GetEnvValueByKey("DEV_SYNC_API_KEY").then((actualApiKey) => {
      const incomingApiKey = req.headers.apikey;
      if (actualApiKey != incomingApiKey) {
        res.status(403).json("Unauthorized");
      } else {
        next();
      }
    });
  } else {
    sqlV2Service.GetEnvValueByKey("FRONTIER_API_KEY").then((actualApiKey) => {
      const incomingApiKey = req.headers.apikey;
      if (actualApiKey != incomingApiKey) {
        res.status(403).json("Unauthorized");
      } else {
        next();
      }
    });
  }
};
