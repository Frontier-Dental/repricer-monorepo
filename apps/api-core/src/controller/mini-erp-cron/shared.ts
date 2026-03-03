import { ScheduledTask } from "node-cron";
import logger from "../../utility/logger";

export const miniErpCrons: Record<string, ScheduledTask> = {};

export function toggleCronStatus(cronObject: ScheduledTask | null, status: any, cronName: string) {
  switch (parseInt(status)) {
    case 0:
      if (cronObject) {
        cronObject.stop();
        logger.info(`${cronName} cron stopped successfully at ${new Date()} `);
      }
      break;
    case 1:
      if (cronObject) {
        cronObject.start();
        logger.info(`${cronName} cron started successfully at ${new Date()} `);
      }
      break;
    default:
      break;
  }
}
