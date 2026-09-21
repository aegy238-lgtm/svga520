import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  RotateCw, 
  Heart, 
  ShoppingCart, 
  Download, 
  ShieldCheck, 
  Share2, 
  Layers, 
  Sparkles,
  Info,
  Maximize2,
  MessageCircle,
  CheckCircle2
} from 'lucide-react';
import { GiftItem, Language } from '../types';
import { translations } from '../utils/translations';

interface GiftModalProps {
  gift: GiftItem | null;
  onClose: () => void;
  lang: Language;
  onAddToCart: (gift: GiftItem) => void;
  onOpenPurchase: (gift: GiftItem) => void;
  allGifts: GiftItem[];
  onSelectGift: (gift: GiftItem) => void;
}

export const GiftModal: React.FC<GiftModalProps> = ({
  gift,
  onClose,
  lang,
  onAddToCart,
  onOpenPurchase,
  allGifts,
  onSelectGift
}) => {
  const t = translations[lang];
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(14);
  const [streamBg, setStreamBg] = useState<'dark' | 'stage' | 'green'>('dark');
  const [isFavorited, setIsFavorited] = useState(false);
  const [showCopiedNotice, setShowCopiedNotice] = useState(false);

  useEffect(() => {
    if (gift && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [gift]);

  if (!gift) return null;

  const displayTitle = lang === 'ar' && gift.titleAr ? gift.titleAr : lang === 'en' && gift.titleEn ? gift.titleEn : gift.title;

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (videoRef.current.duration) {
        setDuration(videoRef.current.duration);
      }
    }
  };

  const handleTogglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleDownloadSample = () => {
    // Generates a mock sample test download packet
    const element = document.createElement('a');
    const file = new Blob([
      `JIAWEI EFFECTS TEST SAMPLE PACKET\n` +
      `Gift: ${gift.title} (${gift.id})\n` +
      `Resolution: ${gift.resolution}\n` +
      `Formats: SVGA, VAP, MP4\n` +
      `Stream URL: ${gift.videoUrl}\n` +
      `License Notice: Genuine commercial test license.`
    ], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${gift.id}_sample_spec.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const relatedGifts = allGifts.filter((g) => g.id !== gift.id).slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div 
        className="relative w-full max-w-5xl rounded-2xl bg-[#0f131c] border border-slate-700/80 shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-30 p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Body: Two Columns (Left Video Player, Right Details) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-y-auto">
          {/* LEFT: Video Player Stage (100% clone of video 0:28 - 0:38) */}
          <div className="lg:col-span-6 bg-slate-950 p-4 sm:p-6 flex flex-col items-center justify-between border-b lg:border-b-0 lg:border-r border-slate-800 relative">
            {/* Top Toolbar / Background Simulator */}
            <div className="w-full flex items-center justify-between mb-3 z-10">
              <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700 rounded-lg p-1 text-[11px]">
                <span className="text-slate-400 px-1">{t.streamBgSim}:</span>
                <button
                  onClick={() => setStreamBg('dark')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    streamBg === 'dark' ? 'bg-cyan-500/30 text-cyan-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.bgDark}
                </button>
                <button
                  onClick={() => setStreamBg('stage')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    streamBg === 'stage' ? 'bg-cyan-500/30 text-cyan-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.bgStage}
                </button>
                <button
                  onClick={() => setStreamBg('green')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    streamBg === 'green' ? 'bg-cyan-500/30 text-cyan-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.bgGreen}
                </button>
              </div>

              <div className="text-[11px] text-cyan-400/80 font-mono">
                {gift.resolution} · {gift.fps || 60}FPS
              </div>
            </div>

            {/* Video Canvas Stage with Phone/Overlay Aspect Ratio */}
            <div 
              className={`relative w-full max-w-[340px] aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl border border-slate-800 transition-colors flex items-center justify-center ${
                streamBg === 'dark' 
                  ? 'bg-black' 
                  : streamBg === 'stage' 
                  ? 'bg-gradient-to-b from-indigo-950 via-slate-950 to-purple-950' 
                  : 'bg-[#00b140]'
              }`}
            >
              {/* External Video Direct Stream (0 server load!) */}
              <video
                ref={videoRef}
                src={gift.videoUrl}
                loop
                muted={isMuted}
                playsInline
                onTimeUpdate={handleTimeUpdate}
                onClick={handleTogglePlay}
                className="w-full h-full object-contain cursor-pointer"
              />

              {/* Watermark clone */}
              <div className="absolute top-4 left-4 pointer-events-none opacity-40 flex items-center gap-1.5 text-xs text-white">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-bold tracking-wider">佳维特效 JIAWEI</span>
              </div>

              {/* Pause icon overlay when paused */}
              {!isPlaying && (
                <div 
                  onClick={handleTogglePlay}
                  className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer"
                >
                  <div className="w-16 h-16 rounded-full bg-cyan-500/90 text-white flex items-center justify-center shadow-xl hover:scale-110 transition-transform">
                    <Play className="w-8 h-8 ml-1 fill-current" />
                  </div>
                </div>
              )}
            </div>

            {/* Player Controls Bar */}
            <div className="w-full max-w-[340px] mt-3 space-y-2">
              {/* Timeline Scrubber */}
              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                <span>{formatTime(currentTime)}</span>
                <input
                  type="range"
                  min="0"
                  max={duration || 14}
                  step="0.1"
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <span>{formatTime(duration)}</span>
              </div>

              {/* Controls buttons */}
              <div className="flex items-center justify-between text-slate-300">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTogglePlay}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-200 transition-colors"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-200 transition-colors"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
                  </button>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <span>MP4 / SVGA / VAP</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Product Specs & Action Box */}
          <div className="lg:col-span-6 p-5 sm:p-6 flex flex-col justify-between space-y-4">
            <div>
              {/* Top Banner: 动效文件处理工具 */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-cyan-950/60 to-blue-950/60 border border-cyan-800/40 text-xs mb-4">
                <div className="flex items-center gap-2 text-cyan-300">
                  <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="font-semibold">{t.toolBadge}</span>
                </div>
                <button 
                  onClick={handleDownloadSample}
                  className="px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[11px] font-medium border border-cyan-500/30"
                >
                  点击体验 →
                </button>
              </div>

              {/* Title & Metadata Line */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                    {displayTitle}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                      {gift.id}
                    </span>
                    <span>文件: {gift.id.toLowerCase()}.mp4</span>
                  </div>
                </div>

                <button
                  onClick={() => setIsFavorited(!isFavorited)}
                  className={`p-2 rounded-xl border transition-colors ${
                    isFavorited 
                      ? 'bg-pink-500/20 border-pink-500/40 text-pink-400' 
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                  title={t.favorite}
                >
                  <Heart className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} />
                </button>
              </div>

              {/* Formats Info Bar (SVGA, MP4, VAP, PAG, etc.) */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 mb-4">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {lang === 'ar' ? 'الصيغ والمواصفات الفنية المرفقة:' : '已包含动效格式与文件体积:'}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {gift.formats.map((fmt, i) => (
                    <div key={i} className="flex items-center justify-between p-1.5 rounded bg-slate-800/60 text-slate-300">
                      <span className="font-medium truncate mr-1">{fmt.name}</span>
                      <span className="text-[11px] text-cyan-400 font-mono shrink-0">{fmt.size}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {['SVGA', 'VAP', 'MP4', 'PAG', 'JSON', 'WEBP', 'GIF', 'MOV'].map((fmt) => (
                    <span key={fmt} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                      {fmt}
                    </span>
                  ))}
                </div>
              </div>

              {/* Price Display Card - USD */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-[#121826] border border-slate-700/80 mb-4">
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                      $ {gift.price}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">USD / {lang === 'ar' ? 'للحزمة الكاملة' : 'Set'}</span>
                  </div>

                  <div className="text-right">
                    <div className="text-[11px] text-slate-400">{t.vipEstPrice}:</div>
                    <div className="text-sm font-bold text-cyan-300 font-mono">
                      $ {gift.vipPrice} USD
                    </div>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>{lang === 'ar' ? 'سعر الشراء الحصري الكامل (الاحتكار التجاري):' : '全网独占买断版权:'}</span>
                  <span className="font-mono text-amber-300 font-bold">$ {gift.exclusivePrice} USD</span>
                </div>
              </div>

              {/* Creator & Direct WhatsApp Contact Card */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={gift.author.avatar}
                    alt={gift.author.name}
                    className="w-10 h-10 rounded-full object-cover border border-cyan-500/40 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white truncate">{gift.author.name}</span>
                      {gift.author.verified && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {lang === 'ar' ? 'مصمم ومعد مؤثرات معتمد في المنصة' : 'Verified Platform VFX Creator'}
                    </div>
                  </div>
                </div>

                {gift.author.whatsapp && (
                  <a
                    href={`https://wa.me/${gift.author.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                      lang === 'ar'
                        ? `مرحباً، أنا مهتم بالحصول على مؤثر البث [${displayTitle} - ${gift.id}] وأود الاستفسار عن التفاصيل والترخيص.`
                        : `Hello! I am interested in your live stream effect [${displayTitle} - ${gift.id}].`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all shrink-0 hover:scale-105 active:scale-95"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'واتساب المصمم' : 'WhatsApp'}</span>
                  </a>
                )}
              </div>

              {/* Action Buttons Box (Direct checkout trigger & Add to cart) */}
              <div className="grid grid-cols-2 gap-2.5 mb-4">
                <button
                  onClick={() => onAddToCart(gift)}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <ShoppingCart className="w-4 h-4 text-cyan-400" />
                  <span>{t.addToCartBtn}</span>
                </button>

                <button
                  onClick={() => onOpenPurchase(gift)}
                  className="py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition-all active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{t.buyNowBtn}</span>
                </button>
              </div>

              {/* License Warranty Notice */}
              <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/30 text-[11px] text-amber-300/90 flex items-start gap-2 leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{t.licenseNotice}</span>
              </div>
            </div>

            {/* Related Gifts Strip */}
            <div className="pt-3 border-t border-slate-800">
              <div className="text-xs font-bold text-slate-300 mb-2">
                {t.relatedGifts}
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {relatedGifts.map((rel) => (
                  <div
                    key={rel.id}
                    onClick={() => onSelectGift(rel)}
                    className="w-20 shrink-0 rounded-lg overflow-hidden border border-slate-800 hover:border-cyan-500/60 cursor-pointer group bg-slate-900"
                  >
                    <div className="aspect-square relative overflow-hidden">
                      <img
                        src={rel.posterUrl}
                        alt={rel.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div className="p-1 text-[10px] text-slate-300 truncate text-center">
                      {rel.title}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
