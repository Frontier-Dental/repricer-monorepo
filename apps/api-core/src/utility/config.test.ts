describe("config", () => {
  const originalEnv = process.env;
  const requiredEnvVars = {
    MANAGED_MONGO_URL: "mongodb://localhost:27017",
    MANAGED_MONGO_PASSWORD: "password123",
    SQL_HOSTNAME: "localhost",
    SQL_PORT: "3306",
    SQL_USERNAME: "root",
    SQL_PASSWORD: "password",
    SQL_DATABASE: "testdb",
    CACHE_HOST_URL: "localhost",
    CACHE_USERNAME: "cacheuser",
    CACHE_PASSWORD: "cachepass",
    CACHE_PORT: "6379",
    MINI_ERP_BASE_URL: "http://localhost:3000",
    MINI_ERP_USERNAME: "erpuser",
    MINI_ERP_PASSWORD: "erppass",
    SHIPPING_DATA_PROXY_SCRAPE_API_KEY: "apikey123",
    REPRICER_ENCRYPTION_KEY: "test-encryption-key-32-chars-long!!",
  };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, ...requiredEnvVars };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("validateConfig", () => {
    it("should validate config with all required environment variables", () => {
      process.env = { ...requiredEnvVars };

      const { validateConfig } = require("./config");
      const result = validateConfig();

      expect(result).toBeDefined();
      expect(result.MANAGED_MONGO_URL).toBe("mongodb://localhost:27017");
      expect(result.SQL_HOSTNAME).toBe("localhost");
      expect(result.SQL_PORT).toBe(3306);
    });

    it("should use default values for optional environment variables", () => {
      process.env = { ...requiredEnvVars };

      const { validateConfig } = require("./config");
      const result = validateConfig();

      expect(result.GET_PRICE_LIST_DBNAME).toBe("repricer");
      expect(result.PORT).toBe(5001);
      expect(result.OFFSET).toBe(0.01);
      expect(result.IGNORE_TIE).toBe(false);
    });

    it("should throw error when required environment variables are missing", () => {
      // Since applicationConfig parses at module load time, we need to test validateConfig
      // with missing env vars by temporarily removing them
      const originalEnv = { ...process.env };

      // Remove required env vars
      delete process.env.MANAGED_MONGO_PASSWORD;
      delete process.env.SQL_PORT;
      delete process.env.SQL_USERNAME;
      delete process.env.SQL_PASSWORD;
      delete process.env.SQL_DATABASE;
      delete process.env.CACHE_HOST_URL;
      delete process.env.CACHE_USERNAME;
      delete process.env.CACHE_PASSWORD;
      delete process.env.CACHE_PORT;
      delete process.env.MINI_ERP_BASE_URL;
      delete process.env.MINI_ERP_USERNAME;
      delete process.env.MINI_ERP_PASSWORD;
      delete process.env.SHIPPING_DATA_PROXY_SCRAPE_API_KEY;

      // Clear module cache and reload
      delete require.cache[require.resolve("./config")];

      // The module will throw when trying to parse applicationConfig at load time
      expect(() => {
        require("./config");
      }).toThrow();

      // Restore env
      process.env = originalEnv;
    });

    it("should parse boolean environment variables correctly", () => {
      process.env = {
        MANAGED_MONGO_URL: "mongodb://localhost:27017",
        MANAGED_MONGO_PASSWORD: "password123",
        SQL_HOSTNAME: "localhost",
        SQL_PORT: "3306",
        SQL_USERNAME: "root",
        SQL_PASSWORD: "password",
        SQL_DATABASE: "testdb",
        CACHE_HOST_URL: "localhost",
        CACHE_USERNAME: "cacheuser",
        CACHE_PASSWORD: "cachepass",
        CACHE_PORT: "6379",
        MINI_ERP_BASE_URL: "http://localhost:3000",
        MINI_ERP_USERNAME: "erpuser",
        MINI_ERP_PASSWORD: "erppass",
        SHIPPING_DATA_PROXY_SCRAPE_API_KEY: "apikey123",
        REPRICER_ENCRYPTION_KEY: "test-encryption-key-32-chars-long!!",
        IGNORE_TIE: "true",
        IS_DEBUG: "true",
        FLAG_MULTI_PRICE_UPDATE: "false",
      };

      const { validateConfig } = require("./config");
      const result = validateConfig();

      expect(result.IGNORE_TIE).toBe(true);
      expect(result.IS_DEBUG).toBe(true);
      expect(result.FLAG_MULTI_PRICE_UPDATE).toBe(false);
    });

    it("should parse number environment variables correctly", () => {
      process.env = {
        MANAGED_MONGO_URL: "mongodb://localhost:27017",
        MANAGED_MONGO_PASSWORD: "password123",
        SQL_HOSTNAME: "localhost",
        SQL_PORT: "3306",
        SQL_USERNAME: "root",
        SQL_PASSWORD: "password",
        SQL_DATABASE: "testdb",
        CACHE_HOST_URL: "localhost",
        CACHE_USERNAME: "cacheuser",
        CACHE_PASSWORD: "cachepass",
        CACHE_PORT: "6379",
        MINI_ERP_BASE_URL: "http://localhost:3000",
        MINI_ERP_USERNAME: "erpuser",
        MINI_ERP_PASSWORD: "erppass",
        SHIPPING_DATA_PROXY_SCRAPE_API_KEY: "apikey123",
        REPRICER_ENCRYPTION_KEY: "test-encryption-key-32-chars-long!!",
        PORT: "8080",
        OFFSET: "0.05",
        BATCH_SIZE: "1000",
      };

      const { validateConfig } = require("./config");
      const result = validateConfig();

      expect(result.PORT).toBe(8080);
      expect(result.OFFSET).toBe(0.05);
      expect(result.BATCH_SIZE).toBe(1000);
    });

    it("should handle string environment variables with defaults", () => {
      process.env = {
        MANAGED_MONGO_URL: "mongodb://localhost:27017",
        MANAGED_MONGO_PASSWORD: "password123",
        SQL_HOSTNAME: "localhost",
        SQL_PORT: "3306",
        SQL_USERNAME: "root",
        SQL_PASSWORD: "password",
        SQL_DATABASE: "testdb",
        CACHE_HOST_URL: "localhost",
        CACHE_USERNAME: "cacheuser",
        CACHE_PASSWORD: "cachepass",
        CACHE_PORT: "6379",
        MINI_ERP_BASE_URL: "http://localhost:3000",
        MINI_ERP_USERNAME: "erpuser",
        MINI_ERP_PASSWORD: "erppass",
        SHIPPING_DATA_PROXY_SCRAPE_API_KEY: "apikey123",
        REPRICER_ENCRYPTION_KEY: "test-encryption-key-32-chars-long!!",
        APP_LOG_PATH: "/custom/log/path",
        FILE_PATH: "/custom/file/path",
      };

      const { validateConfig } = require("./config");
      const result = validateConfig();

      expect(result.APP_LOG_PATH).toBe("/custom/log/path");
      expect(result.FILE_PATH).toBe("/custom/file/path");
    });
  });
});
