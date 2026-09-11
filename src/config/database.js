import pg from "pg";
import config from "./env.js";
import logger from "../utils/logger.js";

const { Pool, types } = pg;



// OID 1114 = timestamp without time zone
types.setTypeParser(1114, (str) => str);


const pool = new Pool({
  user: config.db.user,
  host: config.db.host,
  database: config.db.database,
  password: config.db.password,
  port: config.db.port,

  // Scalability limits
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,

  ssl: {
    rejectUnauthorized: false,
  },
});

logger.info(
  `PostgreSQL Pool Initialized -> Host: "${config.db.host}" | Database: "${config.db.database}" | Environment: "${config.nodeEnv}"`
);

const prodDbName = process.env.DB_DATABASE_PROD || "vinayak_db";
if (config.nodeEnv === "development" && config.db.database === prodDbName) {
  logger.warn(
    `⚠️ SAFETY WARNING: Currently running in DEVELOPMENT mode but connected to PRODUCTION database "${prodDbName}"!`
  );
}

pool.on("error", (err) => {
  logger.error("Unexpected error on idle database client", err);
});

export default pool;
