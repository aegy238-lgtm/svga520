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

// In-memory registry of jobs (synced with disk persistence so jobs survive restarts)
const jobsRegistry = new Map<string, ExportJobRecord>();
const JOBS_METADATA_FILE = path.join(JOBS_BASE_DIR, 'jobs_metadata.json');

export function saveJobsMetadata() {
  try {
    const list: any[] = [];
    for (const job of jobsRegistry.values()) {
      const { processRef, ...safeData } = job;
      list.push(safeData);
    }
    fs.writeFileSync(JOBS_METADATA_FILE, JSON.stringify(list.slice(-100), null, 2), 'utf-8');
  } catch (err) {
    console.warn('[ExportJobs] Could not save metadata to disk:', err);
  }
}

function loadJobsMetadata() {
  try {
    if (fs.existsSync(JOBS_METADATA_FILE)) {
      const content = fs.readFileSync(JOBS_METADATA_FILE, 'utf-8');
      const list = JSON.parse(content);
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item && item.jobId) {
            jobsRegistry.set(item.jobId, item);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[ExportJobs] Could not load metadata from disk:', err);
  }
}
loadJobsMetadata();

/**
 * Periodically purge jobs older than 24 hours to keep disk space lean while allowing users to retrieve files later
 */
function cleanStaleJobs() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let changed = false;
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
      changed = true;
    }
  }
  if (changed) saveJobsMetadata();
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
    if (format === 'vap' || format === 'vap1.0' || format === 'vap 1.0.5') {
      job.progress = 35;
      job.message = 'جاري استخراج قناع الشفافية وترميز فيديو Tencent VAP1.0 بمسرع العتاد...';

      const tempMp4Path = path.join(OUTPUTS_DIR, `temp_${job.jobId}.mp4`);
      // Standard VAP 1.0 vertical stacking: Alpha on TOP ("الحته البيضاء بالأعلى"), RGB on BOTTOM
      const filterStr = '[0:v]format=yuva420p,split[rgb][a];[a]alphaextract[alpha];[alpha][rgb]vstack[out]';
      const vapArgs: string[] = [
        '-y', '-i', inputPath,
        '-filter_complex', filterStr,
        '-map', '[out]',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', preset,
        '-crf', crf
      ];

      if (audioPath && fs.existsSync(audioPath)) {
        vapArgs.push('-i', audioPath, '-map', '1:a:0', '-c:a', 'aac', '-b:a', '192k', '-shortest');
      }

      vapArgs.push(tempMp4Path);

      await execFilePromise(FFMPEG_PATH, vapArgs, { maxBuffer: 15 * 1024 * 1024 });

      job.progress = 80;
      job.message = 'جاري حقن صندوق vapc القياسي وفق مواصفات VAP1.0...';

      let videoW = 1000;
      let videoH = 1000;
      let fpsNum = config.fps || 30;
      let totalF = 30;

      try {
        const { stdout } = await execFilePromise(FFPROBE_PATH, [
          '-v', 'error',
          '-select_streams', 'v:0',
          '-show_entries', 'stream=width,height,r_frame_rate,nb_frames',
          '-of', 'json',
          tempMp4Path
        ]);
        const probeData = JSON.parse(stdout);
        const stream = probeData.streams?.[0];
        if (stream) {
          videoW = stream.width || 1000;
          videoH = stream.height || 1000;
          if (stream.nb_frames) totalF = parseInt(stream.nb_frames, 10) || totalF;
          if (stream.r_frame_rate) {
            const [num, den] = stream.r_frame_rate.split('/').map(Number);
            if (num && den) fpsNum = Math.round(num / den);
          }
        }
      } catch (probeErr) {
        console.warn('[ExportJobs] FFprobe notice:', probeErr);
      }

      const origW = videoW;
      const origH = Math.round(videoH / 2);

      const vapConfig = {
        info: {
          v: 1, // Tencent VAP 1.0 standard
          f: totalF,
          w: origW,
          h: origH,
          fps: fpsNum,
          videoW: videoW,
          videoH: videoH,
          aFrame: [0, 0, origW, origH],        // Alpha mask on TOP ("الحته البيضاء بالأعلى")
          rgbFrame: [0, origH, origW, origH],  // RGB color gift on BOTTOM
          isVapx: 0,
          codeTag: ["common"],
          orien: 0
        }
      };

      const jsonBytes = Buffer.from(JSON.stringify(vapConfig), 'utf-8');
      const boxSize = 8 + jsonBytes.length;
      const boxHeader = Buffer.alloc(8);
      boxHeader.writeUInt32BE(boxSize, 0);
      boxHeader.write('vapc', 4, 4, 'ascii');

      const mp4Data = fs.readFileSync(tempMp4Path);
      const finalVapBuffer = Buffer.concat([mp4Data, boxHeader, jsonBytes]);
      fs.writeFileSync(outputPath, finalVapBuffer);

      try { fs.unlinkSync(tempMp4Path); } catch {}
    } else if (format === 'mp4') {
      args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', preset, '-crf', crf);
      if (audioPath && fs.existsSync(audioPath)) {
        args.push('-map', '0:v:0', '-map', '1:a:0', '-c:a', 'aac', '-b:a', '192k', '-shortest');
      } else {
        args.push('-c:a', 'copy');
      }
      args.push(outputPath);
      job.progress = 50;
      job.message = 'جاري معالجة الإطارات بدقة فائقة...';
      await execFilePromise(FFMPEG_PATH, args, { maxBuffer: 10 * 1024 * 1024 });
    } else if (format === 'webm') {
      args.push('-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-crf', '30', '-b:v', '0');
      if (audioPath && fs.existsSync(audioPath)) {
        args.push('-map', '0:v:0', '-map', '1:a:0', '-c:a', 'libopus', '-shortest');
      } else {
        args.push('-c:a', 'copy');
      }
      args.push(outputPath);
      job.progress = 50;
      job.message = 'جاري معالجة فيديو WebM الشفاف...';
      await execFilePromise(FFMPEG_PATH, args, { maxBuffer: 10 * 1024 * 1024 });
    } else if (format === 'gif') {
      args.push('-vf', `fps=${Math.min(config.fps, 24)},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`);
      args.push(outputPath);
      job.progress = 50;
      job.message = 'جاري إنشاء صورة GIF المتحركة...';
      await execFilePromise(FFMPEG_PATH, args, { maxBuffer: 10 * 1024 * 1024 });
    } else if (format === 'mp3') {
      args.push('-vn', '-c:a', 'libmp3lame', '-q:a', '2');
      args.push(outputPath);
      job.progress = 50;
      job.message = 'جاري استخراج وتحويل الصوت...';
      await execFilePromise(FFMPEG_PATH, args, { maxBuffer: 10 * 1024 * 1024 });
    } else {
      // Default standard copy / container conversion
      args.push('-c', 'copy');
      args.push(outputPath);
      job.progress = 50;
      job.message = 'جاري نسخ وتحويل الحاوية...';
      await execFilePromise(FFMPEG_PATH, args, { maxBuffer: 10 * 1024 * 1024 });
    }

    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      job.outputFileSize = stats.size;
      job.status = 'completed';
      job.progress = 100;
      job.completedAt = Date.now();
      job.message = 'اكتمل التصدير بنجاح! الملف جاهز للتحميل.';
      saveJobsMetadata();
    } else {
      throw new Error('لم ينتج ملف الإخراج بعد انتهاء المعالجة.');
    }
  } catch (err: any) {
    console.error(`[ExportJobs] Execution error for job ${job.jobId}:`, err);
    job.status = 'failed';
    job.error = err.message || 'حدث خطأ أثناء معالجة التصدير السحابي.';
    job.progress = 100;
    saveJobsMetadata();
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
 * POST /api/export-jobs/submit-result
 * Direct upload of completed file to register it permanently on the server
 */
router.post('/submit-result', upload.single('file'), (req: express.Request, res: express.Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'لم يتم إرسال ملف' });
    }
    const {
      userId = 'guest',
      title = 'ملف تم تصديره',
      targetFormat = 'mp4',
      fileName
    } = req.body;

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const outputFileName = fileName || file.originalname || `export_${Date.now()}.${targetFormat}`;
    const targetPath = path.join(OUTPUTS_DIR, `${jobId}_${outputFileName}`);

    // Move uploaded file to outputs directory
    fs.renameSync(file.path, targetPath);
    const stats = fs.statSync(targetPath);

    const jobRecord: ExportJobRecord = {
      jobId,
      userId,
      title: title || outputFileName,
      operationType: 'direct_export',
      targetFormat,
      status: 'completed',
      progress: 100,
      message: 'تم حفظ وتأمين الملف على السيرفر بنجاح!',
      createdAt: Date.now(),
      completedAt: Date.now(),
      outputPath: targetPath,
      outputFileName,
      outputFileSize: stats.size
    };

    jobsRegistry.set(jobId, jobRecord);
    saveJobsMetadata();

    res.json({
      success: true,
      jobId,
      downloadUrl: `/api/export-jobs/${jobId}/download`,
      fileSize: stats.size,
      fileName: outputFileName
    });
  } catch (err: any) {
    console.error('[ExportJobs] Submit result failed:', err);
    res.status(500).json({ success: false, error: err.message || 'فشل في حفظ الملف' });
  }
});

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
