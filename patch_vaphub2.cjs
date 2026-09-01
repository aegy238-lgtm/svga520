const fs = require('fs');
let content = fs.readFileSync('src/components/VapHub.tsx', 'utf8');

content = content.replace(
    "const [activeIndex, setActiveIndex] = useState<number>(0);",
    "const [activeIndex, setActiveIndex] = useState<number>(0);\n    const [selectedFormat, setSelectedFormat] = useState<string>('VAP (Original)');\n    const [isExporting, setIsExporting] = useState<boolean>(false);"
);

content = content.replace(
    `<div className="w-full aspect-video bg-black rounded-2xl overflow-hidden border border-slate-700 relative">`,
    `<div className="w-full aspect-video bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2ZmZiI+PC9yZWN0Pgo8cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNlNmU2ZTYiPjwvcmVjdD4KPHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNlNmU2ZTYiPjwvcmVjdD4KPC9zdmc+')] bg-repeat rounded-2xl overflow-hidden border border-slate-700 relative shadow-inner">`
);

const handleExportCode = `
    const handleExport = async () => {
        if (!activeFile) return;
        setIsExporting(true);
        try {
            if (selectedFormat === 'VAP (Original)') {
                const a = document.createElement('a');
                a.href = activeFile.url;
                a.download = activeFile.file.name;
                a.click();
            } else if (selectedFormat === 'WebM (Transparent)' || selectedFormat === 'MP4 (Alpha Background)') {
                // Since true transparent MP4 isn't widely supported, we default to WebM for transparency
                // To do this, we need to capture the canvas stream from the VapPlayer
                const canvas = document.querySelector('.vap-player-canvas') as HTMLCanvasElement;
                if (!canvas) {
                    // Fallback to downloading the original VAP if canvas not found easily
                    alert('خطأ: لم يتم العثور على مشغل الفيديو للالتقاط. جاري تحميل الملف الأصلي.');
                    const a = document.createElement('a');
                    a.href = activeFile.url;
                    a.download = activeFile.file.name;
                    a.click();
                } else {
                    const stream = canvas.captureStream(30);
                    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
                    const chunks: Blob[] = [];
                    recorder.ondataavailable = e => chunks.push(e.data);
                    recorder.onstop = () => {
                        const blob = new Blob(chunks, { type: 'video/webm' });
                        const a = document.createElement('a');
                        a.href = URL.createObjectURL(blob);
                        a.download = activeFile.file.name.replace(/\\.[^/.]+$/, "") + '.webm';
                        a.click();
                        setIsExporting(false);
                    };
                    recorder.start();
                    
                    // We need to trigger play on the video to start capturing
                    const video = document.querySelector('video') as HTMLVideoElement;
                    if (video) {
                        video.currentTime = 0;
                        video.play();
                        setTimeout(() => {
                            recorder.stop();
                        }, (video.duration || 5) * 1000);
                        return; // return early so setIsExporting(false) is called in onstop
                    } else {
                        recorder.stop();
                    }
                }
            } else {
                alert('هذه الصيغة غير مدعومة مباشرة هنا. يُرجى استخدام أداة (Video Converter) للتحويل إلى SVGA أو GIF.');
            }
        } catch (e: any) {
            alert('Error exporting: ' + e.message);
        }
        setIsExporting(false);
    };
`;

content = content.replace(
    "const activeFile = files[activeIndex];",
    `const activeFile = files[activeIndex];\n${handleExportCode}`
);

content = content.replace(
    `<select className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 mb-4 font-bold outline-none focus:border-indigo-500">`,
    `<select value={selectedFormat} onChange={(e) => setSelectedFormat(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 mb-4 font-bold outline-none focus:border-indigo-500">`
);

content = content.replace(
    `<button className="w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 rounded-2xl font-black text-lg shadow-xl shadow-indigo-500/20 transform hover:-translate-y-1 transition-all mt-auto flex items-center justify-center gap-2">
                                <Activity className="w-5 h-5" /> Start Conversion
                            </button>`,
    `<button onClick={handleExport} disabled={isExporting} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 rounded-2xl font-black text-lg shadow-xl shadow-indigo-500/20 transform hover:-translate-y-1 transition-all mt-auto flex items-center justify-center gap-2">
                                {isExporting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Activity className="w-5 h-5" />} {isExporting ? 'جاري التحويل والتصدير...' : 'Start Conversion'}
                            </button>`
);

fs.writeFileSync('src/components/VapHub.tsx', content);
