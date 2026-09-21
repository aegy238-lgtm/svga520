import { StorageProviderConfig, StorageProviderType, ProviderTestResult } from '../../types';

export interface UploadParams {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  category: string;
  userId?: string;
  userName?: string;
}

export interface UploadResult {
  storageFileId: string;
  storageUrl: string;
  downloadUrl: string;
  fileSize: number;
  providerId: string;
  providerName: string;
  hash: string;
}

export interface StorageAdapter {
  id: string;
  name: string;
  type: StorageProviderType;
  config: StorageProviderConfig;

  upload(params: UploadParams): Promise<UploadResult>;
  uploadBatch?(files: UploadParams[]): Promise<UploadResult[]>;
  getUrl(storageFileId: string, storageUrl: string): string;
  delete(storageFileId: string, storageUrl: string): Promise<boolean>;
  getStatus(): Promise<{ status: string; usedBytes?: number; totalBytes?: number; message: string }>;
  testConnection(): Promise<ProviderTestResult>;
}
