import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import config from '../config/env.js';
import logger from './logger.js';

let s3Client = null;

function getS3Client() {
  if (!s3Client) {
    const { accessKeyId, secretAccessKey, region } = config.s3;
    if (!accessKeyId || !secretAccessKey) {
      logger.warn('AWS credentials are not properly set in environment variables. S3 uploads might fail.');
    }
    s3Client = new S3Client({
      region: region || 'us-east-1',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return s3Client;
}

/**
 * Uploads a file buffer to S3 and returns the public URL.
 * @param {Object} file - Multer file object
 * @param {string} bucketName - The target AWS S3 bucket name
 * @param {string} [folder='tenders'] - Optional path prefix/folder inside the S3 bucket
 * @returns {Promise<string>} - S3 URL of the uploaded file
 */
export async function uploadToS3(file, bucketName, folder = 'tenders') {
  if (!file) {
    throw new Error('A file object is required for S3 upload');
  }
  if (!bucketName) {
    throw new Error('A bucket name is required for S3 upload');
  }

  const { accessKeyId, secretAccessKey, region } = config.s3;
  if (!accessKeyId || !secretAccessKey || accessKeyId === 'your_access_key_id' || secretAccessKey === 'your_secret_access_key') {
    const mockUrl = `https://${bucketName}.s3.${region || 'us-east-1'}.amazonaws.com/${folder}/${Date.now()}-${file.originalname}`;
    logger.info(`[Mock S3 Upload] File '${file.originalname}' uploaded to: ${mockUrl}`);
    return mockUrl;
  }

  const client = getS3Client();
  const fileExtension = file.originalname.split('.').pop();
  const uniqueKey = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExtension}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: uniqueKey,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  await client.send(command);

  return `https://${bucketName}.s3.${region || 'us-east-1'}.amazonaws.com/${uniqueKey}`;
}
