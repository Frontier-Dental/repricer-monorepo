import { ScheduledTask } from "node-cron";

export const slowCrons: Record<string, ScheduledTask> = {};

export function getCronNameByJobName(jobName: string) {
  switch (jobName) {
    case "_SCG1Cron":
      return "SCG-1";
    case "_SCG2Cron":
      return "SCG-2";
    case "_SCG3Cron":
      return "SCG-3";
    default:
      throw new Error(`Invalid job name: ${jobName}`);
  }
}

export async function toggleCronStatus(
  cronObject: ScheduledTask,
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
