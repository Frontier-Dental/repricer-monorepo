import Redis from "ioredis";
import { readFileSync } from "fs";

interface CacheClientOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
  useTLS?: boolean;
  caCertPath?: string;
}

export class CacheClient {
  private readonly options: CacheClientOptions;

  constructor(options: CacheClientOptions) {
    this.options = options;
  }

  private createClient(): Redis {
    const tlsConfig = this.options.useTLS
      ? {
          rejectUnauthorized: true,
          ...(this.options.caCertPath && {
            ca: readFileSync(this.options.caCertPath),
          }),
        }
      : undefined;
    const client = new Redis({
      host: this.options.host,
      port: this.options.port,
      username: this.options.username,
      password: this.options.password,
      tls: tlsConfig,
      maxRetriesPerRequest: 0, // or 0 to disable retries entirely
      retryStrategy: (times) => Math.min(times * 100, 2000),
    });
    return client;
  }

  async set(key: string, value: unknown): Promise<"OK"> {
    const client = this.createClient();
    try {
      const serialized =
        typeof value === "string" ? value : JSON.stringify(value);
      return await client.set(key, serialized);
    } finally {
      await client.quit();
    }
  }

  async get<T = string>(key: string): Promise<T | null> {
    const client = this.createClient();
    try {
      const raw = await client.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      console.error(`Get failed for key "${key}":`, err);
      return null;
    } finally {
      await client.quit();
    }
  }

  async delete(key: string): Promise<number> {
    const client = this.createClient();
    try {
      return await client.del(key);
    } finally {
      await client.quit();
    }
  }
}

export function GetCacheClientOptions(
  applicationConfig: any,
): CacheClientOptions {
  return {
    host: applicationConfig.CACHE_HOST_URL,
    port: Number(applicationConfig.CACHE_PORT),
    username: applicationConfig.CACHE_USERNAME,
    password: applicationConfig.CACHE_PASSWORD,
    useTLS: false,
  };
}
