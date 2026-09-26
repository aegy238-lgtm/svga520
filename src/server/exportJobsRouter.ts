import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { execFile, ChildProcess } from 'child_process';
import util from 'util';

const execFilePromise = util.promisify(execFile);

const FFMPEG_PATH = fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : 'ffmpeg';
const FFPROBE_PATH = fs.existsSync('/usr/bin/ffprobe') ? '/usr/bin/ffprobe' : 'ffprobe';

// Directory configuration for background export tasks
const JOBS_BASE_DIR = path.join(process.cwd(), 'uploads', 'export_jobs');
const INPUTS_DIR = path.join(JOBS_BASE_DIR, 'inputs');
const OUTPUTS_DIR = path.join(JOBS_BASE_DIR, 'outputs');

// Ensure directories exist
try {
  fs.mkdirSync(INPUTS_DIR, { recursive: true });
  fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
} catch (err) {
  console.warn('[ExportJobs] Could not create storage directories:', err);
}

// Multer storage configured with diskStorage so files stream directly to disk without bloating RAM
const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, INPUTS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const safeName = `input_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, safeName);
  }
});

const upload = multer({
  storage: diskStorage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB max upload
  }
});

export interface ExportJobRecord {
  jobId: string;
  userId: string;
  title: string;
  operationType: string;
  targetFormat: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  message: string;
  createdAt: number;
  completedAt?: number;
  inputPath?: string;
  audioPath?: string;
  outputPath?: string;
  outputFileName: string;
  outputFileSize?: number;
  error?: string;
  processRef?: ChildProcess;
}

// In-memory registry of jobs (persists while server is running)
const jobsRegistry = new Map<string, ExportJobRecord>();

/**
 * Periodically purge jobs older than 6 hours to keep disk space lean
 */
function cleanStaleJobs() {
  const cutoff = Date.now() - 6 * 60 * 60 * 1000;
  for (const [id, job] of jobsRegistry.entries()) {
    if (job.createdAt < cutoff) {
      if (job.inputPath && fs.existsSync(job.inputPath)) {
        try { fs.unlinkSync(job.inputPath); } catch {}
      }
      if (job.audioPath && fs.existsSync(job.audioPath)) {
        try { fs.unlinkSync(job.audioPath); } catch {}
      }
      if (job.outputPath && fs.existsSync(job.outputPath)) {
        try { fs.unlinkSync(job.outputPath); } catch {}
      }
      jobsRegistry.delete(id);
    }
  }
}
setInterval(cleanStaleJobs, 30 * 60 * 1000);

const router = express.Router();

/**
 * POST /api/export-jobs/create
 * Creates and asynchronously starts a background export job
 */
router.post('/create', upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'audio', maxCount: 1 }
]), (req: express.Request, res: express.Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const mainFile = files?.file?.[0];
    const audioFile = files?.audio?.[0];

    const {
      userId = 'guest',
      title = 'تصدير خلفي',
      operationType = 'transcode',
      targetFormat = 'mp4',
      fps = '30',
      quality = 'high',
      optionsJson = '{}'
    } = req.body;

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const originalBaseName = mainFile ? path.parse(mainFile.originalname).name : 'export';
    const outputFileName = `${originalBaseName}_exported.${targetFormat}`;
    const outputPath = path.join(OUTPUTS_DIR, `${jobId}_${outputFileName}`);

    const jobRecord: ExportJobRecord = {
      jobId,
      userId,
      title: title || originalBaseName,
      operationType,
      targetFormat,
      status: 'queued',
      progress: 5,
      message: 'تم استلام المهمة في قائمة الانتظار السحابية...',
      createdAt: Date.now(),
      inputPath: mainFile?.path,
      audioPath: audioFile?.path,
      outputPath,
      outputFileName,
    };

    jobsRegistry.set(jobId, jobRecord);

    // Respond immediately to the client so UI is never blocked
    res.json({
      success: true,
      jobId,
      status: jobRecord.status,
      message: 'تم بدء المهمة في الخلفية بنجاح.',
      job: {
        jobId: jobRecord.jobId,
        title: jobRecord.title,
        status: jobRecord.status,
        progress: jobRecord.progress,
        outputFileName: jobRecord.outputFileName
      }
    });

    // Run the job processing in the background asynchronously
    processJobInBackground(jobRecord, {
      fps: parseInt(fps, 10) || 30,
      quality,
      options: JSON.parse(optionsJson || '{}')
    }).catch(err => {
      console.error(`[ExportJobs] Background process failure for ${jobId}:`, err);
    });

  } catch (err: any) {
    console.error('[ExportJobs] Create failed:', err);
    res.status(500).json({ success: false, error: err.message || 'فشل في إنشاء مهمة التصدير' });
  }
});

/**
 * Asynchronously process the export job using FFmpeg streams
 */
async function processJobInBackground(
  job: ExportJobRecord,
  config: { fps: number; quality: string; options: any }
) {
  job.status = 'processing';
  job.progress = 15;
  job.message = 'جاري تحليل وفحص بيانات الوسائط...';

  if (!job.inputPath || !fs.existsSync(job.inputPath)) {
    job.status = 'failed';
    job.error = 'لم يتم العثور على ملف الإدخال المطلوب.';
    job.progress = 100;
    return;
  }

  try {
    const inputPath = job.inputPath;
    const outputPath = job.outputPath!;
    const audioPath = job.audioPath;
    const format = job.targetFormat.toLowerCase();

    // Determine quality arguments
    let crf = '23';
    let preset = 'fast';
    if (config.quality === 'low') {
      crf = '28';
      preset = 'veryfast';
    } else if (config.quality === 'high' || config.quality === 'ultra') {
      crf = '18';
      preset = 'medium';
    }

    job.progress = 30;
    job.message = 'جاري التجهيز والتحويل السحابي فائق السرعة...';

    const args: string[] = ['-y', '-i', inputPath];

    if (audioPath && fs.existsSync(audioPath)) {
      args.push('-i', audioPath);
    }

    // Configure encoders based on target format
    if (format === 'mp4') {
      args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', preset, '-crf', crf);
      if (audioPath && fs.existsSync(audioPath)) {
        args.push('-map', '0:v:0', '-map', '1:a:0', '-c:a', 'aac', '-b:a', '192k', '-shortest');
      } else {
        args.push('-c:a', 'copy');
      }
    } else if (format === 'webm') {
      args.push('-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-crf', '30', '-b:v', '0');
      if (audioPath && fs.existsSync(audioPath)) {
        args.push('-map', '0:v:0', '-map', '1:a:0', '-c:a', 'libopus', '-shortest');
      } else {
        args.push('-c:a', 'copy');
      }
    } else if (format === 'gif') {
      args.push('-vf', `fps=${Math.min(config.fps, 24)},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`);
    } else if (format === 'mp3') {
      args.push('-vn', '-c:a', 'libmp3lame', '-q:a', '2');
    } else {
      // Default standard copy / container conversion
      args.push('-c', 'copy');
    }

    args.push(outputPath);

    job.progress = 50;
    job.message = 'جاري معالجة الإطارات بدقة فائقة...';

    await execFilePromise(FFMPEG_PATH, args, { maxBuffer: 10 * 1024 * 1024 });

    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      job.outputFileSize = stats.size;
      job.status = 'completed';
      job.progress = 100;
      job.completedAt = Date.now();
      job.message = 'اكتمل التصدير بنجاح! الملف جاهز للتحميل.';
    } else {
      throw new Error('لم ينتج ملف الإخراج بعد انتهاء المعالجة.');
    }
  } catch (err: any) {
    console.error(`[ExportJobs] Execution error for job ${job.jobId}:`, err);
    job.status = 'failed';
    job.error = err.message || 'حدث خطأ أثناء معالجة التصدير السحابي.';
    job.progress = 100;
  } finally {
    // Delete temporary input files to free disk space immediately
    if (job.inputPath && fs.existsSync(job.inputPath)) {
      try { fs.unlinkSync(job.inputPath); } catch {}
    }
    if (job.audioPath && fs.existsSync(job.audioPath)) {
      try { fs.unlinkSync(job.audioPath); } catch {}
    }
  }
}

/**
 * GET /api/export-jobs/:jobId
 * Poll the status of a specific job
 */
router.get('/:jobId', (req: express.Request, res: express.Response) => {
  const jobId = String(req.params.jobId);
  const job = jobsRegistry.get(jobId);

  if (!job) {
    return res.status(404).json({ success: false, error: 'المهمة غير موجودة أو انتهت صلاحيتها' });
  }

  res.json({
    success: true,
    job: {
      jobId: job.jobId,
      userId: job.userId,
      title: job.title,
      operationType: job.operationType,
      targetFormat: job.targetFormat,
      status: job.status,
      progress: job.progress,
      message: job.message,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      outputFileName: job.outputFileName,
      outputFileSize: job.outputFileSize,
      error: job.error,
      downloadUrl: job.status === 'completed' ? `/api/export-jobs/${job.jobId}/download` : null
    }
  });
});

/**
 * GET /api/export-jobs/user/:userId
 * List all active and completed background jobs for a specific user
 */
router.get('/user/:userId', (req: express.Request, res: express.Response) => {
  const userId = String(req.params.userId);
  const userJobs: any[] = [];

  for (const job of jobsRegistry.values()) {
    if (job.userId === userId || userId === 'all') {
      userJobs.push({
        jobId: job.jobId,
        userId: job.userId,
        title: job.title,
        operationType: job.operationType,
        targetFormat: job.targetFormat,
        status: job.status,
        progress: job.progress,
        message: job.message,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        outputFileName: job.outputFileName,
        outputFileSize: job.outputFileSize,
        error: job.error,
        downloadUrl: job.status === 'completed' ? `/api/export-jobs/${job.jobId}/download` : null
      });
    }
  }

  // Sort newest first
  userJobs.sort((a, b) => b.createdAt - a.createdAt);

  res.json({
    success: true,
    jobs: userJobs
  });
});

/**
 * GET /api/export-jobs/:jobId/download
 * Download the completed output file directly
 */
router.get('/:jobId/download', (req: express.Request, res: express.Response) => {
  const jobId = String(req.params.jobId);
  const job = jobsRegistry.get(jobId);

  if (!job || job.status !== 'completed' || !job.outputPath || !fs.existsSync(job.outputPath)) {
    return res.status(404).json({ success: false, error: 'الملف غير متوفر للتحميل أو لم تكتمل العملية بعد' });
  }

  res.download(job.outputPath, job.outputFileName, (err) => {
    if (err) {
      console.warn(`[ExportJobs] Error downloading ${jobId}:`, err);
    }
  });
});

/**
 * POST /api/export-jobs/:jobId/cancel
 * Cancel a job
 */
router.post('/:jobId/cancel', (req: express.Request, res: express.Response) => {
  const jobId = String(req.params.jobId);
  const job = jobsRegistry.get(jobId);

  if (!job) {
    return res.status(404).json({ success: false, error: 'المهمة غير موجودة' });
  }

  if (job.processRef) {
    try {
      job.processRef.kill('SIGKILL');
    } catch {}
  }

  job.status = 'cancelled';
  job.message = 'تم إلغاء المهمة من قبل المستخدم.';
  job.progress = 100;

  res.json({ success: true, message: 'تم إلغاء المهمة بنجاح' });
});

export default router;
