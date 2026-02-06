import knex, { Knex } from "knex";
import Encrypto from "./encrypto";
import { config } from "./config";

let knexInstance: Knex | null = null;

function getKnexInstance(): Knex {
  if (knexInstance) return knexInstance;

  const encrypto = new Encrypto(config.REPRICER_ENCRYPTION_KEY);
  const sqlPassword = encrypto.decrypt(config.SQL_PASSWORD);

  knexInstance = knex({
    client: "mysql2",
    connection: {
      host: config.SQL_HOSTNAME,
      port: config.SQL_PORT,
      user: config.SQL_USERNAME,
      password: sqlPassword,
      database: config.SQL_DATABASE,
    },
    pool: {
      min: 0,
      max: 2,
      idleTimeoutMillis: 60000,
      afterCreate: (conn: any, done: (err: Error | null, conn: any) => void) => {
        conn.query("SELECT 1", (err: Error | null) => done(err, conn));
      },
    },
    acquireConnectionTimeout: 10000,
  });

  return knexInstance;
}

export async function getActiveProducts(): Promise<{ MpId: number }[]> {
  const db = getKnexInstance();
  return db(config.PRODUCT_TABLE)
    .distinct("MpId")
    .where(function () {
      this.whereNotNull("RegularCronId").orWhereNotNull("LinkedCronId");
    })
    .where("IsActive", true)
    .orderBy("MpId");
}

export async function destroyConnection(): Promise<void> {
  if (knexInstance) {
    await knexInstance.destroy();
    knexInstance = null;
  }
}
