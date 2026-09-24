import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand, 
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';

// Cloudflare R2 / S3 Configuration Loader
export interface R2Config {
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucketName?: string;
  endpoint?: string;
  publicUrl?: string; // e.g. https://pub-xxx.r2.dev or custom domain
}

let s3ClientInstance: S3Client | null = null;
let currentConfig: R2Config | null = null;

export function getR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || '';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.STORAGE_ACCESS_KEY || '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.STORAGE_SECRET_KEY || '';
  const bucketName = process.env.R2_BUCKET_NAME || process.env.STORAGE_BUCKET || 'app-cache';
  const publicUrl = process.env.R2_PUBLIC_URL || process.env.STORAGE_PUBLIC_URL || '';

  // Standard Cloudflare R2 Endpoint: https://<accountid>.r2.cloudflarestorage.com
  let endpoint = process.env.R2_ENDPOINT || process.env.STORAGE_ENDPOINT || '';
  if (!endpoint && accountId) {
    endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    endpoint,
    publicUrl
  };
}

export function isR2Configured(): boolean {
  const cfg = getR2Config();
  return Boolean(cfg.accessKeyId && cfg.secretAccessKey && (cfg.endpoint || cfg.accountId));
}

export function getS3Client(): S3Client | null {
  if (!isR2Configured()) return null;

  const cfg = getR2Config();
  if (
    !s3ClientInstance || 
    currentConfig?.accessKeyId !== cfg.accessKeyId || 
    currentConfig?.endpoint !== cfg.endpoint
  ) {
    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: cfg.endpoint,
      credentials: {
        accessKeyId: cfg.accessKeyId!,
        secretAccessKey: cfg.secretAccessKey!
      }
    });
    currentConfig = cfg;
  }

  return s3ClientInstance;
}

/**
 * Upload file buffer directly to Cloudflare R2
 */
export async function uploadBufferToR2(
  key: string,
  buffer: Buffer,
  mimeType: string,
  metadata: Record<string, string> = {}
): Promise<{ key: string; publicUrl?: string; size: number }> {
  const client = getS3Client();
  const cfg = getR2Config();
  if (!client) {
    throw new Error('Cloudflare R2 is not configured. Please set R2_ACCESS_KEY_ID & R2_SECRET_ACCESS_KEY.');
  }

  const command = new PutObjectCommand({
    Bucket: cfg.bucketName,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    Metadata: metadata
  });

  await client.send(command);

  const publicUrl = cfg.publicUrl ? `${cfg.publicUrl.replace(/\/$/, '')}/${key}` : undefined;

  return {
    key,
    publicUrl,
    size: buffer.length
  };
}

/**
 * Upload a local file path to Cloudflare R2
 */
export async function uploadLocalFileToR2(
  key: string,
  filePath: string,
  mimeType: string,
  metadata: Record<string, string> = {}
): Promise<{ key: string; publicUrl?: string; size: number }> {
  const client = getS3Client();
  const cfg = getR2Config();
  if (!client) {
    throw new Error('Cloudflare R2 is not configured.');
  }

  const fileStream = fs.createReadStream(filePath);
  const stat = fs.statSync(filePath);

  const command = new PutObjectCommand({
    Bucket: cfg.bucketName,
    Key: key,
    Body: fileStream,
    ContentType: mimeType,
    ContentLength: stat.size,
    Metadata: metadata
  });

  await client.send(command);

  const publicUrl = cfg.publicUrl ? `${cfg.publicUrl.replace(/\/$/, '')}/${key}` : undefined;

  return {
    key,
    publicUrl,
    size: stat.size
  };
}

/**
 * Generate a pre-signed download URL (e.g. 1 hour or 24 hours validity)
 */
export async function getR2PresignedDownloadUrl(key: string, expiresInSeconds: number = 86400): Promise<string> {
  const client = getS3Client();
  const cfg = getR2Config();
  if (!client) {
    throw new Error('Cloudflare R2 is not configured.');
  }

  const command = new GetObjectCommand({
    Bucket: cfg.bucketName,
    Key: key
  });

  return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Delete object from Cloudflare R2
 */
export async function deleteR2Object(key: string): Promise<boolean> {
  const client = getS3Client();
  const cfg = getR2Config();
  if (!client) return false;

  try {
    const command = new DeleteObjectCommand({
      Bucket: cfg.bucketName,
      Key: key
    });
    await client.send(command);
    return true;
  } catch (error) {
    console.error(`[R2] Delete error for key ${key}:`, error);
    return false;
  }
}

/**
 * Multipart Upload initialization for huge files
 */
export async function initR2MultipartUpload(key: string, mimeType: string): Promise<string> {
  const client = getS3Client();
  const cfg = getR2Config();
  if (!client) throw new Error('Cloudflare R2 is not configured.');

  const command = new CreateMultipartUploadCommand({
    Bucket: cfg.bucketName,
    Key: key,
    ContentType: mimeType
  });

  const res = await client.send(command);
  if (!res.UploadId) throw new Error('Failed to initiate R2 multipart upload');
  return res.UploadId;
}

/**
 * Upload part in multipart upload
 */
export async function uploadR2Part(
  key: string,
  uploadId: string,
  partNumber: number,
  body: Buffer
): Promise<{ ETag?: string; PartNumber: number }> {
  const client = getS3Client();
  const cfg = getR2Config();
  if (!client) throw new Error('Cloudflare R2 is not configured.');

  const command = new UploadPartCommand({
    Bucket: cfg.bucketName,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
    Body: body
  });

  const res = await client.send(command);
  return {
    ETag: res.ETag,
    PartNumber: partNumber
  };
}

/**
 * Complete multipart upload
 */
export async function completeR2MultipartUpload(
  key: string,
  uploadId: string,
  parts: { ETag?: string; PartNumber: number }[]
): Promise<{ key: string; publicUrl?: string }> {
  const client = getS3Client();
  const cfg = getR2Config();
  if (!client) throw new Error('Cloudflare R2 is not configured.');

  const command = new CompleteMultipartUploadCommand({
    Bucket: cfg.bucketName,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber)
    }
  });

  await client.send(command);
  const publicUrl = cfg.publicUrl ? `${cfg.publicUrl.replace(/\/$/, '')}/${key}` : undefined;

  return { key, publicUrl };
}
