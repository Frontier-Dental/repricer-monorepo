import express, { Request, Response } from "express";
import moment from "moment";
import { logger, rotateLogFiles } from "../utility/winston-logger";

export const appLogController = express.Router();

appLogController.get("/app/clear-logs", async (req: Request, res: Response) => {
  console.log("clearing logs..");
  rotateLogFiles(logger, 0);
  res.send({ message: "Log files archived successfully" });
});

appLogController.get("/app/logs", async (req: Request, res: Response) => {
  const today = new Date().toISOString().slice(0, 10);

  let startDate: any =
    req.query.startDate !== undefined ? req.query.startDate : today;
  startDate = moment(startDate);

  let endDate: any =
    req.query.endDate !== undefined ? req.query.endDate : today;
  endDate = moment(endDate as any);

  const logLevel =
    req.query.logLevel !== undefined ? req.query.logLevel : "ALL";

  const keyWord = req.query.keyWord;

  // Query options
  const options: any = {
    from: startDate,
    until: endDate,
    limit: 100000,
    start: 0,
    order: "desc",
    fields: ["message", "level", "timestamp", "module", "timeTaken"],
  };
  console.log(options);
  // Query logs
  let logEntries = [];
  logger.query(options, function (err, result) {
    if (err) {
      throw err;
    }
    console.log(result);

    logEntries = result["file"];
    if (logLevel != "ALL") {
      logEntries = logEntries.filter(function (le: any) {
        return le.level == logLevel;
      });
    }

    if (keyWord != undefined) {
      logEntries = logEntries.filter((le: any) => le.message.includes(keyWord));
    }

    logEntries = logEntries.map((log: any) => {
      const date = new Date(log.timestamp);
      return {
        ...log,
        dateTime: formatDate(date),
      };
    });
    console.log(logEntries);
    return res.json(logEntries);
  });
});

// Helper function to format the date
const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-based
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};
