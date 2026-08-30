import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Play,
  Pause,
  Trash2,
  Download,
  Volume2,
  VolumeX,
  Upload,
  Scissors,
  CheckCircle2,
  AlertCircle,
  FileAudio,
  Sparkles,
  Zap,
  RotateCcw,
  Check,
} from "lucide-react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";

interface AudioEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioUrl: string | null;
  audioFile: File | null;
  onReplace: (file: File) => void;
  onRemove: () => void;
  onKeep: () => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
  onExecute: (
    volume: number,
    file: File | null,
    start?: number,
    end?: number,
  ) => Promise<void>;
  isProcessing?: boolean;
}

export function AudioEditorModal({
  isOpen,
  onClose,
  audioUrl,
  audioFile,
  onReplace,
  onRemove,
  onKeep,
  volume,
  onVolumeChange,
  onExecute,
  isProcessing = false,
}: AudioEditorModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const wsRegions = useRef<any>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeTab, setActiveTab] = useState<"audio" | "delete">("audio");
  const [markForDeletion, setMarkForDeletion] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"keep" | "replace">("keep");

  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (audioFile) {
      setSelectedMode("replace");
    } else {
      setSelectedMode("keep");
    }
  }, [audioFile]);

  useEffect(() => {
    if (isOpen && containerRef.current && audioUrl) {
      if (wavesurfer.current) {
        wavesurfer.current.destroy();
        wavesurfer.current = null;
      }

      try {
        wavesurfer.current = WaveSurfer.create({
          container: containerRef.current,
          waveColor: "rgba(234, 179, 8, 0.65)",
          progressColor: "#22c55e",
          cursorColor: "#ffffff",
          cursorWidth: 2,
          barWidth: 3,
          barGap: 2,
          barRadius: 3,
          height: 120,
          normalize: true,
        });

        try {
          wsRegions.current = wavesurfer.current.registerPlugin(
            RegionsPlugin.create()
          );
        } catch (regErr) {
          console.warn("WaveSurfer Regions plugin notice:", regErr);
        }

        wavesurfer.current.on("ready", () => {
          const dur = wavesurfer.current?.getDuration() || 0;
          setDuration(dur);

          if (wsRegions.current) {
            try {
              wsRegions.current.clearRegions();
              wsRegions.current.addRegion({
                start: 0,
                end: dur,
                color: "rgba(34, 197, 94, 0.15)",
                drag: true,
                resize: true,
              });

              wsRegions.current.on("region-updated", (region: any) => {
                setStartTime(region.start);
                setEndTime(region.end);
              });
              wsRegions.current.on("region-created", (region: any) => {
                setStartTime(region.start);
                setEndTime(region.end);
              });
            } catch (e) {}
          }

          setStartTime(0);
          setEndTime(dur);
        });

        wavesurfer.current.on("audioprocess", () => {
          setCurrentTime(wavesurfer.current?.getCurrentTime() || 0);
        });

        wavesurfer.current.on("play", () => setIsPlaying(true));
        wavesurfer.current.on("pause", () => setIsPlaying(false));

        wavesurfer.current.load(audioUrl);
      } catch (err) {
        console.error("WaveSurfer init error:", err);
      }
    }

    return () => {
      if (wavesurfer.current && !isOpen) {
        try {
          wavesurfer.current.destroy();
        } catch (e) {}
        wavesurfer.current = null;
      }
    };
  }, [isOpen, audioUrl]);

  useEffect(() => {
    if (wavesurfer.current) {
      try {
        wavesurfer.current.setVolume(Math.min(volume, 1));
      } catch (e) {}
    }
  }, [volume]);

  const handlePlayPause = () => {
    if (wavesurfer.current) {
      wavesurfer.current.playPause();
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    onVolumeChange(newVolume);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedMode("replace");
      setMarkForDeletion(false);
      onReplace(file);
    }
  };

  const handleClearAll = () => {
    onRemove();
    setSelectedMode("keep");
    setMarkForDeletion(false);
  };

  const handleDownloadCurrentAudio = () => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = audioFile?.name || "vap_audio_track.mp3";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleExecuteAction = async () => {
    if (markForDeletion) {
      onRemove();
      onClose();
      return;
    }
    const fileToUse = selectedMode === "replace" ? audioFile : null;
    await onExecute(volume, fileToUse, startTime, endTime);
  };

  if (!isOpen) return null;

  const currentAudioDisplayName = audioFile?.name || (audioUrl ? "audio" : "لا يوجد مسار صوتي");

  let statusText = "الرجاء اختيار العمليات للتنفيذ";
  let statusColor = "text-slate-400 border-white/10 bg-white/5";

  if (markForDeletion) {
    statusText = "جاهز: تم تحديد مسار الصوت للحذف التام (Marked for Deletion)";
    statusColor = "text-red-400 border-red-500/30 bg-red-500/10";
  } else if (selectedMode === "replace" && audioFile) {
    statusText = `جاهز: استبدال وتضمين الصوت (${audioFile.name}) بسرعة فائقة`;
    statusColor = "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
  } else if (volume !== 1.0) {
    statusText = `جاهز: ضبط مستوى الصوت إلى ${Math.round(volume * 100)}%`;
    statusColor = "text-indigo-400 border-indigo-500/30 bg-indigo-500/10";
  } else if (selectedMode === "keep") {
    statusText = "جاهز: الاحتفاظ بالصوت الحالي مع فحص التوافق";
    statusColor = "text-teal-400 border-teal-500/30 bg-teal-500/10";
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="w-full max-w-4xl bg-[#12141c] rounded-2xl border border-white/10 overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[#161823]">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <h2 className="text-white font-black text-base font-cairo">
                أداة تعديل وتخصيص صوت VAP الاحترافية (VAP Audio Edit Tool)
              </h2>
            </div>
            <p className="text-white/40 text-[11px] font-sans mt-0.5">
              Configure VAP animation audio and click execute
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-lg border border-white/10 text-xs text-white/70 font-mono">
              <span className="text-white/40 text-[10px]">Current audio:</span>
              <span className="text-emerald-400 font-bold truncate max-w-[140px]" title={currentAudioDisplayName}>
                {currentAudioDisplayName}
              </span>
            </div>

            {audioUrl && (
              <>
                <button
                  onClick={handleClearAll}
                  className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold transition-all border border-red-500/20 flex items-center gap-1 cursor-pointer"
                  title="مسح الصوت الحالي"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">مسح الكل</span>
                </button>

                <button
                  onClick={handleDownloadCurrentAudio}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-lg text-xs font-bold transition-all border border-white/10 flex items-center gap-1 cursor-pointer"
                  title="تنزيل ملف الصوت بصيغة MP3"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">تنزيل الصوت</span>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Content Grid */}
        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 font-cairo overflow-y-auto">
          {/* Left Column: Waveform & Audio Player (7 cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
            <div className="bg-[#0b0c12] rounded-xl p-4 border border-white/10 shadow-inner flex flex-col justify-between flex-1 min-h-[220px]">
              <div className="flex items-center justify-between text-xs pb-3 border-b border-white/5">
                <span className="text-white/60 font-bold flex items-center gap-1.5">
                  <FileAudio className="w-4 h-4 text-emerald-400" />
                  مخطط الأمواج الصوتية (Waveform Visualizer)
                </span>
                <span className="text-[10px] font-mono text-emerald-400/90 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  44.1 kHz • AAC/MP3 • Stereo
                </span>
              </div>

              {/* Waveform Canvas Area */}
              <div className="relative my-auto py-2" dir="ltr">
                {!audioUrl && (
                  <div className="h-[120px] flex flex-col items-center justify-center text-white/30 text-xs font-bold border-2 border-dashed border-white/10 rounded-xl bg-white/[0.02] gap-2">
                    <FileAudio className="w-6 h-6 text-white/20" />
                    <span>لا يوجد ملف صوت محمل حالياً. اضغط "استبدال الصوت" لرفع ملف MP3 أو WAV</span>
                  </div>
                )}
                <div ref={containerRef} className={!audioUrl ? "hidden" : "w-full"} />

                {audioUrl && duration > 0 && (
                  <div className="absolute top-1 left-1 px-2.5 py-1 bg-black/80 backdrop-blur-md rounded-md text-[10px] text-white/80 font-mono flex items-center gap-2 border border-white/10 shadow-lg">
                    <Scissors className="w-3 h-3 text-emerald-400" />
                    <span>{formatTime(startTime)} - {formatTime(endTime)}</span>
                    <span className="text-white/40">({formatTime(endTime - startTime)})</span>
                  </div>
                )}
              </div>

              {/* Timeline Player Bar */}
              {audioUrl ? (
                <div className="flex items-center gap-3 pt-3 border-t border-white/5" dir="ltr">
                  <button
                    onClick={handlePlayPause}
                    className="w-10 h-10 flex items-center justify-center bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 rounded-full text-white shadow-lg shadow-emerald-500/25 transition-all cursor-pointer shrink-0"
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 ml-0.5 fill-current" />
                    )}
                  </button>

                  <div className="flex-1 flex items-center justify-between text-white/80 font-mono text-xs bg-white/5 px-3 py-2 rounded-lg border border-white/5">
                    <span>{formatTime(currentTime)}</span>
                    <span className="text-white/30">/</span>
                    <span>{formatTime(duration)}</span>
                  </div>

                  <button
                    onClick={() => {
                      if (wavesurfer.current) {
                        wavesurfer.current.seekTo(0);
                        setCurrentTime(0);
                      }
                    }}
                    className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors cursor-pointer"
                    title="إعادة من البداية"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              ) : null}
            </div>

            {/* Quick Tips Box */}
            <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-[11px] text-white/60 space-y-1" dir="rtl">
              <p className="font-bold text-white/80 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                محرك الدمج المباشر فائق السرعة (Ultra-Fast Direct Remux):
              </p>
              <p className="text-[10px] text-white/50 leading-relaxed">
                يتم نسخ بيانات الفيديو الخام بدون إعادة معالجة الإطارات إطلاقاً، مما يحافظ على شفافية VAP بنسبة 100% ويمنع أي زيادة غير مرغوبة في حجم الملف.
              </p>
            </div>
          </div>

          {/* Right Column: Settings & Configuration (5 cols) */}
          <div className="lg:col-span-5 space-y-4" dir="rtl">
            {/* Tabs Selector */}
            <div className="flex bg-[#0b0c12] rounded-xl p-1 border border-white/10">
              <button
                onClick={() => {
                  setActiveTab("audio");
                  setMarkForDeletion(false);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === "audio"
                    ? "bg-white/10 text-white shadow-sm border border-white/10"
                    : "text-white/50 hover:text-white"
                }`}
              >
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                الصوت ومستوى الصوت
              </button>

              <button
                onClick={() => {
                  setActiveTab("delete");
                  setMarkForDeletion(true);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === "delete"
                    ? "bg-red-500/20 text-red-400 shadow-sm border border-red-500/30"
                    : "text-white/50 hover:text-white"
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                حذف الصوت
              </button>
            </div>

            {/* Tab 1: Audio / Volume Configuration */}
            {activeTab === "audio" && (
              <div className="space-y-5 bg-[#0b0c12] rounded-xl p-4 border border-white/10">
                {/* 1. Audio File Choice */}
                <div className="space-y-2.5">
                  <span className="text-white/70 text-xs font-bold flex items-center gap-1.5">
                    <FileAudio className="w-3.5 h-3.5 text-indigo-400" />
                    ملف الصوت (Audio File)
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setSelectedMode("keep");
                        onKeep();
                      }}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                        selectedMode === "keep" && !audioFile
                          ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300 shadow-sm shadow-indigo-500/20"
                          : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      الاحتفاظ بالحالي
                    </button>

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                        selectedMode === "replace" || audioFile
                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-sm shadow-emerald-500/20"
                          : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      استبدال الصوت
                    </button>
                  </div>

                  {/* Selected audio badge/info */}
                  {audioFile && (
                    <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-[10px] font-bold bg-emerald-500 text-black px-1.5 py-0.5 rounded font-sans">
                          Selected
                        </span>
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold text-white truncate max-w-[150px]" title={audioFile.name}>
                            {audioFile.name}
                          </p>
                          <p className="text-[10px] text-emerald-300/80 font-mono">
                            {(audioFile.size / 1024).toFixed(0)} KB
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          onKeep();
                          setSelectedMode("keep");
                        }}
                        className="text-white/40 hover:text-red-400 text-xs font-bold px-2 py-1 transition-colors cursor-pointer"
                        title="إلغاء الملف المختار"
                      >
                        مسح
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. Output Volume Slider */}
                <div className="space-y-2.5 pt-2 border-t border-white/5">
                  <div className="flex justify-between items-center">
                    <span className="text-white/70 text-xs font-bold flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-teal-400" />
                      مستوى الصوت الناتج (Output Volume)
                    </span>
                    <span className="text-emerald-400 font-mono text-xs font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20" dir="ltr">
                      {Math.round(volume * 100)}%
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.01"
                    value={volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                    dir="ltr"
                  />

                  {/* Volume Presets */}
                  <div className="grid grid-cols-4 gap-1.5 pt-1" dir="ltr">
                    <button
                      onClick={() => handleVolumeChange(0)}
                      className={`py-1 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
                        volume === 0
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "bg-white/5 text-white/50 hover:text-white border-white/5"
                      }`}
                    >
                      كتم 0%
                    </button>
                    <button
                      onClick={() => handleVolumeChange(0.5)}
                      className={`py-1 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
                        volume === 0.5
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-white/5 text-white/50 hover:text-white border-white/5"
                      }`}
                    >
                      خفيف 50%
                    </button>
                    <button
                      onClick={() => handleVolumeChange(1)}
                      className={`py-1 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
                        volume === 1
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-white/5 text-white/50 hover:text-white border-white/5"
                      }`}
                    >
                      الأصلي 100%
                    </button>
                    <button
                      onClick={() => handleVolumeChange(2)}
                      className={`py-1 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
                        volume === 2
                          ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                          : "bg-white/5 text-white/50 hover:text-white border-white/5"
                      }`}
                    >
                      مضاعف 200%
                    </button>
                  </div>

                  <p className="text-white/40 text-[10px] leading-relaxed">
                    100% هو المستوى الأصلي، 0% كتم، 200% مضاعفة الصوت.
                  </p>
                </div>
              </div>
            )}

            {/* Tab 2: Delete Audio */}
            {activeTab === "delete" && (
              <div className="space-y-4 bg-[#0b0c12] rounded-xl p-4 border border-white/10">
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                    <div>
                      <p className="font-bold">تعليم الصوت للحذف النهائي</p>
                      <p className="text-[10px] text-red-300/80 mt-1 leading-relaxed">
                        عند الضغط على "تنفيذ"، سيتم إزالة مسار الصوت تماماً من ملف الـ VAP وتصدير فيديو صامت.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setMarkForDeletion(true);
                    }}
                    className={`w-full py-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                      markForDeletion
                        ? "bg-red-500 text-white shadow-lg shadow-red-500/30 border-red-400"
                        : "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20"
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                    {markForDeletion ? "تم تحديد الصوت للحذف بنجاح" : "تحديد الصوت للحذف (Mark for Deletion)"}
                  </button>

                  <p className="text-white/40 text-[10px] text-center">
                    ملاحظة: بعد تأكيد الحذف، لن يتم تطبيق أي استبدال أو تعديل لمستوى الصوت.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Footer Actions Bar */}
        <div
          className="px-5 py-3.5 border-t border-white/10 bg-[#161823] flex flex-col sm:flex-row items-center justify-between gap-3"
          dir="rtl"
        >
          {/* Status Indicator */}
          <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2 ${statusColor}`}>
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            <span>{statusText}</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
            >
              إلغاء
            </button>

            <button
              onClick={handleExecuteAction}
              disabled={isProcessing || (!audioUrl && !audioFile && !markForDeletion)}
              className="px-7 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>جاري المعالجة السريعة...</span>
                </>
              ) : (
                <>
                  <span>تنفيذ (Execute)</span>
                  <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                </>
              )}
            </button>
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,video/mp4"
          onChange={handleFileChange}
        />
      </motion.div>
    </div>
  );
}
