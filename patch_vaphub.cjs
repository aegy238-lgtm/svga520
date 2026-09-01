const fs = require('fs');
let content = fs.readFileSync('src/components/VapHub.tsx', 'utf8');

const importStatement = "import { convertVapToSvga } from '../utils/svgaExporter';\n";
content = content.replace("import { logActivity } from '../utils/logger';", "import { logActivity } from '../utils/logger';\n" + importStatement);

const handleExportReplacement = `
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
                        a.download = activeFile.file.name.replace(/\.[^/.]+$/, "") + '.webm';
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
                a.download = activeFile.file.name.replace(/\.[^/.]+$/, "") + '.svga';
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
`;

// we need to add setExportPhase state if it doesn't exist
if (!content.includes('const [exportPhase, setExportPhase]')) {
    content = content.replace(
        'const [isExporting, setIsExporting] = useState(false);',
        'const [isExporting, setIsExporting] = useState(false);\n    const [exportPhase, setExportPhase] = useState("");'
    );
}

content = content.replace(/const handleExport = async \(\) => \{[\s\S]*?(?=return \()/g, handleExportReplacement + '\n\n    ');

// update UI to show exportPhase
content = content.replace(
    "{isExporting ? 'جاري التحويل والتصدير...' : 'Start Conversion'}",
    "{isExporting ? (exportPhase || 'جاري التحويل...') : 'Start Conversion'}"
);


fs.writeFileSync('src/components/VapHub.tsx', content);
