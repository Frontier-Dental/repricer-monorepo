import { ScheduledTask } from "node-cron";

export const miniErpCrons: Record<string, ScheduledTask> = {};

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
