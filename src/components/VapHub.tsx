import React, { useState, useRef, useEffect } from 'react';
import { 
    Upload, X, Play, Pause, Settings, Download, Music, 
    Image as ImageIcon, Type, Activity, RefreshCw, Layers, 
    Volume2, VolumeX, CheckCircle2, Sparkles, AlertCircle, 
    FileAudio, Check, Trash2, Sliders, ShieldCheck,
    Eye, Smartphone, Monitor, ArrowUpDown, MoveHorizontal, 
    Disc, PlayCircle, Loader2, Maximize2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { VapPlayer } from './VapPlayer';
import { parseVapMetadata } from '../utils/vapParser';
import { extractAudioFromVap, fastReplaceAudioInVap } from '../utils/vapFFmpeg';
import { convertVapToSvga } from '../utils/svgaExporter';
import { convertVapToMp4 } from '../utils/vapEngine';
import { downloadDesignerInfoFile } from '../utils/designerInfo';
import { exportItem } from './AnimationManager/utils/exportEngine';
import { AnimationItem } from './AnimationManager/types';

export const VapHub: React.FC = () => {
    const [files, setFiles] = useState<{file: File, url: string, metadata: any, status: string}[]>([]);
    const [activeIndex, setActiveIndex] = useState<number>(0);
    const [selectedFormat, setSelectedFormat] = useState<string>('VAP (ملف VAP شفاف مع الصوت)');
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [exportPhase, setExportPhase] = useState<string>('');
    const [exportProgress, setExportProgress] = useState<number>(0);
    const [exportSuccess, setExportSuccess] = useState<boolean>(false);
    const [isExtractingAudio, setIsExtractingAudio] = useState(false);
    const [alphaMode, setAlphaMode] = useState<'right' | 'left' | 'top' | 'bottom'>('right');

    // Mobile & Layout Customization State
    const [mobileTab, setMobileTab] = useState<'preview' | 'audio' | 'export'>('preview');
    const [bgMode, setBgMode] = useState<'checker' | 'dark' | 'black' | 'white' | 'green'>('checker');
    const [aspectMode, setAspectMode] = useState<'auto' | 'portrait' | 'landscape' | 'square'>('auto');
    const [isLoadingSample, setIsLoadingSample] = useState<boolean>(false);
    const [detectedDimensions, setDetectedDimensions] = useState<{ width: number; height: number; duration: number }>({ width: 0, height: 0, duration: 0 });

    // Audio Management State
    const [customAudioFile, setCustomAudioFile] = useState<File | null>(null);
    const [customAudioUrl, setCustomAudioUrl] = useState<string | null>(null);
    const [customAudioDuration, setCustomAudioDuration] = useState<number>(0);
    const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
    const [audioVolume, setAudioVolume] = useState<number>(1.0);
    const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
    const [vapCompressionEnabled, setVapCompressionEnabled] = useState<boolean>(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);
    const audioPlayerRef = useRef<HTMLAudioElement>(null);

    const activeFile = files[activeIndex];

    // Load sample demo VAP for instant mobile testing
    const handleLoadSample = async () => {
        setIsLoadingSample(true);
        try {
            const response = await fetch('/sample_vap.mp4');
            if (!response.ok) throw new Error('فشل جلب العينة التجريبية');
            const blob = await response.blob();
            const sampleFile = new File([blob], 'sample_live_gift.vap', { type: 'video/mp4' });
            const metadata = await parseVapMetadata(sampleFile);
            setAlphaMode('right');
            setFiles(prev => [...prev, {
                file: sampleFile,
                url: URL.createObjectURL(sampleFile),
                metadata,
                status: 'Ready'
            }]);
            setActiveIndex(files.length);
        } catch (err: any) {
            console.error("Error loading sample VAP:", err);
            alert("تعذر تحميل العينة التجريبية: " + err.message);
        } finally {
            setIsLoadingSample(false);
        }
    };

    // Clean up audio URL on unmount or file change
    useEffect(() => {
        return () => {
            if (customAudioUrl) {
                URL.revokeObjectURL(customAudioUrl);
            }
        };
    }, [customAudioUrl]);

    // Handle Custom Audio File Selection
    const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        e.target.value = '';

        if (customAudioUrl) {
            URL.revokeObjectURL(customAudioUrl);
        }

        const url = URL.createObjectURL(file);
        setCustomAudioFile(file);
        setCustomAudioUrl(url);
        setIsAudioMuted(false);

        const tempAudio = new Audio(url);
        tempAudio.onloadedmetadata = () => {
            setCustomAudioDuration(tempAudio.duration || 0);
        };
    };

    const handleRemoveCustomAudio = () => {
        if (customAudioUrl) {
            URL.revokeObjectURL(customAudioUrl);
        }
        setCustomAudioFile(null);
        setCustomAudioUrl(null);
        setCustomAudioDuration(0);
        setIsAudioPlaying(false);
    };

    const toggleAudioPlayback = () => {
        if (!audioPlayerRef.current) return;
        if (isAudioPlaying) {
            audioPlayerRef.current.pause();
            setIsAudioPlaying(false);
        } else {
            audioPlayerRef.current.currentTime = 0;
            audioPlayerRef.current.volume = Math.min(audioVolume, 1.0);
            audioPlayerRef.current.play().catch(() => {});
            setIsAudioPlaying(true);
        }
    };

    const handleExtractAudio = async () => {
        if (!activeFile) return;
        setIsExtractingAudio(true);
        try {
            const audioBlob = await extractAudioFromVap(activeFile.file);
            const a = document.createElement('a');
            a.href = URL.createObjectURL(audioBlob);
            a.download = activeFile.file.name.replace(/\.[^/.]+$/, "") + '.mp3';
            a.click();
        } catch (err: any) {
            console.error("Audio extraction failed:", err);
            alert("فشل استخراج الصوت: " + err.message);
        } finally {
            setIsExtractingAudio(false);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const newFiles = Array.from(e.target.files) as File[];
        e.target.value = '';

        for (const file of newFiles) {
            try {
                const metadata = await parseVapMetadata(file);
                const isLeft = Boolean(
                    (metadata?.info?.aFrame && metadata?.info?.rgbFrame && metadata.info.aFrame[0] < metadata.info.rgbFrame[0]) || 
                    file.name.toLowerCase().endsWith('.yyeva') || 
                    (metadata as any)?.descript
                );
                if (isLeft) {
                    setAlphaMode('left');
                }
                setFiles(prev => [...prev, {
                    file,
                    url: URL.createObjectURL(file),
                    metadata,
                    status: 'Ready'
                }]);
            } catch (err: any) {
                alert(`Error reading ${file.name}: ${err.message}`);
            }
        }
    };

    const handleExport = async (targetTypeOverride?: 'VAP' | 'YYEVA') => {
        if (!activeFile) return;
        setIsExporting(true);
        setExportProgress(10);
        setExportSuccess(false);
        setExportPhase("جاري فحص ملف الأنيميشن ومسارات الصوت...");

        try {
            const baseName = activeFile.file.name.replace(/\.[^/.]+$/, "");
            const fmtType = targetTypeOverride || (selectedFormat.includes('YYEVA') ? 'YYEVA' : 'VAP');

            if (fmtType === 'YYEVA') {
                setExportPhase("جاري فك تشفير وتصدير إطارات الفيديو إلى صيغة YYEVA (.mp4) الشفافة...");
                setExportProgress(30);

                const fps = (activeFile.metadata?.info?.fps && activeFile.metadata.info.fps > 0 && activeFile.metadata.info.fps <= 120) 
                    ? activeFile.metadata.info.fps 
                    : 30;
                const totalF = (activeFile.metadata?.info?.f && activeFile.metadata.info.f > 0 && activeFile.metadata.info.f !== fps)
                    ? activeFile.metadata.info.f
                    : 90;
                const dur = totalF / fps;

                const animItem: AnimationItem = {
                    id: 'vap_to_yyeva_' + Date.now(),
                    name: baseName,
                    originalName: activeFile.file.name,
                    format: 'vap',
                    size: activeFile.file.size,
                    dimensions: {
                        width: activeFile.metadata?.info?.w || 750,
                        height: activeFile.metadata?.info?.h || 750
                    },
                    duration: dur,
                    fps: fps,
                    frameCount: totalF,
                    contentHash: 'hash_' + Date.now(),
                    file: activeFile.file,
                    previewUrl: activeFile.url,
                    createdAt: Date.now(),
                    status: 'ready'
                };
                const result = await exportItem(animItem, 'yyeva', {
                    fps: fps,
                    quality: 95
                });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(result.blob);
                const dlYyeva = `${baseName}_YYEVA.mp4`;
                a.download = dlYyeva;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                downloadDesignerInfoFile(dlYyeva, { format: 'YYEVA Transparent Video', fps, frames: totalF });
                setExportSuccess(true);
                setIsExporting(false);
            } else {
                // VAP export
                setExportPhase("جاري دمج مسار الصوت مع الحفاظ الكامل على إطارات وبيانات VAP...");
                setExportProgress(30);

                const audioToMerge = isAudioMuted ? null : customAudioFile;
                
                const finalVapBlob = await fastReplaceAudioInVap(
                    activeFile.file,
                    audioToMerge,
                    {
                        vapConfig: activeFile.metadata,
                        volume: audioVolume,
                        mute: isAudioMuted,
                        vapCompression: vapCompressionEnabled,
                        onProgress: (p) => setExportProgress(p),
                        onStatus: (s) => setExportPhase(s)
                    }
                );

                setExportProgress(100);
                setExportPhase("تم دمج وتجهيز ملف VAP بنجاح بالمدة الكاملة!");
                setExportSuccess(true);

                const downloadName = `${baseName}${isAudioMuted ? '_silent' : (customAudioFile ? '_with_audio' : '_vap')}.vap`;
                const a = document.createElement('a');
                a.href = URL.createObjectURL(finalVapBlob);
                a.download = downloadName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                downloadDesignerInfoFile(downloadName, { format: 'VAP 1.0.5' });
                setIsExporting(false);
            }
        } catch (error: any) {
            console.error("Export Error:", error);
            setExportPhase(`فشل التصدير: ${error.message || 'خطأ غير معروف'}`);
            alert("حدث خطأ أثناء التصدير: " + (error.message || error));
            setIsExporting(false);
        }
    };

    return (
        <div className="flex flex-col items-center w-full min-h-screen text-white font-sans pt-4 sm:pt-6 px-3 sm:px-6 pb-24 lg:pb-12" dir="rtl">
            {/* Main Studio Header */}
            <div className="w-full max-w-7xl flex flex-col items-center text-center mb-5 sm:mb-8 px-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[11px] sm:text-xs font-black mb-2 shadow-sm">
                    <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                    <span>عارض ومعالج VAP الشفاف • متوافق مع الموبايل والشاشات</span>
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black mb-1.5 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
                    VAP & YYEVA Motion Studio
                </h1>
                <p className="text-slate-400 text-xs sm:text-sm max-w-xl font-arabic">
                    نظام متكامل لمعالجة وتحويل وتشغيل وفحص هدايا وأنيميشن VAP الشفافة مع دمج الصوت وإدارة القنوات
                </p>
            </div>
            
            {files.length === 0 ? (
                <div className="w-full max-w-2xl flex flex-col items-center gap-4 px-2">
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-64 sm:h-72 border-2 border-dashed border-indigo-500/40 hover:border-indigo-400 active:border-indigo-300 rounded-3xl flex flex-col items-center justify-center cursor-pointer bg-slate-800/30 hover:bg-slate-800/60 active:bg-slate-800/80 transition-all p-6 text-center group shadow-2xl relative overflow-hidden"
                    >
                        <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-lg shadow-indigo-500/10">
                            <Upload className="w-8 h-8 text-indigo-400" />
                        </div>
                        <p className="text-base sm:text-lg font-bold text-slate-100">اضغط هنا لرفع ملفات VAP أو MP4</p>
                        <p className="text-xs sm:text-sm text-slate-400 mt-1.5 max-w-md">يدعم اكتشاف إطارات الألفا الشفافة وصندوق البيانات (vapc) والمسارات الصوتية تلقائياً</p>
                        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                            <span className="px-3 py-1 rounded-full bg-slate-700/60 text-[11px] font-semibold text-indigo-300 border border-indigo-500/20">
                                يدعم .vap و .mp4 و .yyeva
                            </span>
                            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20">
                                تشغيل فوري بدون تعليق
                            </span>
                        </div>
                    </div>

                    {/* Instant Demo Sample Button for Mobile Testing */}
                    <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-3">
                        <button
                            type="button"
                            onClick={handleLoadSample}
                            disabled={isLoadingSample}
                            className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 active:scale-95 text-white font-black text-xs sm:text-sm rounded-2xl shadow-xl shadow-indigo-600/25 flex items-center justify-center gap-2 border border-indigo-400/30 transition-all cursor-pointer"
                        >
                            {isLoadingSample ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                                    <span>جاري تجهيز العينة التجريبية...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4 text-amber-300" />
                                    <span>تجربة عينة هدية VAP تجريبية فوراً (بدون رفع ملف)</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="w-full max-w-7xl flex flex-col gap-4">
                    {/* Mobile Segmented Navigation Tabs */}
                    <div className="w-full lg:hidden">
                        <div className="grid grid-cols-3 bg-slate-900/90 p-1 rounded-2xl border border-slate-700 shadow-lg text-xs font-black">
                            <button
                                type="button"
                                onClick={() => setMobileTab('preview')}
                                className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                                    mobileTab === 'preview' 
                                        ? 'bg-indigo-600 text-white shadow-md' 
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <Play className="w-3.5 h-3.5" />
                                <span>العرض والتحكم</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setMobileTab('audio')}
                                className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                                    mobileTab === 'audio' 
                                        ? 'bg-orange-600 text-white shadow-md' 
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <Music className="w-3.5 h-3.5" />
                                <span>الصوت المدمج</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setMobileTab('export')}
                                className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                                    mobileTab === 'export' 
                                        ? 'bg-emerald-600 text-white shadow-md' 
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>التصدير والتحويل</span>
                            </button>
                        </div>
                    </div>

                    <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column: Preview & Info (Visible on desktop or when mobileTab === 'preview') */}
                        <div className={`flex flex-col gap-5 lg:col-span-2 ${mobileTab === 'preview' ? 'flex' : 'hidden lg:flex'}`}>
                            {/* Main Preview Card */}
                            <div className="bg-slate-800/60 rounded-3xl p-4 sm:p-6 border border-slate-700/80 shadow-2xl relative">
                                {/* Preview Card Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-700/50">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-base sm:text-lg font-black flex items-center gap-2 text-slate-100">
                                            <PlayCircle className="w-5 h-5 text-indigo-400 fill-indigo-500/20"/>
                                            <span>معاينة VAP الشفاف</span>
                                        </h2>
                                        <button 
                                            onClick={() => fileInputRef.current?.click()} 
                                            className="sm:hidden bg-indigo-600/20 active:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1"
                                        >
                                            <Upload className="w-3.5 h-3.5" /> رفع ملف
                                        </button>
                                    </div>

                                    {/* Alpha Mode Selector */}
                                    <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/90 rounded-2xl p-1.5 border border-slate-700/80 text-xs">
                                        <span className="px-2 text-slate-400 font-bold text-[11px]">نمط الألفا:</span>
                                        <button 
                                            type="button"
                                            onClick={() => setAlphaMode('left')}
                                            className={`px-2.5 py-1 rounded-lg font-black transition-all text-xs ${
                                                alphaMode === 'left' ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:text-white'
                                            }`}
                                        >
                                            يسار (VAP ⬅️)
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setAlphaMode('right')}
                                            className={`px-2.5 py-1 rounded-lg font-black transition-all text-xs ${
                                                alphaMode === 'right' ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:text-white'
                                            }`}
                                        >
                                            يمين (YYEVA ➡️)
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setAlphaMode('bottom')}
                                            className={`px-2.5 py-1 rounded-lg font-black transition-all text-xs ${
                                                alphaMode === 'bottom' ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:text-white'
                                            }`}
                                        >
                                            أسفل (⬇️)
                                        </button>
                                    </div>

                                    <button 
                                        onClick={() => fileInputRef.current?.click()} 
                                        className="hidden sm:flex bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-xl text-xs transition-all font-bold items-center gap-1.5"
                                    >
                                        <Upload className="w-3.5 h-3.5" /> رفع ملف آخر
                                    </button>
                                </div>

                                {/* Multi-file tabs switcher */}
                                {files.length > 1 && (
                                    <div className="flex gap-2 mb-3 overflow-x-auto pb-1.5 scrollbar-thin">
                                        {files.map((f, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => setActiveIndex(idx)}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all truncate max-w-[160px] flex-shrink-0 ${
                                                    activeIndex === idx 
                                                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md' 
                                                        : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:bg-slate-800'
                                                }`}
                                            >
                                                {f.file.name}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Preview Toolbar: Aspect Ratio & Background Controls */}
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-3 bg-slate-900/70 p-2 rounded-2xl border border-slate-700/60 text-xs">
                                    {/* Aspect Ratio Presets */}
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] sm:text-xs text-slate-400 font-bold px-1">الأبعاد:</span>
                                        <button
                                            type="button"
                                            onClick={() => setAspectMode('auto')}
                                            className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all ${
                                                aspectMode === 'auto' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            تلقائي
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAspectMode('portrait')}
                                            className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all ${
                                                aspectMode === 'portrait' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            طولي (9:16)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAspectMode('landscape')}
                                            className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all ${
                                                aspectMode === 'landscape' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            عرضي (16:9)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAspectMode('square')}
                                            className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all ${
                                                aspectMode === 'square' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            مربع (1:1)
                                        </button>
                                    </div>

                                    {/* Background Mode Selector */}
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] sm:text-xs text-slate-400 font-bold px-1">الخلفية:</span>
                                        <button
                                            type="button"
                                            onClick={() => setBgMode('checker')}
                                            className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all ${
                                                bgMode === 'checker' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
                                            }`}
                                            title="شبكة الشفافية"
                                        >
                                            شفاف
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setBgMode('dark')}
                                            className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all ${
                                                bgMode === 'dark' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
                                            }`}
                                            title="خلفية داكنة"
                                        >
                                            داكن
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setBgMode('black')}
                                            className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all ${
                                                bgMode === 'black' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
                                            }`}
                                            title="خلفية سوداء"
                                        >
                                            أسود
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setBgMode('white')}
                                            className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all ${
                                                bgMode === 'white' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
                                            }`}
                                            title="خلفية بيضاء"
                                        >
                                            أبيض
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setBgMode('green')}
                                            className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all ${
                                                bgMode === 'green' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
                                            }`}
                                            title="أخضر كروما"
                                        >
                                            كروما
                                        </button>
                                    </div>
                                </div>

                                {/* 
                                  ADAPTIVE PREVIEW CONTAINER:
                                  Optimized for mobile devices, adapts automatically to portrait or landscape.
                                */}
                                <div className={`w-full rounded-2xl overflow-hidden border border-slate-700/80 relative shadow-inner flex items-center justify-center transition-all ${
                                    aspectMode === 'portrait' ? 'aspect-[9/16] max-h-[560px] max-w-[340px] mx-auto' :
                                    aspectMode === 'landscape' ? 'aspect-video max-h-[480px]' :
                                    aspectMode === 'square' ? 'aspect-square max-h-[440px] max-w-[440px] mx-auto' :
                                    'h-[46vh] sm:h-[420px] min-h-[320px] max-h-[580px]'
                                }`}>
                                    <VapPlayer 
                                        src={activeFile.url} 
                                        alphaMode={alphaMode} 
                                        bgMode={bgMode}
                                        width={800} 
                                        height={450} 
                                        className="w-full h-full" 
                                        onDimensionsDetected={(dims) => setDetectedDimensions(dims)}
                                    />
                                </div>
                            </div>

                            {/* File Info Cards Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-slate-800/60 p-3 sm:p-4 rounded-2xl border border-slate-700/80 flex flex-col">
                                    <span className="text-slate-400 text-[10px] sm:text-xs uppercase font-black">حجم الملف</span>
                                    <span className="font-black text-base sm:text-lg text-slate-100">
                                        {(activeFile.file.size / 1024 / 1024).toFixed(2)} MB
                                    </span>
                                </div>
                                <div className="bg-slate-800/60 p-3 sm:p-4 rounded-2xl border border-slate-700/80 flex flex-col">
                                    <span className="text-slate-400 text-[10px] sm:text-xs uppercase font-black">الأبعاد المستخرجة</span>
                                    <span className="font-black text-base sm:text-lg text-slate-100">
                                        {detectedDimensions.width || activeFile.metadata?.info?.w || 0} × {detectedDimensions.height || activeFile.metadata?.info?.h || 0}
                                    </span>
                                </div>
                                <div className="bg-slate-800/60 p-3 sm:p-4 rounded-2xl border border-slate-700/80 flex flex-col">
                                    <span className="text-slate-400 text-[10px] sm:text-xs uppercase font-black">معدل الإطارات / الإجمالي</span>
                                    <span className="font-black text-base sm:text-lg text-slate-100">
                                        {activeFile.metadata?.info?.fps || 30} FPS / {activeFile.metadata?.info?.f || 0}
                                    </span>
                                </div>
                                <div className="bg-slate-800/60 p-3 sm:p-4 rounded-2xl border border-slate-700/80 flex flex-col">
                                    <span className="text-slate-400 text-[10px] sm:text-xs uppercase font-black">العناصر الديناميكية</span>
                                    <span className="font-black text-base sm:text-lg text-slate-100">
                                        {activeFile.metadata?.src?.length || 0}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Audio Manager & Export Controls (Visible on desktop or when mobileTab is audio/export) */}
                        <div className={`flex flex-col gap-5 ${mobileTab !== 'preview' ? 'flex' : 'hidden lg:flex'}`}>
                            {/* Audio Manager Card */}
                            <div className={`bg-slate-800/60 rounded-3xl p-4 sm:p-6 border border-slate-700/80 shadow-2xl ${
                                mobileTab === 'export' ? 'hidden lg:block' : 'block'
                            }`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
                                        <Music className="w-5 h-5 text-orange-400"/>
                                        <span>نظام الصوت المدمج</span>
                                    </h3>
                                    {customAudioFile && (
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-bold text-emerald-300">
                                            صوت مخصص جاهز
                                        </span>
                                    )}
                                </div>

                                {/* Custom Audio Info Card */}
                                {customAudioFile ? (
                                    <div className="bg-slate-900/80 rounded-2xl p-3.5 border border-slate-700 mb-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2.5 overflow-hidden">
                                                <div className="w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                                                    <FileAudio className="w-4 h-4 text-orange-400" />
                                                </div>
                                                <div className="truncate">
                                                    <p className="text-xs font-black text-slate-200 truncate">{customAudioFile.name}</p>
                                                    <p className="text-[10px] text-slate-400">
                                                        {(customAudioFile.size / 1024).toFixed(0)} KB {customAudioDuration > 0 && `• ${customAudioDuration.toFixed(1)} ثانية`}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <button 
                                                    type="button"
                                                    onClick={toggleAudioPlayback} 
                                                    className="p-2 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 transition-colors"
                                                    title={isAudioPlaying ? 'إيقاف مؤقت' : 'تشغيل الصوت'}
                                                >
                                                    {isAudioPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={handleRemoveCustomAudio} 
                                                    className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors"
                                                    title="إزالة الصوت المخصص"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Volume Slider */}
                                        <div className="space-y-1.5 pt-1 border-t border-slate-800">
                                            <div className="flex justify-between text-[11px] font-bold text-slate-400">
                                                <span>مستوى الصوت</span>
                                                <span>{Math.round(audioVolume * 100)}%</span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="0" 
                                                max="2" 
                                                step="0.05" 
                                                value={audioVolume} 
                                                onChange={(e) => {
                                                    const v = parseFloat(e.target.value);
                                                    setAudioVolume(v);
                                                    if (audioPlayerRef.current) {
                                                        audioPlayerRef.current.volume = Math.min(v, 1.0);
                                                    }
                                                }}
                                                className="w-full accent-orange-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                                            />
                                        </div>
                                    </div>
                                ) : null}

                                {/* Audio Action Buttons */}
                                <div className="flex flex-col gap-2.5">
                                    <button 
                                        type="button"
                                        onClick={() => audioInputRef.current?.click()}
                                        className="w-full py-3 bg-gradient-to-r from-orange-600/30 to-amber-600/30 hover:from-orange-600/40 hover:to-amber-600/40 border border-orange-500/40 rounded-xl font-bold flex items-center justify-center gap-2 text-xs text-orange-200 transition-all shadow-sm"
                                    >
                                        <Upload className="w-4 h-4 text-orange-400" /> 
                                        <span>{customAudioFile ? 'استبدال ملف الصوت الحالي' : 'إضافة مسار صوتي جديد (MP3 / WAV / AAC)'}</span>
                                    </button>
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                        <button 
                                            type="button"
                                            onClick={() => setIsAudioMuted(!isAudioMuted)} 
                                            className={`py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 text-xs transition-all border ${
                                                isAudioMuted 
                                                    ? 'bg-red-500/20 text-red-300 border-red-500/40 shadow-sm' 
                                                    : 'bg-slate-700/50 hover:bg-slate-700 text-slate-300 border-slate-600/50'
                                            }`}
                                        >
                                            {isAudioMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />} 
                                            <span>{isAudioMuted ? 'الصوت مكتوم 🔇' : 'كتم الصوت'}</span>
                                        </button>

                                        <button 
                                            type="button"
                                            onClick={handleExtractAudio} 
                                            disabled={isExtractingAudio} 
                                            className="py-2.5 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 rounded-xl font-bold flex items-center justify-center gap-1.5 text-xs text-emerald-300 disabled:opacity-50 transition-all"
                                        >
                                            <Download className="w-3.5 h-3.5 text-emerald-400" /> 
                                            <span>{isExtractingAudio ? 'جاري الاستخراج...' : 'استخراج MP3'}</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Hidden audio element for preview */}
                                {customAudioUrl && (
                                    <audio 
                                        ref={audioPlayerRef} 
                                        src={customAudioUrl} 
                                        onEnded={() => setIsAudioPlaying(false)}
                                        className="hidden" 
                                    />
                                )}
                            </div>

                            {/* Export & Conversion Panel */}
                            <div className={`bg-slate-800/60 rounded-3xl p-4 sm:p-6 border border-slate-700/80 shadow-2xl flex-1 flex flex-col justify-between ${
                                mobileTab === 'audio' ? 'hidden lg:flex' : 'flex'
                            }`}>
                                <div>
                                    <h3 className="text-base sm:text-lg font-bold mb-4 flex items-center gap-2">
                                        <Download className="w-5 h-5 text-emerald-400"/>
                                        <span>التحويل والتصدير مع الصوت</span>
                                    </h3>
                                    
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">الصيغة المطلوبة للتصدير</label>
                                            <select 
                                                value={selectedFormat} 
                                                onChange={(e) => setSelectedFormat(e.target.value)} 
                                                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 font-bold text-xs sm:text-sm text-slate-200 outline-none focus:border-indigo-500 transition-colors"
                                            >
                                                <option value="VAP (ملف VAP شفاف مع الصوت)">صيغة VAP (.vap - ملف VAP شفاف بالمدة الكاملة)</option>
                                                <option value="YYEVA (.mp4 شفاف)">صيغة YYEVA (.mp4 - فيديو شفاف مع كود yyea)</option>
                                            </select>
                                        </div>

                                        {/* VAP Compression toggle */}
                                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-700/60">
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                                                <span className="text-xs font-bold text-slate-300">ضغط VAP الذكي لتقليل الحجم</span>
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={() => setVapCompressionEnabled(!vapCompressionEnabled)}
                                                className={`w-10 h-5 rounded-full relative transition-colors ${vapCompressionEnabled ? 'bg-indigo-600' : 'bg-slate-700'}`}
                                            >
                                                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${vapCompressionEnabled ? 'left-0.5 translate-x-5' : 'left-0.5'}`} />
                                            </button>
                                        </div>

                                        {/* Progress & Status */}
                                        {isExporting && (
                                            <div className="space-y-2 p-3.5 bg-slate-900/90 rounded-2xl border border-indigo-500/30 animate-in fade-in duration-200">
                                                <div className="flex justify-between text-xs font-bold text-slate-300">
                                                    <span className="truncate max-w-[200px]">{exportPhase}</span>
                                                    <span className="text-indigo-400 font-mono">{exportProgress}%</span>
                                                </div>
                                                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                                                    <div 
                                                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-300"
                                                        style={{ width: `${exportProgress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {exportSuccess && !isExporting && (
                                            <div className="flex items-center gap-2 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold animate-in fade-in duration-200">
                                                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                                                <span>تم إنشاء وتنزيل ملف التصدير بنجاح بالمدة السليمة!</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Three Dedicated Export Buttons: Full mobile responsiveness */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-5">
                                    <button 
                                        type="button"
                                        onClick={() => handleExport('VAP')} 
                                        disabled={isExporting} 
                                        className="py-3 sm:py-3.5 px-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 hover:from-indigo-500 hover:to-purple-500 active:scale-95 disabled:opacity-50 rounded-2xl font-black text-xs sm:text-sm text-white shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[48px]"
                                        title="تصدير بصيغة VAP بالمدة الكاملة"
                                    >
                                        <Download className="w-4 h-4 stroke-[2.5]" />
                                        <span>تصدير VAP (.vap)</span>
                                    </button>

                                    <button 
                                        type="button"
                                        onClick={() => handleExport('YYEVA')} 
                                        disabled={isExporting} 
                                        className="py-3 sm:py-3.5 px-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 active:scale-95 disabled:opacity-50 rounded-2xl font-black text-xs sm:text-sm text-slate-950 shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[48px]"
                                        title="تصدير بصيغة YYEVA بالمدة الكاملة"
                                    >
                                        <Sparkles className="w-4 h-4 stroke-[2.5]" />
                                        <span>تصدير YYEVA (.mp4)</span>
                                    </button>

                                    <button 
                                        type="button"
                                        onClick={() => handleExport(activeFile?.file.name.toLowerCase().endsWith('.vap') ? 'YYEVA' : 'VAP')} 
                                        disabled={isExporting} 
                                        className="py-3 sm:py-3.5 px-3 bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 active:scale-95 disabled:opacity-50 rounded-2xl font-black text-xs sm:text-sm text-white shadow-xl shadow-cyan-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[48px]"
                                        title={activeFile?.file.name.toLowerCase().endsWith('.vap') ? 'تحويل مباشر من VAP إلى YYEVA' : 'تحويل مباشر من YYEVA إلى VAP'}
                                    >
                                        <RefreshCw className="w-4 h-4 stroke-[2.5]" />
                                        <span>
                                            {activeFile?.file.name.toLowerCase().endsWith('.vap') ? 'تحويل VAP ➔ YYEVA' : 'تحويل YYEVA ➔ VAP'}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Fixed Mobile Quick Action Bottom Dock (Always accessible on phone) */}
                    <div className="lg:hidden fixed bottom-2 inset-x-2 z-40 bg-slate-900/95 backdrop-blur-xl border border-indigo-500/30 p-2 rounded-2xl shadow-2xl flex items-center justify-between gap-1.5">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2.5 rounded-xl bg-slate-800 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center justify-center"
                            title="رفع ملف جديد"
                        >
                            <Upload className="w-4 h-4" />
                        </button>

                        <button
                            type="button"
                            onClick={() => setAlphaMode(alphaMode === 'left' ? 'right' : 'left')}
                            className="px-3 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 text-xs font-black flex items-center gap-1"
                        >
                            <span>الألفا: {alphaMode === 'left' ? 'يسار ⬅️' : 'يمين ➡️'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleExport(activeFile?.file.name.toLowerCase().endsWith('.vap') ? 'YYEVA' : 'VAP')}
                            disabled={isExporting}
                            className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 active:scale-95 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>تصدير سريع</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setMobileTab(mobileTab === 'preview' ? 'export' : mobileTab === 'export' ? 'audio' : 'preview')}
                            className="p-2.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold flex items-center justify-center"
                            title="تبديل التبويب"
                        >
                            {mobileTab === 'preview' ? <Download className="w-4 h-4 text-emerald-400" /> : mobileTab === 'export' ? <Music className="w-4 h-4 text-orange-400" /> : <Play className="w-4 h-4 text-indigo-400" />}
                        </button>
                    </div>
                </div>
            )}
            
            {/* Hidden File Inputs */}
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                multiple 
                accept=".mp4,.vap" 
                onChange={handleUpload} 
            />
            <input 
                type="file" 
                ref={audioInputRef} 
                className="hidden" 
                accept="audio/*,.mp3,.wav,.aac,.m4a,.ogg,.flac" 
                onChange={handleAudioSelect} 
            />
        </div>
    );
};
