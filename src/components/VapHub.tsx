import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Play, Pause, Settings, Download, Music, Image as ImageIcon, Type, Activity, RefreshCw, Layers } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { VapPlayer } from './VapPlayer';
import { parseVapMetadata } from '../utils/vapParser';
import { extractAudioFromVap } from '../utils/vapFFmpeg';
import { convertVapToSvga } from '../utils/svgaExporter';

export const VapHub: React.FC = () => {
    const [files, setFiles] = useState<{file: File, url: string, metadata: any, status: string}[]>([]);
    const [activeIndex, setActiveIndex] = useState<number>(0);
    const [selectedFormat, setSelectedFormat] = useState<string>('VAP (Original)');
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [exportPhase, setExportPhase] = useState<string>('');
    const [isExtractingAudio, setIsExtractingAudio] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const activeFile = files[activeIndex];

    
    const handleExport = async () => {
        if (!activeFile) return;
        setIsExporting(true);
        setExportPhase("جاري التحضير...");

        try {
            if (selectedFormat === 'VAP (Original)') {
                const a = document.createElement('a');
                a.href = activeFile.url;
                a.download = activeFile.file.name;
                a.click();
                setIsExporting(false);
            } else if (selectedFormat === 'WebM (Transparent)' || selectedFormat === 'MP4 (Alpha Background)') {
                // Since true transparent MP4 isn't widely supported, we default to WebM for transparency
                // To do this, we need to capture the canvas stream from the VapPlayer
                const canvas = document.querySelector('.vap-player-canvas') as HTMLCanvasElement;
                if (!canvas) {
                    alert('خطأ: لم يتم العثور على مشغل الفيديو للالتقاط. جاري تحميل الملف الأصلي.');
                    const a = document.createElement('a');
                    a.href = activeFile.url;
                    a.download = activeFile.file.name;
                    a.click();
                    setIsExporting(false);
                } else {
                    const stream = canvas.captureStream(30);
                    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
                    const chunks: Blob[] = [];
                    recorder.ondataavailable = e => chunks.push(e.data);
                    recorder.onstop = () => {
                        const blob = new Blob(chunks, { type: 'video/webm' });
                        const a = document.createElement('a');
                        a.href = URL.createObjectURL(blob);
                        a.download = activeFile.file.name.replace(/.[^/.]+$/, "") + '.webm';
                        a.click();
                        setIsExporting(false);
                    };
                    recorder.start();
                    const durationMs = (activeFile.metadata?.info?.f / activeFile.metadata?.info?.fps) * 1000 || 5000;
                    
                    // Restart video for recording
                    const video = document.querySelector('video[src="' + activeFile.url + '"]') as HTMLVideoElement;
                    if (video) {
                        video.currentTime = 0;
                        video.play();
                    }

                    setTimeout(() => {
                        recorder.stop();
                    }, durationMs + 500); // Record full duration + small buffer
                }
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
                    setExportPhase(ph);
                });
                
                const a = document.createElement('a');
                a.href = URL.createObjectURL(svgaBlob);
                a.download = activeFile.file.name.replace(/.[^/.]+$/, "") + '.svga';
                a.click();
                setIsExporting(false);
            } else {
                alert('عذراً، التصدير لهذه الصيغة يتم حالياً من خلال "Universal Motion Tools" (المحول الشامل) بالمنصة. سيتم إضافة التحويل المباشر قريباً.');
                setIsExporting(false);
            }
        } catch (error: any) {
            console.error("Export Error:", error);
            alert("حدث خطأ أثناء التصدير: " + error.message);
            setIsExporting(false);
        }
    };


    return (
        <div className="flex flex-col items-center w-full min-h-screen text-white font-sans pt-6 px-4">
            <h1 className="text-3xl md:text-4xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">VAP Processing Hub</h1>
            <p className="text-slate-400 mb-8 font-arabic text-sm">نظام متكامل لمعالجة وتحويل وتشغيل ملفات VAP الشفافة</p>
            
            {files.length === 0 ? (
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full max-w-2xl h-64 border-2 border-dashed border-slate-600 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-800/50 hover:border-indigo-500 transition-all"
                >
                    <Upload className="w-12 h-12 text-slate-400 mb-4" />
                    <p className="text-lg font-bold">اضغط هنا أو اسحب ملفات VAP</p>
                    <p className="text-sm text-slate-500 mt-2">يدعم اكتشاف العناصر الديناميكية والصوت تلقائياً</p>
                </div>
            ) : (
                <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Panel: Preview & Info */}
                    <div className="lg:col-span-2 flex flex-col gap-6">
                        <div className="bg-slate-800/50 rounded-3xl p-6 border border-slate-700 shadow-xl relative overflow-hidden">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold flex items-center gap-2"><Play className="w-5 h-5 text-indigo-400"/> معاينة VAP</h2>
                                <button onClick={() => fileInputRef.current?.click()} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl text-sm transition-all font-bold">رفع ملف آخر</button>
                            </div>
                            <div className="w-full aspect-video bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2ZmZiI+PC9yZWN0Pgo8cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNlNmU2ZTYiPjwvcmVjdD4KPHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNlNmU2ZTYiPjwvcmVjdD4KPC9zdmc+')] bg-repeat rounded-2xl overflow-hidden border border-slate-700 relative shadow-inner">
                                <VapPlayer src={activeFile.url} alphaMode="right" width={800} height={450} className="w-full h-full" />
                            </div>
                        </div>

                        {/* File Info */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 flex flex-col">
                                <span className="text-slate-400 text-xs uppercase">File Size</span>
                                <span className="font-bold">{(activeFile.file.size / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 flex flex-col">
                                <span className="text-slate-400 text-xs uppercase">Dimensions</span>
                                <span className="font-bold">{activeFile.metadata?.info?.w || 0}x{activeFile.metadata?.info?.h || 0}</span>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 flex flex-col">
                                <span className="text-slate-400 text-xs uppercase">FPS / Frames</span>
                                <span className="font-bold">{activeFile.metadata?.info?.fps || 30} / {activeFile.metadata?.info?.f || 0}</span>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 flex flex-col">
                                <span className="text-slate-400 text-xs uppercase">Dynamic Elements</span>
                                <span className="font-bold">{activeFile.metadata?.src?.length || 0}</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Controls & Export */}
                    <div className="flex flex-col gap-6">
                        {/* Dynamic Elements */}
                        {activeFile.metadata?.src && activeFile.metadata.src.length > 0 && (
                            <div className="bg-slate-800/50 rounded-3xl p-6 border border-slate-700 shadow-xl">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Layers className="w-5 h-5 text-emerald-400"/> العناصر الديناميكية</h3>
                                <div className="flex flex-col gap-3">
                                    {activeFile.metadata.src.map((srcItem: any, i: number) => (
                                        <div key={i} className="bg-slate-900/50 p-3 rounded-xl border border-slate-700 flex items-center gap-3">
                                            {srcItem.srcType === 'img' ? <ImageIcon className="w-5 h-5 text-blue-400" /> : <Type className="w-5 h-5 text-pink-400" />}
                                            <div className="flex-1">
                                                <p className="text-sm font-bold">{srcItem.srcId}</p>
                                                <p className="text-xs text-slate-400">{srcItem.srcType}</p>
                                            </div>
                                            <button className="px-3 py-1 bg-indigo-600/20 text-indigo-400 text-xs rounded-lg hover:bg-indigo-600/40">تعديل</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Audio Manager */}
                        <div className="bg-slate-800/50 rounded-3xl p-6 border border-slate-700 shadow-xl">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Music className="w-5 h-5 text-orange-400"/> نظام الصوت</h3>
                            <div className="flex flex-col gap-3">
                                <button className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 text-sm">
                                    <Upload className="w-4 h-4" /> إضافة أو استبدال الصوت
                                </button>
                                <button className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 text-sm text-red-400">
                                    <X className="w-4 h-4" /> كتم الصوت
                                </button>
                                <button onClick={handleExtractAudio} disabled={isExtractingAudio} className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 text-sm text-emerald-400 disabled:opacity-50">
                                    <Download className="w-4 h-4" /> {isExtractingAudio ? 'جاري الاستخراج...' : 'استخراج الصوت (MP3)'}
                                </button>
                            </div>
                        </div>

                        {/* Export Panel */}
                        <div className="bg-slate-800/50 rounded-3xl p-6 border border-slate-700 shadow-xl flex-1">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Download className="w-5 h-5 text-emerald-400"/> التحويل والتصدير</h3>
                            
                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">الصيغة المطلوبة</label>
                            <select value={selectedFormat} onChange={(e) => setSelectedFormat(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 mb-4 font-bold outline-none focus:border-indigo-500">
                                <option>VAP (Original)</option>
                                <option>SVGA 2.0</option>
                                <option>SVGA → YYEVA</option>
                                <option>MP4 (Alpha Background)</option>
                                <option>WebM (Transparent)</option>
                                <option>GIF (Animation)</option>
                            </select>

                            <button onClick={handleExport} disabled={isExporting} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 rounded-2xl font-black text-lg shadow-xl shadow-indigo-500/20 transform hover:-translate-y-1 transition-all mt-auto flex items-center justify-center gap-2">
                                {isExporting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Activity className="w-5 h-5" />} {isExporting ? (exportPhase || 'جاري التحويل...') : 'Start Conversion'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            <input type="file" ref={fileInputRef} className="hidden" multiple accept=".mp4,.vap" onChange={handleUpload} />
        </div>
    );
};
