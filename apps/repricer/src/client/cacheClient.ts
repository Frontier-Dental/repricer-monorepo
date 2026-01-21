import { createClient, RedisClientType } from "redis";
import Encrypto from "../utility/encrypto";

const OPERATION_TIMEOUT_MS = 5000; // 5 second timeout for Redis operations

class CacheClient {
  private static instance: CacheClient;
  private client: RedisClientType;
  private connectionPromise: Promise<unknown> | null = null;

  private constructor(option: CacheClientOptions | null = null) {
    this.client = createClient({
      socket: {
        host: option?.host || "localhost",
        port: Number(option?.port) || 25061,
        tls: option?.useTLS || true,
        connectTimeout: 20000, // increase timeout (20s)
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.error("❌ Too many Redis reconnect attempts");
            return new Error("Redis reconnect failed");
          }
          console.warn(`⚡ Redis reconnecting... attempt #${retries}`);
          return Math.min(retries * 500, 5000); // exponential backoff
        },
      },
      username: option?.username || undefined, // optional, for ACL-based auth
      password: option?.password || undefined,
    });

    this.client.on("error", (err) => {
      console.error("❌ Redis Client Error:", err);
    });

    // Store the connection promise so we can await it
    this.connectionPromise = this.client
      .connect()
      .then(() => {
        console.info("✅ Redis connected successfully");
      })
      .catch((err) => {
        console.error("❌ Redis initial connection failed:", err);
      });
  }

  /**
   * Wraps a Redis operation with a timeout to prevent hanging forever
   */
  private async withTimeout<T>(operation: Promise<T>, operationName: string): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Redis ${operationName} timeout after ${OPERATION_TIMEOUT_MS}ms`)), OPERATION_TIMEOUT_MS);
    });

    return Promise.race([operation, timeoutPromise]);
  }

  public static getInstance(option: CacheClientOptions | null = null): CacheClient {
    if (!CacheClient.instance) {
      CacheClient.instance = new CacheClient(option);
    }
    return CacheClient.instance;
  }

  /**
   * Ensures the singleton connection is ready before operations.
   * Call this if you need to await the initial connection.
   */
  public async waitForConnection(): Promise<void> {
    if (this.connectionPromise) {
      await this.connectionPromise;
    }
  }

  public async set<T>(key: string, value: T, ttlInSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    await this.ensureConnected();
    try {
      if (ttlInSeconds) {
        await this.withTimeout(this.client.setEx(key, ttlInSeconds, serialized), "set");
      } else {
        await this.withTimeout(this.client.set(key, serialized), "set");
      }
    } catch (error) {
      console.error(`❌ Redis set error for key ${key}:`, error);
      throw error;
    }
  }

  public async get<T>(key: string): Promise<T | null> {
    await this.ensureConnected();
    try {
      const data = await this.withTimeout(this.client.get(key), "get");
      return data ? (JSON.parse(data) as T) : null;
    } catch (error) {
      console.error(`❌ Redis get error for key ${key}:`, error);
      return null; // Graceful fallback - return null on timeout/error
    }
  }

  public async delete(key: string): Promise<number> {
    await this.ensureConnected();
    try {
      return await this.withTimeout(this.client.del(key), "delete");
    } catch (error) {
      console.error(`❌ Redis delete error for key ${key}:`, error);
      return 0;
    }
  }

  public async exists(key: string): Promise<boolean> {
    await this.ensureConnected();
    try {
      const result = await this.withTimeout(this.client.exists(key), "exists");
      return result === 1;
    } catch (error) {
      console.error(`❌ Redis exists error for key ${key}:`, error);
      return false;
    }
  }

  public async flushAll(): Promise<void> {
    await this.ensureConnected();
    await this.withTimeout(this.client.flushAll(), "flushAll");
  }

  private async ensureConnected(): Promise<void> {
    // Wait for initial connection if still pending
    if (this.connectionPromise) {
      await this.connectionPromise;
    }
    // Reconnect if disconnected
    if (!this.client.isOpen) {
      console.warn("⚡ Redis reconnecting in ensureConnected...");
      this.connectionPromise = this.client.connect();
      await this.connectionPromise;
    }
  }

  /**
   * Get all keys (optionally with values).
   */
  public async getAllKeys(withValues = false): Promise<string[] | Record<string, unknown>> {
    const keys: string[] = [];
    let cursor = "0"; // must be string, not number

    do {
      const result = await this.client.scan(cursor, { COUNT: 100 });
      cursor = result.cursor; // remains a string
      keys.push(...result.keys);
    } while (cursor !== "0");

    if (!withValues) {
      return keys;
    }

    const values: Record<string, unknown> = {};
    for (const key of keys) {
      const val = await this.client.get(key);
      values[key] = val ? JSON.parse(val) : null;
    }

    return values;
  }

  /**
   * No-op: Singleton connection stays open.
   * This method is kept for backward compatibility with existing call sites.
   * The singleton pattern means the connection should remain open and be reused.
   */
  public async disconnect(): Promise<void> {
    // No-op - singleton connection stays alive
    // Previously this killed the shared connection, causing race conditions
    // and silent hangs when other operations tried to use the disconnected client.
    return;
  }
}

export default CacheClient;

interface CacheClientOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
  useTLS?: boolean;
  caCertPath?: string;
}

export function GetCacheClientOptions(applicationConfig: any): CacheClientOptions {
  const encrypto = new Encrypto(applicationConfig.REPRICER_ENCRYPTION_KEY);
  const valkeyPassword = encrypto.decrypt(applicationConfig.CACHE_PASSWORD);
  return {
    host: applicationConfig.CACHE_HOST_URL,
    port: Number(applicationConfig.CACHE_PORT),
    username: applicationConfig.CACHE_USERNAME,
    password: valkeyPassword,
    useTLS: false,
  };
}
