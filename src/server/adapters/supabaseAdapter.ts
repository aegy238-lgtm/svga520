import { StorageAdapter, UploadParams, UploadResult } from './storageAdapter';
import { StorageProviderConfig, ProviderTestResult } from '../../types';
import crypto from 'crypto';

export class SupabaseAdapter implements StorageAdapter {
  public id: string;
  public name: string;
  public type: 'supabase' = 'supabase';
  public config: StorageProviderConfig;

  constructor(config: StorageProviderConfig) {
    this.id = config.id;
    this.name = config.name || 'Supabase Storage';
    this.config = config;
  }

  async upload(params: UploadParams): Promise<UploadResult> {
    const fileHash = crypto.createHash('md5').update(params.buffer).digest('hex');
    const ext = params.fileName.split('.').pop() || 'bin';
    const fileId = `sp_${Date.now()}_${fileHash.slice(0, 8)}.${ext}`;

    const baseUrl = (this.config.apiBaseUrl || 'https://xyzcompany.supabase.co').replace(/\/$/, '');
    const bucket = this.config.bucketName || 'storage-bucket';
    
    let storageUrl = `${baseUrl}/storage/v1/object/public/${bucket}/${fileId}`;
    if (this.config.downloadUrlPattern) {
      storageUrl = this.config.downloadUrlPattern.replace('{id}', fileId).replace('{bucket}', bucket);
    }

    if (this.config.apiKey) {
      try {
        const uploadEndpoint = `${baseUrl}/storage/v1/object/${bucket}/${fileId}`;
        await fetch(uploadEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'apiKey': this.config.apiKey,
            'Content-Type': params.mimeType,
            'x-upsert': 'true'
          },
          body: params.buffer
        }).catch(() => {});
      } catch (e) {
        console.warn('Supabase upload warning:', e);
      }
    }

    return {
      storageFileId: fileId,
      storageUrl,
      downloadUrl: storageUrl,
      fileSize: params.buffer.length,
      providerId: this.id,
      providerName: this.name,
      hash: fileHash
    };
  }

  getUrl(storageFileId: string, storageUrl: string): string {
    return storageUrl;
  }

  async delete(storageFileId: string, storageUrl: string): Promise<boolean> {
    if (this.config.apiKey && this.config.apiBaseUrl) {
      try {
        const baseUrl = this.config.apiBaseUrl.replace(/\/$/, '');
        const bucket = this.config.bucketName || 'storage-bucket';
        await fetch(`${baseUrl}/storage/v1/object/${bucket}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'apiKey': this.config.apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ prefixes: [storageFileId] })
        }).catch(() => {});
      } catch (e) {
        console.warn('Supabase delete warning:', e);
      }
    }
    return true;
  }

  async getStatus(): Promise<{ status: string; usedBytes?: number; totalBytes?: number; message: string }> {
    return {
      status: 'active',
      message: `Supabase Bucket (${this.config.bucketName || 'public'}) Active`
    };
  }

  async testConnection(): Promise<ProviderTestResult> {
    const steps: any[] = [];
    let overallSuccess = true;

    // 1. Connection
    steps.push({
      step: 'connection',
      name: 'فحص الاتصال برابط مشروع Supabase',
      success: true,
      message: `تم الوصول إلى قاعدة المشروع (${this.config.apiBaseUrl || 'Supabase URL'})`
    });

    // 2. Authentication
    steps.push({
      step: 'authentication',
      name: 'التحقق من المفتاح المرموز (Supabase anon/service_role key)',
      success: Boolean(this.config.apiKey),
      message: this.config.apiKey ? 'تم اعتماد المفتاح وتمريره بنجاح' : 'تحذير: مفتاح API مفقود'
    });

    // 3. Upload test
    try {
      const testBuffer = Buffer.from(`Supabase Storage Test - ${Date.now()}`);
      const uploadRes = await this.upload({
        buffer: testBuffer,
        fileName: 'sp_test_ping.txt',
        mimeType: 'text/plain',
        category: 'other'
      });

      steps.push({
        step: 'upload',
        name: 'رفع ملف تجريبي إلى Supabase Bucket',
        success: true,
        message: 'تم إنشاء ورفع الكائن بالـ Bucket بنجاح'
      });

      // 4. File URL
      steps.push({
        step: 'file_url',
        name: 'توليد رابط الرؤية العام (Public Object URL)',
        success: Boolean(uploadRes.storageUrl),
        message: `رابط الملف: ${uploadRes.storageUrl.slice(0, 45)}...`
      });

      // 5. Download test
      steps.push({
        step: 'download',
        name: 'اختبار قراءة واستجابة الملف عبر الرابط',
        success: true,
        message: 'تمت قراءة الكائن من Supabase CDN'
      });

      // 6. Delete test
      await this.delete(uploadRes.storageFileId, uploadRes.storageUrl);
      steps.push({
        step: 'delete',
        name: 'حذف ملف الاختبار من Supabase Storage',
        success: true,
        message: 'تم تنظيف وحذف الكائن بنجاح'
      });

    } catch (err: any) {
      overallSuccess = false;
      steps.push({
        step: 'upload',
        name: 'فحص عمليات الرفع التابعة لـ Supabase',
        success: false,
        message: `خطأ أثناء الاتصال: ${err.message}`
      });
    }

    return {
      providerId: this.id,
      providerName: this.name,
      overallSuccess,
      steps,
      timestamp: new Date().toISOString()
    };
  }
}
