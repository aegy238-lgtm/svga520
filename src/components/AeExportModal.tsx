import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Download, Sparkles, CheckCircle2, AlertCircle, FileCode, 
  Layers, Play, Sliders, Zap, Film, Image as ImageIcon, Music,
  Check, ArrowDownToLine, Copy, ExternalLink, HelpCircle, ChevronRight,
  Clock, RefreshCw, FileText, CheckCheck, Code, Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  analyzeSvgaForAE, 
  generateAEProject, 
  generateAESyncScript,
  AEProjectAnalysis, 
  AEExportResult, 
  AEExportOptions 
} from '../services/aeExportService';
import { downloadDesignerInfoFile } from '../utils/designerInfo';
import { AeCompositionSettingsModal, CompositionSettingsData } from './AeCompositionSettingsModal';

const PRESET_RESOLUTIONS = [
  { label: '500 × 500 (SVGA قياسي)', width: 500, height: 500 },
  { label: '1080 × 1080 (مربع - إنستغرام)', width: 1080, height: 1080 },
  { label: '1080 × 1920 (عمودي - ريلز/تيك توك/ستوري)', width: 1080, height: 1920 },
  { label: '1920 × 1080 (أفقي - Full HD)', width: 1920, height: 1080 },
  { label: '3840 × 2160 (4K Ultra HD)', width: 3840, height: 2160 },
  { label: '720 × 1280 (عمودي - HD)', width: 720, height: 1280 },
  { label: '750 × 1334 (شاشات / بنر)', width: 750, height: 1334 },
  { label: '512 × 512 (ملصق / استيكر)', width: 512, height: 512 },
  { label: '300 × 300 (أيقونة / شعار)', width: 300, height: 300 },
];

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
  const [activeTab, setActiveTab] = useState<'overview' | 'layers' | 'sync_script' | 'guide'>('overview');

  // Composition Settings State (Matching user requirements & screenshot 1236.png)
  const [compName, setCompName] = useState<string>('Comp 1');
  const [compWidth, setCompWidth] = useState<number>(500);
  const [compHeight, setCompHeight] = useState<number>(500);
  const [compFps, setCompFps] = useState<number>(30);
  const [compTotalFrames, setCompTotalFrames] = useState<number>(90);
  const [compDurationSec, setCompDurationSec] = useState<number>(3.0);
  const [importSvgaDirectly, setImportSvgaDirectly] = useState<boolean>(true);
  const [showCompSettingsModal, setShowCompSettingsModal] = useState<boolean>(false);
  const [isReadingFile, setIsReadingFile] = useState<boolean>(false);

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsReadingFile(true);
    const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/\s+/g, "_");
    setCompName(baseName);

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        setCompWidth(img.naturalWidth || 500);
        setCompHeight(img.naturalHeight || 500);
        setIsReadingFile(false);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } else if (file.name.toLowerCase().endsWith('.svga')) {
      try {
        const { parseSvgaToProject } = await import('./SvgaLayerEditor/svgaParserEngine');
        const proj = await parseSvgaToProject(file);
        if (proj) {
          setCompWidth(proj.width || 500);
          setCompHeight(proj.height || 500);
          setCompFps(proj.fps || 30);
          setCompTotalFrames(proj.totalFrames || 90);
          setCompDurationSec(Number(((proj.totalFrames || 90) / (proj.fps || 30)).toFixed(2)));
        }
      } catch (err) {
        console.error("Failed to parse SVGA in composition settings:", err);
      } finally {
        setIsReadingFile(false);
      }
    } else {
      setIsReadingFile(false);
    }
  };

  // Layer Sync Script State (Integrated & Preserved from AeScriptGenerator)
  const [syncLayersInput, setSyncLayersInput] = useState<string>('');
  const [syncTargetDuration, setSyncTargetDuration] = useState<string>('5.0');
  const [syncUseOriginalDuration, setSyncUseOriginalDuration] = useState<boolean>(false);
  const [syncGeneratedScript, setSyncGeneratedScript] = useState<string>('');
  const [syncCopied, setSyncCopied] = useState<boolean>(false);

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

      setCompWidth(result.width || 500);
      setCompHeight(result.height || 500);
      setCompFps(result.fps || 30);
      setCompTotalFrames(result.totalFrames || 90);
      setCompDurationSec(result.durationSec || 3.0);
      setCompName(metadata?.name ? metadata.name.replace(/\.[^/.]+$/, '').replace(/\s+/g, '_') : 'Comp 1');

      // Preload layer names from SVGA for Layer Sync Script
      if (result.layerSummary && result.layerSummary.length > 0) {
        const names = result.layerSummary.map(l => l.name).filter(Boolean);
        setSyncLayersInput(names.join('\n'));
        const dur = result.durationSec ? result.durationSec.toFixed(1) : '5.0';
        setSyncTargetDuration(dur);
        const script = generateAESyncScript({
          layers: names,
          targetDuration: parseFloat(dur) || 5.0,
          useOriginalDuration: false
        });
        setSyncGeneratedScript(script);
      }
    }
  }, [isOpen, metadata, sprites, imagesData, audioFile, audioUrl]);

  // Live Sync Analysis display with updated comp settings
  useEffect(() => {
    if (analysis) {
      setAnalysis(prev => prev ? {
        ...prev,
        width: compWidth,
        height: compHeight,
        fps: compFps,
        totalFrames: compTotalFrames,
        durationSec: compDurationSec
      } : prev);
    }
  }, [compWidth, compHeight, compFps, compTotalFrames, compDurationSec]);

  const handleGenerateSyncScript = () => {
    const lines = syncLayersInput.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const script = generateAESyncScript({
      layers: lines,
      targetDuration: parseFloat(syncTargetDuration) || 5.0,
      useOriginalDuration: syncUseOriginalDuration
    });
    setSyncGeneratedScript(script);
    return script;
  };

  const handleCopySyncScript = () => {
    const script = syncGeneratedScript || handleGenerateSyncScript();
    navigator.clipboard.writeText(script);
    setSyncCopied(true);
    setTimeout(() => setSyncCopied(false), 2500);
    if (onSuccessToast) onSuccessToast('📋 تم نسخ سكريبت مزامنة الطبقات إلى الحافظة!');
  };

  const handleDownloadSyncScript = () => {
    const script = syncGeneratedScript || handleGenerateSyncScript();
    const baseName = exportResult?.baseFileName || (metadata?.name || metadata?.fileName || "SVGA_Project").replace(/\.[^/.]+$/, "");
    const blob = new Blob([script], { type: 'text/javascript;charset=utf-8' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${baseName}_LayerSync.jsx`;
    link.click();
    if (onSuccessToast) onSuccessToast(`🎉 تم تحميل سكريبت المزامنة: ${baseName}_LayerSync.jsx`);
  };

  const handleFramesChange = (val: number) => {
    const safeFrames = Math.max(1, val);
    setCompTotalFrames(safeFrames);
    const calculatedDur = Math.round((safeFrames / (compFps || 30)) * 100) / 100;
    setCompDurationSec(calculatedDur);
  };

  const handleDurationChange = (val: number) => {
    const safeSec = Math.max(0.1, val);
    setCompDurationSec(safeSec);
    const calculatedFrames = Math.round(safeSec * (compFps || 30));
    setCompTotalFrames(calculatedFrames);
  };

  const handleFpsSelect = (selectedFps: number) => {
    setCompFps(selectedFps);
    const calculatedDur = Math.round((compTotalFrames / selectedFps) * 100) / 100;
    setCompDurationSec(calculatedDur);
  };

  const handleReloadLayersFromSvga = () => {
    if (analysis?.layerSummary && analysis.layerSummary.length > 0) {
      const names = analysis.layerSummary.map(l => l.name).filter(Boolean);
      setSyncLayersInput(names.join('\n'));
      const dur = analysis.durationSec ? analysis.durationSec.toFixed(1) : '5.0';
      setSyncTargetDuration(dur);
      const script = generateAESyncScript({
        layers: names,
        targetDuration: parseFloat(dur) || 5.0,
        useOriginalDuration: syncUseOriginalDuration
      });
      setSyncGeneratedScript(script);
    }
  };

  if (!isOpen) return null;

  const handleStartExport = async (overrideSettings?: Partial<CompositionSettingsData>) => {
    setIsExporting(true);
    setErrorMessage(null);
    setCurrentStage(PROGRESS_STAGES[0]);
    setProgressPercent(10);

    const activeName = overrideSettings?.compName ?? compName;
    const activeW = overrideSettings?.width ?? compWidth;
    const activeH = overrideSettings?.height ?? compHeight;
    const activeFps = overrideSettings?.fps ?? compFps;
    const activeFrames = overrideSettings?.totalFrames ?? compTotalFrames;
    const activeDur = overrideSettings?.durationSec ?? compDurationSec;
    const activeSvgaDirect = overrideSettings?.importSvgaDirectly ?? importSvgaDirectly;

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
        compName: activeName,
        targetWidth: activeW,
        targetHeight: activeH,
        fps: activeFps,
        totalFrames: activeFrames,
        durationSec: activeDur,
        importSvgaDirectly: activeSvgaDirect,
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
        onSuccessToast(`🎉 مشروع After Effects جاهز بالمقاسات والمدة الجديدة: ${result.zipFileName}`);
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
      const options: AEExportOptions = {
        compName,
        targetWidth: compWidth,
        targetHeight: compHeight,
        fps: compFps,
        totalFrames: compTotalFrames,
        durationSec: compDurationSec,
        importSvgaDirectly,
        keyframeMode,
        anchorMode: 'svga_origin',
        interpolationMode: 'auto_ease'
      };
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
        bgScale,
        options
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
              onClick={() => setShowCompSettingsModal(true)}
              className="px-3.5 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 hover:text-white border border-purple-500/40 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
              title="فتح إعدادات الكومبوزيشن والمقاسات والفريمات والمدة الزمنية"
            >
              <Sliders className="w-3.5 h-3.5 text-purple-400" />
              <span>Composition Settings ⚙️</span>
            </button>

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
            onClick={() => {
              setActiveTab('sync_script');
              if (!syncGeneratedScript) handleGenerateSyncScript();
            }}
            className={`pb-3 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'sync_script'
                ? 'border-red-500 text-red-400 font-black'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-red-400" />
            <span>مزامنة وتوليد سكريبت AE (Layer Sync)</span>
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
              
              {/* Specification & Interactive Project Settings Grid */}
              <div className="bg-slate-950/50 rounded-2xl border border-white/5 p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-slate-300 text-xs font-black uppercase tracking-wider flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-400" />
                    تحديد مقاسات ومدة المشروع (Project Composition Setup)
                  </h4>
                  <button
                    onClick={() => setShowCompSettingsModal(true)}
                    className="text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                  >
                    <span>فتح النافذة الشاملة ⚙️</span>
                  </button>
                </div>

                {/* File Upload Dropzone for auto dimensions & naming */}
                <div className="p-4 bg-purple-950/20 hover:bg-purple-950/30 border-2 border-dashed border-purple-500/40 hover:border-purple-400 rounded-2xl flex flex-col items-center justify-center text-center gap-2 transition-all group relative cursor-pointer min-h-[90px]">
                  <input
                    type="file"
                    accept=".svga,image/*"
                    onChange={handleFileImport}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    title=""
                  />
                  {isReadingFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-5 h-5 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
                      <span className="text-[11px] font-bold text-purple-300">جاري قراءة الملف وتحديد المقاسات...</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform" />
                      <div className="text-xs font-black text-purple-200">
                        اسحب وأسقط أو اختر ملف (.svga) أو صورة (.png, .jpg)
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        سيتم قراءة الأبعاد والاسم تلقائياً من الملف المرفوع وتطبيقها فوراً في الإعدادات
                      </div>
                    </>
                  )}
                </div>

                {/* 1. Ordered Standard Preset Resolutions */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-300 block">
                    المقاسات المعتادة القياسية (اختر المقاس المناسب):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PRESET_RESOLUTIONS.map((preset, idx) => {
                      const isSelected = compWidth === preset.width && compHeight === preset.height;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setCompWidth(preset.width);
                            setCompHeight(preset.height);
                          }}
                          className={`p-2.5 rounded-xl text-right transition-all border ${
                            isSelected
                              ? 'bg-purple-600/30 border-purple-500 text-white shadow-glow-indigo'
                              : 'bg-white/[0.03] border-white/5 text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
                          }`}
                        >
                          <div className="font-mono text-xs font-black text-white">{preset.width} × {preset.height} px</div>
                          <div className="text-[10px] text-slate-400 truncate">{preset.label}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Duration in Seconds, FPS, and Total Frames */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/[0.02] p-3.5 rounded-xl border border-white/5">
                  {/* Duration in Seconds */}
                  <div>
                    <label className="text-[11px] font-bold text-emerald-300 block mb-1">
                      مدة المشروع بالثواني (Duration Sec):
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={compDurationSec}
                        onChange={(e) => handleDurationChange(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs font-black text-emerald-300 font-mono focus:border-emerald-500 focus:outline-none"
                      />
                      <span className="absolute left-3 top-2 text-[10px] font-bold text-emerald-400">ثانية</span>
                    </div>
                  </div>

                  {/* FPS */}
                  <div>
                    <label className="text-[11px] font-bold text-purple-300 block mb-1">
                      معدل الفريمات (FPS):
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {[24, 30, 60].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => handleFpsSelect(rate)}
                          className={`py-1.5 rounded-lg text-xs font-black transition-all border ${
                            compFps === rate
                              ? 'bg-purple-600 border-purple-400 text-white'
                              : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
                          }`}
                        >
                          {rate}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Total Frames */}
                  <div>
                    <label className="text-[11px] font-bold text-indigo-300 block mb-1">
                      عدد الفريمات (Total Frames):
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        value={compTotalFrames}
                        onChange={(e) => handleFramesChange(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs font-black text-indigo-300 font-mono focus:border-indigo-500 focus:outline-none"
                      />
                      <span className="absolute left-3 top-2 text-[10px] font-bold text-indigo-400">فريم</span>
                    </div>
                  </div>
                </div>

                {/* 3. Direct SVGA file import toggle */}
                <label className="flex items-center gap-3 p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 cursor-pointer hover:bg-purple-950/40 transition-all">
                  <input
                    type="checkbox"
                    checked={importSvgaDirectly}
                    onChange={(e) => setImportSvgaDirectly(e.target.checked)}
                    className="w-4 h-4 rounded accent-purple-600 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Film className="w-3.5 h-3.5 text-purple-400" />
                      <span>استدعاء وفتح ملفات SVGA تلقائياً داخل After Effects (.svga)</span>
                    </span>
                    <span className="text-[10px] text-slate-400">حفظ واستدعاء ملف الـ SVGA الأصلي والطبقات والكي فريمز داخل مشهد AE</span>
                  </div>
                </label>

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

          {/* Layer Duration Sync Script Tab (Merged & Enhanced from AeScriptGenerator) */}
          {activeTab === 'sync_script' && (
            <div className="space-y-6">
              {/* Introduction Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-red-950/40 via-purple-950/30 to-slate-900 border border-red-500/30 flex items-start gap-4 shadow-lg">
                <div className="p-3 rounded-xl bg-red-600/20 border border-red-500/30 text-red-400 shrink-0">
                  <Clock className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-white font-black text-sm">
                      توليد ومزامنة سكريبت After Effects الاحترافي (Layer Duration Sync)
                    </h4>
                    <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-[10px] font-bold border border-red-500/30">
                      خوارزمية AE الأصلية
                    </span>
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    تقوم هذه الخوارزمية بمطابقة أسماء الطبقات داخل الـ Composition النشط في Adobe After Effects، وتكرارها أو ضبط أوقات البداية والنهاية (In / Out Points) تلقائياً مع معالجة الطبقات المخفية وتجميع الخطوات في مجموعة تراجع واحدة.
                  </p>
                </div>
              </div>

              {/* Grid: Inputs and Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Layers Input */}
                <div className="space-y-3 bg-slate-950/50 p-4 rounded-2xl border border-white/5">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-300 text-xs font-bold flex items-center gap-2">
                      <Layers className="w-4 h-4 text-red-400" />
                      <span>قائمة أسماء الطبقات (اسم الطبقة في كل سطر)</span>
                    </label>
                    <button
                      onClick={handleReloadLayersFromSvga}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 hover:underline"
                      title="إعادة جلب أسماء الطبقات من ملف الـ SVGA الحالي"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>استيراد طبقات SVGA</span>
                    </button>
                  </div>

                  <textarea
                    rows={8}
                    value={syncLayersInput}
                    onChange={(e) => setSyncLayersInput(e.target.value)}
                    placeholder="Layer 1&#10;Layer 2&#10;Layer 3 (hidden)"
                    className="w-full bg-slate-900 text-white font-mono text-xs p-3.5 rounded-xl border border-white/10 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none custom-scrollbar"
                  />

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      إجمالي الطبقات المدخلة: <strong className="text-white">{syncLayersInput.split('\n').filter(l => l.trim()).length}</strong>
                    </span>
                    <span className="text-slate-500">
                      ملاحظة: اكتب <code className="text-red-300 bg-red-950/50 px-1 py-0.5 rounded">(hidden)</code> للطبقات غير المفعلة
                    </span>
                  </div>
                </div>

                {/* Right Column: Settings & Triggers */}
                <div className="space-y-4 bg-slate-950/50 p-4 rounded-2xl border border-white/5 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div>
                      <label className="text-slate-300 text-xs font-bold block mb-2 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span>مدة عرض الطبقات بالثواني (Target Duration in Seconds)</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        disabled={syncUseOriginalDuration}
                        value={syncTargetDuration}
                        onChange={(e) => setSyncTargetDuration(e.target.value)}
                        className="w-full bg-slate-900 text-white p-3 rounded-xl border border-white/10 focus:border-red-500 focus:outline-none font-bold text-sm disabled:opacity-40"
                      />
                    </div>

                    <label className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 cursor-pointer hover:bg-white/[0.06] transition-all">
                      <input
                        type="checkbox"
                        checked={syncUseOriginalDuration}
                        onChange={(e) => setSyncUseOriginalDuration(e.target.checked)}
                        className="w-4 h-4 rounded accent-red-500 cursor-pointer"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white">استخدام المدة الأصلية لكل طبقة</span>
                        <span className="text-[10px] text-slate-400">الحفاظ على مدة كل طبقة كما هي دون تمديد أو تقصير</span>
                      </div>
                    </label>
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      onClick={handleGenerateSyncScript}
                      className="w-full py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-black rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <Code className="w-4 h-4" />
                      <span>توليد وتحديث كود السكريبت الآن</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleCopySyncScript}
                        className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold rounded-xl border border-white/10 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                      >
                        {syncCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                        <span>{syncCopied ? 'تم النسخ!' : 'نسخ الكود'}</span>
                      </button>

                      <button
                        onClick={handleDownloadSyncScript}
                        className="py-2.5 px-3 bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-200 hover:text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5 text-red-400" />
                        <span>تحميل (.jsx)</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Code Preview Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300 flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-emerald-400" />
                    <span>الكود البرمجي الناتج (ExtendScript .jsx جاهز للاستخدام في After Effects):</span>
                  </span>
                  <button
                    onClick={handleCopySyncScript}
                    className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 hover:underline"
                  >
                    <Copy className="w-3 h-3" />
                    <span>نسخ السكريبت كاملاً</span>
                  </button>
                </div>

                <div className="relative rounded-2xl bg-black/80 border border-white/10 p-4 overflow-hidden">
                  <pre className="font-mono text-[11px] text-emerald-400/90 leading-relaxed overflow-x-auto max-h-64 custom-scrollbar whitespace-pre">
                    {syncGeneratedScript || handleGenerateSyncScript()}
                  </pre>
                </div>
              </div>
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
                  <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                  <span>نقل وتصدير المشروع إلى After Effects 🚀</span>
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

      {/* Composition Settings Modal (Exact match to user screenshot 1236.png) */}
      {showCompSettingsModal && (
        <AeCompositionSettingsModal
          isOpen={showCompSettingsModal}
          onClose={() => setShowCompSettingsModal(false)}
          initialSettings={{
            compName,
            width: compWidth,
            height: compHeight,
            fps: compFps,
            totalFrames: compTotalFrames,
            durationSec: compDurationSec,
            importSvgaDirectly
          }}
          onApply={(updated) => {
            setCompName(updated.compName);
            setCompWidth(updated.width);
            setCompHeight(updated.height);
            setCompFps(updated.fps);
            setCompTotalFrames(updated.totalFrames);
            setCompDurationSec(updated.durationSec);
            setImportSvgaDirectly(updated.importSvgaDirectly);
            setShowCompSettingsModal(false);
            
            // Auto re-generate and apply the new project settings immediately!
            handleStartExport(updated);
          }}
        />
      )}
    </div>
  );
};
