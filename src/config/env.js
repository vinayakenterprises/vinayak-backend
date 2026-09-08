import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';

// Dynamic database selection based on environment
const defaultDbName = nodeEnv === 'production'
  ? (process.env.DB_DATABASE_PROD || 'vinayak_db')
  : (process.env.DB_DATABASE_DEV || 'vinayak_db_dev');

const dbName = process.env.DB_DATABASE || defaultDbName;

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv,
  db: {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: dbName,
    password: process.env.DB_PASSWORD || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432', 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'VinayakEnterprises',
    expiresIn: process.env.JWT_EXPIRES_IN || '60d',
  },
  s3: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'us-east-1',
    bucketName: process.env.AWS_BUCKET_NAME || '',
  }
};

export default config;
