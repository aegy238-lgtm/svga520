import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import util from 'util';
import crypto from 'crypto';

const execFilePromise = util.promisify(execFile);

// Setup resilient FFmpeg and FFprobe binary paths
let resolvedFfmpegPath = '/usr/bin/ffmpeg';
if (fs.existsSync('/usr/bin/ffmpeg')) {
  resolvedFfmpegPath = '/usr/bin/ffmpeg';
} else {
  resolvedFfmpegPath = 'ffmpeg';
}

let resolvedFfprobePath = '/usr/bin/ffprobe';
if (fs.existsSync('/usr/bin/ffprobe')) {
  resolvedFfprobePath = '/usr/bin/ffprobe';
} else {
  resolvedFfprobePath = 'ffprobe';
}
console.log('[Audio Server] Initialized FFmpeg at:', resolvedFfmpegPath, 'and FFprobe at:', resolvedFfprobePath);

const router = express.Router();

// Helper to extract VAP metadata box from a Buffer
function extractRawVapBoxFromBuffer(buffer: Buffer): Buffer | null {
  try {
    const boxTags = ['vapc', 'yyea', 'yyev', 'udta'];
    for (const tagStr of boxTags) {
      const tag = Buffer.from(tagStr, 'ascii');
      let idx = buffer.indexOf(tag);
      while (idx !== -1) {
        if (idx >= 4) {
          const boxSize = buffer.readUInt32BE(idx - 4);
          // Standard MP4 box layout: [4 bytes size][4 bytes tag][payload]
          if (boxSize >= 8 && (idx - 4 + boxSize) <= buffer.length) {
            const rawPayload = buffer.subarray(idx + 4, idx - 4 + boxSize);
            const str = rawPayload.toString('utf-8');
            const parsed = extractJsonFromText(str);
            if (parsed && (parsed.info || parsed.descript || parsed.v !== undefined || parsed.rgbFrame || parsed.w || parsed.width)) {
              return buildVapBoxFromJsonServer(parsed);
            }
          }
        }

        // Check if raw JSON follows the tag anywhere in the slice
        const rawPayload = buffer.subarray(idx + 4, Math.min(buffer.length, idx + 4 + 65536));
        const str = rawPayload.toString('utf-8');
        const parsed = extractJsonFromText(str);
        if (parsed && (parsed.info || parsed.descript || parsed.v !== undefined || parsed.rgbFrame || parsed.w || parsed.width)) {
          return buildVapBoxFromJsonServer(parsed);
        }

        idx = buffer.indexOf(tag, idx + 1);
      }
    }

    // Direct search for rgbFrame in buffer text
    const fullText = buffer.subarray(Math.max(0, buffer.length - 1024 * 1024)).toString('utf-8');
    const rgbIdx = fullText.indexOf('rgbFrame');
    if (rgbIdx !== -1) {
      const start = fullText.lastIndexOf('{', rgbIdx);
      if (start !== -1) {
        const parsed = extractJsonFromText(fullText.substring(start));
        if (parsed) {
          return buildVapBoxFromJsonServer(parsed);
        }
      }
    }
  } catch (e) {
    console.warn('[Audio Server] Failed to extract raw VAP box in server:', e);
  }
  return null;
}

function extractJsonFromText(str: string): any {
  const start = str.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < str.length; i++) {
    if (str[i] === '{') depth++;
    else if (str[i] === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(str.substring(start, i + 1));
        } catch {
          // keep searching
        }
      }
    }
  }
  return null;
}

function buildVapBoxFromJsonServer(config: any): Buffer {
  let parsed: any = null;
  if (typeof config === 'string') {
    try {
      parsed = JSON.parse(config);
    } catch {
      parsed = null;
    }
  } else if (typeof config === 'object' && config !== null) {
    parsed = config;
  }

  if (!parsed) {
    parsed = {
      info: {
        v: 2,
        f: 24,
        w: 750,
        h: 1334,
        videoW: 1500,
        videoH: 1334,
        aFrame: [750, 0, 750, 1334],
        rgbFrame: [0, 0, 750, 1334]
      }
    };
  }

  // Ensure standard VAP info structure
  if (!parsed.info) {
    const desc = parsed.descript || parsed;
    const w = desc.w || desc.width || 750;
    const h = desc.h || desc.height || 1334;
    const f = desc.f || desc.fps || 24;
    const videoW = desc.videoW || desc.videoWidth || (w * 2);
    const videoH = desc.videoH || desc.videoHeight || h;
    const rgbFrame = desc.rgbFrame || [0, 0, w, h];
    const aFrame = desc.aFrame || desc.alphaFrame || [w, 0, w, h];
    parsed = {
      info: {
        v: 2,
        f,
        w,
        h,
        videoW,
        videoH,
        rgbFrame,
        aFrame,
        ...desc
      }
    };
  }

  const jsonStr = JSON.stringify(parsed);
  const jsonBytes = Buffer.from(jsonStr, 'utf-8');
  const boxSize = 8 + jsonBytes.length;
  const header = Buffer.alloc(8);
  header.writeUInt32BE(boxSize, 0);
  header.write('vapc', 4, 'ascii');
  return Buffer.concat([header, jsonBytes]);
}

// Setup Multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB limit
  fileFilter: (req, file, cb) => {
    // Allow all video, audio, vap, svga, mp4, and general binary container streams
    if (
      file.mimetype.startsWith('video/') || 
      file.mimetype.startsWith('audio/') || 
      file.mimetype.startsWith('application/') ||
      file.originalname.match(/\.(vap|svga|mp4|mov|mkv|avi|webm|flv|wmv|3gp|mp3|wav|aac|m4a|ogg|flac|opus|wma|aiff|alac|bin)$/i)
    ) {
      cb(null, true);
    } else {
      cb(null, true); // Permissive to allow custom animation formats without blocking
    }
  }
});

interface Job {
  id: string;
  originalName: string;
  size: number;
  format: string;
  quality: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: number;
  outputFile?: string;
  error?: string;
}

const jobs = new Map<string, Job>();

// Clean up jobs and files older than 1 hour
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (now - job.createdAt > 3600000) {
      if (job.outputFile && fs.existsSync(job.outputFile)) {
        try { fs.unlinkSync(job.outputFile); } catch (e) {}
      }
      jobs.delete(id);
    }
  }
}, 3600000);

router.post('/extract', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'لم يتم رفع أي ملف' });
  }

  const file = req.file;
  const format = (req.body.format || 'mp3').toLowerCase();
  const quality = req.body.quality || '192k';
  const startTime = req.body.startTime !== undefined && req.body.startTime !== '' ? parseFloat(req.body.startTime) : 0;
  const endTime = req.body.endTime !== undefined && req.body.endTime !== '' ? parseFloat(req.body.endTime) : 0;
  const duration = req.body.duration !== undefined && req.body.duration !== '' ? parseFloat(req.body.duration) : 0;
  const volume = req.body.volume !== undefined && req.body.volume !== '' ? parseFloat(req.body.volume) : 1;
  const speed = req.body.speed !== undefined && req.body.speed !== '' ? parseFloat(req.body.speed) : 1;
  const fadeIn = req.body.fadeIn !== undefined && req.body.fadeIn !== '' ? parseFloat(req.body.fadeIn) : 0;
  const fadeOut = req.body.fadeOut !== undefined && req.body.fadeOut !== '' ? parseFloat(req.body.fadeOut) : 0;
  const normalize = req.body.normalize === 'true' || req.body.normalize === true;

  const jobId = crypto.randomUUID();
  const outputFileName = `audio-${jobId}.${format}`;
  const outputPath = path.join(uploadDir, outputFileName);

  const newJob: Job = {
    id: jobId,
    originalName: file.originalname,
    size: file.size,
    format,
    quality,
    status: 'processing',
    progress: 10,
    createdAt: Date.now()
  };

  jobs.set(jobId, newJob);

  res.json({ jobId, message: 'بدأت عملية الاستخراج والتعديل' });

  // Process video/audio in background with execFile
  (async () => {
    try {
      const args: string[] = ['-y'];

      // Add fast seek start time if specified
      if (startTime > 0) {
        args.push('-ss', startTime.toFixed(3));
      }

      args.push('-i', file.path);

      // Add duration/end time if specified
      const effectiveDuration = duration > 0 ? duration : (endTime > startTime ? endTime - startTime : 0);
      if (effectiveDuration > 0) {
        args.push('-t', effectiveDuration.toFixed(3));
      }

      args.push('-vn');

      // Build audio filters (volume, speed, fade in/out, normalization)
      const audioFilters: string[] = [];
      if (volume !== 1 && volume >= 0) {
        audioFilters.push(`volume=${volume.toFixed(2)}`);
      }
      if (speed !== 1 && speed >= 0.5 && speed <= 2.0) {
        audioFilters.push(`atempo=${speed.toFixed(2)}`);
      }
      if (fadeIn > 0) {
        audioFilters.push(`afade=t=in:ss=0:d=${fadeIn.toFixed(2)}`);
      }
      if (fadeOut > 0 && effectiveDuration > fadeOut) {
        audioFilters.push(`afade=t=out:st=${(effectiveDuration - fadeOut).toFixed(2)}:d=${fadeOut.toFixed(2)}`);
      }
      if (normalize) {
        audioFilters.push('loudnorm');
      }

      if (audioFilters.length > 0) {
        args.push('-filter:a', audioFilters.join(','));
      }

      // Codec and format settings
      if (format === 'mp3') {
        args.push('-c:a', 'libmp3lame', '-b:a', quality, '-id3v2_version', '3', '-write_xing', '1');
      } else if (format === 'wav') {
        args.push('-c:a', 'pcm_s16le');
      } else if (format === 'aac') {
        args.push('-c:a', 'aac', '-b:a', quality);
      } else if (format === 'm4a') {
        args.push('-c:a', 'aac', '-b:a', quality);
      } else if (format === 'ogg') {
        args.push('-c:a', 'libvorbis', '-b:a', quality);
      } else if (format === 'flac') {
        args.push('-c:a', 'flac');
      } else if (format === 'opus') {
        args.push('-c:a', 'libopus', '-b:a', quality);
      } else {
        args.push('-c:a', 'libmp3lame', '-b:a', quality);
      }

      args.push(outputPath);

      console.log('[Audio Server] Extracting audio with FFmpeg args:', args.join(' '));
      await execFilePromise(resolvedFfmpegPath, args);
      const job = jobs.get(jobId);
      if (job) {
        job.status = 'completed';
        job.progress = 100;
        job.outputFile = outputPath;
      }
    } catch (err: any) {
      console.error('[Audio Extract Error]:', err);
      const job = jobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = err.message || 'فشل استخراج ومعالجة الصوت';
      }
    } finally {
      if (fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch (e) {}
      }
    }
  })();
});

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    ffmpeg: fs.existsSync(resolvedFfmpegPath),
    ffmpegPath: resolvedFfmpegPath,
    supportedFormats: ['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac', 'opus']
  });
});

router.get('/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'العملية غير موجودة' });
  }
  res.json(job);
});

router.get('/stream/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.status !== 'completed' || !job.outputFile || !fs.existsSync(job.outputFile)) {
    return res.status(404).json({ error: 'الملف غير جاهز أو غير موجود' });
  }

  const ext = path.extname(job.outputFile).toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.aac': 'audio/aac',
    '.m4a': 'audio/mp4',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.opus': 'audio/opus',
  };

  const stat = fs.statSync(job.outputFile);
  res.setHeader('Content-Type', mimeTypes[ext] || 'audio/mpeg');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Accept-Ranges', 'bytes');
  fs.createReadStream(job.outputFile).pipe(res);
});

router.get('/download/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.status !== 'completed' || !job.outputFile || !fs.existsSync(job.outputFile)) {
    return res.status(404).json({ error: 'الملف غير جاهز أو غير موجود' });
  }

  const ext = path.extname(job.outputFile);
  const baseName = path.basename(job.originalName, path.extname(job.originalName)) || 'audio_export';
  const downloadName = `${baseName}${ext}`;

  res.download(job.outputFile, downloadName, (err) => {
    if (err) {
      console.warn('[Audio Download Notice]:', err.message);
    }
  });
});

router.post('/replace-vap-audio', upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'audio', maxCount: 1 }
]), async (req, res) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const videoFile = files?.['video']?.[0];
  const audioFile = files?.['audio']?.[0];

  if (!videoFile) {
    return res.status(400).json({ error: 'ملف الفيديو (VAP) مطلوب' });
  }

  const outputId = crypto.randomUUID();
  const outputPath = path.join(uploadDir, `vap-remux-${outputId}.mp4`);
  const rawDuration = req.body.duration ? parseFloat(req.body.duration) : undefined;
  const vapConfigJson = req.body.vapConfig ? req.body.vapConfig : undefined;
  const isMute = req.body.mute === 'true' || req.body.mute === '1';
  const vapCompressionEnabled = req.body.vapCompressionEnabled === 'true' || req.body.vapCompressionEnabled === '1';
  const volume = req.body.volume ? parseFloat(req.body.volume) : 1.0;
  const startTime = req.body.startTime ? parseFloat(req.body.startTime) : 0;
  const endTime = req.body.endTime ? parseFloat(req.body.endTime) : 0;

  try {
    // 1. Probe exact video duration
    let exactDuration: number | undefined = rawDuration && rawDuration > 0 ? rawDuration : undefined;
    try {
      const { stdout } = await execFilePromise(resolvedFfprobePath, [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        videoFile.path
      ]);
      const probed = parseFloat(stdout.trim());
      if (!isNaN(probed) && probed > 0) {
        exactDuration = probed;
      }
    } catch (probeErr) {
      console.warn('[Audio Server] ffprobe duration probe warning:', probeErr);
    }

    let args: string[] = ['-y', '-threads', '0', '-i', videoFile.path];

    if (audioFile && !isMute && volume > 0) {
      if (startTime > 0) {
        args.push('-ss', startTime.toFixed(3));
      }
      if (endTime > 0 && endTime > startTime) {
        args.push('-to', endTime.toFixed(3));
      } else if (exactDuration && exactDuration > 0) {
        args.push('-t', (exactDuration + 0.5).toFixed(3));
      }
      args.push('-i', audioFile.path);
      args.push('-map', '0:v:0');
      args.push('-map', '1:a:0');
      
      // If VAP compression is enabled, compress the video stream
      if (vapCompressionEnabled) {
          args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '28', '-preset', 'veryfast');
      } else {
          args.push('-c:v', 'copy');
      }
      
      args.push('-c:a', 'aac');
      if (volume !== 1.0 && !isNaN(volume)) {
        args.push('-af', `volume=${Math.max(0, Math.min(volume, 5.0)).toFixed(2)}`);
      }
      args.push('-b:a', '192k');
      args.push('-ar', '44100');
      args.push('-ac', '2');
      args.push('-shortest');
      args.push('-movflags', '+faststart');
    } else if (isMute || volume === 0) {
      args.push('-map', '0:v:0');
      if (vapCompressionEnabled) {
          args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '28', '-preset', 'veryfast');
      } else {
          args.push('-c:v', 'copy');
      }
      args.push('-an');
      args.push('-movflags', '+faststart');
    } else {
      args.push('-map', '0:v:0');
      args.push('-map', '0:a?');
      if (vapCompressionEnabled) {
          args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '28', '-preset', 'veryfast');
      } else {
          args.push('-c:v', 'copy');
      }
      if (volume !== 1.0 && !isNaN(volume)) {
        args.push('-c:a', 'aac', '-af', `volume=${Math.max(0, Math.min(volume, 5.0)).toFixed(2)}`, '-b:a', '192k');
      } else {
        args.push('-c:a', 'copy');
      }
      args.push('-movflags', '+faststart');
    }

    args.push(outputPath);

    console.log('[Audio Server] Running remux with args:', args.join(' '));
    try {
      await execFilePromise(resolvedFfmpegPath, args);
    } catch (remuxErr) {
      console.warn('[Audio Server] Direct copy failed, attempting full re-encode fallback:', remuxErr);
      // Fallback: re-encode with libx264 + aac
      const fallbackArgs: string[] = ['-y', '-i', videoFile.path];
      if (audioFile && !isMute) {
        if (startTime > 0) fallbackArgs.push('-ss', startTime.toFixed(3));
        if (endTime > 0 && endTime > startTime) {
          fallbackArgs.push('-to', endTime.toFixed(3));
        } else if (exactDuration && exactDuration > 0) {
          fallbackArgs.push('-t', (exactDuration + 0.5).toFixed(3));
        }
        fallbackArgs.push('-i', audioFile.path);
        fallbackArgs.push(
          '-map', '0:v:0',
          '-map', '1:a:0',
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-preset', 'veryfast',
          '-crf', '18',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-ar', '44100',
          '-ac', '2',
          '-shortest',
          '-movflags', '+faststart'
        );
      } else if (isMute) {
        fallbackArgs.push('-map', '0:v:0', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '18', '-an', '-movflags', '+faststart');
      } else {
        fallbackArgs.push('-map', '0:v:0', '-map', '0:a?', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart');
      }
      fallbackArgs.push(outputPath);
      await execFilePromise(resolvedFfmpegPath, fallbackArgs);
    }

    if (!fs.existsSync(outputPath)) {
      throw new Error('فشل إنشاء ملف الفيديو الجديد');
    }

    const fileStat = await fs.promises.stat(outputPath);
    if (fileStat.size < 1000) {
      throw new Error('حجم ملف الفيديو الناتج غير صالح');
    }

    // Read generated mp4
    const generatedMp4Buffer = await fs.promises.readFile(outputPath);
    
    // Read original video file to extract VAP metadata box
    const originalVideoBuffer = await fs.promises.readFile(videoFile.path);
    let vapBox = extractRawVapBoxFromBuffer(originalVideoBuffer);
    if (!vapBox && vapConfigJson) {
      try {
        const parsed = typeof vapConfigJson === 'string' ? JSON.parse(vapConfigJson) : vapConfigJson;
        vapBox = buildVapBoxFromJsonServer(parsed);
      } catch (e) {}
    }

    // Ensure a valid VAP box is ALWAYS appended
    if (!vapBox) {
      vapBox = buildVapBoxFromJsonServer(null);
    }

    const finalBuffer = Buffer.concat([generatedMp4Buffer, vapBox]);

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="replaced_vap.vap"`);
    res.setHeader('Content-Length', finalBuffer.length.toString());
    res.end(finalBuffer);
  } catch (error: any) {
    console.error('Error in replace-vap-audio endpoint:', error);
    res.status(500).json({ error: error?.message || 'فشلت معالجة الصوت في الخادم' });
  } finally {
    // Immediate cleanup of temporary files
    if (videoFile && fs.existsSync(videoFile.path)) {
      try { fs.unlinkSync(videoFile.path); } catch (e) {}
    }
    if (audioFile && fs.existsSync(audioFile.path)) {
      try { fs.unlinkSync(audioFile.path); } catch (e) {}
    }
    if (fs.existsSync(outputPath)) {
      try { fs.unlinkSync(outputPath); } catch (e) {}
    }
  }
});

// Dedicated VAP & MP4 Batch Compression Endpoint
router.post('/compress-vap', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'ملف VAP أو MP4 مطلوب للضغط' });
  }

  const outputId = crypto.randomUUID();
  const outputPath = path.join(uploadDir, `vap-compressed-${outputId}.mp4`);

  const quality = req.body.quality ? parseInt(req.body.quality, 10) : 75; // 10 - 100
  const customCrf = req.body.crf ? parseInt(req.body.crf, 10) : undefined;
  const presetMode = req.body.preset || 'smart';
  const scale = req.body.scale ? parseFloat(req.body.scale) : 1.0;
  const preserveAudio = req.body.preserveAudio !== 'false' && req.body.preserveAudio !== false;
  const passedVapConfig = req.body.vapConfig ? req.body.vapConfig : undefined;
  const explicitFormat = req.body.format || (file.originalname.toLowerCase().endsWith('.vap') ? 'vap' : 'mp4');

  // Calculate target CRF
  let targetCrf = 26; // balanced default
  if (customCrf && customCrf >= 16 && customCrf <= 42) {
    targetCrf = customCrf;
  } else {
    if (presetMode === 'max_quality') targetCrf = 19;
    else if (presetMode === 'high_quality') targetCrf = 23;
    else if (presetMode === 'balanced') targetCrf = 27;
    else if (presetMode === 'high_compression') targetCrf = 31;
    else if (presetMode === 'max_compression') targetCrf = 35;
    else {
      // Smart mapping from quality (10-100) -> CRF (36 down to 18)
      const clampedQuality = Math.max(10, Math.min(100, quality));
      targetCrf = Math.round(36 - ((clampedQuality - 10) / 90) * 18);
    }
  }

  try {
    // 1. Probe original file with ffprobe for deep streams inspection
    let hasAudio = false;
    let audioCodec = '';
    let audioChannels = 0;
    let audioSampleRate = 0;
    let videoWidth = 0;
    let videoHeight = 0;
    let videoFps = 24;
    let videoDuration = 0;
    let videoCodec = 'h264';
    let totalFrames = 0;

    try {
      const { stdout: probeJsonStr } = await execFilePromise(resolvedFfprobePath, [
        '-v', 'error',
        '-show_streams',
        '-show_format',
        '-print_format', 'json',
        file.path
      ]);
      const probeData = JSON.parse(probeJsonStr);
      if (probeData && probeData.streams) {
        for (const s of probeData.streams) {
          if (s.codec_type === 'video' && !videoWidth) {
            videoWidth = parseInt(s.width, 10) || 0;
            videoHeight = parseInt(s.height, 10) || 0;
            videoCodec = s.codec_name || 'h264';
            if (s.r_frame_rate) {
              const [num, den] = s.r_frame_rate.split('/').map(Number);
              if (den && num) videoFps = Math.round(num / den);
            }
            if (s.duration) videoDuration = parseFloat(s.duration);
            if (s.nb_frames) totalFrames = parseInt(s.nb_frames, 10);
          } else if (s.codec_type === 'audio') {
            hasAudio = true;
            audioCodec = s.codec_name || 'aac';
            audioChannels = s.channels || 2;
            audioSampleRate = s.sample_rate || 44100;
          }
        }
      }
      if (!videoDuration && probeData.format && probeData.format.duration) {
        videoDuration = parseFloat(probeData.format.duration);
      }
    } catch (probeErr) {
      console.warn('[VAP/MP4 Server] ffprobe inspect notice:', probeErr);
    }

    // 2. Extract and preserve VAP Box Metadata if this is a VAP file
    const originalBuffer = await fs.promises.readFile(file.path);
    let originalVapBox = extractRawVapBoxFromBuffer(originalBuffer);
    let parsedConfig: any = null;

    if (passedVapConfig) {
      try {
        parsedConfig = typeof passedVapConfig === 'string' ? JSON.parse(passedVapConfig) : passedVapConfig;
      } catch {}
    }

    if (!originalVapBox && parsedConfig) {
      originalVapBox = buildVapBoxFromJsonServer(parsedConfig);
    }

    const isVap = explicitFormat === 'vap' || originalVapBox !== null || Boolean(parsedConfig);

    // 3. Build FFmpeg command with smart H.264 compression & even dimensions guarantee
    const ffmpegArgs: string[] = [
      '-y',
      '-threads', '0',
      '-i', file.path
    ];

    // Video filter for optional scaling and mandatory even dimension padding for libx264
    const filters: string[] = [];
    if (scale < 0.98 && scale >= 0.3) {
      filters.push(`scale=trunc(iw*${scale}/2)*2:trunc(ih*${scale}/2)*2`);
    } else {
      filters.push('pad=ceil(iw/2)*2:ceil(ih/2)*2');
    }

    ffmpegArgs.push('-vf', filters.join(','));

    // High efficiency H.264 encoding with smart CRF
    ffmpegArgs.push(
      '-c:v', 'libx264',
      '-crf', targetCrf.toString(),
      '-preset', 'veryfast',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart'
    );

    // Audio stream handling: 100% Preserved when present without accidental stripping!
    if (preserveAudio) {
      // 0:a? maps any audio stream if present, safely passing through without error if silent
      ffmpegArgs.push('-map', '0:v:0', '-map', '0:a?');
      ffmpegArgs.push('-c:a', 'aac', '-b:a', '128k', '-ar', '44100');
    } else {
      ffmpegArgs.push('-map', '0:v:0', '-an');
    }

    ffmpegArgs.push(outputPath);

    console.log(`[VAP/MP4 Compressor] Compressing ${file.originalname || 'video'} (Format=${isVap ? 'VAP' : 'MP4'}) with CRF=${targetCrf}, HasAudio=${hasAudio}, PreserveAudio=${preserveAudio}`);
    await execFilePromise(resolvedFfmpegPath, ffmpegArgs);

    if (!fs.existsSync(outputPath)) {
      throw new Error('فشل إنشاء ملف الفيديو المضغوط');
    }

    // 4. Read compressed MP4
    let compressedMp4 = await fs.promises.readFile(outputPath);

    // Guaranteed Compression Check: If output is not smaller than original, re-encode with more aggressive CRF
    if (compressedMp4.length >= file.size && targetCrf < 38) {
      console.log(`[VAP/MP4 Compressor] Output size (${compressedMp4.length}) >= original (${file.size}), applying secondary optimization pass...`);
      const retryCrf = Math.min(38, targetCrf + 6);
      const retryArgs: string[] = [
        '-y', '-threads', '0', '-i', file.path,
        '-vf', filters.join(','),
        '-c:v', 'libx264', '-crf', retryCrf.toString(),
        '-preset', 'faster', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'
      ];
      if (preserveAudio) {
        retryArgs.push('-map', '0:v:0', '-map', '0:a?', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100');
      } else {
        retryArgs.push('-map', '0:v:0', '-an');
      }
      retryArgs.push(outputPath);
      try {
        await execFilePromise(resolvedFfmpegPath, retryArgs);
        if (fs.existsSync(outputPath)) {
          const recompressed = await fs.promises.readFile(outputPath);
          if (recompressed.length < compressedMp4.length) {
            compressedMp4 = recompressed;
            targetCrf = retryCrf;
          }
        }
      } catch (retryErr) {
        console.warn('[VAP/MP4 Compressor] Retry pass note:', retryErr);
      }
    }

    // 5. If it's a VAP file, ensure VAP Box is appended at the end of the file
    let finalBuffer: Buffer;
    if (isVap) {
      let finalVapBox = originalVapBox;
      if (!finalVapBox) {
        finalVapBox = buildVapBoxFromJsonServer({
          info: {
            v: 2,
            f: videoFps || 24,
            w: videoWidth ? Math.floor(videoWidth / 2) : 750,
            h: videoHeight || 1334,
            fps: videoFps || 24,
            videoW: videoWidth || 1500,
            videoH: videoHeight || 1334,
            rgbFrame: [0, 0, videoWidth ? Math.floor(videoWidth / 2) : 750, videoHeight || 1334],
            aFrame: [videoWidth ? Math.floor(videoWidth / 2) : 750, 0, videoWidth ? Math.floor(videoWidth / 2) : 750, videoHeight || 1334]
          }
        });
      }
      finalBuffer = Buffer.concat([compressedMp4, finalVapBox]);
    } else {
      // Standard pure MP4 video file
      finalBuffer = compressedMp4;
    }

    // 6. Validation: Check compressed output
    let outHasAudio = false;
    let outDuration = 0;
    try {
      const { stdout: outProbeStr } = await execFilePromise(resolvedFfprobePath, [
        '-v', 'error',
        '-show_streams',
        '-show_format',
        '-print_format', 'json',
        outputPath
      ]);
      const outProbe = JSON.parse(outProbeStr);
      if (outProbe && outProbe.streams) {
        for (const s of outProbe.streams) {
          if (s.codec_type === 'audio') outHasAudio = true;
        }
      }
      if (outProbe.format && outProbe.format.duration) {
        outDuration = parseFloat(outProbe.format.duration);
      }
    } catch {}

    const originalSizeBytes = file.size;
    const compressedSizeBytes = finalBuffer.length;
    const savedBytes = Math.max(0, originalSizeBytes - compressedSizeBytes);
    const savingPercent = originalSizeBytes > 0 ? Math.round((savedBytes / originalSizeBytes) * 100) : 0;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', '*');
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="compressed_${file.originalname || (isVap ? 'animation.vap' : 'video.mp4')}"`);
    res.setHeader('x-original-size', originalSizeBytes.toString());
    res.setHeader('x-compressed-size', compressedSizeBytes.toString());
    res.setHeader('x-saved-bytes', savedBytes.toString());
    res.setHeader('x-saving-percent', savingPercent.toString());
    res.setHeader('x-has-audio', hasAudio ? '1' : '0');
    res.setHeader('x-audio-preserved', (hasAudio && outHasAudio) ? '1' : '0');
    res.setHeader('x-fps', videoFps.toString());
    res.setHeader('x-video-width', videoWidth.toString());
    res.setHeader('x-video-height', videoHeight.toString());
    res.setHeader('x-duration', (videoDuration || outDuration || 0).toFixed(2));
    res.setHeader('x-crf-used', targetCrf.toString());
    res.setHeader('x-is-vap', isVap ? '1' : '0');

    res.end(finalBuffer);
  } catch (err: any) {
    console.error('[VAP/MP4 Compression Error]:', err);
    res.status(500).json({ error: err?.message || 'فشلت معالجة وضغط ملف الفيديو' });
  } finally {
    // Cleanup temporary files
    if (file && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (e) {}
    }
    if (fs.existsSync(outputPath)) {
      try { fs.unlinkSync(outputPath); } catch (e) {}
    }
  }
});

// Probe VAP/MP4 metadata and audio info endpoint
router.post('/probe-vap', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'الملف مطلوب للفحص' });
  }

  try {
    const { stdout: probeJsonStr } = await execFilePromise(resolvedFfprobePath, [
      '-v', 'error',
      '-show_streams',
      '-show_format',
      '-print_format', 'json',
      file.path
    ]);

    const probeData = JSON.parse(probeJsonStr);
    let hasAudio = false;
    let audioInfo: any = null;
    let videoInfo: any = null;

    if (probeData && probeData.streams) {
      for (const s of probeData.streams) {
        if (s.codec_type === 'video' && !videoInfo) {
          let fps = 24;
          if (s.r_frame_rate) {
            const [num, den] = s.r_frame_rate.split('/').map(Number);
            if (den && num) fps = Math.round(num / den);
          }
          videoInfo = {
            width: parseInt(s.width, 10),
            height: parseInt(s.height, 10),
            fps,
            codec: s.codec_name,
            duration: parseFloat(s.duration || probeData.format?.duration || 0),
            frames: parseInt(s.nb_frames, 10) || 0
          };
        } else if (s.codec_type === 'audio') {
          hasAudio = true;
          audioInfo = {
            codec: s.codec_name,
            channels: s.channels,
            sampleRate: s.sample_rate,
            bitrate: s.bit_rate
          };
        }
      }
    }

    const buffer = await fs.promises.readFile(file.path);
    const vapBox = extractRawVapBoxFromBuffer(buffer);

    res.json({
      valid: true,
      hasAudio,
      audioInfo,
      videoInfo,
      hasVapBox: Boolean(vapBox),
      fileSize: file.size
    });
  } catch (err: any) {
    console.error('[Probe Error]:', err);
    res.status(500).json({ error: err?.message || 'فشل فحص الملف' });
  } finally {
    if (file && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (e) {}
    }
  }
});

export default router;
