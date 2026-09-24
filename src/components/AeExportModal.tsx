import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Download, Sparkles, CheckCircle2, AlertCircle, FileCode, 
  Layers, Play, Sliders, Zap, Film, Image as ImageIcon, Music,
  Check, ArrowDownToLine, Copy, ExternalLink, HelpCircle, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  analyzeSvgaForAE, 
  generateAEProject, 
  AEProjectAnalysis, 
  AEExportResult, 
  AEExportOptions 
} from '../services/aeExportService';
import { downloadDesignerInfoFile } from '../utils/designerInfo';

interface AeExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: any;
  sprites: any[];
  imagesData: { [key: string]: Uint8Array };
  previewBg?: string | null;
  audioFile?: File | null;
  audioUrl?: string | null;
  bgPos?: { x: number; y: number };
  bgScale?: number;
  onSuccessToast?: (msg: string) => void;
}

export const AeExportModal: React.FC<AeExportModalProps> = ({
  isOpen,
  onClose,
  metadata,
  sprites,
  imagesData,
  previewBg,
  audioFile,
  audioUrl,
  bgPos,
  bgScale,
  onSuccessToast
}) => {
  // Analysis state
  const [analysis, setAnalysis] = useState<AEProjectAnalysis | null>(null);

  // Settings
  const [keyframeMode, setKeyframeMode] = useState<'all_frames' | 'optimized'>('all_frames');
  const [activeTab, setActiveTab] = useState<'overview' | 'layers' | 'guide'>('overview');

  // Export progress & results
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [exportResult, setExportResult] = useState<AEExportResult | null>(null);
  const [copiedJsx, setCopiedJsx] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Progress steps array matching user requirement
  const PROGRESS_STAGES = [
    "Analyzing SVGA 2.0...",
    "Reading Layers...",
    "Reading Animation...",
    "Converting Keyframes...",
    "Preparing Assets...",
    "Creating After Effects Project...",
    "Project Ready"
  ];

  // Perform deep analysis when modal opens
  useEffect(() => {
    if (isOpen && metadata && sprites) {
      const result = analyzeSvgaForAE(metadata, sprites, imagesData, !!(audioFile || audioUrl));
      setAnalysis(result);
      setExportResult(null);
      setCurrentStage('');
      setProgressPercent(0);
      setErrorMessage(null);
    }
  }, [isOpen, metadata, sprites, imagesData, audioFile, audioUrl]);

  if (!isOpen) return null;

  const handleStartExport = async () => {
    setIsExporting(true);
    setErrorMessage(null);
    setCurrentStage(PROGRESS_STAGES[0]);
    setProgressPercent(10);

    try {
      const origW = Number(
        metadata.videoItem?.videoSize?.width || 
        metadata.params?.viewBoxWidth || 
        metadata.videoSize?.width || 
        metadata.width || 
        metadata.originalWidth || 
        500
      );
      const origH = Number(
        metadata.videoItem?.videoSize?.height || 
        metadata.params?.viewBoxHeight || 
        metadata.videoSize?.height || 
        metadata.height || 
        metadata.originalHeight || 
        500
      );

      const options: AEExportOptions = {
        keyframeMode,
        anchorMode: 'svga_origin',
        interpolationMode: 'auto_ease'
      };

      const result = await generateAEProject({
        metadata,
        originalWidth: origW,
        originalHeight: origH,
        sprites,
        imagesData,
        previewBg,
        audioFile,
        audioUrl,
        bgPos,
        bgScale,
        options,
        onProgressStage: (stage, percent) => {
          setCurrentStage(stage);
          setProgressPercent(percent);
        },
        setProgress: setProgressPercent
      });

      setExportResult(result);
      if (onSuccessToast) {
        onSuccessToast(`🎉 After Effects Project Ready: ${result.zipFileName}`);
      }
    } catch (err: any) {
      console.error("AE Export error:", err);
      setErrorMessage(err.message || "Failed to generate After Effects project");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadZip = () => {
    if (!exportResult) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(exportResult.zipBlob);
    link.download = exportResult.zipFileName;
    link.click();
    downloadDesignerInfoFile(exportResult.zipFileName, {
      format: 'Adobe After Effects Project (ZIP)',
      fps: metadata?.fps,
      frames: metadata?.frames
    });
  };

  const handleDownloadJsx = async () => {
    let content = exportResult?.jsxContent;
    let baseName = exportResult?.baseFileName || (metadata?.name || metadata?.fileName || "SVGA_Project").replace(/\.[^/.]+$/, "");
    if (!content) {
      const origW = Number(metadata.videoItem?.videoSize?.width || metadata.width || metadata.originalWidth || 500);
      const origH = Number(metadata.videoItem?.videoSize?.height || metadata.height || metadata.originalHeight || 500);
      const res = await generateAEProject({
        metadata,
        originalWidth: origW,
        originalHeight: origH,
        sprites,
        imagesData,
        previewBg,
        audioFile,
        audioUrl,
        bgPos,
        bgScale
      });
      content = res.jsxContent;
      baseName = res.baseFileName;
    }
    const blob = new Blob([content], { type: 'text/javascript;charset=utf-8' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${baseName}.jsx`;
    link.click();
  };

  const handleCopyJsx = () => {
    if (!exportResult) return;
    navigator.clipboard.writeText(exportResult.jsxContent);
    setCopiedJsx(true);
    setTimeout(() => setCopiedJsx(false), 2500);
  };

  const handleDownloadJson = () => {
    if (!exportResult) return;
    const blob = new Blob([JSON.stringify(exportResult.jsonData, null, 2)], { type: 'application/json' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `SVGA2_Project_Data.json`;
    link.click();
  };

  const getStageIndex = (stage: string) => {
    const idx = PROGRESS_STAGES.findIndex(s => stage.includes(s.split('.')[0]));
    return idx === -1 ? 0 : idx;
  };

  const currentStageIdx = getStageIndex(currentStage);

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-indigo-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-glow-indigo">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-white font-black text-lg tracking-wide">
                  Export to Adobe After Effects
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-sm">
                  SVGA 2.0 Engine
                </span>
              </div>
              <p className="text-slate-400 text-xs font-medium mt-0.5">
                تحويل ملف SVGA 2.0 إلى مشروع After Effects حقيقي وقابل للتعديل بكامل الطبقات والكي فريمز
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleDownloadJsx}
              className="px-3.5 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 hover:text-white border border-indigo-500/40 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
              title="تحميل ملف السكريبت (.jsx) فقط مباشرة"
            >
              <FileCode className="w-3.5 h-3.5 text-indigo-400" />
              <span>تحميل السكريبت (.jsx)</span>
            </button>

            <button 
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-white/5 bg-slate-950/30 text-xs font-bold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-3 border-b-2 transition-all ${
              activeTab === 'overview'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            نظرة عامة ومواصفات المشروع
          </button>
          <button
            onClick={() => setActiveTab('layers')}
            className={`pb-3 px-3 border-b-2 transition-all ${
              activeTab === 'layers'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            تحليل الطبقات ({analysis?.layersCount || 0})
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`pb-3 px-3 border-b-2 transition-all ${
              activeTab === 'guide'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            دليل الاستيراد في After Effects
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Specification Grid */}
              <div className="bg-slate-950/50 rounded-2xl border border-white/5 p-5">
                <h4 className="text-slate-300 text-xs font-black uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  مواصفات المشهد (Composition Specifications)
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <span className="text-[10px] text-slate-400 uppercase block mb-1">Source (المصدر)</span>
                    <span className="text-sm font-black text-indigo-300">SVGA 2.0</span>
                  </div>

                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <span className="text-[10px] text-slate-400 uppercase block mb-1">Resolution (الأبعاد)</span>
                    <span className="text-sm font-black text-white">
                      {analysis?.width || 500} × {analysis?.height || 500}
                    </span>
                  </div>

                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <span className="text-[10px] text-slate-400 uppercase block mb-1">FPS (معدل الإطارات)</span>
                    <span className="text-sm font-black text-purple-300">
                      {analysis?.fps || 30} FPS
                    </span>
                  </div>

                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <span className="text-[10px] text-slate-400 uppercase block mb-1">Duration & Frames</span>
                    <span className="text-sm font-black text-emerald-300">
                      {analysis?.totalFrames || 0} f ({analysis?.durationSec || 0}s)
                    </span>
                  </div>
                </div>

                {/* Badges / Detections matching Point 18 */}
                <div className="flex flex-wrap gap-2.5 mt-4 pt-4 border-t border-white/5">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold">
                    <Zap className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Animation: Detected</span>
                  </div>

                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Keyframes: Detected ({analysis?.totalKeyframesEstimate || 0})</span>
                  </div>

                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs font-bold">
                    <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                    <span>Assets: Detected ({analysis?.imagesCount || 0} Images)</span>
                  </div>

                  {analysis?.hasAudio && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-300 text-xs font-bold">
                      <Music className="w-3.5 h-3.5 text-pink-400" />
                      <span>Audio: Detected</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-bold">
                    <Layers className="w-3.5 h-3.5 text-purple-400" />
                    <span>Layers: {analysis?.layersCount || 0}</span>
                  </div>
                </div>
              </div>

              {/* Conversion Settings */}
              <div className="bg-slate-950/50 rounded-2xl border border-white/5 p-5 space-y-4">
                <h4 className="text-slate-300 text-xs font-black uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  خيارات التصدير والكي فريمز (Export Options)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => setKeyframeMode('all_frames')}
                    className={`p-3.5 rounded-xl border text-right transition-all flex flex-col gap-1 ${
                      keyframeMode === 'all_frames'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-glow-indigo'
                        : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white">Frame-by-Frame (دقة 100% متطابقة)</span>
                      {keyframeMode === 'all_frames' && <Check className="w-4 h-4 text-indigo-400" />}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      توليد Keyframe لكل إطار بالتمام، تطابق تام مع حركة SVGA الأصلية.
                    </span>
                  </button>

                  <button
                    onClick={() => setKeyframeMode('optimized')}
                    className={`p-3.5 rounded-xl border text-right transition-all flex flex-col gap-1 ${
                      keyframeMode === 'optimized'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-glow-indigo'
                        : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white">Smart Optimized (مبسّطة وسهلة التعديل)</span>
                      {keyframeMode === 'optimized' && <Check className="w-4 h-4 text-indigo-400" />}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      حذف الكي فريمز المتكررة في فترات الثبات لتسهيل التعديل على التايم لاين.
                    </span>
                  </button>
                </div>
              </div>

              {/* Progress & Stages Box (Always shown when exporting or completed) */}
              {(isExporting || exportResult) && (
                <div className="bg-slate-950/80 rounded-2xl border border-indigo-500/20 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-300">
                      {isExporting ? 'جاري التحويل والتجهيز...' : '🎉 تم تجهيز مشروع After Effects بنجاح!'}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-400">
                      {progressPercent}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>

                  {/* Step by step list matching user request */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-2">
                    {PROGRESS_STAGES.map((stage, idx) => {
                      const isPast = currentStageIdx > idx || exportResult !== null;
                      const isCurrent = currentStageIdx === idx && isExporting;
                      return (
                        <div 
                          key={stage}
                          className={`flex items-center gap-2 p-2 rounded-lg transition-all ${
                            isPast 
                              ? 'text-emerald-400 bg-emerald-500/5' 
                              : isCurrent 
                              ? 'text-indigo-300 bg-indigo-500/10 font-bold' 
                              : 'text-slate-500'
                          }`}
                        >
                          {isPast ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : isCurrent ? (
                            <div className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                          )}
                          <span>{stage}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Error Box */}
              {errorMessage && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Results & Download Section */}
              {exportResult && (
                <div className="bg-gradient-to-br from-indigo-950/40 to-slate-950 p-6 rounded-2xl border border-indigo-500/30 space-y-4">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h4 className="text-white font-black text-sm mb-1">
                        📦 حزمة مشروع After Effects الكاملة جاهزة للتحميل
                      </h4>
                      <p className="text-slate-400 text-xs">
                        تحتوي الحزمة على كود السكريبت (.jsx)، ملفات الصور (.png)، مجلد Data الوسيط، وملف README.
                      </p>
                    </div>

                    <button
                      onClick={handleDownloadZip}
                      className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white text-xs font-black rounded-xl shadow-glow-emerald flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download After Effects Project (.zip)</span>
                    </button>
                  </div>

                  {/* Secondary Quick Actions */}
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-white/10">
                    <button
                      onClick={handleCopyJsx}
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      {copiedJsx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedJsx ? 'تم نسخ كود ExtendScript' : 'Copy AE Script (.jsx)'}</span>
                    </button>

                    <button
                      onClick={handleDownloadJsx}
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      <FileCode className="w-3.5 h-3.5 text-purple-400" />
                      <span>Download .jsx Script</span>
                    </button>

                    <button
                      onClick={handleDownloadJson}
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5 text-sky-400" />
                      <span>Download Intermediate Data (.json)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Layers Breakdown Tab */}
          {activeTab === 'layers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  تفاصيل الطبقات التي تم التعرف عليها واستخراجها لإنشائها داخل After Effects:
                </span>
                <span className="text-xs font-bold text-indigo-400">
                  إجمالي الطبقات: {analysis?.layersCount || 0}
                </span>
              </div>

              <div className="border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5 bg-slate-950/40">
                {analysis?.layerSummary.map((layer) => (
                  <div key={layer.index} className="p-3.5 flex items-center justify-between text-xs hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-slate-500 w-6">#{layer.index + 1}</span>
                      <div className="flex items-center gap-2">
                        {layer.type === 'image' ? (
                          <ImageIcon className="w-4 h-4 text-sky-400" />
                        ) : (
                          <Layers className="w-4 h-4 text-purple-400" />
                        )}
                        <span className="text-white font-bold">{layer.name}</span>
                      </div>
                      {layer.hasMatte && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                          Alpha Matte
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-slate-400 text-[11px]">
                      <span>Keyframes: <strong className="text-indigo-300">{layer.keyframeCount}</strong></span>
                      <span>In/Out: <strong className="text-emerald-300">{layer.inFrame}f - {layer.outFrame}f</strong></span>
                    </div>
                  </div>
                ))}
              </div>

              {analysis?.unsupportedEffects && analysis.unsupportedEffects.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-2">
                    <HelpCircle className="w-4 h-4" />
                    ملاحظات التوافقية (Compatibility Notes):
                  </div>
                  <ul className="list-disc list-inside text-slate-300 text-[11px] space-y-0.5">
                    {analysis.unsupportedEffects.map((eff, i) => (
                      <li key={i}>{eff}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Guide Tab */}
          {activeTab === 'guide' && (
            <div className="space-y-6 text-xs text-slate-300">
              <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 space-y-3">
                <h4 className="text-white font-black text-sm flex items-center gap-2">
                  <Film className="w-4 h-4 text-indigo-400" />
                  خطوات تشغيل المشروع في Adobe After Effects (3 خطوات بسيطة)
                </h4>
                <ol className="space-y-2.5 list-decimal list-inside text-slate-300 text-xs">
                  <li>قم بتحميل ملف الـ ZIP واستخراجه في مجلد عادي على جهازك.</li>
                  <li>افتح برنامج Adobe After Effects (من إصدار CC 2018 حتى CC 2025).</li>
                  <li>من القائمة العلوية، اختر: <strong>File &gt; Scripts &gt; Run Script File...</strong> (أو ملف &gt; نصوص برمجية).</li>
                  <li>اختر الملف الذي ينتهي بـ <strong>.jsx</strong> من المجلد المستخرج.</li>
                  <li>اضغط <strong>Yes</strong> لبناء المشهد فوراً، وسيقوم السكريبت باستيراد الصور وإنشاء الطبقات وتطبيق الكي فريمز تلقائياً!</li>
                </ol>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/50 border border-white/5 space-y-2">
                <h5 className="text-white font-bold text-xs">نصيحة هامة لإعدادات After Effects:</h5>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  تأكد من تفعيل صلاحية تشغيل السكريبتات من إعدادات البرنامج:
                  <br />
                  <strong>Edit &gt; Preferences &gt; Scripting &amp; Expressions &gt; Check &quot;Allow Scripts to Write Files and Access Network&quot;</strong>.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/10 bg-slate-950/60 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all text-xs font-bold"
          >
            إغلاق
          </button>

          {!exportResult ? (
            <button
              onClick={handleStartExport}
              disabled={isExporting}
              className="px-7 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-500 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black rounded-xl shadow-glow-indigo flex items-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  <span>{currentStage || 'جاري التصدير...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Start Export (بدء التصدير إلى After Effects)</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleDownloadZip}
              className="px-7 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-glow-emerald flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>تحميل المشروع مرة أخرى (.zip)</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
