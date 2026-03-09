require("dotenv").config({ path: ".env.test" });
process.env.NODE_ENV = "test";

const requiredForParse = ["MANAGED_MONGO_URL", "MANAGED_MONGO_PASSWORD", "SQL_HOSTNAME", "SQL_USERNAME", "SQL_PASSWORD", "SESSION_SECRET", "REPRICER_API_BASE_URL", "SMTP_USER", "SMTP_HOST", "SMTP_PWD", "CACHE_HOST_URL", "CACHE_USERNAME", "CACHE_PASSWORD", "CACHE_PORT", "REPRICER_ENCRYPTION_KEY", "PROXY_USERNAME", "PROXY_PASSWORD", "FTP_HOST", "FTP_USER", "FTP_PASSWORD", "DEV_SYNC_API_KEY", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"];
const placeholder = "test";
const placeholderPort = "6379";
requiredForParse.forEach((key) => {
  if (process.env[key] == null || process.env[key] === "") {
    process.env[key] = key === "CACHE_PORT" ? placeholderPort : placeholder;
  }
});

jest.setTimeout(10000);
