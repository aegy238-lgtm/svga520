/**
 * Continuous Background Export Manager
 * Allows exports to continue uninterrupted when the user navigates between pages,
 * switches tabs, or opens the app in another window.
 */

import { playSound } from './sound';
import { safeRevokeUrl } from '../utils/memoryManager';

export interface BackgroundExportJob {
  id: string;
  title: string;
  fileName: string;
  mode: 'server' | 'client';
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0 - 100
  message: string;
  createdAt: number;
  completedAt?: number;
  fileSize?: number;
  downloadUrl?: string;
  blob?: Blob;
  error?: string;
  userId?: string;
}

type JobListener = (jobs: BackgroundExportJob[]) => void;

class BackgroundExportManager {
  private jobs: Map<string, BackgroundExportJob> = new Map();
  private listeners: Set<JobListener> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private pollIntervals: Map<string, any> = new Map();
  private STORAGE_KEY = 'svga_background_export_jobs_v1';

  constructor() {
    this.initBroadcastChannel();
    this.loadFromStorage();
  }

  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('svga_bg_exports_channel');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.type === 'SYNC_JOBS') {
            this.handleRemoteSync(event.data.jobs);
          }
        };
      } catch (e) {
        console.warn('[BackgroundExportManager] BroadcastChannel not supported:', e);
      }
    }
  }

  private broadcast() {
    if (this.broadcastChannel) {
      try {
        const serializableJobs = Array.from(this.jobs.values()).map(j => {
          const copy = { ...j };
          delete copy.blob; // Cannot clone Blob across simple postMessage in some browsers
          return copy;
        });
        this.broadcastChannel.postMessage({ type: 'SYNC_JOBS', jobs: serializableJobs });
      } catch {}
    }
    this.saveToStorage();
    this.notify();
  }

  private handleRemoteSync(remoteJobs: BackgroundExportJob[]) {
    let changed = false;
    for (const rj of remoteJobs) {
      const local = this.jobs.get(rj.id);
      if (!local || local.progress !== rj.progress || local.status !== rj.status) {
        this.jobs.set(rj.id, {
          ...(local || {}),
          ...rj,
          blob: local?.blob // preserve local blob if exists
        });
        changed = true;
      }
    }
    if (changed) {
      this.notify();
    }
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const list: BackgroundExportJob[] = JSON.parse(raw);
        for (const j of list) {
          // Keep completed or active jobs from the last 12 hours
          if (Date.now() - j.createdAt < 12 * 60 * 60 * 1000) {
            this.jobs.set(j.id, j);
            if (j.mode === 'server' && (j.status === 'processing' || j.status === 'queued')) {
              this.startPollingServerJob(j.id);
            }
          }
        }
        this.notify();
      }
    } catch (e) {
      console.warn('[BackgroundExportManager] Error loading from storage:', e);
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      const serializableJobs = Array.from(this.jobs.values())
        .slice(-20) // Keep last 20 jobs
        .map(j => {
          const copy = { ...j };
          delete copy.blob;
          return copy;
        });
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(serializableJobs));
    } catch {}
  }

  private notify() {
    const list = Array.from(this.jobs.values()).sort((a, b) => b.createdAt - a.createdAt);
    this.listeners.forEach(fn => fn(list));
  }

  public subscribe(listener: JobListener): () => void {
    this.listeners.add(listener);
    listener(Array.from(this.jobs.values()).sort((a, b) => b.createdAt - a.createdAt));
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getJobs(): BackgroundExportJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public getJob(id: string): BackgroundExportJob | undefined {
    return this.jobs.get(id);
  }

  /**
   * Start a continuous client-side export in the background.
   * Runs in the global scope so navigating between pages or switching tabs does not kill it.
   */
  public async startClientExport(params: {
    title: string;
    fileName: string;
    taskFn: (
      updateProgress: (percentage: number, message: string) => void,
      isCancelled: () => boolean
    ) => Promise<Blob>;
    userId?: string;
  }): Promise<string> {
    const jobId = `client_job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const job: BackgroundExportJob = {
      id: jobId,
      title: params.title,
      fileName: params.fileName,
      mode: 'client',
      status: 'processing',
      progress: 5,
      message: 'جاري بدء التصدير في الخلفية...',
      createdAt: Date.now(),
      userId: params.userId || 'guest'
    };

    this.jobs.set(jobId, job);
    this.broadcast();

    // Run asynchronously
    (async () => {
      try {
        let cancelled = false;
        const blob = await params.taskFn((percentage, message) => {
          const current = this.jobs.get(jobId);
          if (current && current.status === 'processing') {
            current.progress = Math.min(99, Math.max(1, Math.round(percentage)));
            current.message = message;
            this.broadcast();
          }
        }, () => {
          const current = this.jobs.get(jobId);
          return current?.status === 'cancelled';
        });

        const current = this.jobs.get(jobId);
        if (current && current.status !== 'cancelled') {
          current.status = 'completed';
          current.progress = 100;
          current.completedAt = Date.now();
          current.message = 'اكتمل التصدير بنجاح! جاهز للتحميل.';
          current.blob = blob;
          current.fileSize = blob.size;
          current.downloadUrl = URL.createObjectURL(blob);
          this.broadcast();

          // Play subtle audio alert and notify
          try {
            playSound('success');
          } catch {}
        }
      } catch (err: any) {
        console.error('[BackgroundExportManager] Client task failed:', err);
        const current = this.jobs.get(jobId);
        if (current && current.status !== 'cancelled') {
          current.status = 'failed';
          current.progress = 100;
          current.message = err?.message || 'فشل التصدير';
          current.error = String(err);
          this.broadcast();
          try { playSound('error'); } catch {}
        }
      }
    })();

    return jobId;
  }

  /**
   * Start a heavy server-side background export.
   * Completely offloads CPU and RAM to the server. Works even if user closes the browser!
   */
  public async startServerExport(params: {
    file: Blob | File;
    audioFile?: Blob | File | null;
    title: string;
    targetFormat: string;
    fps?: number;
    quality?: string;
    userId?: string;
    options?: any;
  }): Promise<string> {
    const formData = new FormData();
    formData.append('file', params.file, (params.file as any).name || 'input.mp4');
    if (params.audioFile) {
      formData.append('audio', params.audioFile, (params.audioFile as any).name || 'audio.mp3');
    }
    formData.append('title', params.title);
    formData.append('targetFormat', params.targetFormat);
    formData.append('fps', String(params.fps || 30));
    formData.append('quality', params.quality || 'high');
    formData.append('userId', params.userId || 'guest');
    formData.append('optionsJson', JSON.stringify(params.options || {}));

    const response = await fetch('/api/export-jobs/create', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'فشل في إرسال مهمة التصدير السحابية.');
    }

    const data = await response.json();
    const jobId = data.jobId;

    const job: BackgroundExportJob = {
      id: jobId,
      title: params.title,
      fileName: data.job?.outputFileName || `${params.title}.${params.targetFormat}`,
      mode: 'server',
      status: 'processing',
      progress: 10,
      message: 'تم تفويض المهمة للسيرفر، جاري المعالجة السحابية الفائقة...',
      createdAt: Date.now(),
      userId: params.userId || 'guest'
    };

    this.jobs.set(jobId, job);
    this.broadcast();

    // Start background polling for status updates
    this.startPollingServerJob(jobId);

    return jobId;
  }

  private startPollingServerJob(jobId: string) {
    if (this.pollIntervals.has(jobId)) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/export-jobs/${jobId}`);
        if (!res.ok) {
          if (res.status === 404) {
            clearInterval(interval);
            this.pollIntervals.delete(jobId);
          }
          return;
        }

        const data = await res.json();
        if (data.success && data.job) {
          const serverJob = data.job;
          const current = this.jobs.get(jobId);
          if (current) {
            current.status = serverJob.status;
            current.progress = serverJob.progress;
            current.message = serverJob.message;
            current.fileName = serverJob.outputFileName || current.fileName;
            current.fileSize = serverJob.outputFileSize || current.fileSize;
            current.error = serverJob.error;
            if (serverJob.status === 'completed') {
              current.downloadUrl = serverJob.downloadUrl;
              current.completedAt = serverJob.completedAt || Date.now();
              clearInterval(interval);
              this.pollIntervals.delete(jobId);
              try { playSound('success'); } catch {}
            } else if (serverJob.status === 'failed' || serverJob.status === 'cancelled') {
              clearInterval(interval);
              this.pollIntervals.delete(jobId);
              try { playSound('error'); } catch {}
            }
            this.broadcast();
          }
        }
      } catch (err) {
        console.warn(`[BackgroundExportManager] Polling error for ${jobId}:`, err);
      }
    }, 1500);

    this.pollIntervals.set(jobId, interval);
  }

  /**
   * Trigger direct file download for a job
   */
  public downloadJob(id: string) {
    const job = this.jobs.get(id);
    if (!job || job.status !== 'completed') return;

    const filename = job.fileName || `export_${Date.now()}`;

    if (job.blob) {
      const url = URL.createObjectURL(job.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      safeRevokeUrl(url, 3000);
    } else if (job.downloadUrl) {
      const a = document.createElement('a');
      a.href = job.downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  /**
   * Cancel an active job
   */
  public async cancelJob(id: string) {
    const job = this.jobs.get(id);
    if (!job) return;

    if (job.mode === 'server') {
      try {
        await fetch(`/api/export-jobs/${id}/cancel`, { method: 'POST' });
      } catch {}
    }

    if (this.pollIntervals.has(id)) {
      clearInterval(this.pollIntervals.get(id));
      this.pollIntervals.delete(id);
    }

    job.status = 'cancelled';
    job.progress = 100;
    job.message = 'تم إلغاء المهمة بنجاح.';
    this.broadcast();
  }

  /**
   * Remove job from history
   */
  public removeJob(id: string) {
    const job = this.jobs.get(id);
    if (job?.downloadUrl && job.downloadUrl.startsWith('blob:')) {
      safeRevokeUrl(job.downloadUrl);
    }
    if (this.pollIntervals.has(id)) {
      clearInterval(this.pollIntervals.get(id));
      this.pollIntervals.delete(id);
    }
    this.jobs.delete(id);
    this.broadcast();
  }

  /**
   * Clear all completed and failed jobs
   */
  public clearFinishedJobs() {
    for (const [id, job] of this.jobs.entries()) {
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        if (job.downloadUrl && job.downloadUrl.startsWith('blob:')) {
          safeRevokeUrl(job.downloadUrl);
        }
        this.jobs.delete(id);
      }
    }
    this.broadcast();
  }
}

export const backgroundExportManager = new BackgroundExportManager();
