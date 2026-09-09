import React, { useEffect, useRef, useState } from 'react';
import lottie, { AnimationItem as LottieInstance } from 'lottie-web';
import { 
  Play, Pause, Trash2, Edit2, Download, Eye, 
  RotateCw, Check, Grid, Hash, Clock, Layers, Sparkles 
} from 'lucide-react';
import { AnimationItem, ExportFormat, PreviewBackground, SupportedFormat } from './types';

interface AnimationCardProps {
  item: AnimationItem;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onInspect: (item: AnimationItem) => void;
  onQuickExport: (item: AnimationItem, format: ExportFormat) => void;
}

const FORMAT_CONFIG: Record<
  SupportedFormat,
  { label: string; bg: string; text: string; border: string }
> = {
  gif: { label: 'GIF', bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  webp: { label: 'WebP', bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  apng: { label: 'APNG', bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  png: { label: 'PNG', bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' },
  lottie: { label: 'Lottie', bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  dotlottie: { label: 'DotLottie', bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/30' },
  svga: { label: 'SVGA', bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  pag: { label: 'PAG', bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' }
};

export const AnimationCard: React.FC<AnimationCardProps> = ({
  item,
  isSelected,
  onToggleSelect,
  onDelete,
  onRename,
  onInspect,
  onQuickExport
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [background, setBackground] = useState<PreviewBackground>('checkerboard');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(item.name);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const lottieContainerRef = useRef<HTMLDivElement>(null);
  const lottieInstanceRef = useRef<LottieInstance | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgaPlayerRef = useRef<any>(null);
  const pagViewRef = useRef<any>(null);

  // Initialize Lottie player if applicable
  useEffect(() => {
    if ((item.format === 'lottie' || item.format === 'dotlottie') && item.lottieData && lottieContainerRef.current) {
      // Clear container
      lottieContainerRef.current.innerHTML = '';

      try {
        const anim = lottie.loadAnimation({
          container: lottieContainerRef.current,
          renderer: 'svg',
          loop: true,
          autoplay: isPlaying,
          animationData: JSON.parse(JSON.stringify(item.lottieData))
        });

        anim.setSpeed(playbackSpeed);
        lottieInstanceRef.current = anim;

        return () => {
          anim.destroy();
        };
      } catch (err) {
        console.warn('Lottie render error on card:', err);
      }
    }
  }, [item.lottieData, item.format]);

  // Initialize SVGA or PAG player
  useEffect(() => {
    let isCancelled = false;

    const initSpecialPlayer = async () => {
      if (!canvasRef.current) return;

      if (item.format === 'svga') {
        try {
          const { Player, Parser } = await import('svga.lite');
          const parser = new Parser();
          const buffer = await item.file.arrayBuffer();
          const svgaData = await parser.do(buffer);
          
          if (isCancelled) return;
          
          const player = new Player(canvasRef.current);
          await player.mount(svgaData);
          player.set({ loop: 0, fillMode: 'forwards' } as any);
          
          svgaPlayerRef.current = player;
          if (isPlaying) player.start();
        } catch (err) {
          console.warn('SVGA render error on card:', err);
        }
      } else if (item.format === 'pag') {
        try {
          const { getPAG } = await import('../../utils/pagEngine');
          const PAG = await getPAG();
          const buffer = await item.file.arrayBuffer();
          const pagFile = await PAG.PAGFile.load(buffer);
          
          if (isCancelled) return;
          
          const pagView = await PAG.PAGView.init(pagFile, canvasRef.current);
          pagView.setRepeatCount(0); // 0 means loop infinitely
          
          pagViewRef.current = pagView;
          if (isPlaying) await pagView.play();
        } catch (err) {
          console.warn('PAG render error on card:', err);
        }
      }
    };

    if (item.format === 'svga' || item.format === 'pag') {
      initSpecialPlayer();
    }

    return () => {
      isCancelled = true;
      if (svgaPlayerRef.current) {
        svgaPlayerRef.current.destroy();
        svgaPlayerRef.current = null;
      }
      if (pagViewRef.current) {
        pagViewRef.current.destroy();
        pagViewRef.current = null;
      }
    };
  }, [item.file, item.format]);

  // Handle Play/Pause
  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = !isPlaying;
    setIsPlaying(nextState);

    if (lottieInstanceRef.current) {
      if (nextState) lottieInstanceRef.current.play();
      else lottieInstanceRef.current.pause();
    }
    
    if (svgaPlayerRef.current) {
      if (nextState) svgaPlayerRef.current.start();
      else svgaPlayerRef.current.stop();
    }

    if (pagViewRef.current) {
      if (nextState) pagViewRef.current.play();
      else pagViewRef.current.pause();
    }
  };

  // Handle Speed Change
  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const speeds = [0.5, 1, 1.5, 2];
    const nextIndex = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const newSpeed = speeds[nextIndex];
    setPlaybackSpeed(newSpeed);

    if (lottieInstanceRef.current) {
      lottieInstanceRef.current.setSpeed(newSpeed);
    }
  };

  // Cycle Background
  const cycleBackground = (e: React.MouseEvent) => {
    e.stopPropagation();
    const bgs: PreviewBackground[] = ['checkerboard', 'dark', 'light'];
    const nextIndex = (bgs.indexOf(background) + 1) % bgs.length;
    setBackground(bgs[nextIndex]);
  };

  const handleSaveRename = () => {
    if (nameInput.trim()) {
      onRename(item.id, nameInput.trim());
    }
    setIsEditingName(false);
  };

  const formatBadge = FORMAT_CONFIG[item.format] || FORMAT_CONFIG.png;
  const formattedSize =
    item.size > 1024 * 1024
      ? `${(item.size / (1024 * 1024)).toFixed(2)} MB`
      : `${(item.size / 1024).toFixed(1)} KB`;

  return (
    <div
      onClick={() => onToggleSelect(item.id)}
      className={`relative group flex flex-col rounded-3xl overflow-hidden border transition-all duration-300 backdrop-blur-md select-none ${
        isSelected
          ? 'border-cyan-400 bg-[#0e1628]/95 shadow-[0_0_25px_rgba(6,182,212,0.25)] ring-2 ring-cyan-500/50'
          : 'border-white/10 bg-[#0a0f1d]/75 hover:border-white/20 hover:bg-[#0e1628]/90'
      }`}
    >
      {/* Top Card Controls Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-white/5 relative z-10">
        {/* Selection Checkbox & Format Badge */}
        <div className="flex items-center gap-2">
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(item.id);
            }}
            className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
              isSelected
                ? 'bg-cyan-500 border-cyan-400 text-black shadow-md'
                : 'border-white/20 hover:border-cyan-400/60 bg-white/5'
            }`}
          >
            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
          </div>

          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${formatBadge.bg} ${formatBadge.text} ${formatBadge.border}`}
          >
            {formatBadge.label}
          </span>
        </div>

        {/* Content Hash Snippet & Actions */}
        <div className="flex items-center gap-1.5">
          <span
            title={`بصمة المحتوى: ${item.contentHash}`}
            className="text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/5"
          >
            #{item.contentHash.substring(0, 6)}
          </span>

          <button
            type="button"
            title="معاينة وفحص تفصيلي"
            onClick={(e) => {
              e.stopPropagation();
              onInspect(item);
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-400 hover:bg-white/10 transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>

          <button
            type="button"
            title="حذف الملف"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Animation Preview Stage */}
      <div
        className={`relative w-full h-56 flex items-center justify-center overflow-hidden transition-colors duration-300 ${
          background === 'checkerboard'
            ? 'bg-[linear-gradient(45deg,#161d2f_25%,transparent_25%),linear-gradient(-45deg,#161d2f_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#161d2f_75%),linear-gradient(-45deg,transparent_75%,#161d2f_75%)] bg-[size:16px_16px] bg-[#0c1220]'
            : background === 'dark'
            ? 'bg-[#060911]'
            : 'bg-white'
        }`}
      >
        {/* Lottie / DotLottie Render Target */}
        {(item.format === 'lottie' || item.format === 'dotlottie') && item.lottieData ? (
          <div
            ref={lottieContainerRef}
            className="w-full h-full flex items-center justify-center p-4 pointer-events-none"
          />
        ) : item.format === 'svga' || item.format === 'pag' ? (
          <canvas
            ref={canvasRef}
            width={item.dimensions.width}
            height={item.dimensions.height}
            className="max-w-full max-h-full object-contain p-3 select-none pointer-events-none"
          />
        ) : (
          /* GIF / WebP / APNG / PNG Image Element */
          <img
            src={item.previewUrl}
            alt={item.name}
            className="max-w-full max-h-full object-contain p-3 select-none pointer-events-none"
            style={{
              animationPlayState: isPlaying ? 'running' : 'paused'
            }}
          />
        )}

        {/* Floating Quick Playback Overlay Controls on Hover */}
        <div className="absolute bottom-2 inset-x-2 flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex items-center gap-1.5">
            {/* Play/Pause Button */}
            <button
              type="button"
              onClick={togglePlay}
              className="p-1.5 rounded-lg text-white hover:text-cyan-400 hover:bg-white/10 transition-colors"
              title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>

            {/* Speed Toggle */}
            <button
              type="button"
              onClick={cycleSpeed}
              className="px-2 py-0.5 rounded-lg text-[11px] font-bold text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              title="تغيير سرعة العرض"
            >
              {playbackSpeed}x
            </button>

            {/* Background Switcher */}
            <button
              type="button"
              onClick={cycleBackground}
              className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              title={`تغيير الخلفية (الحالية: ${
                background === 'checkerboard' ? 'شفافية' : background === 'dark' ? 'داكن' : 'فاتح'
              })`}
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Direct SVGA Convert Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onQuickExport(item, 'svga');
            }}
            className="px-2 py-1 rounded-lg bg-gradient-to-r from-indigo-500/30 to-purple-500/30 hover:from-indigo-500/50 hover:to-purple-500/50 text-indigo-200 text-xs font-bold flex items-center gap-1 border border-indigo-400/40 transition-all shadow-sm"
            title="تحويل فوري مباشر إلى صيغة SVGA"
          >
            <Sparkles className="w-3 h-3 text-indigo-300" />
            <span>تحويل SVGA</span>
          </button>

          {/* Quick Export Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowExportMenu(!showExportMenu);
              }}
              className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-xs font-bold flex items-center gap-1 border border-cyan-500/30 transition-all"
            >
              <Download className="w-3 h-3" />
              <span>تصدير</span>
            </button>

            {/* Export Menu Popover */}
            {showExportMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-8 left-0 w-40 rounded-xl bg-[#0e1628] border border-white/15 shadow-2xl p-1.5 flex flex-col gap-1 z-30"
              >
                <button
                  type="button"
                  onClick={() => {
                    onQuickExport(item, 'svga');
                    setShowExportMenu(false);
                  }}
                  className="w-full text-right px-2.5 py-1.5 rounded-lg text-xs font-bold text-indigo-300 bg-indigo-500/15 hover:bg-indigo-500/30 hover:text-indigo-200 transition-colors font-arabic flex items-center justify-between border border-indigo-500/20"
                >
                  <span>تحويل إلى SVGA</span>
                  <span className="text-[9px] px-1 py-0.5 rounded bg-indigo-500/40 text-indigo-100 font-mono">.svga</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onQuickExport(item, 'original');
                    setShowExportMenu(false);
                  }}
                  className="w-full text-right px-2.5 py-1.5 rounded-lg text-xs text-gray-200 hover:bg-white/10 hover:text-cyan-400 transition-colors font-arabic"
                >
                  الصيغة الأصلية
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onQuickExport(item, 'gif');
                    setShowExportMenu(false);
                  }}
                  className="w-full text-right px-2.5 py-1.5 rounded-lg text-xs text-gray-200 hover:bg-white/10 hover:text-amber-400 transition-colors font-arabic"
                >
                  صيغة GIF متحرك
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onQuickExport(item, 'webp');
                    setShowExportMenu(false);
                  }}
                  className="w-full text-right px-2.5 py-1.5 rounded-lg text-xs text-gray-200 hover:bg-white/10 hover:text-emerald-400 transition-colors font-arabic"
                >
                  صيغة WebP
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onQuickExport(item, 'apng');
                    setShowExportMenu(false);
                  }}
                  className="w-full text-right px-2.5 py-1.5 rounded-lg text-xs text-gray-200 hover:bg-white/10 hover:text-purple-400 transition-colors font-arabic"
                >
                  صيغة APNG
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onQuickExport(item, 'png_frames');
                    setShowExportMenu(false);
                  }}
                  className="w-full text-right px-2.5 py-1.5 rounded-lg text-xs text-gray-200 hover:bg-white/10 hover:text-sky-400 transition-colors font-arabic"
                >
                  حزمة إطارات PNG (ZIP)
                </button>
                {item.lottieData && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onQuickExport(item, 'lottie');
                        setShowExportMenu(false);
                      }}
                      className="w-full text-right px-2.5 py-1.5 rounded-lg text-xs text-gray-200 hover:bg-white/10 hover:text-cyan-400 transition-colors font-arabic"
                    >
                      Lottie JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onQuickExport(item, 'dotlottie');
                        setShowExportMenu(false);
                      }}
                      className="w-full text-right px-2.5 py-1.5 rounded-lg text-xs text-gray-200 hover:bg-white/10 hover:text-pink-400 transition-colors font-arabic"
                    >
                      DotLottie (.lottie)
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onQuickExport(item, 'mp4');
                    setShowExportMenu(false);
                  }}
                  className="w-full text-right px-2.5 py-1.5 rounded-lg text-xs text-gray-200 hover:bg-white/10 hover:text-red-400 transition-colors font-arabic"
                >
                  فيديو MP4
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card Info & Meta Details */}
      <div className="p-4 flex flex-col gap-3 bg-[#0a0e1a]/90">
        {/* Name and Rename */}
        <div className="flex items-center justify-between gap-2">
          {isEditingName ? (
            <div
              className="flex items-center gap-1.5 w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename();
                  if (e.key === 'Escape') setIsEditingName(false);
                }}
                autoFocus
                className="flex-1 bg-white/10 border border-cyan-500/50 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSaveRename}
                className="p-1 rounded-lg bg-cyan-500 text-black hover:bg-cyan-400"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 overflow-hidden">
              <span
                title={item.name}
                className="font-bold text-sm text-white truncate text-right font-arabic"
              >
                {item.name}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
                className="text-gray-500 hover:text-cyan-400 transition-colors"
                title="إعادة تسمية"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Technical Specs Badges */}
        <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-400 font-mono">
          {/* Dimensions */}
          <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
            <span className="text-gray-400">الأبعاد:</span>
            <span className="text-gray-200 font-bold">
              {item.dimensions.width}×{item.dimensions.height}
            </span>
          </div>

          {/* Size */}
          <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
            <span className="text-gray-400">الحجم:</span>
            <span className="text-gray-200 font-bold">{formattedSize}</span>
          </div>

          {/* Duration */}
          <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
            <span className="text-gray-400">المدة:</span>
            <span className="text-gray-200 font-bold">
              {item.duration > 0 ? `${item.duration}s` : 'ثابت'}
            </span>
          </div>

          {/* Frames & FPS */}
          <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
            <span className="text-gray-400">الإطارات:</span>
            <span className="text-gray-200 font-bold">
              {item.frameCount > 1 ? `${item.frameCount}f` : '1f'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
