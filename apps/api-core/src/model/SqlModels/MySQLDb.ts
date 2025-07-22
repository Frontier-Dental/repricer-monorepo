import { Knex, knex } from "knex";

let knexInstance: Knex | null = null;

export function getKnexInstance(): Knex {
  if (
    !process.env.SQL_HOSTNAME ||
    !process.env.SQL_PORT ||
    !process.env.SQL_USERNAME ||
    !process.env.SQL_PASSWORD ||
    !process.env.SQL_DATABASE
  ) {
    throw new Error(
      "SQL_HOSTNAME, SQL_PORT, SQL_USERNAME, SQL_PASSWORD, and SQL_DATABASE must be set",
    );
  }
  if (knexInstance) {
    return knexInstance;
  } else {
    knexInstance = knex({
      client: "mysql2",
      connection: {
        host: process.env.SQL_HOSTNAME,
        port: parseInt(process.env.SQL_PORT!),
        user: process.env.SQL_USERNAME,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DATABASE,
      },
      pool: { min: 0 },
    });
    return knexInstance;
  }
}
