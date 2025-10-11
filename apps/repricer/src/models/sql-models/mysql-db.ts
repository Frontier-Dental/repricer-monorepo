import DataBase from "mysql2";
import { applicationConfig } from "../../utility/config";
import Encrypto from "../../utility/encrypto";

// Helper: safely decrypt if format matches IV:CipherText
function tryDecrypt(value: string): string {
  if (typeof value !== "string" || !value.includes(":")) return value;
  const encrypto = new Encrypto(applicationConfig.REPRICER_ENCRYPTION_KEY);
  return encrypto.decrypt(value);
}

const sqlPassword = tryDecrypt(applicationConfig.SQL_PASSWORD);

export default DataBase.createPool({
  host: applicationConfig.SQL_HOSTNAME,
  port: applicationConfig.SQL_PORT,
  user: applicationConfig.SQL_USERNAME,
  password: sqlPassword,
  database: applicationConfig.SQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 100,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
}).promise();
