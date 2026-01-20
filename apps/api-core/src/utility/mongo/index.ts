import { Db, MongoClient } from "mongodb";
import _ from "lodash";
import { applicationConfig } from "../config";
import Encrypto from "../encrypto";

// MongoDB Singleton Helper
let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;
let connectionPromise: Promise<Db> | null = null;

export async function getMongoDb(): Promise<Db> {
  if (mongoDb && mongoClient) {
    return mongoDb;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = connectToMongo().catch((error) => {
    console.error("api-core MongoDB: Connection error:", error);
    resetConnection();
    throw error;
  });

  return connectionPromise;
}

async function connectToMongo(): Promise<Db> {
  const encrypto = new Encrypto(applicationConfig.REPRICER_ENCRYPTION_KEY);
  const mongoPassword = encrypto.decrypt(applicationConfig.MANAGED_MONGO_PASSWORD);
  const mongoUrl = applicationConfig.MANAGED_MONGO_URL.replace("{{password}}", mongoPassword);
  const dbName = applicationConfig.GET_PRICE_LIST_DBNAME;

  if (!mongoUrl || !dbName) {
    throw new Error("URL and DB name must be provided");
  }

  const client = new MongoClient(mongoUrl, {
    retryReads: true,
    retryWrites: true,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });

  client.on("close", () => {
    console.warn("api-core MongoDB: Connection closed, resetting for reconnection");
    resetConnection();
  });

  client.on("error", (err) => {
    console.error("api-core MongoDB: Connection error, resetting for reconnection", err);
    resetConnection();
  });

  await client.connect();
  mongoDb = client.db(dbName);
  mongoClient = client;
  console.log("api-core MongoDB: Connection established successfully");
  return mongoDb;
}

function resetConnection(): void {
  mongoClient = null;
  mongoDb = null;
  connectionPromise = null;
}
