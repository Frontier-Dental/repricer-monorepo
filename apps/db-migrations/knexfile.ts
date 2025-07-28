import type { Knex } from "knex";
import dotenv from "dotenv";

// Update with your config settings.

function getConnectionConfig(env: string) {
  dotenv.config({ path: `.env.${env}` });
  if (!process.env.SQL_HOSTNAME) {
    throw new Error("SQL_HOSTNAME is not set");
  }
  if (!process.env.SQL_PORT) {
    throw new Error("SQL_PORT is not set");
  }
  if (!process.env.SQL_USERNAME) {
    throw new Error("SQL_USERNAME is not set");
  }
  if (!process.env.SQL_PASSWORD) {
    throw new Error("SQL_PASSWORD is not set");
  }
  if (!process.env.SQL_DATABASE) {
    throw new Error("SQL_DATABASE is not set");
  }
  return {
    host: process.env.SQL_HOSTNAME,
    port: parseInt(process.env.SQL_PORT),
    user: process.env.SQL_USERNAME,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DATABASE,
  };
}

const config: { [key: string]: Knex.Config } = {
  development: {
    client: "mysql2",
    connection: getConnectionConfig("development"),
  },

  production: {
    client: "mysql2",
    connection: getConnectionConfig("production"),
  },
};

export default config;
