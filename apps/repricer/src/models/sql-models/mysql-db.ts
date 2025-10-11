import DataBase from "mysql2";
import { applicationConfig } from "../../utility/config";
// import Encrypto from "../../utility/encrypto";

// const encrypto = new Encrypto(applicationConfig.REPRICER_ENCRYPTION_KEY);
// const sqlPassword = encrypto.decrypt(applicationConfig.SQL_PASSWORD);

export default DataBase.createPool({
  host: applicationConfig.SQL_HOSTNAME,
  port: applicationConfig.SQL_PORT,
  user: applicationConfig.SQL_USERNAME,
  password: applicationConfig.SQL_PASSWORD,
  database: applicationConfig.SQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 100,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
}).promise();
