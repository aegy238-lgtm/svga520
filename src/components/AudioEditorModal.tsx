import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Play,
  Pause,
  Trash2,
  Download,
  RefreshCcw,
  Volume2,
  Upload,
  Scissors,
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
  const [activeTab, setActiveTab] = useState<"audio" | "rename">("audio");

  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && containerRef.current && audioUrl) {
      if (!wavesurfer.current) {
        wavesurfer.current = WaveSurfer.create({
          container: containerRef.current,
          waveColor: "url(#gradient)",
          progressColor: "rgba(255, 255, 255, 0.5)",
          cursorColor: "#fff",
          barWidth: 3,
          barGap: 3,
          barRadius: 3,
          height: 100,
          normalize: true,
        });

        wsRegions.current = wavesurfer.current.registerPlugin(
          RegionsPlugin.create(),
        );

        wavesurfer.current.on("ready", () => {
          const dur = wavesurfer.current?.getDuration() || 0;
          setDuration(dur);

          wsRegions.current.clearRegions();
          wsRegions.current.addRegion({
            start: 0,
            end: dur,
            color: "rgba(16, 185, 129, 0.2)",
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

          setStartTime(0);
          setEndTime(dur);
        });

        wavesurfer.current.on("audioprocess", () => {
          setCurrentTime(wavesurfer.current?.getCurrentTime() || 0);
        });

        wavesurfer.current.on("play", () => setIsPlaying(true));
        wavesurfer.current.on("pause", () => setIsPlaying(false));
      }

      wavesurfer.current.load(audioUrl);
    }

    return () => {
      if (wavesurfer.current && !isOpen) {
        wavesurfer.current.destroy();
        wavesurfer.current = null;
      }
    };
  }, [isOpen, audioUrl]);

  useEffect(() => {
    if (wavesurfer.current) {
      wavesurfer.current.setVolume(Math.min(volume, 1));
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
      onReplace(file);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl bg-[#1a1c23] rounded-2xl border border-white/10 overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h2 className="text-white font-black text-lg font-cairo">
            أداة تعديل الصوت (Audio Edit Tool)
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 font-cairo">
          <div className="lg:col-span-2 space-y-6">
            <div
              className="bg-black/40 rounded-xl p-4 border border-white/5"
              dir="rtl"
            >
              <div className="text-white/50 text-xs font-bold mb-4 flex justify-between items-center">
                <span>الصوت الحالي: {audioFile?.name || "audio_track"}</span>
                {audioUrl && (
                  <button
                    className="flex items-center gap-1 hover:text-white transition-colors"
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = audioUrl;
                      a.download = audioFile?.name || "audio.mp3";
                      a.click();
                    }}
                  >
                    <Download className="w-3 h-3" />
                    استخراج الصوت
                  </button>
                )}
              </div>

              <div className="relative" dir="ltr">
                <svg width="0" height="0" className="absolute">
                  <defs>
                    <linearGradient
                      id="gradient"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="0%"
                    >
                      <stop offset="0%" stopColor="#22c55e" />
                      <stop offset="50%" stopColor="#eab308" />
                      <stop offset="100%" stopColor="#ef4444" />
                    </linearGradient>
                  </defs>
                </svg>
                {!audioUrl && (
                  <div className="h-[100px] flex items-center justify-center text-white/20 text-sm font-bold border-2 border-dashed border-white/10 rounded-lg">
                    لا يوجد صوت محدد
                  </div>
                )}
                <div ref={containerRef} className={!audioUrl ? "hidden" : ""} />

                {audioUrl && duration > 0 && (
                  <div className="absolute top-2 left-2 px-2 py-1 bg-black/80 rounded-md text-[10px] text-white/70 font-mono flex items-center gap-2 border border-white/10 shadow-lg">
                    <Scissors className="w-3 h-3 text-emerald-400" />
                    <span>
                      {formatTime(startTime)} - {formatTime(endTime)}
                    </span>
                    <span className="text-white/40">
                      ({formatTime(endTime - startTime)})
                    </span>
                  </div>
                )}
              </div>

              {audioUrl && (
                <div className="flex items-center gap-4 mt-4" dir="ltr">
                  <button
                    onClick={handlePlayPause}
                    className="w-10 h-10 flex items-center justify-center bg-indigo-500 rounded-full text-white hover:bg-indigo-400 transition-colors shadow-lg shadow-indigo-500/20"
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 ml-1" />
                    )}
                  </button>
                  <div className="text-white/70 text-xs font-mono">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4" dir="rtl">
            <div className="flex bg-black/40 rounded-lg p-1 border border-white/5">
              <button
                onClick={() => setActiveTab("audio")}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${activeTab === "audio" ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}`}
              >
                الصوت ومستوى الصوت
              </button>
              <button
                onClick={() => setActiveTab("rename")}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${activeTab === "rename" ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}`}
              >
                إعادة تسمية | حذف
              </button>
            </div>

            {activeTab === "audio" && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-white/70 text-xs font-bold flex items-center gap-2">
                    <Volume2 className="w-4 h-4" /> ملف الصوت
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={onKeep}
                      className="flex-1 py-3 bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 rounded-xl text-xs font-bold hover:bg-indigo-500/30 transition-all"
                    >
                      الاحتفاظ بالحالي
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 py-3 bg-white/5 border border-white/10 text-white rounded-xl text-xs font-bold hover:bg-white/10 transition-all flex justify-center items-center gap-2"
                    >
                      <Upload className="w-4 h-4" /> استبدال
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-white/70 text-xs font-bold">
                      مستوى الصوت الناتج
                    </h3>
                    <span
                      className="text-emerald-400 font-mono text-xs"
                      dir="ltr"
                    >
                      {Math.round(volume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.01"
                    value={volume}
                    onChange={(e) =>
                      handleVolumeChange(parseFloat(e.target.value))
                    }
                    className="w-full accent-emerald-500"
                    dir="ltr"
                  />
                  <div className="flex justify-between gap-2" dir="ltr">
                    <button
                      onClick={() => handleVolumeChange(0)}
                      className="flex-1 py-1.5 bg-white/5 rounded-lg text-[10px] text-white/50 hover:text-white transition-colors font-cairo"
                    >
                      كتم 0%
                    </button>
                    <button
                      onClick={() => handleVolumeChange(1)}
                      className="flex-1 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] hover:bg-emerald-500/30 transition-colors border border-emerald-500/30 font-cairo"
                    >
                      الأصلي 100%
                    </button>
                    <button
                      onClick={() => handleVolumeChange(2)}
                      className="flex-1 py-1.5 bg-white/5 rounded-lg text-[10px] text-white/50 hover:text-white transition-colors font-cairo"
                    >
                      200%
                    </button>
                  </div>
                  <p className="text-white/40 text-[9px] leading-relaxed">
                    100% هو المستوى الأصلي، 0% كتم، 200% مضاعفة الصوت. (ملاحظة:
                    سيتم معالجة الصوت وتطبيقه عند النقر على تنفيذ).
                  </p>
                </div>
              </div>
            )}

            {activeTab === "rename" && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-white/70 text-xs font-bold">إدارة</h3>
                  <button
                    onClick={() => {
                      onRemove();
                      onClose();
                    }}
                    className="w-full py-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    تحديد للحذف
                  </button>
                  <p className="text-white/40 text-[9px] leading-relaxed text-center">
                    سيتم إزالة مسار الصوت من المشروع بعد تأكيد الحذف.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          className="p-4 border-t border-white/5 flex justify-end gap-3 bg-black/20"
          dir="rtl"
        >
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-6 py-2.5 bg-white/5 text-white/70 hover:text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 font-cairo"
          >
            إلغاء
          </button>
          <button
            onClick={() => onExecute(volume, audioFile, startTime, endTime)}
            disabled={isProcessing || !audioUrl}
            className="px-8 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-cairo"
          >
            {isProcessing ? "جاري المعالجة..." : "تنفيذ"}{" "}
            {!isProcessing && (
              <Play className="w-3 h-3 fill-current rotate-180" />
            )}
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="audio/*"
          onChange={handleFileChange}
        />
      </motion.div>
    </div>
  );
}
