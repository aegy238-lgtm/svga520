import React, { useRef, useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  MessageCircle, 
  Download, 
  ShoppingCart, 
  Sparkles, 
  ShieldCheck, 
  Layers 
} from 'lucide-react';
import { GiftItem, Language } from '../types';
import { translations } from '../utils/translations';
import { SvgaPlayer } from './SvgaPlayer';
import { resolveMediaUrl } from '../utils/mediaStorage';

interface SelectedDesignViewerProps {
  gift: GiftItem | null;
  lang: Language;
  onOpenDetails: (gift: GiftItem) => void;
  onAddToCart: (gift: GiftItem) => void;
  onBuyWhatsApp: (gift: GiftItem) => void;
}

export const SelectedDesignViewer: React.FC<SelectedDesignViewerProps> = ({
  gift,
  lang,
  onOpenDetails,
  onAddToCart,
  onBuyWhatsApp
}) => {
  const t = translations[lang];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [backdrop, setBackdrop] = useState<'dark' | 'stage' | 'black' | 'white'>('dark');

  useEffect(() => {
    setIsMuted(true);
    if (gift?.videoUrl) {
      setVideoSrc(resolveMediaUrl(gift.videoUrl));
    }
  }, [gift?.id, gift?.videoUrl]);

  // When selected gift changes, ensure audio starts MUTED by default
  useEffect(() => {
    if (videoRef.current && videoSrc) {
      videoRef.current.currentTime = 0;
      videoRef.current.muted = isMuted;
      videoRef.current.play().catch(() => {});
    }
  }, [gift?.id, videoSrc, isMuted]);

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }
  };

  const handleTogglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  if (!gift) return null;

  const displayTitle = lang === 'ar' && gift.titleAr ? gift.titleAr : lang === 'en' && gift.titleEn ? gift.titleEn : gift.title;

  const isSvga = Boolean(
    gift.videoUrl && (
      gift.videoUrl.toLowerCase().endsWith('.svga') ||
      gift.videoUrl.toLowerCase().endsWith('.svga2') ||
      gift.videoUrl.includes('.svga?') ||
      gift.videoUrl.includes('data:application/octet-stream') ||
      gift.videoUrl.includes('gifts/svga')
    ) && !gift.videoUrl.toLowerCase().includes('.mp4') && !gift.videoUrl.toLowerCase().includes('.webm')
  );

  const isImageFile = Boolean(
    !gift.videoUrl || (
      gift.videoUrl.match(/\.(jpeg|jpg|gif|png|webp|svg|bmp)(\?.*)?$/i) ||
      gift.videoUrl.startsWith('data:image/')
    )
  );

  const isVideo = Boolean(gift.videoUrl && !isSvga && !isImageFile);

  const resolvedPoster = gift.posterUrl ? resolveMediaUrl(gift.posterUrl) : '';
  const resolvedVideo = gift.videoUrl ? resolveMediaUrl(gift.videoUrl) : '';
  const finalImageSource = resolvedPoster || (isImageFile ? (videoSrc || resolvedVideo) : '');

  return (
    <div className="w-full mt-6 mb-8 rounded-3xl bg-[#0f121a] border border-slate-800/90 shadow-2xl p-4 sm:p-6 overflow-hidden">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="text-[11px] text-cyan-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.selectedDesign}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            {displayTitle}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-black text-lg sm:text-xl">
            $ {gift.price} <span className="text-xs text-emerald-300/80 font-bold">USD</span>
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700/80 text-xs font-mono text-cyan-300">
            {gift.formats?.[0]?.name ? gift.formats[0].name.split(' ')[0] : (isSvga ? 'SVGA' : isVideo ? 'MP4' : 'IMAGE')}
          </span>
        </div>
      </div>

      {/* Large Preview Stage with Clean Solid Dark Background (Natural Colors, Zero Checkerboard) */}
      <div className="relative aspect-square sm:aspect-video max-h-[420px] w-full rounded-2xl overflow-hidden bg-[#07090e] border border-slate-800 flex items-center justify-center p-4 shadow-inner">
        {/* Live SVGA / Video / Image Render */}
        {isSvga && gift.videoUrl ? (
          <div className="relative w-full h-full flex items-center justify-center z-10">
            <SvgaPlayer
              src={videoSrc || gift.videoUrl}
              autoPlay={isPlaying}
              loop={true}
              isMuted={isMuted}
              backdrop="dark"
              className="w-full h-full object-contain"
            />
          </div>
        ) : isVideo && videoSrc ? (
          <div className="relative w-full h-full flex items-center justify-center z-10">
            <video
              ref={videoRef}
              src={videoSrc}
              autoPlay={isPlaying}
              loop
              muted={isMuted}
              playsInline
              className="w-full h-full object-contain"
            />
          </div>
        ) : finalImageSource ? (
          <div className="relative w-full h-full flex items-center justify-center z-10">
            <img
              src={finalImageSource}
              alt={displayTitle}
              className="max-h-full max-w-full object-contain opacity-100 filter-none select-none drop-shadow-2xl"
              onError={(e) => {
                const target = e.currentTarget;
                const rawUrl = gift.posterUrl || gift.videoUrl || '';
                if (rawUrl.startsWith('http') && !target.src.includes('/api/proxy-media')) {
                  target.src = `/api/proxy-media?url=${encodeURIComponent(rawUrl)}`;
                } else if (gift.videoUrl && target.src !== gift.videoUrl) {
                  target.src = resolveMediaUrl(gift.videoUrl);
                }
              }}
            />
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-xs">
            <Sparkles className="w-8 h-8 text-cyan-400 mb-2 opacity-40 animate-pulse" />
            <span>{displayTitle}</span>
          </div>
        )}

        {/* Controls Overlay: Audio + Play + Stage + Maximize */}
        <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
          {/* Audio toggle button with active sound wave indicator */}
          <button
            onClick={handleToggleMute}
            className={`p-2 rounded-xl border backdrop-blur shadow-md transition-all cursor-pointer flex items-center gap-1.5 ${
              !isMuted 
                ? 'bg-emerald-950/90 hover:bg-emerald-900 border-emerald-500/70 text-emerald-300 ring-1 ring-emerald-500/30' 
                : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/80 text-slate-400'
            }`}
            title={!isMuted ? (lang === 'ar' ? 'الصوت مشغّل (اضغط للكتم)' : 'Sound On') : (lang === 'ar' ? 'الصوت مكتوم (اضغط للتشغيل)' : 'Sound Muted')}
          >
            {!isMuted ? (
              <>
                <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-300 hidden sm:inline">
                  {lang === 'ar' ? 'صوت' : 'Audio'}
                </span>
              </>
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {/* Play/Pause */}
          <button
            onClick={handleTogglePlay}
            className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 backdrop-blur shadow-md transition-colors cursor-pointer"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 text-cyan-400" />}
          </button>

          {/* Fullscreen / Details */}
          <button
            onClick={() => onOpenDetails(gift)}
            className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 backdrop-blur shadow-md transition-colors cursor-pointer"
            title="Full Screen / Details"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <span>ID: {gift.id}</span>
          <span>·</span>
          <span>{gift.resolution || '1080×1920'}</span>
          <span>·</span>
          <span>{gift.fps || 60}FPS</span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Buy on WhatsApp */}
          <button
            onClick={() => onBuyWhatsApp(gift)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{t.buyNowBtn}</span>
          </button>

          {/* View Details Modal */}
          <button
            onClick={() => onOpenDetails(gift)}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold border border-slate-700 transition-colors cursor-pointer"
          >
            {t.viewDetails}
          </button>
        </div>
      </div>
    </div>
  );
};
