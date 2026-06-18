import pg from "pg";
import config from "./env.js";
import logger from "../utils/logger.js";

const { Pool } = pg;

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

  ...(process.env.NODE_ENV !== "development" && {
    ssl: {
      rejectUnauthorized: false,
    },
  }),
});

console.log("lskjdflk -> ", process.env.NODE_ENV);

pool.on("error", (err) => {
  logger.error("Unexpected error on idle database client", err);
});

export default pool;
