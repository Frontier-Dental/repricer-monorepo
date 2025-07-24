import { Db, MongoClient } from "mongodb";
import _ from "lodash";
import { applicationConfig } from "../config";

// Lazy singleton MongoDB connection helper
let mongoDb: Db | null = null;

export async function getMongoDb() {
  const url = applicationConfig.MANAGED_MONGO_URL;
  const dbName = applicationConfig.GET_PRICE_LIST_DBNAME;
  if (!url || !dbName) {
    throw new Error("URL and DB name must be provided");
  }
  if (!mongoDb) {
    const mongoClient = new MongoClient(url);
    await mongoClient.connect();
    mongoDb = mongoClient.db(dbName);
  }
  return mongoDb;
}
