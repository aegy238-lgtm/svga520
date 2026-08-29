import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Volume2, VolumeX, Play, Pause, RotateCcw, Scissors, 
  Trash2, X, Download, RefreshCw, AlertTriangle, 
  CheckCircle2, Music, Check, Sparkles, Sliders,
  FileAudio, Layers, Settings, Radio, ChevronLeft, ChevronRight,
  Maximize2, Minimize2, CornerDownLeft, FastForward
} from 'lucide-react';
import { SVGAProjectData, SVGAAudioTrack } from './types';
import { 
  decodeAudioSource, 
  calculateWaveformPeaks, 
  sliceAndProcessAudio, 
  formatAudioTime, 
  embedAudioTrackIntoProject, 
  removeAudioTrackFromProject 
} from '../../utils/svgaAudioTrimmer';
import { extractAudioInBrowser } from '../../utils/clientAudio';

interface SvgaAudioEditorModalProps {
  isOpen: boolean;
  project: SVGAProjectData;
  onClose: () => void;
  onUpdateProject: (updatedProject: SVGAProjectData) => void;
  onShowToast: (message: string) => void;
}

type ModalTab = 'audio_volume' | 'delete_rename';
type TrimMode = 'fit_svga' | 'custom' | 'full';
type DragHandle = 'start' | 'end' | 'playhead' | null;

export const SvgaAudioEditorModal: React.FC<SvgaAudioEditorModalProps> = ({
  isOpen,
  project,
  onClose,
  onUpdateProject,
  onShowToast
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visualizerContainerRef = useRef<HTMLDivElement>(null);

  // Existing Track in Project (if any)
  const existingAudio = project.audios && project.audios.length > 0 ? project.audios[0] : null;

  // Active Tab
  const [activeTab, setActiveTab] = useState<ModalTab>('audio_volume');

  // Audio Source State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [selectedFileSize, setSelectedFileSize] = useState<string>('');
  const [isNotMp3Warning, setIsNotMp3Warning] = useState<boolean>(false);
  const [fileOriginalFormat, setFileOriginalFormat] = useState<string>('');
  
  // Decoded Audio Buffer & Waveform
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [waveformPeaks, setWaveformPeaks] = useState<{ min: number[]; max: number[] } | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);

  // Volume Setting (0 to 200%)
  const [volumePercent, setVolumePercent] = useState<number>(100);

  // Trimming Mode & Dual Left/Right Range
  const [trimMode, setTrimMode] = useState<TrimMode>('fit_svga');
  const [startSec, setStartSec] = useState<number>(0);
  const [endSec, setEndSec] = useState<number>(project.durationSec || 2);

  // Dragging interaction state
  const [draggingHandle, setDraggingHandle] = useState<DragHandle>(null);
  const [hoverHandle, setHoverHandle] = useState<DragHandle>(null);

  // Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [playerVolume, setPlayerVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Rename & Delete State
  const [renameKey, setRenameKey] = useState<string>(existingAudio?.audioKey || `audio_${Date.now()}`);
  const [isMarkedForDeletion, setIsMarkedForDeletion] = useState<boolean>(false);

  // Execution / Loading State
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executeProgress, setExecuteProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('Please select operations to execute');

  // Web Audio Context & Nodes for preview
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const playbackOffsetRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  const currentFps = project.fps || 30;
  const svgaDurationSec = project.durationSec || ((project.totalFrames || (project as any).frames || 60) / currentFps);

  // Initialize from project existing audio if available
  useEffect(() => {
    let isCancelled = false;
    if (existingAudio) {
      setRenameKey(existingAudio.audioKey);
      
      const rawBytes = project.rawImages?.[existingAudio.audioKey];
      const dataUrl = existingAudio.dataUrl || project.imagesMap?.[existingAudio.audioKey];
      const sourceToDecode = rawBytes || dataUrl;

      if (sourceToDecode) {
        decodeAudioSource(sourceToDecode)
          .then((decoded) => {
            if (isCancelled) return;
            setAudioBuffer(decoded.audioBuffer);
            setAudioDuration(decoded.duration);
            setWaveformPeaks(calculateWaveformPeaks(decoded.audioBuffer, 80));
            const initEnd = trimMode === 'fit_svga' 
              ? Math.min(decoded.duration, parseFloat(svgaDurationSec.toFixed(2)))
              : decoded.duration;
            setEndSec(initEnd);
            setSelectedFileName(existingAudio.name || existingAudio.audioKey + '.mp3');
            if (rawBytes && typeof rawBytes === 'object' && 'byteLength' in rawBytes) {
              setSelectedFileSize(`${Math.round((rawBytes as any).byteLength / 1024)} KB`);
            } else {
              setSelectedFileSize('Loaded');
            }
          })
          .catch((err) => {
            console.warn('Could not decode existing project audio:', err);
          });
      }
    }
    return () => {
      isCancelled = true;
    };
  }, [existingAudio, project, svgaDurationSec, trimMode]);

  // Clean up playback on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Update End Sec when Trim Mode or Audio Buffer changes
  useEffect(() => {
    if (!audioBuffer) return;
    if (trimMode === 'fit_svga') {
      setStartSec(0);
      setEndSec(Math.min(audioBuffer.duration, parseFloat(svgaDurationSec.toFixed(2))));
    } else if (trimMode === 'full') {
      setStartSec(0);
      setEndSec(parseFloat(audioBuffer.duration.toFixed(2)));
    }
  }, [trimMode, audioBuffer, svgaDurationSec]);

  // Handle File Selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name;
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    const isMp3 = extension === 'mp3' || file.type === 'audio/mpeg' || file.type === 'audio/mp3';

    setSelectedFile(file);
    setSelectedFileName(fileName);
    setSelectedFileSize(`${Math.round(file.size / 1024)} KB`);
    setFileOriginalFormat(extension ? `.${extension.toUpperCase()}` : 'غير معروف');

    if (!isMp3) {
      setIsNotMp3Warning(true);
    } else {
      setIsNotMp3Warning(false);
    }

    setIsMarkedForDeletion(false);
    setStatusMessage(`Ready: Add Audio (${fileName})`);
    stopPlayback();

    try {
      let buffer: AudioBuffer;
      if (file.type.startsWith('video/')) {
        const extracted = await extractAudioInBrowser(file);
        buffer = extracted.audioBuffer;
      } else {
        const decoded = await decodeAudioSource(file);
        buffer = decoded.audioBuffer;
      }

      setAudioBuffer(buffer);
      setAudioDuration(buffer.duration);
      setWaveformPeaks(calculateWaveformPeaks(buffer, 80));

      const initialEnd = trimMode === 'fit_svga' 
        ? Math.min(buffer.duration, parseFloat(svgaDurationSec.toFixed(2)))
        : parseFloat(buffer.duration.toFixed(2));

      setStartSec(0);
      setEndSec(initialEnd);
      setCurrentTimeSec(0);

    } catch (err: any) {
      console.error('Audio decode error:', err);
      onShowToast('تعذر فك تشفير الملف الصوتي. يرجى تجربة ملف آخر.');
    }
  };

  // Playback Control
  const startPlayback = useCallback((fromSec: number = 0) => {
    if (!audioBuffer) return;
    stopPlayback();

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioCtx;

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;

    const gainNode = audioCtx.createGain();
    const effectiveVolume = isMuted ? 0 : (volumePercent / 100) * playerVolume;
    gainNode.gain.setValueAtTime(effectiveVolume, audioCtx.currentTime);

    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    activeSourceRef.current = source;
    gainNodeRef.current = gainNode;

    const clipStart = startSec;
    const clipEnd = endSec;

    let startOffset = fromSec >= clipStart && fromSec < clipEnd ? fromSec : clipStart;
    const duration = Math.max(0.01, clipEnd - startOffset);

    playbackStartTimeRef.current = audioCtx.currentTime;
    playbackOffsetRef.current = startOffset;

    source.start(0, startOffset, duration);
    setIsPlaying(true);

    const updatePlayhead = () => {
      if (!audioContextRef.current || !activeSourceRef.current) return;
      const elapsed = audioContextRef.current.currentTime - playbackStartTimeRef.current;
      const cur = playbackOffsetRef.current + elapsed;

      if (cur >= clipEnd) {
        setCurrentTimeSec(clipStart);
        setIsPlaying(false);
        return;
      }

      setCurrentTimeSec(cur);
      animFrameRef.current = requestAnimationFrame(updatePlayhead);
    };

    animFrameRef.current = requestAnimationFrame(updatePlayhead);

    source.onended = () => {
      setIsPlaying(false);
    };
  }, [audioBuffer, startSec, endSec, volumePercent, playerVolume, isMuted]);

  const stopPlayback = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
        activeSourceRef.current.disconnect();
      } catch (e) {}
      activeSourceRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const togglePlay = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback(currentTimeSec);
    }
  };

  // Clear / Reset All
  const handleClearAll = () => {
    stopPlayback();
    setSelectedFile(null);
    setSelectedFileName('');
    setSelectedFileSize('');
    setIsNotMp3Warning(false);
    setAudioBuffer(null);
    setWaveformPeaks(null);
    setAudioDuration(0);
    setStartSec(0);
    setEndSec(svgaDurationSec);
    setVolumePercent(100);
    setIsMarkedForDeletion(false);
    setStatusMessage('Please select operations to execute');
  };

  // Download Current Audio
  const handleDownloadAudio = () => {
    if (!audioBuffer) return;
    setIsExecuting(true);
    sliceAndProcessAudio(audioBuffer, {
      startSec,
      endSec,
      volume: volumePercent / 100,
      bitrateKbps: 192
    }).then((processed) => {
      const url = URL.createObjectURL(processed.mp3Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(selectedFileName || 'audio_track').replace(/\.[^/.]+$/, '')}.mp3`;
      a.click();
      URL.revokeObjectURL(url);
      onShowToast('تم تحميل المقطع الصوتي بصيغة MP3');
    }).finally(() => {
      setIsExecuting(false);
    });
  };

  // Dragging logic on Waveform visualizer (Left handle, Right handle, Playhead)
  const handleContainerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!visualizerContainerRef.current || !audioBuffer) return;
    const rect = visualizerContainerRef.current.getBoundingClientRect();
    const clientX = e.clientX;
    const clickRatio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const clickTime = clickRatio * audioDuration;

    const startX = (startSec / (audioDuration || 1)) * rect.width;
    const endX = (endSec / (audioDuration || 1)) * rect.width;
    const mouseX = clientX - rect.left;

    // Threshold in pixels for handle detection
    const handleThreshold = 18;

    if (Math.abs(mouseX - startX) <= handleThreshold) {
      setDraggingHandle('start');
      setTrimMode('custom');
      stopPlayback();
    } else if (Math.abs(mouseX - endX) <= handleThreshold) {
      setDraggingHandle('end');
      setTrimMode('custom');
      stopPlayback();
    } else {
      // Seek playhead directly
      const boundedTime = Math.max(startSec, Math.min(endSec, clickTime));
      setCurrentTimeSec(boundedTime);
      setDraggingHandle('playhead');
      if (isPlaying) startPlayback(boundedTime);
    }
  };

  const handleContainerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!visualizerContainerRef.current || !audioBuffer) return;
    const rect = visualizerContainerRef.current.getBoundingClientRect();
    const clientX = e.clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetSec = parseFloat((ratio * audioDuration).toFixed(2));

    const startX = (startSec / (audioDuration || 1)) * rect.width;
    const endX = (endSec / (audioDuration || 1)) * rect.width;
    const mouseX = clientX - rect.left;

    if (!draggingHandle) {
      if (Math.abs(mouseX - startX) <= 16) {
        setHoverHandle('start');
      } else if (Math.abs(mouseX - endX) <= 16) {
        setHoverHandle('end');
      } else {
        setHoverHandle(null);
      }
      return;
    }

    if (draggingHandle === 'start') {
      const newStart = Math.max(0, Math.min(endSec - 0.05, targetSec));
      setStartSec(parseFloat(newStart.toFixed(2)));
      setCurrentTimeSec(newStart);
      setTrimMode('custom');
    } else if (draggingHandle === 'end') {
      const newEnd = Math.max(startSec + 0.05, Math.min(audioDuration, targetSec));
      setEndSec(parseFloat(newEnd.toFixed(2)));
      setTrimMode('custom');
    } else if (draggingHandle === 'playhead') {
      const bounded = Math.max(startSec, Math.min(endSec, targetSec));
      setCurrentTimeSec(parseFloat(bounded.toFixed(2)));
    }
  };

  const handleContainerPointerUp = () => {
    setDraggingHandle(null);
  };

  // Adjust Start Trim with Delta (+/- seconds)
  const adjustStartTrim = (delta: number) => {
    if (!audioBuffer) return;
    const next = Math.max(0, Math.min(endSec - 0.05, parseFloat((startSec + delta).toFixed(2))));
    setStartSec(next);
    setCurrentTimeSec(next);
    setTrimMode('custom');
  };

  // Adjust End Trim with Delta (+/- seconds)
  const adjustEndTrim = (delta: number) => {
    if (!audioBuffer) return;
    const next = Math.max(startSec + 0.05, Math.min(audioDuration, parseFloat((endSec + delta).toFixed(2))));
    setEndSec(next);
    setTrimMode('custom');
  };

  // Snap to SVGA Duration
  const handleSnapFitSvga = () => {
    if (!audioBuffer) return;
    setStartSec(0);
    setEndSec(Math.min(audioBuffer.duration, parseFloat(svgaDurationSec.toFixed(2))));
    setCurrentTimeSec(0);
    setTrimMode('fit_svga');
    onShowToast(`تمت مطابقة طول الصوت مع مدة SVGA (${svgaDurationSec.toFixed(2)} ثانية)`);
  };

  // Snap to Full File Duration
  const handleSnapFullAudio = () => {
    if (!audioBuffer) return;
    setStartSec(0);
    setEndSec(parseFloat(audioBuffer.duration.toFixed(2)));
    setCurrentTimeSec(0);
    setTrimMode('full');
  };

  // Draw Audio Visualizer Bars (Matching the video exact visualizer style + Trim Highlights)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const barCount = 56;
    const barWidth = 4;
    const gap = (width - (barCount * barWidth)) / (barCount - 1);
    const centerY = height / 2;

    const effectiveTotalDur = audioDuration || svgaDurationSec || 2;
    const startRatio = startSec / effectiveTotalDur;
    const endRatio = endSec / effectiveTotalDur;

    for (let i = 0; i < barCount; i++) {
      const x = i * (barWidth + gap);
      const barRatio = i / barCount;
      const isInsideTrim = barRatio >= startRatio && barRatio <= endRatio;
      
      // Calculate bar amplitude
      let amp = 0.15;
      if (waveformPeaks && waveformPeaks.max.length > 0) {
        const peakIdx = Math.floor(barRatio * waveformPeaks.max.length);
        const maxVal = waveformPeaks.max[peakIdx] || 0;
        const minVal = waveformPeaks.min[peakIdx] || 0;
        amp = Math.min(1, Math.max(0.12, (Math.abs(maxVal) + Math.abs(minVal)) / 1.5));
      } else {
        const norm = (i - barCount / 2) / (barCount / 2);
        amp = Math.max(0.1, 0.9 * Math.exp(-norm * norm * 2.2) + Math.sin(i * 0.45) * 0.15);
      }

      const barHeight = Math.max(8, amp * (height - 36));
      const topY = centerY - barHeight / 2;

      if (audioBuffer) {
        if (isInsideTrim) {
          // Vivid active gradient (Yellow -> Green -> Cyan)
          const gradient = ctx.createLinearGradient(0, topY, 0, topY + barHeight);
          gradient.addColorStop(0, '#eab308');   // Yellow-500
          gradient.addColorStop(0.5, '#22c55e'); // Green-500
          gradient.addColorStop(1, '#06b6d4');   // Cyan-500
          ctx.fillStyle = gradient;
        } else {
          // Dimmed inactive bars outside trimmed zone
          ctx.fillStyle = 'rgba(74, 222, 128, 0.18)';
        }
      } else {
        ctx.fillStyle = 'rgba(74, 222, 128, 0.25)';
      }

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, topY, barWidth, barHeight, 2);
      } else {
        ctx.rect(x, topY, barWidth, barHeight);
      }
      ctx.fill();

      // Bottom baseline dot indicator
      ctx.fillStyle = isInsideTrim ? 'rgba(34, 197, 94, 0.6)' : 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.arc(x + barWidth / 2, height - 10, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

  }, [waveformPeaks, audioBuffer, currentTimeSec, startSec, endSec, audioDuration, svgaDurationSec]);

  // Execute Audio Merge / Delete Operation
  const handleExecute = async () => {
    setIsExecuting(true);
    setExecuteProgress(15);
    stopPlayback();

    try {
      // If Marked for Deletion:
      if (isMarkedForDeletion) {
        setExecuteProgress(60);
        await new Promise(r => setTimeout(r, 400));
        const updated = removeAudioTrackFromProject(project, renameKey);
        setExecuteProgress(100);
        onUpdateProject(updated);
        onShowToast('تم حذف المسار الصوتي من ملف SVGA بنجاح');
        onClose();
        return;
      }

      // If No audio buffer to process:
      if (!audioBuffer) {
        onShowToast('الرجاء اختيار ملف صوتي أولاً');
        setIsExecuting(false);
        return;
      }

      setExecuteProgress(35);
      setStatusMessage('جاري تشفير صوت MP3 (LAME Engine) وقص النطاق المحدد...');

      // True LAME MP3 Encoding & Slicing
      const sliceDuration = Math.max(0.01, endSec - startSec);
      const totalTimeMs = Math.round(sliceDuration * 1000);
      const startTimeMs = Math.round(startSec * 1000);
      const fps = project.fps || 30;
      const calculatedEndFrame = Math.round(sliceDuration * fps);

      setExecuteProgress(65);

      const processed = await sliceAndProcessAudio(audioBuffer, {
        startSec,
        endSec,
        volume: volumePercent / 100,
        normalize: true,
        bitrateKbps: 192
      });

      setExecuteProgress(85);
      setStatusMessage('جاري دمج وحقن بايتات الـ MP3 في هيكل MovieEntity بالـ SVGA...');

      const targetKey = renameKey.trim() || `audio_${Date.now()}`;

      const updatedProject = embedAudioTrackIntoProject(project, {
        audioKey: targetKey,
        rawBytes: processed.rawBytes,
        dataUrl: processed.dataUrl,
        startFrame: 0,
        endFrame: calculatedEndFrame,
        startTimeMs,
        totalTimeMs
      });

      setExecuteProgress(100);
      await new Promise(r => setTimeout(r, 300));

      onUpdateProject(updatedProject);
      onShowToast('🎉 تم دمج وقص صوت الـ MP3 داخل ملف SVGA باحترافية وتوافق 100%!');
      onClose();

    } catch (err: any) {
      console.error('Audio execute error:', err);
      onShowToast(err.message || 'حدث خطأ أثناء دمج الصوت.');
    } finally {
      setIsExecuting(false);
      setExecuteProgress(0);
    }
  };

  if (!isOpen) return null;

  const currentTrimSpan = Math.max(0, endSec - startSec);
  const totalDisplayDur = audioDuration || svgaDurationSec || 2;
  const startPercent = Math.max(0, Math.min(100, (startSec / totalDisplayDur) * 100));
  const endPercent = Math.max(0, Math.min(100, (endSec / totalDisplayDur) * 100));
  const playheadPercent = Math.max(0, Math.min(100, (currentTimeSec / totalDisplayDur) * 100));

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md select-none">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.mp4,.mov"
        className="hidden"
        onChange={handleFileChange}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-[#0e121a] border border-[#1e2638] rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col text-slate-200"
        style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#1c2436] flex items-center justify-between bg-[#0b0e15]">
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">
              {existingAudio ? 'Audio Edit Tool' : 'Add Audio'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure operations and click execute
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body - Two Column Layout */}
        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 bg-[#0e121a]">
          
          {/* Left Column: Visualizer & Trimming Deck (7 cols) */}
          <div className="lg:col-span-7 bg-[#080b11] border border-[#1b2333] rounded-xl p-4 flex flex-col justify-between space-y-4">
            
            {/* Top Sub-Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Volume2 size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white leading-tight">
                    {existingAudio ? `Current audio: ${existingAudio.audioKey}` : (selectedFileName ? `Selected: ${selectedFileName}` : 'No current audio')}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    FPS:{currentFps}, duration: {audioBuffer ? audioDuration.toFixed(2) : svgaDurationSec.toFixed(2)}s
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RefreshCw size={12} />
                  <span>Clear All</span>
                </button>

                {audioBuffer && (
                  <button
                    type="button"
                    onClick={handleDownloadAudio}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Download size={12} />
                    <span>Download Audio</span>
                  </button>
                )}
              </div>
            </div>

            {/* Interactive Visualizer Display with Left & Right Drag Handles */}
            <div 
              ref={visualizerContainerRef}
              onPointerDown={handleContainerPointerDown}
              onPointerMove={handleContainerPointerMove}
              onPointerUp={handleContainerPointerUp}
              onPointerLeave={handleContainerPointerUp}
              className={`w-full h-52 bg-[#04060a] border border-[#161d2b] rounded-lg relative overflow-hidden flex flex-col items-center justify-center p-3 select-none ${
                audioBuffer ? 'cursor-crosshair' : ''
              }`}
            >
              <canvas ref={canvasRef} className="w-full h-full block pointer-events-none" />

              {!audioBuffer ? (
                <div className="absolute inset-0 flex items-center justify-center gap-2 text-slate-500 text-xs pointer-events-none">
                  <VolumeX size={14} />
                  <span>No audio to preview</span>
                </div>
              ) : (
                <>
                  {/* Left Trimmed Shaded Area (Darkened Left Mask) */}
                  <div 
                    className="absolute top-0 bottom-0 left-0 bg-black/75 backdrop-blur-[1px] pointer-events-none border-r border-emerald-500/40 transition-all duration-75"
                    style={{ width: `${startPercent}%` }}
                  />

                  {/* Right Trimmed Shaded Area (Darkened Right Mask) */}
                  <div 
                    className="absolute top-0 bottom-0 right-0 bg-black/75 backdrop-blur-[1px] pointer-events-none border-l border-amber-500/40 transition-all duration-75"
                    style={{ width: `${100 - endPercent}%` }}
                  />

                  {/* Active Selected Audio Region Border */}
                  <div 
                    className="absolute top-0 bottom-0 pointer-events-none border-y-2 border-emerald-500/40 bg-emerald-500/5 transition-all duration-75"
                    style={{ 
                      left: `${startPercent}%`, 
                      width: `${Math.max(0, endPercent - startPercent)}%` 
                    }}
                  />

                  {/* Left Handle (Start Trim / قص البداية من الشمال) */}
                  <div 
                    className={`absolute top-0 bottom-0 w-4 -ml-2 flex flex-col items-center justify-between cursor-ew-resize z-20 transition-transform ${
                      draggingHandle === 'start' || hoverHandle === 'start' ? 'scale-110' : ''
                    }`}
                    style={{ left: `${startPercent}%` }}
                  >
                    {/* Floating Top Badge */}
                    <div className="bg-emerald-500 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap -mt-1 font-mono tracking-tighter">
                      بداية {startSec.toFixed(2)}s
                    </div>

                    {/* Vertical Green Guide Line & Grip Handle */}
                    <div className="w-1.5 h-full bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)] flex items-center justify-center my-1">
                      <div className="w-0.5 h-4 bg-slate-950 rounded-full" />
                    </div>

                    <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-md -mb-1 border border-slate-900" />
                  </div>

                  {/* Right Handle (End Trim / قص النهاية من اليمين) */}
                  <div 
                    className={`absolute top-0 bottom-0 w-4 -ml-2 flex flex-col items-center justify-between cursor-ew-resize z-20 transition-transform ${
                      draggingHandle === 'end' || hoverHandle === 'end' ? 'scale-110' : ''
                    }`}
                    style={{ left: `${endPercent}%` }}
                  >
                    {/* Floating Top Badge */}
                    <div className="bg-amber-400 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap -mt-1 font-mono tracking-tighter">
                      نهاية {endSec.toFixed(2)}s
                    </div>

                    {/* Vertical Yellow Guide Line & Grip Handle */}
                    <div className="w-1.5 h-full bg-amber-400 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)] flex items-center justify-center my-1">
                      <div className="w-0.5 h-4 bg-slate-950 rounded-full" />
                    </div>

                    <div className="w-2.5 h-2.5 bg-amber-400 rounded-full shadow-md -mb-1 border border-slate-900" />
                  </div>

                  {/* Playhead Needle Indicator */}
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 pointer-events-none shadow-[0_0_10px_rgba(34,211,238,1)] z-30 transition-all duration-75"
                    style={{ left: `${playheadPercent}%` }}
                  >
                    <div className="w-2 h-2 bg-cyan-400 rotate-45 -ml-[3px] shadow-md" />
                  </div>

                  {/* Dynamic Info Overlay Pill */}
                  <div className="absolute bottom-2 bg-black/80 backdrop-blur-md border border-slate-800 text-[10px] text-slate-300 px-2.5 py-1 rounded-full pointer-events-none flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">اسحب المقابض للقص:</span>
                    <span className="font-mono">
                      {currentTrimSpan.toFixed(2)}s ({Math.round(currentTrimSpan * currentFps)} فريم)
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Audio Player Controller Bar */}
            <div className="bg-[#0b0e17] border border-[#1a2233] rounded-lg px-3 py-2 flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                disabled={!audioBuffer}
                className="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed shadow-sm shrink-0"
                title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل المقطع المقصوص'}
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
              </button>

              {/* Reset to Start of Trim */}
              <button
                type="button"
                onClick={() => {
                  stopPlayback();
                  setCurrentTimeSec(startSec);
                }}
                disabled={!audioBuffer}
                className="p-1.5 text-slate-400 hover:text-white disabled:text-slate-700 transition-colors cursor-pointer"
                title="إعادة المؤشر لبداية المقطع"
              >
                <RotateCcw size={13} />
              </button>

              {/* Time display */}
              <span className="font-mono text-xs text-slate-300 shrink-0">
                {formatAudioTime(currentTimeSec, false)} / {formatAudioTime(endSec || audioDuration, false)}
              </span>

              {/* Progress Slider */}
              <input
                type="range"
                min={startSec}
                max={endSec || audioDuration || 1}
                step={0.01}
                value={currentTimeSec}
                disabled={!audioBuffer}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setCurrentTimeSec(val);
                  if (isPlaying) startPlayback(val);
                }}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />

              {/* Volume / Mute Button */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : playerVolume}
                  onChange={(e) => {
                    setPlayerVolume(parseFloat(e.target.value));
                    setIsMuted(false);
                  }}
                  className="w-14 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            </div>

            {/* Left & Right Precision Cutting Studio (قص البداية والنهاية الدقيق) */}
            <div className="bg-[#0b0e17]/90 border border-[#1a2233] rounded-lg p-3 space-y-3">
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scissors size={14} className="text-emerald-400" />
                  <span className="text-xs font-bold text-white">التحكم في قص البداية (يسار) والنهاية (يمين):</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSnapFitSvga}
                    disabled={!audioBuffer}
                    className="text-[11px] font-bold px-2 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 rounded-md transition-colors cursor-pointer"
                  >
                    مطابقة SVGA ({svgaDurationSec.toFixed(2)}s)
                  </button>

                  <button
                    type="button"
                    onClick={handleSnapFullAudio}
                    disabled={!audioBuffer}
                    className="text-[11px] font-bold px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition-colors cursor-pointer"
                  >
                    كامل الملف
                  </button>
                </div>
              </div>

              {/* Dual Range Controls: Left Trim and Right Trim */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-800/80">
                
                {/* Left Side: Start Trim Control */}
                <div className="bg-slate-950/80 border border-emerald-500/30 rounded-lg p-2.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-400 flex items-center gap-1">
                      <ChevronLeft size={14} />
                      قص البداية (يسار):
                    </span>
                    <span className="font-mono text-white font-bold text-xs bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {startSec.toFixed(2)}s
                    </span>
                  </div>

                  {/* Micro Stepping Buttons */}
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => adjustStartTrim(-0.5)}
                      disabled={!audioBuffer || startSec <= 0}
                      className="flex-1 py-1 text-[10px] font-bold font-mono bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 rounded border border-slate-800 transition-colors cursor-pointer"
                    >
                      -0.5s
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustStartTrim(-0.1)}
                      disabled={!audioBuffer || startSec <= 0}
                      className="flex-1 py-1 text-[10px] font-bold font-mono bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 rounded border border-slate-800 transition-colors cursor-pointer"
                    >
                      -0.1s
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustStartTrim(0.1)}
                      disabled={!audioBuffer || startSec >= endSec - 0.1}
                      className="flex-1 py-1 text-[10px] font-bold font-mono bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-emerald-300 rounded border border-slate-800 transition-colors cursor-pointer"
                    >
                      +0.1s
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustStartTrim(0.5)}
                      disabled={!audioBuffer || startSec >= endSec - 0.5}
                      className="flex-1 py-1 text-[10px] font-bold font-mono bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-emerald-300 rounded border border-slate-800 transition-colors cursor-pointer"
                    >
                      +0.5s
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStartSec(0);
                        setCurrentTimeSec(0);
                      }}
                      disabled={!audioBuffer}
                      className="px-2 py-1 text-[10px] font-bold font-mono bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded border border-emerald-500/40 transition-colors cursor-pointer"
                      title="تصفير البداية"
                    >
                      0s
                    </button>
                  </div>
                </div>

                {/* Right Side: End Trim Control */}
                <div className="bg-slate-950/80 border border-amber-500/30 rounded-lg p-2.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-400 flex items-center gap-1">
                      <ChevronRight size={14} />
                      قص النهاية (يمين):
                    </span>
                    <span className="font-mono text-white font-bold text-xs bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {endSec.toFixed(2)}s
                    </span>
                  </div>

                  {/* Micro Stepping Buttons */}
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => adjustEndTrim(-0.5)}
                      disabled={!audioBuffer || endSec <= startSec + 0.5}
                      className="flex-1 py-1 text-[10px] font-bold font-mono bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-amber-300 rounded border border-slate-800 transition-colors cursor-pointer"
                    >
                      -0.5s
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustEndTrim(-0.1)}
                      disabled={!audioBuffer || endSec <= startSec + 0.1}
                      className="flex-1 py-1 text-[10px] font-bold font-mono bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-amber-300 rounded border border-slate-800 transition-colors cursor-pointer"
                    >
                      -0.1s
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustEndTrim(0.1)}
                      disabled={!audioBuffer || endSec >= audioDuration}
                      className="flex-1 py-1 text-[10px] font-bold font-mono bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 rounded border border-slate-800 transition-colors cursor-pointer"
                    >
                      +0.1s
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustEndTrim(0.5)}
                      disabled={!audioBuffer || endSec >= audioDuration}
                      className="flex-1 py-1 text-[10px] font-bold font-mono bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 rounded border border-slate-800 transition-colors cursor-pointer"
                    >
                      +0.5s
                    </button>
                    <button
                      type="button"
                      onClick={() => audioBuffer && setEndSec(audioBuffer.duration)}
                      disabled={!audioBuffer}
                      className="px-2 py-1 text-[10px] font-bold font-mono bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded border border-amber-500/40 transition-colors cursor-pointer"
                      title="أقصى نهاية للملف"
                    >
                      Max
                    </button>
                  </div>
                </div>

              </div>

            </div>

          </div>

          {/* Right Column: Settings & Operations (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            
            {/* Top Tabs */}
            <div className="flex items-center gap-2 border-b border-[#1c2436] pb-3">
              <button
                type="button"
                onClick={() => setActiveTab('audio_volume')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer border ${
                  activeTab === 'audio_volume'
                    ? 'bg-[#182030] text-white border-[#2b3852]'
                    : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                <Sliders size={13} />
                <span>Audio | Volume</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('delete_rename')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer border ${
                  activeTab === 'delete_rename'
                    ? 'bg-[#182030] text-white border-[#2b3852]'
                    : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                <Trash2 size={13} />
                <span>{existingAudio ? 'Rename | Delete' : 'Delete Audio'}</span>
              </button>
            </div>

            {/* Tab 1 Content: Audio File & Output Volume */}
            {activeTab === 'audio_volume' && (
              <div className="space-y-4 flex-1">
                
                {/* Audio File Section */}
                <div className="bg-[#0b0e17] border border-[#1b2333] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Music size={13} className="text-emerald-400" />
                      Audio File
                    </span>
                    {selectedFileName && (
                      <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-500/30">
                        Selected
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="flex-1 py-2 px-3 bg-emerald-500/10 border border-emerald-500/40 rounded-lg text-xs font-bold text-emerald-400 text-center truncate"
                    >
                      {existingAudio && !selectedFile ? 'Keep Current' : (selectedFileName ? 'Audio Loaded' : 'No current audio')}
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-600/20"
                    >
                      <span>{existingAudio ? 'Replace Audio' : '+ Add Audio'}</span>
                    </button>
                  </div>

                  {/* Warning: If file is NOT MP3 */}
                  {isNotMp3Warning && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 flex items-start gap-2 text-[11px] text-amber-300">
                      <AlertTriangle size={15} className="shrink-0 text-amber-400 mt-0.5" />
                      <div className="leading-tight">
                        <span className="font-bold block">تنبيه: صيغة الملف ({fileOriginalFormat}) ليست MP3.</span>
                        <span className="text-slate-300 text-[10px]">
                          سيقوم المحرك بتحويله وتشفيره تلقائياً إلى MP3 LAME عالي الجودة بنقاء 100% ليعمل بسلاسة داخل SVGA.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Selected File Details Box */}
                  {selectedFileName && (
                    <div className="bg-[#05070c] border border-[#161c2b] rounded-lg p-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs text-white font-bold block truncate">
                          {selectedFileName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {selectedFileSize} • {isNotMp3Warning ? 'Auto MP3 Encode' : 'MP3 Format'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearAll}
                        className="px-2.5 py-1 text-xs font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {/* Output Volume Section */}
                <div className="bg-[#0b0e17] border border-[#1b2333] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Volume2 size={13} className="text-emerald-400" />
                      Output Volume
                    </span>
                    <span className="bg-amber-500/20 text-amber-400 text-xs font-bold font-mono px-2 py-0.5 rounded-md border border-amber-500/30">
                      {volumePercent}%
                    </span>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={200}
                    step={1}
                    value={volumePercent}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setVolumePercent(val);
                      setStatusMessage(`Ready: Volume ${val}%`);
                    }}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />

                  <p className="text-[10px] text-slate-400">
                    100% is original volume, 0% is mute, 200% is double volume
                  </p>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setVolumePercent(0)}
                      className="py-1.5 text-xs font-bold bg-[#06080e] hover:bg-[#121622] border border-slate-800 text-slate-300 rounded-lg transition-colors cursor-pointer text-center"
                    >
                      Mute 0%
                    </button>
                    <button
                      type="button"
                      onClick={() => setVolumePercent(100)}
                      className="py-1.5 text-xs font-bold bg-[#06080e] hover:bg-[#121622] border border-slate-800 text-slate-300 rounded-lg transition-colors cursor-pointer text-center"
                    >
                      Original 100%
                    </button>
                    <button
                      type="button"
                      onClick={() => setVolumePercent(200)}
                      className="py-1.5 text-xs font-bold bg-[#06080e] hover:bg-[#121622] border border-slate-800 text-slate-300 rounded-lg transition-colors cursor-pointer text-center"
                    >
                      2x 200%
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* Tab 2 Content: Rename | Delete */}
            {activeTab === 'delete_rename' && (
              <div className="space-y-4 flex-1">
                <div className="bg-[#0b0e17] border border-[#1b2333] rounded-xl p-4 space-y-3">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    Rename Audio Key
                  </span>
                  <input
                    type="text"
                    value={renameKey}
                    onChange={(e) => setRenameKey(e.target.value)}
                    placeholder="audio_..."
                    className="w-full bg-[#05070c] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-slate-500">
                    The identifier key mapped inside the SVGA binary images dictionary.
                  </p>
                </div>

                <div className="bg-[#0b0e17] border border-[#1b2333] rounded-xl p-4 space-y-3">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    Delete Audio
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setIsMarkedForDeletion(!isMarkedForDeletion);
                      if (!isMarkedForDeletion) {
                        setStatusMessage('Ready: Mark for deletion');
                      } else {
                        setStatusMessage('Please select operations to execute');
                      }
                    }}
                    className={`w-full py-2.5 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                      isMarkedForDeletion
                        ? 'bg-rose-600/30 border-rose-500 text-rose-300 shadow-md shadow-rose-500/20'
                        : 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400'
                    }`}
                  >
                    <Trash2 size={14} />
                    <span>{isMarkedForDeletion ? '✓ Marked for deletion' : '🗑️ Mark for deletion'}</span>
                  </button>

                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    After marking delete, replacement and volume adjustment will not execute.
                  </p>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[#1c2436] bg-[#0b0e15] flex flex-wrap items-center justify-between gap-3">
          
          {/* Status Message */}
          <div className="text-xs text-slate-400 flex items-center gap-2">
            {isExecuting ? (
              <div className="flex items-center gap-2 text-emerald-400">
                <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <span>{statusMessage}</span>
              </div>
            ) : (
              <span>{statusMessage}</span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isExecuting}
              className="px-4 py-2 bg-[#141a26] hover:bg-[#1c2436] text-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-[#222c3f]"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleExecute}
              disabled={isExecuting || (!audioBuffer && !isMarkedForDeletion)}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-600/30 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed"
            >
              <Play size={13} className="fill-current" />
              <span>Execute</span>
            </button>
          </div>

        </div>

        {/* In-place Execution Progress Bar */}
        {isExecuting && (
          <div className="w-full bg-[#05070c] h-1.5 relative overflow-hidden">
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: `${executeProgress}%` }}
              transition={{ duration: 0.2 }}
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
            />
          </div>
        )}

      </motion.div>
    </div>
  );
};
