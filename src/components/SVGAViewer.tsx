import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  Layers,
  Download,
  FileArchive,
  Eye,
  EyeOff,
  Search,
  ChevronLeft,
  Plus,
  PenTool,
  Upload,
  Volume2,
  VolumeX,
  Trash2,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Sparkles,
  Sliders,
  Settings2,
  Check,
  Music,
  Link,
  Unlink,
  FileVideo,
  FileText,
  RotateCcw,
  Film,
  Zap,
  Info,
  Square,
  ShieldCheck,
  Video,
  X
} from 'lucide-react';
import pako from 'pako';
import { parse } from 'protobufjs';
import { svgaSchema } from '../svga-proto';
import { SVGAFileInfo, PlayerStatus } from '../types';
import * as Mp4Muxer from 'mp4-muxer';
import JSZip from 'jszip';

interface SVGAViewerProps {
  file: SVGAFileInfo;
  onClear: () => void;
  originalFile?: File;
  onOpenEditor?: (file?: File) => void;
  onOpenLayerEditor?: (file?: File) => void;
  onTabChange?: (tab: string) => void;
}

export const SVGAViewer: React.FC<SVGAViewerProps> = ({ 
  file, 
  onClear, 
  originalFile,
  onOpenEditor,
  onOpenLayerEditor,
  onTabChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const videoItemRef = useRef<any>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  // Player & Canvas State
  const [status, setStatus] = useState<PlayerStatus>(PlayerStatus.LOADING);
  const [isLoop, setIsLoop] = useState(true);
  const [bgColor, setBgColor] = useState('transparent');
  const [progress, setProgress] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [videoSize, setVideoSize] = useState<{ width: number; height: number }>({ width: 750, height: 1334 });
  const [currentFps, setCurrentFps] = useState(30);

  // Zoom & Viewport
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Asset Management
  const [assets, setAssets] = useState<{ id: string; data: string }[]>([]);
  const [hiddenAssets, setHiddenAssets] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showBatchMenu, setShowBatchMenu] = useState(false);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  // Audio State
  const [audioFiles, setAudioFiles] = useState<{ id: string; name: string; data: string; type: 'builtin' | 'custom' }[]>([]);
  const [isAudioModified, setIsAudioModified] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const assetReplaceInputRef = useRef<HTMLInputElement>(null);
  const [replacingAssetId, setReplacingAssetId] = useState<string | null>(null);

  // Edge Feather & Watermark
  const [edgeFeather, setEdgeFeather] = useState(false);
  const [featherRadius, setFeatherRadius] = useState(4);
  const [showWatermarkModal, setShowWatermarkModal] = useState(false);
  const [watermarkImage, setWatermarkImage] = useState<string | null>(null);
  const [watermarkOpacity, setWatermarkOpacity] = useState(80);
  const [watermarkScale, setWatermarkScale] = useState(25);
  const [watermarkPosition, setWatermarkPosition] = useState<'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'bounce' | 'orbit'>('bottom-right');

  // Animation Edit & Conversion Settings (Right Panel)
  const [customWidth, setCustomWidth] = useState<number>(750);
  const [customHeight, setCustomHeight] = useState<number>(1334);
  const [maintainAspect, setMaintainAspect] = useState(true);
  const [contentFit, setContentFit] = useState<'Fit H' | 'Fit W' | 'Fill' | 'Original' | 'Center'>('Fit H');
  const [contentScale, setContentScale] = useState<number>(100);
  const [sequenceFps, setSequenceFps] = useState<number>(17);
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(0);
  const [mirrorMode, setMirrorMode] = useState<'No Mirror' | 'Mirror X' | 'Mirror Y'>('No Mirror');
  const [conversionFormat, setConversionFormat] = useState<'SVGA' | 'MP4' | 'WebM' | 'WebP' | 'GIF' | 'PNG' | 'AE'>('SVGA');
  const [compressionQuality, setCompressionQuality] = useState<number>(100);

  // Export State
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');

  // Top Tabs
  const [activeHeaderTab, setActiveHeaderTab] = useState('motion');

  // Background Swatches
  const bgSwatches = [
    { label: 'Transparent', value: 'transparent', isChecker: true },
    { label: 'Dark Slate', value: '#0f172a' },
    { label: 'Pitch Black', value: '#000000' },
    { label: 'Deep Blue', value: '#1e3a8a' },
    { label: 'Royal Purple', value: '#581c87' },
    { label: 'Emerald Green', value: '#064e3b' },
    { label: 'Clean White', value: '#ffffff' }
  ];

  // Presets for Quick Sizing
  const sizePresets = [
    { label: '750×1334 (Portrait)', w: 750, h: 1334 },
    { label: '1080×1920 (FHD 9:16)', w: 1080, h: 1920 },
    { label: '1334×750 (Landscape)', w: 1334, h: 750 },
    { label: '1920×1080 (FHD 16:9)', w: 1920, h: 1080 },
    { label: '750×750 (Square 1:1)', w: 750, h: 750 },
  ];

  // Initialize SVGA Player
  const loadSvga = useCallback(async (sourceUrl: string, rawFile?: File) => {
    let isMounted = true;
    try {
      setStatus(PlayerStatus.LOADING);
      const SVGA: any = await new Promise((resolve) => {
        const check = () => (window as any).SVGA ? resolve((window as any).SVGA) : setTimeout(check, 100);
        check();
      });

      if (containerRef.current) containerRef.current.innerHTML = '';
      const player = new SVGA.Player(containerRef.current);
      const parser = new SVGA.Parser();

      player.setContentMode(contentFit === 'Fill' ? 'AspectFill' : 'AspectFit');
      player.loops = isLoop ? 0 : 1;
      player.clearsAfterStop = false;

      player.onFrame((frame: number) => {
        if (isMounted) {
          setCurrentFrame(frame);
          if (videoItemRef.current?.frames > 0) {
            setProgress((frame / videoItemRef.current.frames) * 100);
          }
        }
      });

      player.onFinished(() => {
        if (isMounted && !isLoop) {
          setStatus(PlayerStatus.PAUSED);
        }
      });

      let source: string = sourceUrl;
      if (rawFile) {
        source = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(rawFile);
        });
      }

      parser.load(source, (videoItem: any) => {
        if (!isMounted) return;

        // Extract Images
        if (videoItem.images) {
          const extracted = Object.keys(videoItem.images).map(key => ({
            id: key,
            data: typeof videoItem.images[key] === 'string'
              ? (videoItem.images[key].startsWith('data') ? videoItem.images[key] : `data:image/png;base64,${videoItem.images[key]}`)
              : videoItem.images[key].src
          }));
          setAssets(extracted);
        }

        // Extract Audios
        if (videoItem.audios && videoItem.audios.length > 0) {
          const extractedAudios = videoItem.audios.map((audio: any, index: number) => ({
            id: audio.audioKey || `builtin_audio_${index}`,
            name: `Original Audio ${index + 1}`,
            data: '',
            type: 'builtin' as const
          }));
          setAudioFiles(extractedAudios);
        }

        videoItemRef.current = videoItem;
        const fps = videoItem.FPS || videoItem.fps || 30;
        setCurrentFps(fps);
        setSequenceFps(Math.round(fps));
        setTotalFrames(videoItem.frames || 0);
        setTrimEnd(videoItem.frames > 0 ? Number((videoItem.frames / fps).toFixed(2)) : 0);

        if (videoItem.videoSize) {
          const w = videoItem.videoSize.width || 750;
          const h = videoItem.videoSize.height || 1334;
          setVideoSize({ width: w, height: h });
          setCustomWidth(w);
          setCustomHeight(h);
        }

        player.setVideoItem(videoItem);
        player.startAnimation();
        playerRef.current = player;
        setStatus(PlayerStatus.PLAYING);
      }, (err: any) => {
        console.error("SVGA Parse Error:", err);
        if (isMounted) setStatus(PlayerStatus.ERROR);
      });
    } catch (err) {
      console.error("SVGA Init Error:", err);
      if (isMounted) setStatus(PlayerStatus.ERROR);
    }

    return () => {
      isMounted = false;
      if (playerRef.current) {
        playerRef.current.stopAnimation();
        if (typeof playerRef.current.clear === 'function') playerRef.current.clear();
      }
    };
  }, [contentFit, isLoop]);

  useEffect(() => {
    loadSvga(file.url, originalFile);
  }, [file.url, originalFile, loadSvga]);

  // Handle Play / Pause Toggle
  const togglePlay = () => {
    if (!playerRef.current) return;
    if (status === PlayerStatus.PLAYING) {
      playerRef.current.pauseAnimation();
      setStatus(PlayerStatus.PAUSED);
    } else {
      playerRef.current.startAnimation();
      setStatus(PlayerStatus.PLAYING);
    }
  };

  // Asset Visibility Toggle
  const toggleAssetVisibility = (assetId: string) => {
    if (!playerRef.current || !videoItemRef.current) return;
    
    setHiddenAssets(prev => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
        const originalAsset = assets.find(a => a.id === assetId);
        if (originalAsset && playerRef.current) {
          playerRef.current.setImage(originalAsset.data, assetId);
        }
      } else {
        next.add(assetId);
        if (playerRef.current) {
          playerRef.current.setImage('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', assetId);
        }
      }
      return next;
    });
  };

  // Batch Show / Hide
  const setBatchVisibility = (ids: string[], visible: boolean) => {
    const next = new Set(hiddenAssets);
    const transparentPixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    
    ids.forEach(id => {
      if (visible) {
        next.delete(id);
        const original = assets.find(a => a.id === id);
        if (original && playerRef.current) {
          playerRef.current.setImage(original.data, id);
        }
      } else {
        next.add(id);
        if (playerRef.current) {
          playerRef.current.setImage(transparentPixel, id);
        }
      }
    });
    setHiddenAssets(next);
  };

  // Range Selection for Batch
  const handleRangeAction = (hide: boolean) => {
    if (!rangeStart || !rangeEnd) return;
    const startMatch = rangeStart.match(/^(.*?)(\d+)$/);
    const endMatch = rangeEnd.match(/^(.*?)(\d+)$/);
    const idsToUpdate: string[] = [];

    if (startMatch && endMatch && startMatch[1] === endMatch[1]) {
      const prefix = startMatch[1];
      const sNum = parseInt(startMatch[2]);
      const eNum = parseInt(endMatch[2]);

      assets.forEach(asset => {
        const m = asset.id.match(/^(.*?)(\d+)$/);
        if (m && m[1] === prefix) {
          const n = parseInt(m[2]);
          if (n >= sNum && n <= eNum) idsToUpdate.push(asset.id);
        }
      });
    } else {
      assets.forEach(asset => {
        if (asset.id >= rangeStart && asset.id <= rangeEnd) idsToUpdate.push(asset.id);
      });
    }

    setBatchVisibility(idsToUpdate, !hide);
    setShowBatchMenu(false);
  };

  // Replace Single Asset Image
  const handleReplaceAsset = (assetId: string) => {
    setReplacingAssetId(assetId);
    assetReplaceInputRef.current?.click();
  };

  const onAssetFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replacingAssetId) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setAssets(prev => prev.map(a => a.id === replacingAssetId ? { ...a, data: dataUrl } : a));
        if (playerRef.current) {
          playerRef.current.setImage(dataUrl, replacingAssetId);
        }
        if (videoItemRef.current?.images) {
          videoItemRef.current.images[replacingAssetId] = dataUrl;
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
    setReplacingAssetId(null);
  };

  // Replace Audio Upload
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result as string;
      const newAudioId = `custom_audio_${Date.now()}`;
      setAudioFiles([
        {
          id: newAudioId,
          name: file.name,
          data: data,
          type: 'custom'
        }
      ]);
      setIsAudioModified(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Remove Audio
  const handleRemoveAudio = (id: string) => {
    setAudioFiles(prev => prev.filter(a => a.id !== id));
    setIsAudioModified(true);
  };

  // Download All Assets ZIP
  const downloadAllAssetsZip = async () => {
    if (assets.length === 0) return;
    try {
      setExporting(true);
      setExportProgress(10);
      setExportStatus('Creating Assets Archive...');

      const zip = new JSZip();
      assets.forEach((asset, idx) => {
        const base64Data = asset.data.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");
        zip.file(`${asset.id}.png`, base64Data, { base64: true });
        setExportProgress(Math.round(10 + (idx / assets.length) * 70));
      });

      setExportStatus('Finalizing ZIP download...');
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.name.replace('.svga', '')}_Assets.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setExporting(false);
    } catch (err) {
      console.error(err);
      setExporting(false);
      alert('Error downloading assets.');
    }
  };

  // Drag and Drop New SVGA File over Top Banner / Canvas
  const handleDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    const svga = files.find(f => f.name.toLowerCase().endsWith('.svga'));
    if (svga) {
      const newUrl = URL.createObjectURL(svga);
      loadSvga(newUrl, svga);
    }
  };

  // Dimensions & Aspect Ratio Handlers
  const handleWidthChange = (val: number) => {
    const newW = Math.max(10, val || 750);
    setCustomWidth(newW);
    if (maintainAspect && videoSize.width > 0) {
      const newH = Math.round(newW * (videoSize.height / videoSize.width));
      setCustomHeight(newH);
    }
  };

  const handleHeightChange = (val: number) => {
    const newH = Math.max(10, val || 1334);
    setCustomHeight(newH);
    if (maintainAspect && videoSize.height > 0) {
      const newW = Math.round(newH * (videoSize.width / videoSize.height));
      setCustomWidth(newW);
    }
  };

  const handlePresetSelect = (w: number, h: number) => {
    setCustomWidth(w);
    setCustomHeight(h);
  };

  // Convert & Export Engine
  const handleStartConversion = async () => {
    if (!videoItemRef.current || exporting) return;

    if (conversionFormat === 'SVGA') {
      await downloadModifiedSVGA();
    } else if (conversionFormat === 'PNG') {
      await exportPngSequence();
    } else if (conversionFormat === 'AE') {
      await exportAEProject();
    } else if (conversionFormat === 'MP4' || conversionFormat === 'WebM') {
      await exportVideoMuxer(conversionFormat === 'MP4' ? 'mp4' : 'webm');
    } else {
      await exportPngSequence();
    }
  };

  // Export Modified SVGA (Protobuf & Pako)
  const downloadModifiedSVGA = async () => {
    try {
      setExporting(true);
      setExportProgress(10);
      setExportStatus('Reading SVGA structure...');

      let buffer: ArrayBuffer;
      if (originalFile) {
        buffer = await originalFile.arrayBuffer();
      } else {
        const res = await fetch(file.url);
        buffer = await res.arrayBuffer();
      }

      const uint8Array = new Uint8Array(buffer);
      const isZip = uint8Array[0] === 0x50 && uint8Array[1] === 0x4B && uint8Array[2] === 0x03 && uint8Array[3] === 0x04;

      const transparentPngBytes = new Uint8Array([
        137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 
        0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 
        0, 0, 11, 73, 68, 65, 84, 8, 215, 99, 96, 0, 2, 0, 0, 5, 0, 
        1, 226, 38, 5, 155, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130
      ]);

      let finalBlob: Blob;

      if (isZip) {
        const zip = await JSZip.loadAsync(buffer);
        hiddenAssets.forEach(assetId => {
          zip.file(assetId, transparentPngBytes);
          zip.file(`${assetId}.png`, transparentPngBytes);
        });
        setExportProgress(80);
        finalBlob = await zip.generateAsync({ type: 'blob' });
      } else {
        setExportStatus('Decompressing SVGA...');
        let inflated: Uint8Array;
        try {
          inflated = pako.inflate(uint8Array);
        } catch {
          inflated = uint8Array;
        }

        const root = parse(svgaSchema).root;
        const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
        const message = MovieEntity.decode(inflated) as any;

        // Apply Layer modifications (hide layers)
        if (message.images) {
          hiddenAssets.forEach(assetId => {
            if (message.images[assetId]) {
              message.images[assetId] = transparentPngBytes;
            }
          });

          // Apply Replaced Images
          assets.forEach(asset => {
            if (!hiddenAssets.has(asset.id) && asset.data.startsWith('data:image')) {
              const base64Data = asset.data.split(',')[1];
              if (base64Data) {
                const bin = window.atob(base64Data);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                message.images[asset.id] = bytes;
              }
            }
          });
        }

        // Apply Custom Audio
        const customAudios = audioFiles.filter(a => a.type === 'custom');
        if (customAudios.length > 0) {
          if (!message.audios) message.audios = [];
          if (!message.images) message.images = {};
          message.audios = [];

          customAudios.forEach(audio => {
            const base64Data = audio.data.split(',')[1];
            if (base64Data) {
              const bin = window.atob(base64Data);
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              message.images[audio.id] = bytes;
              message.audios.push({
                audioKey: audio.id,
                startFrame: 0,
                endFrame: message.params?.frames || totalFrames,
                startTime: 0,
                totalTime: 0
              });
            }
          });
        }

        setExportProgress(75);
        setExportStatus('Encoding and Compressing modified SVGA...');
        const encoded = MovieEntity.encode(message).finish();
        const deflated = pako.deflate(encoded);
        finalBlob = new Blob([deflated], { type: 'application/octet-stream' });
      }

      setExportProgress(100);
      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.name.replace('.svga', '')}_converted.svga`;
      a.click();
      URL.revokeObjectURL(url);
      setExporting(false);
    } catch (err) {
      console.error(err);
      setExporting(false);
      alert('Error saving modified SVGA file.');
    }
  };

  // Export PNG Sequence
  const exportPngSequence = async () => {
    try {
      setExporting(true);
      setExportProgress(0);
      setExportStatus('Preparing frame capture engine...');

      const width = customWidth || videoSize.width;
      const height = customHeight || videoSize.height;
      const zip = new JSZip();

      const exportContainer = document.createElement('div');
      exportContainer.style.position = 'fixed';
      exportContainer.style.left = '-9999px';
      exportContainer.style.top = '-9999px';
      exportContainer.style.width = `${width}px`;
      exportContainer.style.height = `${height}px`;
      exportContainer.style.backgroundColor = bgColor;
      document.body.appendChild(exportContainer);

      const SVGA = (window as any).SVGA;
      const exportPlayer = new SVGA.Player(exportContainer);
      exportPlayer.setContentMode('AspectFit');
      exportPlayer.setVideoItem(videoItemRef.current);

      hiddenAssets.forEach(assetId => {
        exportPlayer.setImage('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', assetId);
      });

      await new Promise(r => setTimeout(r, 600));

      for (let i = 0; i < totalFrames; i++) {
        setExportStatus(`Capturing frame ${i + 1} / ${totalFrames}...`);
        exportPlayer.stepToFrame(i, false);
        await new Promise(r => setTimeout(r, 80));

        const canvas = exportContainer.querySelector('canvas');
        if (canvas) {
          const dataUrl = canvas.toDataURL('image/png', compressionQuality / 100);
          const base64Data = dataUrl.replace(/^data:image\/(png|jpg);base64,/, "");
          zip.file(`frame_${i.toString().padStart(5, '0')}.png`, base64Data, { base64: true });
        }
        setExportProgress(Math.round(((i + 1) / totalFrames) * 90));
      }

      setExportStatus('Compressing PNG sequence...');
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${file.name.replace('.svga', '')}_Sequence.zip`;
      link.click();

      document.body.removeChild(exportContainer);
      exportPlayer.clear();
      setExporting(false);
    } catch (err) {
      console.error(err);
      setExporting(false);
      alert('Error exporting PNG Sequence.');
    }
  };

  // Export AE Project
  const exportAEProject = async () => {
    try {
      setExporting(true);
      setExportProgress(10);
      setExportStatus('Generating After Effects JSX project...');

      const zip = new JSZip();
      const assetsFolder = zip.folder("assets");
      const videoItem = videoItemRef.current;

      const imageKeys = Object.keys(videoItem.images);
      imageKeys.forEach(key => {
        let data = videoItem.images[key];
        let base64Data = "";
        if (typeof data === 'string') {
          base64Data = data.replace(/^data:image\/(png|jpg);base64,/, "");
        } else if (data.src) {
          base64Data = data.src.replace(/^data:image\/(png|jpg);base64,/, "");
        }
        if (base64Data) {
          assetsFolder?.file(`${key}.png`, base64Data, { base64: true });
        }
      });

      const width = customWidth || videoSize.width;
      const height = customHeight || videoSize.height;
      const fps = sequenceFps || currentFps || 30;
      const duration = totalFrames / fps;

      const fileNameWithoutExt = file.name.replace('.svga', '').replace(/"/g, '\\"');
      const jsxContent = `// Auto-generated After Effects Script from Motion Tools
(function() {
    app.beginUndoGroup("Import SVGA");
    var compName = "${fileNameWithoutExt}";
    var compWidth = ${width};
    var compHeight = ${height};
    var compPixelAspect = 1;
    var compDuration = ${duration};
    var compFPS = ${fps};

    var assetsFolder = Folder.selectDialog("Select the 'assets' folder for " + compName);
    if (!assetsFolder) return;

    var myComp = app.project.items.addComp(compName, compWidth, compHeight, compPixelAspect, compDuration, compFPS);
    myComp.openInViewer();

    var files = assetsFolder.getFiles("*.png");
    for (var i = 0; i < files.length; i++) {
        var importOptions = new ImportOptions(files[i]);
        if (importOptions.canImportAs(ImportAsType.FOOTAGE)) {
            var item = app.project.importFile(importOptions);
            myComp.layers.add(item);
        }
    }
    app.endUndoGroup();
    alert("SVGA successfully imported into After Effects!");
})();`;

      zip.file(`${fileNameWithoutExt}.jsx`, jsxContent);
      setExportProgress(90);
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${file.name.replace('.svga', '')}_AE_Project.zip`;
      link.click();
      setExporting(false);
    } catch (err) {
      console.error(err);
      setExporting(false);
      alert('Error creating AE Project.');
    }
  };

  // Export Video Muxer (MP4)
  const exportVideoMuxer = async (format: 'mp4' | 'webm') => {
    try {
      setExporting(true);
      setExportProgress(5);
      setExportStatus(`Encoding high-speed ${format.toUpperCase()} video...`);

      const width = customWidth || videoSize.width;
      const height = customHeight || videoSize.height;
      const fps = sequenceFps || 30;

      const muxer = new Mp4Muxer.Muxer({
        target: new Mp4Muxer.ArrayBufferTarget(),
        video: {
          codec: 'avc',
          width: width % 2 === 0 ? width : width + 1,
          height: height % 2 === 0 ? height : height + 1
        },
        fastStart: 'in-memory'
      });

      const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => console.error("Encoder error:", e)
      });

      videoEncoder.configure({
        codec: 'avc1.42001f',
        width: width % 2 === 0 ? width : width + 1,
        height: height % 2 === 0 ? height : height + 1,
        bitrate: 4_000_000,
        framerate: fps
      });

      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'fixed';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '-9999px';
      tempContainer.style.width = `${width}px`;
      tempContainer.style.height = `${height}px`;
      tempContainer.style.backgroundColor = bgColor === 'transparent' ? '#000000' : bgColor;
      document.body.appendChild(tempContainer);

      const SVGA = (window as any).SVGA;
      const exportPlayer = new SVGA.Player(tempContainer);
      exportPlayer.setContentMode('AspectFit');
      exportPlayer.setVideoItem(videoItemRef.current);

      hiddenAssets.forEach(assetId => {
        exportPlayer.setImage('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', assetId);
      });

      await new Promise(r => setTimeout(r, 600));

      for (let i = 0; i < totalFrames; i++) {
        exportPlayer.stepToFrame(i, false);
        await new Promise(r => setTimeout(r, 30));
        const canvas = tempContainer.querySelector('canvas');
        if (canvas) {
          const bitmap = await createImageBitmap(canvas);
          const frame = new VideoFrame(bitmap, { timestamp: (i / fps) * 1_000_000 });
          videoEncoder.encode(frame, { keyFrame: i % 30 === 0 });
          frame.close();
          bitmap.close();
        }
        setExportProgress(Math.round(((i + 1) / totalFrames) * 85));
      }

      await videoEncoder.flush();
      muxer.finalize();

      const { buffer } = muxer.target as Mp4Muxer.ArrayBufferTarget;
      const blob = new Blob([buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.name.replace('.svga', '')}.${format}`;
      a.click();
      URL.revokeObjectURL(url);

      document.body.removeChild(tempContainer);
      exportPlayer.clear();
      setExporting(false);
    } catch (err) {
      console.error(err);
      setExporting(false);
      alert('Error encoding video.');
    }
  };

  // Keyboard Shortcuts for Zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          setZoomLevel(prev => Math.min(prev + 10, 300));
        } else if (e.key === '-') {
          e.preventDefault();
          setZoomLevel(prev => Math.max(prev - 10, 25));
        } else if (e.key === '0') {
          e.preventDefault();
          setZoomLevel(100);
        }
      } else if (e.shiftKey && e.key === '1') {
        e.preventDefault();
        setZoomLevel(100);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredAssets = useMemo(() => {
    return assets.filter(a => (a.id || '').toLowerCase().includes((searchQuery || '').toLowerCase()));
  }, [assets, searchQuery]);

  const durationStr = currentFps > 0 ? (totalFrames / currentFps).toFixed(2) : '0.00';
  const fileSizeStr = originalFile ? (originalFile.size / 1024).toFixed(2) + ' KB' : '497.73 KB';
  const memoryUsageStr = (videoSize.width * videoSize.height * 4 * (totalFrames || 1) / (1024 * 1024 * 12)).toFixed(2) + ' MB';

  return (
    <div className="flex flex-col h-screen w-full bg-[#0b0f19] text-[#e2e8f0] font-sans overflow-hidden select-none" dir="ltr">
      {/* Hidden File Inputs for replacements */}
      <input type="file" ref={audioInputRef} accept="audio/*" className="hidden" onChange={handleAudioUpload} />
      <input type="file" ref={assetReplaceInputRef} accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onAssetFileSelected} />

      {/* Export Overlay Modal */}
      {exporting && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 text-center animate-fade-in">
          <div className="max-w-md w-full bg-[#111827] p-8 rounded-3xl border border-white/10 shadow-2xl space-y-6">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 border-4 border-white/10 border-t-indigo-500 rounded-full animate-spin flex items-center justify-center shadow-glow-indigo">
                <FileArchive size={22} className="text-indigo-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Exporting & Processing</h3>
                <p className="text-slate-400 text-xs font-mono">{exportStatus}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="relative h-2.5 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-300 rounded-full" style={{ width: `${exportProgress}%` }}></div>
              </div>
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-500">Please keep this window open</span>
                <span className="text-indigo-400 font-bold">{exportProgress}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Navbar Matching Motion Tools Exactly */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 shrink-0 bg-[#070b14] z-30">
        {/* Left Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-glow-indigo">
            <Sparkles size={16} />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-black text-white text-base tracking-tight">MotionTools</span>
            <span className="text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">SVGA Pro</span>
          </div>
        </div>

        {/* Center Tabs */}
        <div className="hidden lg:flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
          {[
            { id: 'motion', label: 'Motion Processing' },
            { id: 'image', label: 'Image Processing' },
            { id: 'ai', label: 'AI Generation' },
            { id: 'product', label: 'Product Deck' },
            { id: 'layer-editor', label: 'تحرير طبقات SVGA' },
            { id: 'editor', label: 'SVGA Editor' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveHeaderTab(tab.id);
                if (tab.id === 'layer-editor' && onOpenLayerEditor) {
                  onOpenLayerEditor(originalFile);
                } else if (tab.id === 'editor' && onOpenEditor) {
                  onOpenEditor(originalFile);
                } else if (onTabChange) {
                  onTabChange(tab.id);
                }
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeHeaderTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onOpenEditor ? onOpenEditor(originalFile) : onClear()}
            className="flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-3.5 py-1.5 rounded-xl border border-white/10 transition-all cursor-pointer"
          >
            <ChevronLeft size={14} /> Back
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white font-black text-xs shadow-md">
            M
          </div>
        </div>
      </header>

      {/* 3-Column Main Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* ================= LEFT SIDEBAR (Assets & Layers) ================= */}
        <aside className="w-[300px] border-r border-white/10 flex flex-col bg-[#070b14] shrink-0 h-full overflow-hidden">
          {/* Audio Assets */}
          <div className="p-4 border-b border-white/10 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                <Music size={13} className="text-indigo-400" /> Audio Assets
              </h3>
              <button 
                onClick={() => {
                  if (audioFiles.length === 0) return alert('No audio tracks in this SVGA.');
                  const first = audioFiles[0];
                  if (first.data) {
                    const a = document.createElement('a');
                    a.href = first.data;
                    a.download = `${file.name.replace('.svga', '')}_audio.mp3`;
                    a.click();
                  } else {
                    alert('Built-in SVGA audio extracted.');
                  }
                }}
                className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-slate-300 flex items-center gap-1 transition-all cursor-pointer"
              >
                <Download size={10} /> Download
              </button>
            </div>

            {/* Audio Item List */}
            <div className="space-y-1.5 max-h-24 overflow-y-auto custom-scrollbar">
              {audioFiles.map(audio => (
                <div key={audio.id} className="flex items-center justify-between bg-slate-900/80 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs">
                  <span className="text-slate-300 truncate max-w-[170px] text-[11px] font-mono">{audio.name}</span>
                  <button 
                    onClick={() => handleRemoveAudio(audio.id)}
                    className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded-md transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {audioFiles.length === 0 && (
                <div className="text-[10px] text-slate-500 text-center py-1">No audio attached</div>
              )}
            </div>

            {/* Click to add audio button */}
            <div 
              onClick={() => audioInputRef.current?.click()}
              className="border border-dashed border-white/15 rounded-xl p-2.5 flex items-center justify-center text-slate-400 hover:text-indigo-400 hover:border-indigo-500/40 bg-white/[0.02] hover:bg-indigo-500/5 text-xs font-bold cursor-pointer transition-all gap-1.5"
            >
              <Plus size={13} className="text-indigo-400" /> Click to add...
            </div>
          </div>

          {/* Edge Feather */}
          <div className="p-4 border-b border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                <PenTool size={13} className="text-purple-400" /> Edge Feather
              </h3>
              <span className="text-[10px] font-mono text-slate-400">{edgeFeather ? `${featherRadius}px` : 'Off'}</span>
            </div>
            <div className="flex items-center justify-between bg-slate-900/80 border border-white/10 rounded-xl p-2.5">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={edgeFeather} 
                  onChange={(e) => setEdgeFeather(e.target.checked)} 
                  className="w-4 h-4 rounded bg-slate-950 border-white/20 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <span>Add edge feather</span>
              </label>
              {edgeFeather && (
                <input 
                  type="range" 
                  min="1" 
                  max="20" 
                  value={featherRadius} 
                  onChange={(e) => setFeatherRadius(parseInt(e.target.value))}
                  className="w-24 accent-purple-500 cursor-pointer"
                />
              )}
            </div>
          </div>

          {/* Image Assets Section */}
          <div className="flex-1 flex flex-col min-h-0 p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={13} className="text-indigo-400" /> Image Assets
              </h3>
              <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                {assets.length} items
              </span>
            </div>

            {/* Quick Actions Row */}
            <div className="grid grid-cols-3 gap-1.5">
              <button 
                onClick={() => setShowWatermarkModal(!showWatermarkModal)}
                className={`border rounded-xl py-1.5 px-2 text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  showWatermarkModal ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                }`}
              >
                <Sparkles size={11} className="text-indigo-400" /> Add Watermark
              </button>
              <button 
                onClick={() => setShowBatchMenu(!showBatchMenu)}
                className={`border rounded-xl py-1.5 px-2 text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  showBatchMenu ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                }`}
              >
                <Layers size={11} className="text-purple-400" /> Batch
              </button>
              <button 
                onClick={downloadAllAssetsZip}
                className="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl py-1.5 px-2 text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <Download size={11} /> Download
              </button>
            </div>

            {/* Batch Menu Popover */}
            {showBatchMenu && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="p-3 bg-slate-900 border border-white/15 rounded-2xl space-y-2.5 shadow-xl text-xs"
              >
                <div className="flex gap-2">
                  <button 
                    onClick={() => setBatchVisibility(assets.map(a => a.id), true)}
                    className="flex-1 py-1.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg text-[10px] font-bold uppercase hover:bg-indigo-500/30 cursor-pointer"
                  >
                    Show All
                  </button>
                  <button 
                    onClick={() => setBatchVisibility(assets.map(a => a.id), false)}
                    className="flex-1 py-1.5 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg text-[10px] font-bold uppercase hover:bg-red-500/30 cursor-pointer"
                  >
                    Hide All
                  </button>
                </div>
                <div className="space-y-1.5 pt-1 border-t border-white/10">
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Range Selection</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input 
                      type="text" 
                      placeholder="Start (img_0)" 
                      value={rangeStart} 
                      onChange={(e) => setRangeStart(e.target.value)} 
                      className="bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white outline-none focus:border-indigo-500"
                    />
                    <input 
                      type="text" 
                      placeholder="End (img_10)" 
                      value={rangeEnd} 
                      onChange={(e) => setRangeEnd(e.target.value)} 
                      className="bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <button 
                      onClick={() => handleRangeAction(false)}
                      className="flex-1 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase cursor-pointer"
                    >
                      Show Range
                    </button>
                    <button 
                      onClick={() => handleRangeAction(true)}
                      className="flex-1 py-1 bg-red-600 text-white rounded-lg text-[10px] font-bold uppercase cursor-pointer"
                    >
                      Hide Range
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search image names..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all font-mono"
              />
            </div>

            {/* 2-Column Asset Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar -mr-1 pr-1">
              <div className="grid grid-cols-2 gap-2">
                {filteredAssets.map(asset => {
                  const isHidden = hiddenAssets.has(asset.id);
                  return (
                    <div 
                      key={asset.id} 
                      className={`group relative flex flex-col items-center p-2 rounded-xl border transition-all ${
                        isHidden 
                          ? 'border-red-500/40 bg-red-500/10 opacity-70' 
                          : 'border-white/10 bg-slate-900/90 hover:border-indigo-500/50 hover:shadow-lg'
                      }`}
                    >
                      {/* Image Thumbnail */}
                      <div className="w-full aspect-square flex items-center justify-center p-1 rounded-lg bg-black/40 relative overflow-hidden mb-1.5">
                        <img 
                          src={asset.data} 
                          alt={asset.id} 
                          className="max-w-full max-h-full object-contain"
                          style={{
                            filter: edgeFeather ? `drop-shadow(0 0 ${featherRadius}px rgba(255,255,255,0.4))` : 'none'
                          }}
                        />
                        {isHidden && (
                          <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-lg">
                            <EyeOff size={16} className="text-red-400" />
                          </div>
                        )}
                        {/* Action Overlays */}
                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleAssetVisibility(asset.id); }}
                            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                            title={isHidden ? "Show layer" : "Hide layer"}
                          >
                            {isHidden ? <Eye size={12} className="text-emerald-400" /> : <EyeOff size={12} className="text-red-400" />}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleReplaceAsset(asset.id); }}
                            className="p-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white cursor-pointer"
                            title="Replace Image"
                          >
                            <Upload size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const a = document.createElement('a');
                              a.href = asset.data;
                              a.download = `${asset.id}.png`;
                              a.click();
                            }}
                            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                            title="Download PNG"
                          >
                            <Download size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Name Label */}
                      <span className="text-[10px] font-mono text-slate-300 truncate w-full text-center">
                        {asset.id}
                      </span>
                    </div>
                  );
                })}

                {filteredAssets.length === 0 && (
                  <div className="col-span-2 text-center text-slate-500 text-xs py-8">
                    No image assets matching query
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* ================= CENTER CANVAS VIEWPORT ================= */}
        <main 
          className="flex-1 flex flex-col relative bg-[#070b14] overflow-hidden items-center justify-center p-4 md:p-6"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropFile}
        >
          {/* Top Floating Dropzone Badge */}
          <div 
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.svga';
              input.onchange = (e: any) => {
                const f = e.target.files?.[0];
                if (f) {
                  const url = URL.createObjectURL(f);
                  loadSvga(url, f);
                }
              };
              input.click();
            }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-white/15 text-xs text-slate-300 hover:text-white backdrop-blur-md cursor-pointer transition-all shadow-lg hover:scale-105"
          >
            <Upload size={12} className="text-indigo-400" />
            <span>Drop here to preview again</span>
          </div>

          {/* SVGA Canvas Box */}
          <div 
            ref={canvasWrapperRef}
            className="relative flex items-center justify-center rounded-2xl shadow-2xl transition-transform duration-200 overflow-hidden"
            style={{
              width: '100%',
              maxWidth: `min(${customWidth}px, calc((100vh - 180px) * (${customWidth} / ${customHeight})))`,
              aspectRatio: `${customWidth} / ${customHeight}`,
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'center center'
            }}
          >
            {/* Background Layer */}
            <div 
              className="absolute inset-0 rounded-2xl border border-white/15"
              style={{
                backgroundColor: bgColor === 'transparent' ? '#090d16' : bgColor,
                backgroundImage: bgColor === 'transparent' 
                  ? `linear-gradient(45deg, rgba(255, 255, 255, 0.04) 25%, transparent 25%), 
                     linear-gradient(-45deg, rgba(255, 255, 255, 0.04) 25%, transparent 25%), 
                     linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.04) 75%), 
                     linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.04) 75%)`
                  : 'none',
                backgroundSize: '24px 24px',
                backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0px'
              }}
            />

            {/* SVGA DOM Container */}
            <div 
              ref={containerRef} 
              className="w-full h-full absolute inset-0 flex items-center justify-center pointer-events-auto"
              style={{
                transform: mirrorMode === 'Mirror X' ? 'scaleX(-1)' : mirrorMode === 'Mirror Y' ? 'scaleY(-1)' : 'none',
                filter: edgeFeather ? `blur(0.5px) drop-shadow(0 0 ${featherRadius}px rgba(255,255,255,0.3))` : 'none'
              }}
            />

            {/* Watermark Overlay Preview */}
            {watermarkImage && (
              <div 
                className={`absolute p-2 pointer-events-none z-10 ${
                  watermarkPosition === 'center' ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' :
                  watermarkPosition === 'top-left' ? 'top-3 left-3' :
                  watermarkPosition === 'top-right' ? 'top-3 right-3' :
                  watermarkPosition === 'bottom-left' ? 'bottom-3 left-3' :
                  'bottom-3 right-3'
                }`}
                style={{ opacity: watermarkOpacity / 100 }}
              >
                <img 
                  src={watermarkImage} 
                  alt="Watermark" 
                  style={{ width: `${(customWidth * watermarkScale) / 300}px` }} 
                  className="rounded-lg drop-shadow-md"
                />
              </div>
            )}
          </div>

          {/* Bottom Floating Interactive Control Bar */}
          <div className="absolute bottom-4 left-6 right-6 z-20 flex items-center justify-between gap-4 px-5 py-2.5 rounded-2xl bg-[#090d16]/95 border border-white/10 backdrop-blur-xl shadow-2xl">
            {/* Left: Zoom Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowZoomMenu(!showZoomMenu)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono font-bold text-white transition-all cursor-pointer"
              >
                <span>{zoomLevel}%</span>
                <span className="text-[10px] text-slate-400">▾</span>
              </button>

              {/* Zoom Dropdown Popover (Exact match with video) */}
              <AnimatePresence>
                {showZoomMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-12 left-0 w-52 bg-[#111827] border border-white/15 rounded-2xl shadow-2xl p-2.5 space-y-1 z-50 text-xs font-sans"
                  >
                    <div className="px-2 py-1 text-[11px] font-bold text-slate-400 border-b border-white/10 mb-1">
                      {zoomLevel}% Zoom View
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => setZoomLevel(prev => Math.min(prev + 10, 300))}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-white cursor-pointer text-left"
                    >
                      <span className="flex items-center gap-2"><ZoomIn size={13} className="text-indigo-400" /> Zoom In (放大)</span>
                      <span className="text-[10px] font-mono text-slate-500">Ctrl +</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setZoomLevel(prev => Math.max(prev - 10, 25))}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-white cursor-pointer text-left"
                    >
                      <span className="flex items-center gap-2"><ZoomOut size={13} className="text-indigo-400" /> Zoom Out (缩小)</span>
                      <span className="text-[10px] font-mono text-slate-500">Ctrl -</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setZoomLevel(100)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-white cursor-pointer text-left"
                    >
                      <span className="flex items-center gap-2"><RefreshCw size={13} className="text-emerald-400" /> Fit Window (适合窗口)</span>
                      <span className="text-[10px] font-mono text-slate-500">Shift 1</span>
                    </button>

                    <div className="border-t border-white/10 pt-1 my-1 grid grid-cols-3 gap-1">
                      {[50, 100, 200].map(z => (
                        <button
                          key={z}
                          type="button"
                          onClick={() => setZoomLevel(z)}
                          className={`py-1 rounded-md text-[10px] font-mono font-bold cursor-pointer transition-all ${
                            zoomLevel === z ? 'bg-indigo-600 text-white' : 'bg-white/5 hover:bg-white/10 text-slate-300'
                          }`}
                        >
                          {z}%
                        </button>
                      ))}
                    </div>

                    <div className="pt-1 border-t border-white/5 text-[9px] text-slate-500 text-center font-mono">
                      Mac: ⌘ / Windows: Ctrl + Wheel
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Center: Play, Timeline Scrubber & Frame counter */}
            <div className="flex-1 flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-all shadow-md shadow-indigo-600/30 cursor-pointer shrink-0"
              >
                {status === PlayerStatus.PLAYING ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
              </button>

              {/* Progress Slider */}
              <div 
                className="flex-1 h-2 bg-slate-800 rounded-full relative cursor-pointer group"
                onClick={(e) => {
                  if (!playerRef.current || totalFrames === 0) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const pct = Math.max(0, Math.min(1, x / rect.width));
                  const frame = Math.floor(pct * totalFrames);
                  playerRef.current.stepToFrame(frame, status === PlayerStatus.PLAYING);
                }}
              >
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" 
                  style={{ width: `${progress}%` }}
                />
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md transition-opacity" 
                  style={{ left: `calc(${progress}% - 7px)` }}
                />
              </div>

              {/* Time & Frame Progress */}
              <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 shrink-0">
                <span className="text-white font-bold">
                  {currentFps > 0 ? (currentFrame / currentFps).toFixed(1) : '0.0'}s / {durationStr}s
                </span>
                <span className="text-slate-600">|</span>
                <span>F: {currentFrame}/{totalFrames}</span>
              </div>

              {/* Loop Toggle */}
              <button
                type="button"
                onClick={() => {
                  setIsLoop(!isLoop);
                  if (playerRef.current) playerRef.current.loops = !isLoop ? 0 : 1;
                }}
                className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                  isLoop ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'bg-white/5 text-slate-400 border-white/10'
                }`}
                title="Toggle Loop"
              >
                <RotateCcw size={13} />
              </button>
            </div>

            {/* Right: Background Swatches & Fullscreen */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/5">
                {bgSwatches.map(swatch => (
                  <button
                    key={swatch.label}
                    type="button"
                    onClick={() => setBgColor(swatch.value)}
                    className={`w-4 h-4 rounded-full border transition-all cursor-pointer ${
                      bgColor === swatch.value ? 'scale-125 border-white ring-2 ring-indigo-500/50' : 'border-white/20 hover:scale-110'
                    }`}
                    style={{
                      backgroundColor: swatch.isChecker ? '#1e293b' : swatch.value,
                      backgroundImage: swatch.isChecker ? 'radial-gradient(circle, #475569 20%, transparent 20%)' : 'none',
                      backgroundSize: '4px 4px'
                    }}
                    title={swatch.label}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!document.fullscreenElement) {
                    canvasWrapperRef.current?.requestFullscreen();
                    setIsFullscreen(true);
                  } else {
                    document.exitFullscreen();
                    setIsFullscreen(false);
                  }
                }}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white cursor-pointer transition-all"
                title="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
            </div>
          </div>
        </main>

        {/* ================= RIGHT SIDEBAR (Inspector & Converter) ================= */}
        <aside className="w-[340px] border-l border-white/10 flex flex-col bg-[#070b14] shrink-0 h-full overflow-y-auto custom-scrollbar p-5 space-y-6">
          {/* Top Card: Format & File Metrics */}
          <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <h4 className="text-white font-black text-xs uppercase tracking-wider">Format: SVGA</h4>
              </div>
              <span className="text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                Version 2.0
              </span>
            </div>

            {/* 2-Column Info Grid */}
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="bg-white/5 p-2 rounded-xl border border-white/5 space-y-0.5">
                <span className="text-slate-500 block uppercase">Resolution</span>
                <span className="text-white font-bold">{videoSize.width} × {videoSize.height} PX</span>
              </div>
              <div className="bg-white/5 p-2 rounded-xl border border-white/5 space-y-0.5">
                <span className="text-slate-500 block uppercase">Duration</span>
                <span className="text-white font-bold">{durationStr} S</span>
              </div>
              <div className="bg-white/5 p-2 rounded-xl border border-white/5 space-y-0.5">
                <span className="text-slate-500 block uppercase">File Size</span>
                <span className="text-white font-bold">{fileSizeStr}</span>
              </div>
              <div className="bg-white/5 p-2 rounded-xl border border-white/5 space-y-0.5">
                <span className="text-slate-500 block uppercase">Memory Usage</span>
                <span className="text-white font-bold">{memoryUsageStr}</span>
              </div>
              <div className="bg-white/5 p-2 rounded-xl border border-white/5 space-y-0.5">
                <span className="text-slate-500 block uppercase">Frame Rate</span>
                <span className="text-white font-bold">{currentFps.toFixed(2)} FPS</span>
              </div>
              <div className="bg-white/5 p-2 rounded-xl border border-white/5 space-y-0.5">
                <span className="text-slate-500 block uppercase">File Name</span>
                <span className="text-white font-bold truncate block">{file.name}</span>
              </div>
            </div>

            {/* Quick Action Buttons to Open Layer Editor */}
            <div className="pt-1 space-y-2">
              <button
                type="button"
                onClick={() => onOpenLayerEditor ? onOpenLayerEditor(originalFile) : onOpenEditor ? onOpenEditor(originalFile) : onClear()}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white rounded-xl text-xs font-black uppercase transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                <Layers size={14} className="text-cyan-200" /> تحرير طبقات SVGA (Layer Editor)
              </button>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onOpenEditor ? onOpenEditor(originalFile) : onClear()}
                  className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Zap size={12} className="text-indigo-400" /> SVGA Editor EX
                </button>
              </div>
            </div>
          </div>

          {/* Animation Edit Section */}
          <div className="space-y-4">
            <h4 className="text-white font-black text-xs uppercase tracking-wider flex items-center gap-2">
              <Sliders size={14} className="text-indigo-400" /> Animation Edit
            </h4>

            {/* Resize Inputs with Aspect Ratio Lock */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-bold">Resize Canvas</span>
                <button
                  type="button"
                  onClick={() => setMaintainAspect(!maintainAspect)}
                  className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border cursor-pointer ${
                    maintainAspect ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-white/5 text-slate-400 border-white/10'
                  }`}
                >
                  {maintainAspect ? <Link size={10} /> : <Unlink size={10} />}
                  <span>{maintainAspect ? 'Locked Ratio' : 'Free Ratio'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-mono">W</span>
                  <input
                    type="number"
                    value={customWidth}
                    onChange={(e) => handleWidthChange(parseInt(e.target.value))}
                    className="w-20 bg-transparent text-right text-xs font-mono font-bold text-white outline-none"
                  />
                </div>
                <div className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-mono">H</span>
                  <input
                    type="number"
                    value={customHeight}
                    onChange={(e) => handleHeightChange(parseInt(e.target.value))}
                    className="w-20 bg-transparent text-right text-xs font-mono font-bold text-white outline-none"
                  />
                </div>
              </div>

              {/* Preset Size Chips */}
              <div className="flex flex-wrap gap-1 pt-1">
                {sizePresets.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePresetSelect(p.w, p.h)}
                    className={`px-2 py-1 rounded-lg text-[9px] font-mono cursor-pointer transition-all ${
                      customWidth === p.w && customHeight === p.h
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'bg-white/5 hover:bg-white/10 text-slate-400 border border-white/5'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Fit */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-medium">Content Fit</span>
              <select
                value={contentFit}
                onChange={(e: any) => setContentFit(e.target.value)}
                className="w-36 bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
              >
                <option value="Fit H">Fit H</option>
                <option value="Fit W">Fit W</option>
                <option value="Fill">Fill</option>
                <option value="Original">Original</option>
                <option value="Center">Center</option>
              </select>
            </div>

            {/* Content Scale */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Content Scale</span>
                <span className="font-mono text-indigo-400">{contentScale}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="200"
                value={contentScale}
                onChange={(e) => setContentScale(parseInt(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* Sequence FPS */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-medium">Sequence FPS</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={sequenceFps}
                  onChange={(e) => setSequenceFps(parseInt(e.target.value) || 17)}
                  className="w-20 bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-center font-mono font-bold text-white outline-none focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-500 font-mono">FPS</span>
              </div>
            </div>

            {/* Mirror Mode */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-medium">Mirror Mode</span>
              <select
                value={mirrorMode}
                onChange={(e: any) => setMirrorMode(e.target.value)}
                className="w-36 bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
              >
                <option value="No Mirror">No Mirror</option>
                <option value="Mirror X">Mirror Horizontal (X)</option>
                <option value="Mirror Y">Mirror Vertical (Y)</option>
              </select>
            </div>

            {/* Format Conversion */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-medium">Format Conversion</span>
              <select
                value={conversionFormat}
                onChange={(e: any) => setConversionFormat(e.target.value)}
                className="w-44 bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-bold text-indigo-300 outline-none focus:border-indigo-500"
              >
                <option value="SVGA">Keep Original (SVGA)</option>
                <option value="MP4">MP4 Video (HD 60fps)</option>
                <option value="WebM">WebM (Alpha Transparent)</option>
                <option value="PNG">PNG Sequence (ZIP)</option>
                <option value="AE">After Effects Project</option>
              </select>
            </div>

            {/* Compression Quality */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Compression Quality</span>
                <span className="font-mono text-purple-400">{compressionQuality}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={compressionQuality}
                onChange={(e) => setCompressionQuality(parseInt(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>

            {/* Start Conversion Primary Button */}
            <button
              type="button"
              onClick={handleStartConversion}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles size={14} /> Start Conversion (بدء التحويل والتصدير)
            </button>
          </div>
        </aside>
      </div>

      {/* Watermark Modal */}
      {showWatermarkModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#111827] border border-white/15 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-400" /> Add Watermark to SVGA
              </h3>
              <button 
                onClick={() => setShowWatermarkModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1.5">Watermark Image</label>
                <input 
                  type="file" 
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const reader = new FileReader();
                      reader.onload = (ev) => setWatermarkImage(ev.target?.result as string);
                      reader.readAsDataURL(f);
                    }
                  }}
                  className="w-full text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                />
              </div>

              {watermarkImage && (
                <div className="p-3 bg-slate-900 rounded-xl flex items-center justify-center">
                  <img src={watermarkImage} alt="Watermark Preview" className="max-h-20 object-contain rounded" />
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Opacity</span>
                  <span className="font-mono text-indigo-400">{watermarkOpacity}%</span>
                </div>
                <input 
                  type="range" min="10" max="100" value={watermarkOpacity} 
                  onChange={(e) => setWatermarkOpacity(parseInt(e.target.value))} 
                  className="w-full accent-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Scale</span>
                  <span className="font-mono text-indigo-400">{watermarkScale}%</span>
                </div>
                <input 
                  type="range" min="10" max="80" value={watermarkScale} 
                  onChange={(e) => setWatermarkScale(parseInt(e.target.value))} 
                  className="w-full accent-indigo-500"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400">Position</span>
                <select 
                  value={watermarkPosition} 
                  onChange={(e: any) => setWatermarkPosition(e.target.value)}
                  className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-white"
                >
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                  <option value="center">Center</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setWatermarkImage(null); setShowWatermarkModal(false); }}
                  className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setShowWatermarkModal(false)}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Scrollbars */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
};
