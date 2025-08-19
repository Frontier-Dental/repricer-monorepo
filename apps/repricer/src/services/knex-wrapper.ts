import { Knex, knex } from "knex";
import { applicationConfig } from "../utility/config";

let knexInstance: Knex | null = null;

export function getKnexInstance(): Knex {
  if (knexInstance) {
    return knexInstance;
  } else {
    knexInstance = knex({
      client: "mysql2",
      connection: {
        host: applicationConfig.SQL_HOSTNAME,
        port: applicationConfig.SQL_PORT,
        user: applicationConfig.SQL_USERNAME,
        password: applicationConfig.SQL_PASSWORD,
        database: applicationConfig.SQL_DATABASE,
      },
      pool: { min: 0 },
    });
    return knexInstance;
  }
}
