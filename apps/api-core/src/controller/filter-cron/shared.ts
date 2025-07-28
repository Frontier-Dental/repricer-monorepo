import { ScheduledTask } from "node-cron";

export const filterCrons: Record<string, ScheduledTask> = {};

export function getCronNameByJobName(cronName: string) {
  switch (cronName) {
    case "_FC1Cron":
      return "FC-1";
    case "_FC2Cron":
      return "FC-2";
    case "_FC3Cron":
      return "FC-3";
    default:
      throw new Error(`Invalid cron name: ${cronName}`);
  }
}
