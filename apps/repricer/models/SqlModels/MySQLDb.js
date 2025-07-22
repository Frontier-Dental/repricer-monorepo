const DataBase = require("mysql2");
const sqlConnectionPool = DataBase.createPool({
  host: process.env.SQL_HOSTNAME,
  port: parseInt(process.env.SQL_PORT),
  user: process.env.SQL_USERNAME,
  password: process.env.SQL_PASSWORD,
  database: process.env.SQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 100,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
}).promise();
module.exports = sqlConnectionPool;
