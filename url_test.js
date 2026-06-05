import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

try {
  const result = await pool.query('SELECT NOW()');

  console.log('✅ Connected Successfully');
  console.log(result.rows);

  await pool.end();
} catch (error) {
  console.error('❌ Connection Failed');
  console.error(error);
}