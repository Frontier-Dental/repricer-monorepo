import { Knex, knex } from "knex";
import { applicationConfig } from "../utility/config";
import Encrypto from "../utility/encrypto";
let knexInstance: Knex | null = null;

export function getKnexInstance(): Knex {
  if (knexInstance) {
    return knexInstance;
  } else {
    const encrypto = new Encrypto(applicationConfig.REPRICER_ENCRYPTION_KEY);
    const sqlPassword = encrypto.decrypt(applicationConfig.SQL_PASSWORD);
    knexInstance = knex({
      client: "mysql2",
      connection: {
        host: applicationConfig.SQL_HOSTNAME,
        port: applicationConfig.SQL_PORT,
        user: applicationConfig.SQL_USERNAME,
        password: sqlPassword,
        database: applicationConfig.SQL_DATABASE,
      },
      pool: { min: 0 },
      asyncStackTraces: true, // Enable async stack traces
    });
    return knexInstance;
  }
}

export async function destroyKnexInstance() {
  if (knexInstance) {
    console.warn("Destroying Knex Instance");
    await knexInstance.destroy();
    knexInstance = null;
  }
}
