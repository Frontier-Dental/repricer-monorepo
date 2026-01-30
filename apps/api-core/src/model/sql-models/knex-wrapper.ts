import { Knex, knex } from "knex";
import { applicationConfig } from "../../utility/config";
import Encrypto from "../../utility/encrypto";

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
        connectTimeout: 10000,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
      },
      pool: {
        min: 2,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200,
        // Validate before use
        validate: (connection: any) => {
          return connection
            .query("SELECT 1")
            .then(() => true)
            .catch(() => false);
        },
      } as any,
      acquireConnectionTimeout: 10000,
    });

    // Log pool events for debugging
    knexInstance.on("query-error", (error, obj) => {
      console.error("Knex query error:", error, obj);
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
