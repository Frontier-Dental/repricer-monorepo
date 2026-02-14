import _ from "lodash";
import moment from "moment";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { GetHistoryApiResponse } from "../services/mysql-v2";
import { CsvWriter } from "./csvWriter";
import { applicationConfig } from "./config";

export const archiveHistory = async () => {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const generatedGuid: string[] = uuidv4().split("-");
    const uniqueKey = _.last(generatedGuid)?.trim() ?? "";
    let startDate = moment(yesterday.setHours(0, 0, 0, 0)).format("YYYY-MM-DD HH:mm:ss");
    let endDate = moment(yesterday.setHours(23, 59, 59, 59)).format("YYYY-MM-DD HH:mm:ss");
    const historyFileName = `history-${uniqueKey}-${startDate.split(" ")[0]}-TO-${endDate.split(" ")[0]}.csv`;
    const filePath = path.join("exportArchives", historyFileName);
    const csvWriterObj = new CsvWriter(filePath, applicationConfig.AWS_BUCKET_NAME, applicationConfig.AWS_REGION);
    console.debug(`HISTORY_ARCHIVE_CRON : Fetching History for ALL | START_DATE : ${startDate} | END_DATE : ${endDate} | FILE_NAME : ${historyFileName}`);
    const intervals: { start: string; end: string; isFinal: boolean }[] = [];
    for (let interval = 0; interval < 24; interval++) {
      const start = moment(yesterday).set({ hour: interval, minute: 0, second: 0, millisecond: 0 }).format("YYYY-MM-DD HH:mm:ss");
      const end = moment(yesterday).set({ hour: interval, minute: 59, second: 59, millisecond: 999 }).format("YYYY-MM-DD HH:mm:ss");
      intervals.push({
        start,
        end,
        isFinal: interval === 23,
      });
    }
    if (intervals.length > 0) {
      for (const interval of intervals) {
        console.debug(`HISTORY_ARCHIVE_CRON : Fetching History for ALL | START_DATE : ${interval.start} | END_DATE : ${interval.end}`);
        const historyResults = await GetHistoryApiResponse(interval.start, interval.end);
        if (historyResults && historyResults.length > 0) {
          console.debug(`HISTORY_ARCHIVE_CRON : Writing ${historyResults.length} records to CSV`);
          await csvWriterObj.writeData(historyResults);
          if (interval.isFinal == true) {
            await csvWriterObj.uploadToS3Multipart(filePath);
            fs.unlinkSync(filePath);
          }
        }
      }
    }
  } catch (exception) {
    console.error(`HISTORY_ARCHIVE_CRON : Sorry some error occurred! Error : ${exception}`);
  }
};
