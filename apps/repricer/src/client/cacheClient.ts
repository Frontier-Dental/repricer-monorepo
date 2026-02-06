import { createClient, RedisClientType } from "redis";
import Encrypto from "../utility/encrypto";

const OPERATION_TIMEOUT_MS = 5000;

class CacheClient {
  private static instance: CacheClient;
  private client: RedisClientType;

  private constructor(option: CacheClientOptions | null = null) {
    this.client = createClient({
      socket: {
        host: option?.host || "localhost",
        port: Number(option?.port) || 25061,
        tls: option?.useTLS || true,
        connectTimeout: 20000, // increase timeout (20s)
        reconnectStrategy: (retries) => {
          if (retries > 2) {
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

    // Fire and forget initial connection - ensureConnected() will handle it
    this.client.connect().catch((err) => {
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

  public async set<T>(key: string, value: T, ttlInSeconds?: number): Promise<void> {
    const connected = await this.ensureConnected();
    if (!connected) {
      console.error(`❌ Redis set skipped for key ${key}: not connected`);
      return;
    }
    try {
      const serialized = JSON.stringify(value);
      if (ttlInSeconds) {
        await this.withTimeout(this.client.setEx(key, ttlInSeconds, serialized), "set");
      } else {
        await this.withTimeout(this.client.set(key, serialized), "set");
      }
    } catch (error) {
      console.error(`❌ Redis set error for key ${key}:`, error);
    }
  }

  public async get<T>(key: string): Promise<T | null> {
    const connected = await this.ensureConnected();
    if (!connected) {
      return null;
    }
    try {
      const data = await this.withTimeout(this.client.get(key), "get");
      return data ? (JSON.parse(data) as T) : null;
    } catch (error) {
      console.error(`❌ Redis get error for key ${key}:`, error);
      return null;
    }
  }

  public async delete(key: string): Promise<number> {
    const connected = await this.ensureConnected();
    if (!connected) {
      return 0;
    }
    try {
      return await this.withTimeout(this.client.del(key), "delete");
    } catch (error) {
      console.error(`❌ Redis delete error for key ${key}:`, error);
      return 0;
    }
  }

  public async exists(key: string): Promise<boolean> {
    const connected = await this.ensureConnected();
    if (!connected) {
      return false;
    }
    try {
      const result = await this.withTimeout(this.client.exists(key), "exists");
      return result === 1;
    } catch (error) {
      console.error(`❌ Redis exists error for key ${key}:`, error);
      return false;
    }
  }

  public async flushAll(): Promise<void> {
    const connected = await this.ensureConnected();
    if (!connected) {
      return;
    }
    await this.withTimeout(this.client.flushAll(), "flushAll");
  }

  /**
   * Checks if connected, tries to connect if not. Returns success status.
   */
  private async ensureConnected(): Promise<boolean> {
    if (this.client.isOpen) {
      return true;
    }
    try {
      console.warn("⚡ Redis reconnecting in ensureConnected...");
      await this.client.connect();
      return true;
    } catch (error) {
      console.error("❌ Redis connection failed:", error);
      return false;
    }
  }

  /**
   * Get all keys (optionally with values).
   */
  public async getAllKeys(withValues = false): Promise<string[] | Record<string, unknown>> {
    const connected = await this.ensureConnected();
    if (!connected) {
      return withValues ? {} : [];
    }

    const keys: string[] = [];
    let cursor = "0";

    try {
      do {
        const result = await this.client.scan(cursor, { COUNT: 100 });
        cursor = result.cursor;
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
    } catch (error) {
      console.error("❌ Redis getAllKeys error:", error);
      return withValues ? {} : [];
    }
  }

  /**
   * No-op: Singleton connection stays open.
   * This method is kept for backward compatibility with existing call sites.
   * The singleton pattern means the connection should remain open and be reused.
   */
  public async disconnect(): Promise<void> {
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
