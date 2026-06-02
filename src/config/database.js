import pg from 'pg';
import config from './env.js';
import logger from '../utils/logger.js';

const { Pool } = pg;

const pool = new Pool({
  user: config.db.user,
  host: config.db.host,
  database: config.db.database,
  password: config.db.password,
  port: config.db.port,
  // Scalability limits
  max: 20, // maximum number of clients in the pool
  idleTimeoutMillis: 30000, // close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // return an error if a connection takes too long
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle database client', err);
});

export default pool;
