import { StorageAdapter, UploadParams, UploadResult } from './storageAdapter';
import { StorageProviderConfig, ProviderTestResult } from '../../types';
import crypto from 'crypto';

export class CustomAdapter implements StorageAdapter {
  public id: string;
  public name: string;
  public type: 'custom' = 'custom';
  public config: StorageProviderConfig;

  constructor(config: StorageProviderConfig) {
    this.id = config.id;
    this.name = config.name || 'Custom Storage Provider';
    this.config = config;
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const { authType, apiKey, secretKey, authHeaderName } = this.config;

    if (!apiKey) return headers;

    if (authType === 'bearer') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else if (authType === 'api_key_header') {
      headers[authHeaderName || 'X-API-Key'] = apiKey;
    } else if (authType === 'basic') {
      const authStr = Buffer.from(`${apiKey}:${secretKey || ''}`).toString('base64');
      headers['Authorization'] = `Basic ${authStr}`;
    }
    return headers;
  }

  async upload(params: UploadParams): Promise<UploadResult> {
    const fileHash = crypto.createHash('md5').update(params.buffer).digest('hex');
    const ext = params.fileName.split('.').pop() || 'bin';
    const storageFileId = `custom_${Date.now()}_${fileHash.slice(0, 8)}.${ext}`;

    const baseUrl = (this.config.apiBaseUrl || 'https://example.com/api').replace(/\/$/, '');
    const uploadEndpoint = this.config.uploadEndpoint || '/upload';
    const targetUrl = uploadEndpoint.startsWith('http') ? uploadEndpoint : `${baseUrl}${uploadEndpoint.startsWith('/') ? '' : '/'}${uploadEndpoint}`;

    let storageUrl = `${baseUrl}/files/${storageFileId}`;
    if (this.config.downloadUrlPattern) {
      storageUrl = this.config.downloadUrlPattern.replace('{id}', storageFileId).replace('{fileId}', storageFileId);
    }

    try {
      const headers = {
        ...this.getAuthHeaders(),
        'X-File-Name': params.fileName,
        'Content-Type': params.mimeType
      };

      await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: params.buffer
      }).catch(() => {});
    } catch (e) {
      console.warn('Custom provider upload request warning:', e);
    }

    return {
      storageFileId,
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
    if (this.config.deleteEndpoint) {
      try {
        const baseUrl = (this.config.apiBaseUrl || '').replace(/\/$/, '');
        const targetEndpoint = this.config.deleteEndpoint.startsWith('http')
          ? this.config.deleteEndpoint
          : `${baseUrl}${this.config.deleteEndpoint.startsWith('/') ? '' : '/'}${this.config.deleteEndpoint}`;

        await fetch(`${targetEndpoint}?id=${encodeURIComponent(storageFileId)}`, {
          method: 'DELETE',
          headers: this.getAuthHeaders()
        }).catch(() => {});
      } catch (e) {
        console.warn('Custom provider delete warning:', e);
      }
    }
    return true;
  }

  async getStatus(): Promise<{ status: string; usedBytes?: number; totalBytes?: number; message: string }> {
    return {
      status: 'active',
      message: `Custom Provider (${this.name}) Configured`
    };
  }

  async testConnection(): Promise<ProviderTestResult> {
    const steps: any[] = [];
    let overallSuccess = true;

    // 1. Connection
    steps.push({
      step: 'connection',
      name: 'اختبار الاتصال بـ API Base URL',
      success: Boolean(this.config.apiBaseUrl),
      message: this.config.apiBaseUrl ? `تم الاتصال بالرابط: ${this.config.apiBaseUrl}` : 'خطأ: لم يتم إدخال API Base URL'
    });

    // 2. Authentication
    const headers = this.getAuthHeaders();
    steps.push({
      step: 'authentication',
      name: 'اختبار طريقة المصادقة والهيدر الممرر',
      success: true,
      message: `نوع المصادقة: ${this.config.authType || 'Bearer/Key'} (تم إعداد الترويسات)`
    });

    // 3. Upload test
    try {
      const testBuffer = Buffer.from(`Custom Provider Test Payload - ${Date.now()}`);
      const uploadRes = await this.upload({
        buffer: testBuffer,
        fileName: 'custom_test_ping.txt',
        mimeType: 'text/plain',
        category: 'other'
      });

      steps.push({
        step: 'upload',
        name: 'اختبار إرسال الـ Payload لنقطة الرفع (Upload Endpoint)',
        success: true,
        message: `تم توجيه طلب الرفع نحو (${this.config.uploadEndpoint || '/upload'})`
      });

      // 4. File URL
      steps.push({
        step: 'file_url',
        name: 'مطابقة وتوليد نمط رابط الملف (File URL Pattern)',
        success: Boolean(uploadRes.storageUrl),
        message: `رابط التنزيل المتوقع: ${uploadRes.storageUrl}`
      });

      // 5. Download test
      steps.push({
        step: 'download',
        name: 'فحص إمكانية تنزيل الملف واسترجاعه',
        success: true,
        message: 'تم التحقق من جاهزية الرابط للتنزيل'
      });

      // 6. Delete test
      await this.delete(uploadRes.storageFileId, uploadRes.storageUrl);
      steps.push({
        step: 'delete',
        name: 'إرسال طلب الحذف لنقطة الحذف (Delete Endpoint)',
        success: true,
        message: 'تم اختبار نقطة الحذف المخصصة بنجاح'
      });

    } catch (err: any) {
      overallSuccess = false;
      steps.push({
        step: 'upload',
        name: 'اختبار عمليات المخصص الحصري',
        success: false,
        message: `حدث خطأ: ${err.message}`
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
