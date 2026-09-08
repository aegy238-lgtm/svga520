import React, { useEffect, useRef, useState } from 'react';
import lottie, { AnimationItem as LottieInstance } from 'lottie-web';
import { 
  X, Play, Pause, Download, Grid, RotateCcw, 
  ChevronLeft, ChevronRight, Hash, Layers, Check, Palette 
} from 'lucide-react';
import { AnimationItem, ExportFormat, PreviewBackground } from './types';

interface AnimationPreviewModalProps {
  item: AnimationItem | null;
  onClose: () => void;
  onExport: (item: AnimationItem, format: ExportFormat, options?: any) => void;
}

export const AnimationPreviewModal: React.FC<AnimationPreviewModalProps> = ({
  item,
  onClose,
  onExport
}) => {
  if (!item) return null;

  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(1);
  const [background, setBackground] = useState<PreviewBackground>('checkerboard');
  const [customBgColor, setCustomBgColor] = useState('#000000');
  const [currentFrame, setCurrentFrame] = useState(0);
  const [selectedExportFormat, setSelectedExportFormat] = useState<ExportFormat>('original');
  const [mp4BgColor, setMp4BgColor] = useState('#000000');

  const lottieContainerRef = useRef<HTMLDivElement>(null);
  const lottieAnimRef = useRef<LottieInstance | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgaPlayerRef = useRef<any>(null);
  const pagViewRef = useRef<any>(null);

  useEffect(() => {
    if ((item.format === 'lottie' || item.format === 'dotlottie') && item.lottieData && lottieContainerRef.current) {
      lottieContainerRef.current.innerHTML = '';
      try {
        const anim = lottie.loadAnimation({
          container: lottieContainerRef.current,
          renderer: 'svg',
          loop: true,
          autoplay: isPlaying,
          animationData: JSON.parse(JSON.stringify(item.lottieData))
        });

        anim.setSpeed(speed);
        lottieAnimRef.current = anim;

        anim.addEventListener('enterFrame', (e: any) => {
          if (e && typeof e.currentTime === 'number') {
            setCurrentFrame(Math.round(e.currentTime));
          }
        });

        return () => anim.destroy();
      } catch (e) {
        console.warn('Modal lottie error:', e);
      }
    }
  }, [item, isPlaying]);

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
          player.set({ loop: 0, fillMode: 'forwards' as any });
          
          svgaPlayerRef.current = player;
          if (isPlaying) player.start();
        } catch (err) {
          console.warn('SVGA render error on preview:', err);
        }
      } else if (item.format === 'pag') {
        try {
          const { getPAG } = await import('../../utils/pagEngine');
          const PAG = await getPAG();
          const buffer = await item.file.arrayBuffer();
          const pagFile = await PAG.PAGFile.load(buffer);
          
          if (isCancelled) return;
          
          const pagView = await PAG.PAGView.init(pagFile, canvasRef.current);
          pagView.setRepeatCount(0);
          
          pagViewRef.current = pagView;
          if (isPlaying) await pagView.play();
        } catch (err) {
          console.warn('PAG render error on preview:', err);
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
  }, [item, isPlaying]);

  const togglePlay = () => {
    const next = !isPlaying;
    setIsPlaying(next);
    if (lottieAnimRef.current) {
      if (next) lottieAnimRef.current.play();
      else lottieAnimRef.current.pause();
    }
    if (svgaPlayerRef.current) {
      if (next) svgaPlayerRef.current.start();
      else svgaPlayerRef.current.stop();
    }
    if (pagViewRef.current) {
      if (next) pagViewRef.current.play();
      else pagViewRef.current.pause();
    }
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (lottieAnimRef.current) {
      lottieAnimRef.current.setSpeed(newSpeed);
    }
  };

  const handleFrameSeek = (frame: number) => {
    setCurrentFrame(frame);
    setIsPlaying(false);
    
    if (lottieAnimRef.current) {
      lottieAnimRef.current.goToAndStop(frame, true);
    }
    
    if (svgaPlayerRef.current && item.frameCount > 0) {
      svgaPlayerRef.current.stop();
    }
    
    if (pagViewRef.current && item.frameCount > 0) {
      pagViewRef.current.pause();
      const progress = frame / item.frameCount;
      pagViewRef.current.setProgress(progress);
      pagViewRef.current.flush();
    }
  };

  const formattedSize =
    item.size > 1024 * 1024
      ? `${(item.size / (1024 * 1024)).toFixed(2)} MB`
      : `${(item.size / 1024).toFixed(1)} KB`;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl animate-fade-in"
      dir="rtl"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-3xl bg-[#0b101d] border border-white/15 shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#070b14]">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              {item.format.toUpperCase()}
            </span>
            <h3 className="text-lg sm:text-xl font-black text-white font-arabic truncate max-w-md">
              {item.name}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-6">
          {/* Main Visual Stage */}
          <div className="flex-1 flex flex-col gap-4">
            <div
              className={`relative w-full h-80 sm:h-96 rounded-2xl flex items-center justify-center overflow-hidden border border-white/10 ${
                background === 'checkerboard'
                  ? 'bg-[linear-gradient(45deg,#161d2f_25%,transparent_25%),linear-gradient(-45deg,#161d2f_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#161d2f_75%),linear-gradient(-45deg,transparent_75%,#161d2f_75%)] bg-[size:20px_20px] bg-[#0c1220]'
                  : background === 'dark'
                  ? 'bg-[#050811]'
                  : background === 'light'
                  ? 'bg-white'
                  : ''
              }`}
              style={background === 'custom' ? { backgroundColor: customBgColor } : {}}
            >
              {(item.format === 'lottie' || item.format === 'dotlottie') && item.lottieData ? (
                <div
                  ref={lottieContainerRef}
                  className="w-full h-full flex items-center justify-center p-6"
                />
              ) : item.format === 'svga' || item.format === 'pag' ? (
                <canvas
                  ref={canvasRef}
                  width={item.dimensions.width}
                  height={item.dimensions.height}
                  className="max-w-full max-h-full object-contain p-4 select-none"
                />
              ) : (
                <img
                  src={item.previewUrl}
                  alt={item.name}
                  className="max-w-full max-h-full object-contain p-4 select-none"
                  style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
                />
              )}
            </div>

            {/* Stage Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
              {/* Play / Pause / Speeds */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="p-2 rounded-xl bg-cyan-500 text-black hover:bg-cyan-400 font-bold transition-colors"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>

                <div className="flex items-center gap-1 bg-black/40 rounded-xl p-1 border border-white/10">
                  {[0.5, 1, 1.5, 2].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSpeedChange(s)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                        speed === s
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Background Picker */}
              <div className="flex items-center gap-1.5 bg-black/40 rounded-xl p-1 border border-white/10">
                <button
                  type="button"
                  onClick={() => setBackground('checkerboard')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    background === 'checkerboard'
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  شفافية
                </button>
                <button
                  type="button"
                  onClick={() => setBackground('dark')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    background === 'dark'
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  داكن
                </button>
                <button
                  type="button"
                  onClick={() => setBackground('light')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    background === 'light'
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  فاتح
                </button>
              </div>
            </div>

            {/* Frame Scrubber for Lottie */}
            {item.frameCount > 1 && (
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-xs text-gray-400 font-mono">
                  {currentFrame} / {item.frameCount}
                </span>
                <input
                  type="range"
                  min="0"
                  max={item.frameCount - 1}
                  value={currentFrame}
                  onChange={(e) => handleFrameSeek(Number(e.target.value))}
                  className="flex-1 accent-cyan-400 cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Technical Metadata & Export Panel */}
          <div className="w-full lg:w-80 flex flex-col gap-5">
            {/* Metadata Card */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-3 font-arabic">
              <h4 className="text-sm font-bold text-gray-300 border-b border-white/10 pb-2">
                بيانات الأنيميشن الفنية
              </h4>

              <div className="flex flex-col gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">الأبعاد الأصلية:</span>
                  <span className="text-white font-mono font-bold">
                    {item.dimensions.width} × {item.dimensions.height} px
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">حجم الملف:</span>
                  <span className="text-white font-mono font-bold">{formattedSize}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">مدة الأنيميشن:</span>
                  <span className="text-white font-mono font-bold">
                    {item.duration > 0 ? `${item.duration} ثانية` : 'صورة ثابتة'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">إجمالي الإطارات:</span>
                  <span className="text-white font-mono font-bold">{item.frameCount} إطار</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">معدل الإطارات:</span>
                  <span className="text-white font-mono font-bold">{item.fps} FPS</span>
                </div>

                <div className="flex flex-col gap-1 pt-2 border-t border-white/10">
                  <span className="text-gray-400">بصمة المحتوى (Content Hash):</span>
                  <span className="text-[10px] font-mono text-cyan-400 break-all bg-black/40 p-1.5 rounded-lg border border-white/5">
                    {item.contentHash}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Export Panel */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-3 font-arabic">
              <h4 className="text-sm font-bold text-gray-300 border-b border-white/10 pb-2">
                تصدير وتحويل الملف
              </h4>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400">صيغة التصدير المستهدفة:</label>
                <select
                  value={selectedExportFormat}
                  onChange={(e) => setSelectedExportFormat(e.target.value as ExportFormat)}
                  className="bg-[#0a0f1d] border border-white/15 text-white text-xs rounded-xl p-2.5 focus:outline-none focus:border-cyan-400"
                >
                  <option value="original">الصيغة الأصلية ({item.format.toUpperCase()})</option>
                  <option value="svga">صيغة SVGA 2.0 (.svga - متوافق مع التأثيرات والجوال)</option>
                  <option value="webp">WebP متحرك</option>
                  <option value="apng">APNG (عالي الجودة مع شفافية ألفا)</option>
                  <option value="png_frames">حزمة إطارات PNG (ZIP)</option>
                  {item.lottieData && (
                    <>
                      <option value="lottie">Lottie JSON</option>
                      <option value="dotlottie">DotLottie (.lottie)</option>
                    </>
                  )}
                  <option value="mp4">فيديو MP4</option>
                </select>
              </div>

              {selectedExportFormat === 'mp4' && (
                <div className="flex flex-col gap-1.5 pt-1">
                  <label className="text-xs text-gray-400">لون خلفية الفيديو (للملفات الشفافة):</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={mp4BgColor}
                      onChange={(e) => setMp4BgColor(e.target.value)}
                      className="w-8 h-8 rounded-lg border border-white/20 bg-transparent cursor-pointer"
                    />
                    <span className="text-xs font-mono text-gray-300">{mp4BgColor}</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() =>
                  onExport(item, selectedExportFormat, {
                    backgroundColor: selectedExportFormat === 'mp4' ? mp4BgColor : 'transparent'
                  })
                }
                className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>تحميل الملف الآن</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
