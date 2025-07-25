import { ScheduledTask } from "node-cron";
import * as mySqlHelper from "../../utility/mysql-helper";
import * as scrapeHelper from "../../utility/scrape-helper";

export const scrapeCrons: Record<string, ScheduledTask> = {};

export function toggleCronStatus(
  cronObject: ScheduledTask | null,
  status: any,
  cronName: string,
) {
  switch (parseInt(status)) {
    case 0:
      if (cronObject) {
        cronObject.stop();
        console.log(`${cronName} cron stopped successfully at ${new Date()} `);
      }
      break;
    case 1:
      if (cronObject) {
        cronObject.start();
        console.log(`${cronName} cron started successfully at ${new Date()} `);
      }
      break;
    default:
      break;
  }
}

export async function scrapeProductList(cronSettingsResponse: any) {
  const scrapeProductList = await mySqlHelper.GetEligibleScrapeProductList(
    cronSettingsResponse.CronId,
  );
  await scrapeHelper.Execute(scrapeProductList, cronSettingsResponse);
}

export function getScrapeCronNameFromJobName(jobName: string) {
  const match = jobName.match(/^_SOC(\d+)Cron$/);
  if (match) {
    return `SOC-${match[1]}`;
  }
  return jobName;
}
