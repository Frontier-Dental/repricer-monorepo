import mongoose from "mongoose";

let cronSettingsCache: any[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function connectToDatabase(uri?: string) {
  const mongoUri = process.env.MANAGED_MONGO_URL as string;

  if (!mongoUri) {
    throw new Error("MANAGED_MONGO_URL environment variable is not set");
  }

  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error;
  }
}

export async function getCronSettingsList(): Promise<any[]> {
  const now = Date.now();

  if (cronSettingsCache && now - cacheTimestamp < CACHE_DURATION) {
    return cronSettingsCache;
  }

  try {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database connection not established");
    }

    const cronSettingsCollection = db.collection("CronSettings");
    const cronSettings = await cronSettingsCollection.find({}).toArray();

    cronSettingsCache = cronSettings;
    cacheTimestamp = now;

    return cronSettings;
  } catch (error) {
    console.error("Error fetching cron settings:", error);
    return [];
  }
}

export function clearCronSettingsCache() {
  cronSettingsCache = null;
  cacheTimestamp = 0;
}
