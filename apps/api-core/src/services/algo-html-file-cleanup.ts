import { schedule, ScheduledTask } from "node-cron";
import {
  getKnexInstance,
  destroyKnexInstance,
} from "../model/sql-models/knex-wrapper";

let cleanupCron: ScheduledTask | null = null;

/**
 * Starts the cleanup cron job that runs every 2 hours
 */
export function startV2AlgoHtmlFileCleanupCron(): void {
  if (cleanupCron) {
    console.log("Cleanup cron is already running");
    return;
  }

  // Run every 2 hours at minute 0 (e.g., 00:00, 02:00, 04:00, etc.)
  const cronExpression = "0 */2 * * *";

  cleanupCron = schedule(
    cronExpression,
    async () => {
      try {
        console.log(
          `Starting cleanup of expired v2_algo_execution records at ${new Date().toISOString()}`,
        );
        await cleanupExpiredRecords();
        console.log(
          `Cleanup completed successfully at ${new Date().toISOString()}`,
        );
      } catch (error) {
        console.error("Error during cleanup cron execution:", error);
      }
    },
    {
      scheduled: true,
      timezone: "UTC",
      runOnInit: true,
    },
  );

  console.log("Cleanup cron job started successfully. Running every 2 hours.");
}

/**
 * Stops the cleanup cron job
 */
export function stopCleanupCron(): void {
  if (cleanupCron) {
    cleanupCron.stop();
    cleanupCron = null;
    console.log("Cleanup cron job stopped");
  }
}

/**
 * Manually triggers the cleanup process
 */
export async function runCleanupManually(): Promise<void> {
  try {
    console.log("Starting manual cleanup of expired v2_algo_execution records");
    await cleanupExpiredRecords();
    console.log("Manual cleanup completed successfully");
  } catch (error) {
    console.error("Error during manual cleanup:", error);
    throw error;
  }
}

/**
 * Deletes expired records from v2_algo_execution table
 */
async function cleanupExpiredRecords(): Promise<void> {
  const knex = getKnexInstance();
  const currentTime = new Date();
  // Delete records where expires_at is in the past
  const deletedCount = await knex("v2_algo_execution")
    .where("expires_at", "<", currentTime)
    .del();
  //destroyKnexInstance();
  console.log(
    `Deleted ${deletedCount} expired records from v2_algo_execution table`,
  );
}

/**
 * Gets the count of expired records (for monitoring purposes)
 */
export async function getExpiredRecordsCount(): Promise<number> {
  const knex = getKnexInstance();
  const currentTime = new Date();

  try {
    const count = await knex("v2_algo_execution")
      .where("expires_at", "<", currentTime)
      .count("* as count")
      .first();

    return count ? Number(count.count) : 0;
  } catch (error) {
    console.error("Error getting expired records count:", error);
    throw error;
  } finally {
    //destroyKnexInstance();
  }
}

/**
 * Gets the count of total records (for monitoring purposes)
 */
export async function getTotalRecordsCount(): Promise<number> {
  const knex = getKnexInstance();

  try {
    const count = await knex("v2_algo_execution").count("* as count").first();

    return count ? Number(count.count) : 0;
  } catch (error) {
    console.error("Error getting total records count:", error);
    throw error;
  } finally {
    //destroyKnexInstance();
  }
}
