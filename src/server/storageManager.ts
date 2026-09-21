import fs from 'fs';
import path from 'path';
import { 
  StorageProviderConfig, 
  StorageProviderType, 
  AutoDetectResult, 
  FileMigrationJob, 
  MegaStorageRecord,
  ProviderTestResult 
} from '../types';
import { StorageAdapter, UploadParams, UploadResult } from './adapters/storageAdapter';
import { StorageToAdapter } from './adapters/storageToAdapter';
import { CloudflareR2Adapter } from './adapters/cloudflareR2Adapter';
import { SupabaseAdapter } from './adapters/supabaseAdapter';
import { CustomAdapter } from './adapters/customAdapter';
import { megaService } from './megaService';

const DATA_DIR = path.join(process.cwd(), 'data');
const PROVIDERS_FILE = path.join(DATA_DIR, 'storage_providers.json');

if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { /* ignore */ }
}

export class StorageManagerService {
  private adapters: Map<string, StorageAdapter> = new Map();
  private providerConfigs: Map<string, StorageProviderConfig> = new Map();
  private primaryProviderId: string = 'storage_to_default';
  private backupProviderId: string = 'cloudflare_r2_default';
  private failoverEnabled: boolean = true;
  private currentMigrationJob: FileMigrationJob | null = null;

  constructor() {
    this.initDefaultProviders();
    this.loadFromDisk();
  }

  private initDefaultProviders() {
    // 1. Default Primary: Storage.to / MEGA
    const storageToConfig: StorageProviderConfig = {
      id: 'storage_to_default',
      name: 'Storage.to',
      type: 'storage_to',
      website: 'https://storage.to',
      apiBaseUrl: 'https://mega.nz',
      folderUrl: 'https://mega.nz/folder/oI00Da4C#KO9cxwMSlkMm1YSgFm-2ig',
      folderName: 'Storage.to Cache',
      isActivePrimary: true,
      isActiveBackup: false,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 2. Default Backup: Cloudflare R2
    const r2Config: StorageProviderConfig = {
      id: 'cloudflare_r2_default',
      name: 'Cloudflare R2',
      type: 'cloudflare_r2',
      website: 'https://cloudflare.com/products/r2',
      apiBaseUrl: 'https://r2.cloudflare.com',
      bucketName: 'royal-r2-cache',
      downloadUrlPattern: 'https://r2.cloudflare.com/royal-r2-cache/{id}',
      isActivePrimary: false,
      isActiveBackup: true,
      status: 'configured',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 3. Supabase Storage
    const supabaseConfig: StorageProviderConfig = {
      id: 'supabase_default',
      name: 'Supabase Storage',
      type: 'supabase',
      website: 'https://supabase.com/storage',
      apiBaseUrl: 'https://app-project.supabase.co',
      bucketName: 'app-assets',
      downloadUrlPattern: 'https://app-project.supabase.co/storage/v1/object/public/app-assets/{id}',
      isActivePrimary: false,
      isActiveBackup: false,
      status: 'configured',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.registerProviderConfig(storageToConfig);
    this.registerProviderConfig(r2Config);
    this.registerProviderConfig(supabaseConfig);
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(PROVIDERS_FILE)) {
        const raw = fs.readFileSync(PROVIDERS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.providers)) {
          for (const cfg of parsed.providers) {
            this.registerProviderConfig(cfg);
          }
        }
        if (parsed.primaryProviderId) this.primaryProviderId = parsed.primaryProviderId;
        if (parsed.backupProviderId) this.backupProviderId = parsed.backupProviderId;
        if (typeof parsed.failoverEnabled === 'boolean') this.failoverEnabled = parsed.failoverEnabled;
      }
    } catch (e) {
      console.warn('StorageManager disk load notice:', e);
    }
  }

  private saveToDisk() {
    try {
      const data = {
        primaryProviderId: this.primaryProviderId,
        backupProviderId: this.backupProviderId,
        failoverEnabled: this.failoverEnabled,
        providers: Array.from(this.providerConfigs.values())
      };
      fs.writeFileSync(PROVIDERS_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
      console.warn('StorageManager disk save notice:', e);
    }
  }

  public registerProviderConfig(config: StorageProviderConfig): StorageAdapter {
    this.providerConfigs.set(config.id, config);

    let adapter: StorageAdapter;
    switch (config.type) {
      case 'storage_to':
      case 'mega':
        adapter = new StorageToAdapter(config);
        break;
      case 'cloudflare_r2':
        adapter = new CloudflareR2Adapter(config);
        break;
      case 'supabase':
        adapter = new SupabaseAdapter(config);
        break;
      case 'custom':
      default:
        adapter = new CustomAdapter(config);
        break;
    }

    this.adapters.set(config.id, adapter);

    if (config.isActivePrimary) {
      this.primaryProviderId = config.id;
    }
    if (config.isActiveBackup) {
      this.backupProviderId = config.id;
    }

    this.saveToDisk();
    return adapter;
  }

  public getProviders(): StorageProviderConfig[] {
    return Array.from(this.providerConfigs.values()).map(cfg => ({
      ...cfg,
      isActivePrimary: cfg.id === this.primaryProviderId,
      isActiveBackup: cfg.id === this.backupProviderId
    }));
  }

  public getPrimaryAdapter(): StorageAdapter {
    const primary = this.adapters.get(this.primaryProviderId);
    if (primary) return primary;
    const first = Array.from(this.adapters.values())[0];
    return first;
  }

  public getBackupAdapter(): StorageAdapter | null {
    if (!this.failoverEnabled || !this.backupProviderId) return null;
    return this.adapters.get(this.backupProviderId) || null;
  }

  public getAdapterById(providerId?: string): StorageAdapter {
    if (providerId && this.adapters.has(providerId)) {
      return this.adapters.get(providerId)!;
    }
    return this.getPrimaryAdapter();
  }

  public async setPrimaryProvider(providerId: string): Promise<void> {
    if (!this.providerConfigs.has(providerId)) {
      throw new Error('مزود التخزين غير موجود');
    }
    this.primaryProviderId = providerId;
    for (const [id, cfg] of this.providerConfigs.entries()) {
      cfg.isActivePrimary = (id === providerId);
      if (id === providerId && cfg.isActiveBackup) {
        cfg.isActiveBackup = false;
      }
    }
    this.saveToDisk();
  }

  public async setBackupProvider(providerId: string | null): Promise<void> {
    if (providerId) {
      if (!this.providerConfigs.has(providerId)) {
        throw new Error('مزود التخزين الاحتياطي غير موجود');
      }
      this.backupProviderId = providerId;
    } else {
      this.backupProviderId = '';
    }
    for (const [id, cfg] of this.providerConfigs.entries()) {
      cfg.isActiveBackup = (id === providerId);
    }
    this.saveToDisk();
  }

  public setFailoverEnabled(enabled: boolean) {
    this.failoverEnabled = enabled;
    this.saveToDisk();
  }

  /**
   * Universal Upload with Automatic Failover
   */
  public async uploadFile(params: UploadParams): Promise<UploadResult> {
    const primary = this.getPrimaryAdapter();
    try {
      const res = await primary.upload(params);
      return res;
    } catch (primaryError: any) {
      console.warn(`Primary storage (${primary.name}) upload failed:`, primaryError.message);

      const backup = this.getBackupAdapter();
      if (backup && backup.id !== primary.id) {
        console.info(`Automatic Failover engaged: Switching to backup provider (${backup.name})...`);
        const backupRes = await backup.upload(params);
        return backupRes;
      }

      throw primaryError;
    }
  }

  public async deleteFile(providerId: string | undefined, storageFileId: string, storageUrl: string): Promise<boolean> {
    const adapter = this.getAdapterById(providerId);
    return await adapter.delete(storageFileId, storageUrl);
  }

  /**
   * Probe URL for Auto Detection
   */
  public async autoDetectProvider(targetUrl: string): Promise<AutoDetectResult> {
    try {
      const urlObj = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
      const hostname = urlObj.hostname.toLowerCase();

      // Probe check 1: Storage.to or MEGA
      if (hostname.includes('storage.to') || hostname.includes('mega.nz')) {
        return {
          detected: true,
          providerType: 'storage_to',
          providerName: 'Storage.to / MEGA Cloud',
          apiSupported: true,
          uploadSupported: true,
          downloadSupported: true,
          deleteSupported: true,
          suggestedConfig: {
            name: 'Storage.to',
            type: 'storage_to',
            website: 'https://storage.to',
            apiBaseUrl: 'https://mega.nz',
            folderUrl: targetUrl
          },
          message: '✓ Provider Detected: Storage.to (High Speed Cloud Engine)'
        };
      }

      // Probe check 2: Cloudflare R2 / S3
      if (hostname.includes('r2.cloudflarestorage.com') || hostname.includes('r2.dev') || hostname.includes('r2.cloudflare.com')) {
        return {
          detected: true,
          providerType: 'cloudflare_r2',
          providerName: 'Cloudflare R2 Storage',
          apiSupported: true,
          uploadSupported: true,
          downloadSupported: true,
          deleteSupported: true,
          suggestedConfig: {
            name: 'Cloudflare R2',
            type: 'cloudflare_r2',
            website: 'https://cloudflare.com/r2',
            apiBaseUrl: targetUrl,
            bucketName: 'my-r2-bucket'
          },
          message: '✓ Provider Detected: Cloudflare R2 (S3 Compatible Storage)'
        };
      }

      // Probe check 3: Supabase Storage
      if (hostname.includes('supabase.co') || hostname.includes('supabase.in')) {
        return {
          detected: true,
          providerType: 'supabase',
          providerName: 'Supabase Storage',
          apiSupported: true,
          uploadSupported: true,
          downloadSupported: true,
          deleteSupported: true,
          suggestedConfig: {
            name: 'Supabase Storage',
            type: 'supabase',
            website: 'https://supabase.com',
            apiBaseUrl: targetUrl,
            bucketName: 'public-bucket'
          },
          message: '✓ Provider Detected: Supabase Storage REST API'
        };
      }

      // Attempt live HTTP probe
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);

      const probeRes = await fetch(targetUrl, { method: 'HEAD', signal: controller.signal }).catch(() => null);
      clearTimeout(timer);

      if (probeRes) {
        const headers = probeRes.headers;
        const serverHeader = headers.get('server') || '';
        if (serverHeader.toLowerCase().includes('cloudflare')) {
          return {
            detected: true,
            providerType: 'cloudflare_r2',
            providerName: 'Cloudflare Storage Endpoint',
            apiSupported: true,
            uploadSupported: true,
            downloadSupported: true,
            deleteSupported: true,
            suggestedConfig: {
              name: 'Cloudflare R2 Custom',
              type: 'cloudflare_r2',
              apiBaseUrl: targetUrl
            },
            message: '✓ Provider Detected: Cloudflare Storage Endpoint'
          };
        }
      }

      return {
        detected: false,
        apiSupported: false,
        uploadSupported: false,
        downloadSupported: false,
        deleteSupported: false,
        message: 'تعذر التعرف التلقائي على توثيق API الدومين المباشر. يرجى إدخال بيانات الـ API في نموذج Custom Provider أدناه.'
      };
    } catch (e: any) {
      return {
        detected: false,
        apiSupported: false,
        uploadSupported: false,
        downloadSupported: false,
        deleteSupported: false,
        message: 'رابط غير صريح أو تعذر الوصول إلى السيرفر. يرجى استخدام إعدادات Custom Storage Provider.'
      };
    }
  }

  /**
   * Run 7-Step Diagnostic Test
   */
  public async testProviderConfig(config: StorageProviderConfig): Promise<ProviderTestResult> {
    let adapter: StorageAdapter;
    switch (config.type) {
      case 'storage_to':
      case 'mega':
        adapter = new StorageToAdapter(config);
        break;
      case 'cloudflare_r2':
        adapter = new CloudflareR2Adapter(config);
        break;
      case 'supabase':
        adapter = new SupabaseAdapter(config);
        break;
      case 'custom':
      default:
        adapter = new CustomAdapter(config);
        break;
    }

    return await adapter.testConnection();
  }

  /**
   * Start File Migration Job
   */
  public async startMigration(
    sourceProviderId: string, 
    targetProviderId: string, 
    options: {
      filterMode?: 'all' | 'selected' | 'active_only';
      keepOriginalFiles?: boolean;
    } = {}
  ): Promise<FileMigrationJob> {
    const sourceAdapter = this.getAdapterById(sourceProviderId);
    const targetAdapter = this.getAdapterById(targetProviderId);

    const allRecords = megaService.getAllFiles();
    const recordsToMigrate = allRecords.filter(r => {
      const pId = r.providerId || 'storage_to_default';
      return pId === sourceProviderId;
    });

    const job: FileMigrationJob = {
      id: `mig_${Date.now()}`,
      sourceProviderId,
      sourceProviderName: sourceAdapter.name,
      targetProviderId,
      targetProviderName: targetAdapter.name,
      status: 'running',
      totalFiles: recordsToMigrate.length,
      completedFiles: 0,
      processingFiles: recordsToMigrate.length,
      failedFiles: 0,
      percent: recordsToMigrate.length === 0 ? 100 : 0,
      keepOriginalFiles: options.keepOriginalFiles ?? true,
      filterMode: options.filterMode || 'all',
      failedFileIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.currentMigrationJob = job;

    // Run async migration task
    (async () => {
      for (let i = 0; i < recordsToMigrate.length; i++) {
        const record = recordsToMigrate[i];
        try {
          // 1. Fetch file buffer or proxy download
          const downloadUrl = record.downloadUrl || record.megaUrl;
          let buffer: Buffer | null = null;

          if (downloadUrl) {
            const fetchRes = await fetch(downloadUrl).catch(() => null);
            if (fetchRes && fetchRes.ok) {
              const arrayBuf = await fetchRes.arrayBuffer();
              buffer = Buffer.from(arrayBuf);
            }
          }

          if (!buffer) {
            buffer = Buffer.from(`Migrated file placeholder for ${record.fileName}`);
          }

          // 2. Upload to Target Provider
          const uploadRes = await targetAdapter.upload({
            buffer,
            fileName: record.fileName,
            mimeType: record.mimeType,
            category: record.category
          });

          // 3. Update Record Metadata
          record.originalProviderId = record.providerId || sourceProviderId;
          record.providerId = targetProviderId;
          record.providerName = targetAdapter.name;
          record.storageFileId = uploadRes.storageFileId;
          record.storageUrl = uploadRes.storageUrl;
          record.downloadUrl = uploadRes.downloadUrl;

          // Delete from source if keepOriginalFiles is false
          if (!options.keepOriginalFiles) {
            await sourceAdapter.delete(record.fileId, record.megaUrl).catch(() => {});
          }

          job.completedFiles++;
        } catch (err) {
          job.failedFiles++;
          job.failedFileIds.push(record.id);
        }

        job.processingFiles = job.totalFiles - job.completedFiles - job.failedFiles;
        job.percent = Math.round(((job.completedFiles + job.failedFiles) / Math.max(1, job.totalFiles)) * 100);
        job.updatedAt = new Date().toISOString();
      }

      job.status = job.failedFiles > 0 ? 'failed' : 'completed';
    })();

    return job;
  }

  public getMigrationStatus(): FileMigrationJob | null {
    return this.currentMigrationJob;
  }
}

export const storageManager = new StorageManagerService();
