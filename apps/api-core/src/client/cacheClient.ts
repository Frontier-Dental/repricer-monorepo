import { createClient, RedisClientType } from "redis";
import Encrypto from "../utility/encrypto";
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

    this.client.connect().then(() => {
      //console.info("✅ Redis connected successfully");
    });
  }

  public static getInstance(option: CacheClientOptions | null = null): CacheClient {
    if (!CacheClient.instance || CacheClient.instance.client.isOpen === false) {
      CacheClient.instance = new CacheClient(option);
    }
    return CacheClient.instance;
  }

  public async set<T>(key: string, value: T, ttlInSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    await this.ensureConnected();
    if (ttlInSeconds) {
      await this.client.setEx(key, ttlInSeconds, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  public async get<T>(key: string): Promise<T | null> {
    await this.ensureConnected();
    const data = await this.client.get(key);
    return data ? (JSON.parse(data) as T) : null;
  }

  public async delete(key: string): Promise<number> {
    await this.ensureConnected();
    return this.client.del(key);
  }

  public async exists(key: string): Promise<boolean> {
    await this.ensureConnected();
    const result = await this.client.exists(key);
    return result === 1;
  }

  public async flushAll(): Promise<void> {
    await this.ensureConnected();
    await this.client.flushAll();
  }

  private async ensureConnected() {
    if (!this.client.isOpen) {
      await this.client.connect();
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

  public async disconnect(): Promise<void> {
    if (this.client.isOpen === true) {
      //console.debug("Disconnected Redis client");
      await this.client.quit();
    } else {
      //console.debug("Redis client already disconnected");
    }
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
