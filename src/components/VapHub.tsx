import React, { useState, useRef, useEffect } from 'react';
import { 
    Upload, X, Play, Pause, Settings, Download, Music, 
    Image as ImageIcon, Type, Activity, RefreshCw, Layers, 
    Volume2, VolumeX, CheckCircle2, Sparkles, AlertCircle, 
    FileAudio, Check, Trash2, Sliders, ShieldCheck
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { VapPlayer } from './VapPlayer';
import { parseVapMetadata } from '../utils/vapParser';
import { extractAudioFromVap, fastReplaceAudioInVap } from '../utils/vapFFmpeg';
import { convertVapToSvga } from '../utils/svgaExporter';
import { convertVapToMp4 } from '../utils/vapEngine';

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

    const handleExport = async () => {
        if (!activeFile) return;
        setIsExporting(true);
        setExportProgress(10);
        setExportSuccess(false);
        setExportPhase("جاري فحص ملف VAP ومسارات الصوت...");

        try {
            const baseName = activeFile.file.name.replace(/\.[^/.]+$/, "");
            const isVapFormat = selectedFormat.includes('VAP') || selectedFormat === 'VAP (Original)';

            if (isVapFormat) {
                setExportPhase("جاري دمج مسار الصوت مع الحفاظ الكامل على إطارات وبيانات VAP...");
                setExportProgress(30);

                const audioToMerge = isAudioMuted ? null : customAudioFile;
                
                const finalVapBlob = await fastReplaceAudioInVap(
                    activeFile.file,
                    audioToMerge,
                    {
                        duration: activeFile.metadata?.info?.f && activeFile.metadata?.info?.fps 
                            ? (activeFile.metadata.info.f / activeFile.metadata.info.fps) 
                            : undefined,
                        vapConfig: activeFile.metadata,
                        volume: audioVolume,
                        mute: isAudioMuted,
                        vapCompression: vapCompressionEnabled,
                        onProgress: (p) => setExportProgress(p),
                        onStatus: (s) => setExportPhase(s)
                    }
                );

                setExportProgress(100);
                setExportPhase("تم دمج وتجهيز ملف VAP بنجاح!");
                setExportSuccess(true);

                // Auto download with appropriate extension
                const extension = selectedFormat.includes('.vap') ? '.vap' : '.vap.mp4';
                const audioSuffix = isAudioMuted ? '_silent' : (customAudioFile ? '_with_audio' : '_vap');
                const downloadName = `${baseName}${audioSuffix}${extension.startsWith('.') ? extension : '.' + extension}`;

                const a = document.createElement('a');
                a.href = URL.createObjectURL(finalVapBlob);
                a.download = downloadName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setIsExporting(false);
            } else if (selectedFormat.includes('MP4')) {
                setExportPhase("جاري تصدير فيديو MP4 عالي الجودة مع دمج الصوت...");
                setExportProgress(25);

                const { mp4Blob } = await convertVapToMp4({
                    file: activeFile.file,
                    url: activeFile.url,
                    vapConfig: activeFile.metadata,
                    onProgress: (prog, status) => {
                        setExportProgress(prog);
                        setExportPhase(status);
                    }
                });

                const a = document.createElement('a');
                a.href = URL.createObjectURL(mp4Blob);
                a.download = `${baseName}_converted.mp4`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setExportSuccess(true);
                setIsExporting(false);
            } else if (selectedFormat === 'SVGA 2.0') {
                const video = document.querySelector('video[src="' + activeFile.url + '"]') as HTMLVideoElement;
                if (!video) {
                    alert('تعذر العثور على الفيديو');
                    setIsExporting(false);
                    return;
                }
                
                const vw = video.videoWidth || activeFile.metadata?.info?.videoW || 1000;
                const vh = video.videoHeight || activeFile.metadata?.info?.videoH || 1000;
                const fps = activeFile.metadata?.info?.fps || 30;
                const totalFrames = activeFile.metadata?.info?.f || Math.floor(video.duration * fps) || 100;

                const svgaBlob = await convertVapToSvga(video, vw, vh, totalFrames, fps, (prog, ph) => {
                    setExportProgress(prog);
                    setExportPhase(ph);
                });
                
                const a = document.createElement('a');
                a.href = URL.createObjectURL(svgaBlob);
                a.download = baseName + '.svga';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setExportSuccess(true);
                setIsExporting(false);
            } else {
                // Fallback for WebM / other formats: Remux via fastReplaceAudioInVap
                setExportPhase("جاري معالجة وتصدير الملف...");
                const finalBlob = await fastReplaceAudioInVap(
                    activeFile.file,
                    isAudioMuted ? null : customAudioFile,
                    {
                        duration: activeFile.metadata?.info?.f && activeFile.metadata?.info?.fps 
                            ? (activeFile.metadata.info.f / activeFile.metadata.info.fps) 
                            : undefined,
                        vapConfig: activeFile.metadata,
                        volume: audioVolume,
                        mute: isAudioMuted,
                        onProgress: (p) => setExportProgress(p),
                        onStatus: (s) => setExportPhase(s)
                    }
                );

                const a = document.createElement('a');
                a.href = URL.createObjectURL(finalBlob);
                a.download = `${baseName}_export.mp4`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setExportSuccess(true);
                setIsExporting(false);
            }
        } catch (error: any) {
            console.error("Export Error:", error);
            alert("حدث خطأ أثناء التصدير: " + (error.message || error));
            setIsExporting(false);
        }
    };

    return (
        <div className="flex flex-col items-center w-full min-h-screen text-white font-sans pt-6 px-4 pb-12" dir="rtl">
            <h1 className="text-3xl md:text-4xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500">
                VAP Processing Hub
            </h1>
            <p className="text-slate-400 mb-8 font-arabic text-sm text-center">
                نظام متكامل لمعالجة وتحويل وتشغيل ودمج الصوت في ملفات VAP الشفافة
            </p>
            
            {files.length === 0 ? (
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full max-w-2xl h-72 border-2 border-dashed border-slate-600 hover:border-indigo-500 rounded-3xl flex flex-col items-center justify-center cursor-pointer bg-slate-800/20 hover:bg-slate-800/50 transition-all p-6 text-center group shadow-xl"
                >
                    <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Upload className="w-8 h-8 text-indigo-400" />
                    </div>
                    <p className="text-lg font-bold text-slate-200">اضغط هنا أو اسحب ملفات VAP</p>
                    <p className="text-sm text-slate-400 mt-2 max-w-md">يدعم اكتشاف إطارات الألفا الشفافة وصندوق البيانات (vapc) والمسارات الصوتية تلقائياً</p>
                    <span className="mt-4 px-3 py-1 rounded-full bg-slate-700/60 text-xs font-semibold text-indigo-300">
                        يدعم .mp4 و .vap
                    </span>
                </div>
            ) : (
                <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Panel: Preview & Info */}
                    <div className="lg:col-span-2 flex flex-col gap-6">
                        <div className="bg-slate-800/50 rounded-3xl p-6 border border-slate-700 shadow-xl relative overflow-hidden">
                            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <Play className="w-5 h-5 text-indigo-400"/> معاينة VAP الشفاف
                                </h2>
                                
                                <div className="flex items-center gap-2">
                                    {/* Alpha Mode Selector */}
                                    <div className="flex items-center bg-slate-900/80 rounded-xl p-1 border border-slate-700 text-xs">
                                        <span className="px-2 text-slate-400 font-bold">نمط الألفا:</span>
                                        <button 
                                            onClick={() => setAlphaMode('right')}
                                            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${alphaMode === 'right' ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}
                                        >
                                            يمين (Right)
                                        </button>
                                        <button 
                                            onClick={() => setAlphaMode('left')}
                                            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${alphaMode === 'left' ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}
                                        >
                                            يسار (Left)
                                        </button>
                                        <button 
                                            onClick={() => setAlphaMode('bottom')}
                                            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${alphaMode === 'bottom' ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}
                                        >
                                            أسفل (Bottom)
                                        </button>
                                    </div>

                                    <button 
                                        onClick={() => fileInputRef.current?.click()} 
                                        className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-xl text-xs transition-all font-bold flex items-center gap-1.5"
                                    >
                                        <Upload className="w-3.5 h-3.5" /> رفع ملف آخر
                                    </button>
                                </div>
                            </div>

                            <div className="w-full aspect-video bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2ZmZiI+PC9yZWN0Pgo8cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNlNmU2ZTYiPjwvcmVjdD4KPHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNlNmU2ZTYiPjwvcmVjdD4KPC9zdmc+')] bg-repeat rounded-2xl overflow-hidden border border-slate-700 relative shadow-inner flex items-center justify-center">
                                <VapPlayer 
                                    src={activeFile.url} 
                                    alphaMode={alphaMode} 
                                    width={800} 
                                    height={450} 
                                    className="w-full h-full" 
                                />
                            </div>

                            {/* Active file tab switcher if multiple files */}
                            {files.length > 1 && (
                                <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
                                    {files.map((f, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setActiveIndex(idx)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all truncate max-w-[150px] ${
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
                        </div>

                        {/* File Info Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 flex flex-col">
                                <span className="text-slate-400 text-xs uppercase font-bold">حجم الملف</span>
                                <span className="font-black text-lg text-slate-100">{(activeFile.file.size / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 flex flex-col">
                                <span className="text-slate-400 text-xs uppercase font-bold">الأبعاد (العرض × الارتفاع)</span>
                                <span className="font-black text-lg text-slate-100">{activeFile.metadata?.info?.w || 0} × {activeFile.metadata?.info?.h || 0}</span>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 flex flex-col">
                                <span className="text-slate-400 text-xs uppercase font-bold">معدل الإطارات / الإجمالي</span>
                                <span className="font-black text-lg text-slate-100">{activeFile.metadata?.info?.fps || 30} FPS / {activeFile.metadata?.info?.f || 0}</span>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 flex flex-col">
                                <span className="text-slate-400 text-xs uppercase font-bold">العناصر الديناميكية</span>
                                <span className="font-black text-lg text-slate-100">{activeFile.metadata?.src?.length || 0}</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Audio Manager & Export Controls */}
                    <div className="flex flex-col gap-6">
                        {/* Audio Manager */}
                        <div className="bg-slate-800/50 rounded-3xl p-6 border border-slate-700 shadow-xl">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <Music className="w-5 h-5 text-orange-400"/> نظام الصوت المدمج
                                </h3>
                                {customAudioFile && (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-bold text-emerald-300">
                                        تم تحديد صوت مخصص
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
                                                onClick={toggleAudioPlayback} 
                                                className="p-2 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 transition-colors"
                                                title={isAudioPlaying ? 'إيقاف مؤقت' : 'تشغيل الصوت'}
                                            >
                                                {isAudioPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                            </button>
                                            <button 
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

                            {/* Action Buttons */}
                            <div className="flex flex-col gap-2.5">
                                <button 
                                    onClick={() => audioInputRef.current?.click()}
                                    className="w-full py-3 bg-gradient-to-r from-orange-600/30 to-amber-600/30 hover:from-orange-600/40 hover:to-amber-600/40 border border-orange-500/40 rounded-xl font-bold flex items-center justify-center gap-2 text-xs text-orange-200 transition-all shadow-sm"
                                >
                                    <Upload className="w-4 h-4 text-orange-400" /> 
                                    {customAudioFile ? 'استبدال ملف الصوت الحالي' : 'إضافة مسار صوتي جديد (MP3 / WAV / AAC)'}
                                </button>
                                
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={() => setIsAudioMuted(!isAudioMuted)} 
                                        className={`py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 text-xs transition-all border ${
                                            isAudioMuted 
                                                ? 'bg-red-500/20 text-red-300 border-red-500/40 shadow-sm' 
                                                : 'bg-slate-700/50 hover:bg-slate-700 text-slate-300 border-slate-600/50'
                                        }`}
                                    >
                                        {isAudioMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />} 
                                        {isAudioMuted ? 'الصوت مكتوم 🔇' : 'كتم الصوت'}
                                    </button>

                                    <button 
                                        onClick={handleExtractAudio} 
                                        disabled={isExtractingAudio} 
                                        className="py-2.5 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 rounded-xl font-bold flex items-center justify-center gap-1.5 text-xs text-emerald-300 disabled:opacity-50 transition-all"
                                    >
                                        <Download className="w-3.5 h-3.5 text-emerald-400" /> 
                                        {isExtractingAudio ? 'جاري الاستخراج...' : 'استخراج MP3'}
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

                        {/* Export Panel */}
                        <div className="bg-slate-800/50 rounded-3xl p-6 border border-slate-700 shadow-xl flex-1 flex flex-col justify-between">
                            <div>
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <Download className="w-5 h-5 text-emerald-400"/> التحويل والتصدير مع الصوت
                                </h3>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">الصيغة المطلوبة للتصدير</label>
                                        <select 
                                            value={selectedFormat} 
                                            onChange={(e) => setSelectedFormat(e.target.value)} 
                                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 font-bold text-sm text-slate-200 outline-none focus:border-indigo-500 transition-colors"
                                        >
                                            <option value="VAP (ملف VAP شفاف مع الصوت)">VAP (ملف VAP شفاف مع الصوت المدمج) - افتراضي</option>
                                            <option value="VAP (.vap) - مخصص لـ flutter_vap">VAP (.vap) - مخصص لحزم Flutter VAP</option>
                                            <option value="MP4 (فيديو مدمج مع الصوت)">MP4 (فيديو مدمج عالي الدقة مع الصوت)</option>
                                            <option value="SVGA 2.0">SVGA 2.0 (متحرك تفاعلي)</option>
                                            <option value="WebM (Transparent)">WebM (فيديو شفاف VP9 مع الصوت)</option>
                                        </select>
                                    </div>

                                    {/* VAP Compression toggle */}
                                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-700/60">
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4 text-indigo-400" />
                                            <span className="text-xs font-bold text-slate-300">ضغط VAP الذكي لتقليل الحجم</span>
                                        </div>
                                        <button 
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
                                                <span className="text-indigo-400">{exportProgress}%</span>
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
                                            <span>تم إنشاء وتنزيل ملف {selectedFormat.includes('VAP') ? 'VAP' : 'الفيديو'} بنجاح!</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button 
                                onClick={handleExport} 
                                disabled={isExporting} 
                                className="w-full py-4 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 rounded-2xl font-black text-base shadow-xl shadow-indigo-500/20 transform hover:-translate-y-0.5 transition-all mt-6 flex items-center justify-center gap-2 text-white"
                            >
                                {isExporting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />} 
                                {isExporting ? (exportPhase || 'جاري التصدير...') : 'تصدير وتحميل ملف VAP الآن'}
                            </button>
                        </div>
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
