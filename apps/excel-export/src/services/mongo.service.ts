import mongoose from "mongoose";
import Encrypto from "../utility/encrypto";
import { applicationConfig } from "../utility/config";
let cronSettingsCache: any[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function connectToDatabase(uri?: string) {
  let mongoUri = applicationConfig.MANAGED_MONGO_URL;

  if (!mongoUri) {
    throw new Error("MANAGED_MONGO_URL environment variable is not set");
  }

  try {
    const encrypto = new Encrypto(applicationConfig.REPRICER_ENCRYPTION_KEY);
    const mongoPassword = encrypto.decrypt(
      applicationConfig.MANAGED_MONGO_PASSWORD,
    );
    mongoUri = mongoUri.replace("{{password}}", mongoPassword);
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error;
  }
}

export function clearCronSettingsCache() {
  cronSettingsCache = null;
  cacheTimestamp = 0;
}
