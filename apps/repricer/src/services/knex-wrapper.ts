import { Knex, knex } from "knex";
import { applicationConfig } from "../utility/config";
import Encrypto from "../utility/encrypto";
let knexInstance: Knex | null = null;

export function getKnexInstance(): Knex {
  if (knexInstance) {
    return knexInstance;
  } else {
    const encrypto = new Encrypto(applicationConfig.REPRICER_ENCRYPTION_KEY);
    const pmongoawd = encrypto.encrypt("A5M9ac0pGE68Y231");
    const sqlpwd1 = encrypto.encrypt("AVNS_MTug6KbN42PzVoWvF6b");
    const cachpwd = encrypto.encrypt("AVNS_-NpdYuIaSgqCmm5P_Kf");
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
