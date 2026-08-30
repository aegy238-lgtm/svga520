import React, { useState, useRef, useEffect, useCallback } from 'react';
import { UserRecord } from '../types';
import { useAccessControl } from '../hooks/useAccessControl';
import { 
  Type, ImageIcon, Layers, Download, Trash, Copy, ChevronUp, ChevronDown, 
  AlignLeft, AlignCenter, AlignRight, X, Upload, Move, Maximize, RotateCcw, 
  Settings, Save, Palette, Eye, EyeOff, ChevronsUp, ChevronsDown, Sparkles
} from 'lucide-react';
import { toPng, toJpeg, toSvg, toBlob } from 'html-to-image';
import { motion, AnimatePresence } from 'motion/react';
import { parseSVGA, encodeSVGA } from '../utils/svgaEncoder';
import SVGAPlayer from './SVGAPlayer';

interface BaseLayer {
  id: string;
  type: 'text' | 'image' | 'svga';
  name: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  zIndex: number;
  visible: boolean;
}

interface TextLayer extends BaseLayer {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  letterSpacing: number;
  lineHeight: number;
  textAlign: 'left' | 'center' | 'right';
  is3D: boolean;
  depthColor: string;
  depthSize: number;
  shadowIntensity: number;
  shadowColor: string;
}

interface ImageLayer extends BaseLayer {
  type: 'image';
  src: string;
  opacity: number;
  locked?: boolean;
}

interface SvgaLayer extends BaseLayer {
  type: 'svga';
  opacity: number;
  movieData: any;
  fileBuffer: ArrayBuffer;
}

type CanvasLayer = TextLayer | ImageLayer | SvgaLayer;

interface ImageEditorProps {
  currentUser: UserRecord | null;
  onCancel: () => void;
  onLoginRequired: () => void;
  onSubscriptionRequired: () => void;
  globalQuality?: 'low' | 'medium' | 'high';
}

const FONTS = [
  'Inter', 'Space Grotesk', 'JetBrains Mono', 'Cinzel', 
  'Playfair Display', 'Oswald', 'Poppins', 'Cairo', 'Tajawal', 'Almarai', 'sans-serif', 'serif', 'monospace'
];

const generateDecorations = (text: string) => {
   if (!text) return [];
   const azArr = Array.from("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ");
   const dsArr = Array.from("𝕒𝕓𝕔𝕕𝕖𝕗𝕘𝕙𝕚𝕛𝕜𝕝𝕞𝕟𝕠𝕡𝕢𝕣𝕤𝕥𝕦𝕧𝕨𝕩𝕪𝕫𝔸𝔹ℂ𝔻𝔼𝔽𝔾ℍ𝕀𝕁𝕂𝕃𝕄ℕ𝕆ℙℚℝ𝕊𝕋𝕌𝕍𝕎𝕏𝕐ℤ");
   const scArr = Array.from("𝒶𝒷𝒸𝒹𝑒𝒻𝑔𝒽𝒾𝒿𝓀𝓁𝓂𝓃𝑜𝓅𝓆𝓇𝓈𝓉𝓊𝓋𝓌𝓍𝓎𝓏𝒜𝐵𝒞𝒟𝐸𝐹𝒢𝐻𝐼𝒥𝒦𝐿𝑀𝒩𝒪𝒫𝒬𝑅𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵");
   const frArr = Array.from("𝔞𝔟𝔠𝔡𝔢𝔣𝔤𝔥𝔦𝔧𝔨𝔩𝔪𝔫𝔬𝔭𝔮𝔯𝔰𝔱𝔲𝔳𝔴𝔵𝔶𝔷𝔄𝔅ℭ𝔇𝔈𝔉𝔊ℌℑ𝔍𝔎𝔏𝔐𝔑𝔒𝔓𝔔ℜ𝔖𝔗𝔘𝔙𝔚𝔛𝔜ℨ");
   const ciArr = Array.from("ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ");

   const applyMap = (str: string, toArr: string[]) => {
       return Array.from(str).map(c => {
           let idx = azArr.indexOf(c);
           return idx !== -1 ? toArr[idx] : c;
       }).join('');
   };

   let results: string[] = [];

   results.push(applyMap(text, dsArr));
   results.push(applyMap(text, scArr));
   results.push(applyMap(text, frArr));
   results.push(applyMap(text, ciArr));

   const mixedDecos = [
      `꧁ ${text} ꧂`,
      `★·.·´¯\`·.·★ ${text} ★·.·´¯\`·.·★`,
      `۝ ${text} ۝`,
      `【 ${text} 】`,
      `⫷ ${text} ⫸`,
      `Oº°‘¨ ${text} ¨‘°ºO`,
      `ـ๑ـ ${text} ـ๑ـ`,
      `•´¯\`•. ${text} .•´¯\`•`,
      `(¯\`·.¸¸.·´¯\`·.¸¸.-> ${text} <-.¸¸.·´¯\`·.¸¸.·´¯)`,
      `ـﮩﮩ٨ـ ${text} ـﮩﮩ٨ـ`,
      `°°°·.°·..·°¯°·._.· ${text} ·._.·°¯°·.·° .·°°°`,
      `▌│█║▌║▌║ ${text} ║▌║▌║█│▌`,
      `ıllıllı ${text} ıllıllı`,
      `×º°”˜\`”°º× ${text} ×º°”˜\`”°º×`,
      `..|..< ${text} >..|..`,
      `✧○ꊞ○✧ ${text} ✧○ꊞ○✧`,
      `︵‿︵‿୨♡୧‿︵‿︵ ${text} ︵‿︵‿୨♡୧‿︵‿︵`,
      `♜ ${text} ♜`,
      `[̲̅${text}]̲̅`,
      `✿.｡.:* ☆:**:. ${text} .:**:.☆*.:｡.✿`,
      `╔═════ஓ๑♡๑ஓ═════╗\n${text}\n╚═════ஓ๑♡๑ஓ═════╝`,
   ];
   
   results.push(...mixedDecos);
   
   // Arabic specific replacements
   const arTransformer1 = (t: string) => t.replace(/ا/g, 'ٱ').replace(/ك/g, 'ڪ').replace(/ي/g, 'ى').replace(/ق/g, 'ڨ').replace(/ل/g, 'ڵ').replace(/ه/g, 'ھ').replace(/و/g, 'ۆ').replace(/ت/g, 'ٺ');
   const arTransformer2 = (t: string) => t.replace(/ا/g, 'إ').replace(/س/g, 'ښ').replace(/ش/g, 'ڜ').replace(/ص/g, 'ڝ').replace(/ض/g, 'ڞ').replace(/ع/g, '؏').replace(/غ/g, 'ڠ').replace(/ف/g, 'ڢ');
   
   results.push(arTransformer1(text));
   results.push(arTransformer2(text));
   
   // Add tatweel (kashida) effectively
   results.push(Array.from(text).join('ـ'));
   results.push(Array.from(text).join('ــ'));
   results.push(Array.from(text).map(c => c + 'ٌ').join(''));
   results.push(Array.from(text).map(c => c + 'ّ').join(''));

   // Complex Arabic Borders
   const arabicBorders = [
      `«—• ${text} •—»`,
      `๑۞๑,¸¸,ø¤º°\`°๑۩ ${text} ๑۩ ,¸¸,ø¤º°\`°๑۞๑`,
      `◥ ツ ${text} ツ ◤`,
      `⫷ ${text} ⫸`,
      `ஜ۩۞۩ஜ ${text} ஜ۩۞۩ஜ`,
      `๑۩ﺴ ${text} ﺴ۩๑`,
      `╰⊱♥⊱╮ ${text} ╭⊱♥≺`,
      `¨'*·~-.¸¸,.-~* ${text} ¨'*·~-.¸¸,.-~*`,
      `★彡 ${text} 彡★`,
      `▓▓▓▓▓ { ${text} } ▓▓▓▓▓`,
      `⋐⋑⋐⋑⋐⋑ ${text} ⋐⋑⋐⋑⋐⋑`,
      `•°¯\`•• ${text} ••´¯°•`
   ];
   results.push(...arabicBorders);

   return Array.from(new Set(results)).filter(r => r !== text);
};

export const ImageEditor: React.FC<ImageEditorProps> = ({ currentUser, onCancel, onLoginRequired, onSubscriptionRequired }) => {
  const { checkAccess } = useAccessControl();
  
  const [layers, setLayers] = useState<CanvasLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [canvasBg, setCanvasBg] = useState<string>('transparent');
  const [canvasWidth, setCanvasWidth] = useState<number>(800);
  const [canvasHeight, setCanvasHeight] = useState<number>(600);
  
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpg' | 'svg' | 'webp' | 'svga'>('png');
  const [exportScale, setExportScale] = useState<number>(1);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDecorationsModal, setShowDecorationsModal] = useState(false);
  
  const stageRef = useRef<HTMLDivElement>(null);

  const activeLayer = layers.find(l => l.id === activeLayerId);

  const addImageLayer = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.svga')) {
       try {
          const svgaData = await parseSVGA(file);
          const buffer = await file.arrayBuffer();
          const w = svgaData.params?.viewBoxWidth || 800;
          const h = svgaData.params?.viewBoxHeight || 600;

          const newLayer: SvgaLayer = {
            id: Date.now().toString(),
            type: 'svga',
            name: `SVGA ${layers.filter(l => l.type === 'svga').length + 1}`,
            movieData: svgaData,
            fileBuffer: buffer,
            x: 0,
            y: 0,
            rotation: 0,
            scale: 1,
            zIndex: layers.length,
            visible: true,
            opacity: 100,
          };
          
          if (layers.length === 0) {
            const scale = Math.min(800 / w, 600 / h, 1);
            setCanvasWidth(w * scale);
            setCanvasHeight(h * scale);
            newLayer.scale = scale;
          } else {
            newLayer.scale = Math.min(canvasWidth / w, canvasHeight / h, 1) * 0.8;
          }
          
          setLayers(prev => [...prev, newLayer]);
          setActiveLayerId(newLayer.id);
       } catch (err) {
         console.error('Failed to parse SVGA:', err);
         alert('Failed to parse SVGA file. Please check if it is SVGA 2.0.');
       }
       return;
    }

    const img = new Image();
    const reader = new FileReader();
    reader.onload = (event) => {
      img.onload = () => {
        const newLayer: ImageLayer = {
          id: Date.now().toString(),
          type: 'image',
          name: `Image ${layers.filter(l => l.type === 'image').length + 1}`,
          src: event.target?.result as string,
          x: 0,
          y: 0,
          rotation: 0,
          scale: 1,
          zIndex: layers.length,
          visible: true,
          opacity: 100,
        };
        
        // If it's the very first layer, let's adjust canvas size to roughly fit it
        if (layers.length === 0) {
           const maxW = 1000;
           let w = img.width;
           let h = img.height;
           if (w > maxW) {
             h = Math.round((h * maxW) / w);
             w = maxW;
           }
           setCanvasWidth(w);
           setCanvasHeight(h);
        }
        
        setLayers(prev => [...prev, newLayer]);
        setActiveLayerId(newLayer.id);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  const addTextLayer = () => {
    const newLayer: TextLayer = {
      id: Date.now().toString(),
      type: 'text',
      name: `Text ${layers.filter(l => l.type === 'text').length + 1}`,
      text: 'Double click to edit\nأدخل النص هنا',
      x: 100,
      y: 100,
      rotation: 0,
      scale: 1,
      zIndex: layers.length,
      visible: true,
      fontSize: 48,
      fontFamily: 'Cairo',
      color: '#ffffff',
      letterSpacing: 0,
      lineHeight: 1.2,
      textAlign: 'center',
      is3D: false,
      depthColor: '#6366f1',
      depthSize: 5,
      shadowIntensity: 50,
      shadowColor: '#000000'
    };
    setLayers(prev => [...prev, newLayer]);
    setActiveLayerId(newLayer.id);
  };

  const updateLayer = (id: string, updates: Partial<CanvasLayer>) => {
    setLayers(prev => prev.map(layer => 
      layer.id === id ? { ...layer, ...updates } as CanvasLayer : layer
    ));
  };

  const deleteLayer = (id: string) => {
    setLayers(prev => prev.filter(layer => layer.id !== id));
    if (activeLayerId === id) setActiveLayerId(null);
  };

  const duplicateLayer = (id: string) => {
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    
    const newLayer = {
      ...layer,
      id: Date.now().toString(),
      name: `${layer.name} Copy`,
      x: layer.x + 20,
      y: layer.y + 20,
      zIndex: layers.length
    } as CanvasLayer;
    
    setLayers(prev => [...prev, newLayer]);
    setActiveLayerId(newLayer.id);
  };

  const changeZIndex = (id: string, direction: 'up' | 'down') => {
    const currentIndex = layers.findIndex(l => l.id === id);
    if (currentIndex === -1) return;
    
    const newLayers = [...layers];
    if (direction === 'up' && currentIndex < newLayers.length - 1) {
       // Swap with next
       const nextLayerId = newLayers[currentIndex + 1].id;
       newLayers[currentIndex].zIndex += 1;
       newLayers[currentIndex + 1].zIndex -= 1;
    } else if (direction === 'down' && currentIndex > 0) {
       // Swap with prev
       const prevLayerId = newLayers[currentIndex - 1].id;
       newLayers[currentIndex].zIndex -= 1;
       newLayers[currentIndex - 1].zIndex += 1;
    }
    
    // Re-sort by zIndex
    setLayers(newLayers.sort((a, b) => a.zIndex - b.zIndex).map((l, i) => ({...l, zIndex: i})));
  };

  // Generate CSS text shadow for 3D effect
  const generate3DTextShadow = (layer: TextLayer) => {
    if (!layer.is3D) {
      if (layer.shadowIntensity > 0) {
         return `0px ${layer.shadowIntensity / 10}px ${layer.shadowIntensity / 5}px ${layer.shadowColor}`;
      }
      return 'none';
    }
    
    let shadows = [];
    // Depth extrusion
    for (let i = 1; i <= layer.depthSize; i++) {
      shadows.push(`${i}px ${i}px 0px ${layer.depthColor}`);
    }
    // Drop shadow at the end
    if (layer.shadowIntensity > 0) {
      const dropShadowPos = layer.depthSize + (layer.shadowIntensity / 10);
      shadows.push(`${dropShadowPos}px ${dropShadowPos}px ${layer.shadowIntensity / 2}px ${layer.shadowColor}`);
    }
    
    return shadows.join(', ');
  };

  const handleExport = async () => {
    if (!stageRef.current) return;
    try {
      setIsExporting(true);
      
      // Temporarily deselect so bounding boxes don't render
      const prevActive = activeLayerId;
      setActiveLayerId(null);
      
      // Wait a tick for React to render without active selection
      await new Promise(r => setTimeout(r, 100));

      const opts = {
        quality: 1.0,
        pixelRatio: exportScale,
        style: {
           transform: 'scale(1)',
           transformOrigin: 'top left'
        }
      };

      let downloadUrl = '';
      let format = exportFormat;
      
      if (format === 'svga') {
        const svgaLayers = layers.filter(l => l.type === 'svga' && l.visible).sort((a, b) => a.zIndex - b.zIndex);
        const baseSvgaLayer = svgaLayers.length > 0 ? (svgaLayers[0] as SvgaLayer) : null;
        
        // Take a snapshot, but filter out the SVGA containers if we have a base SVGA (so they don't get snapshotted statically)
        const snapshotOpts = {
           ...opts,
           backgroundColor: baseSvgaLayer ? 'transparent' : (canvasBg === 'transparent' ? 'transparent' : canvasBg),
           filter: (node: HTMLElement) => !baseSvgaLayer || !node.classList?.contains('svga-layer-container')
        };
        
        const pngDataUrl = await toPng(stageRef.current, snapshotOpts);
        const binary = atob(pngDataUrl.split(',')[1]);
        const bytes = new Uint8Array(binary.length);
        for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
        
        const sw = canvasWidth * exportScale;
        const sh = canvasHeight * exportScale;
        
        let movieData: any;
        
        if (baseSvgaLayer && baseSvgaLayer.movieData) {
            // Clone base movieData structure to avoid mutating state
            movieData = {
               ...baseSvgaLayer.movieData,
               params: { ...baseSvgaLayer.movieData.params },
               images: { ...baseSvgaLayer.movieData.images },
               sprites: [ ...baseSvgaLayer.movieData.sprites ]
            };
            
            // Adjust to the editor's canvas size if different?
            // Actually it's safer to keep viewBox sizing and scale the overlay. 
            // Wait, the overlay we just generated is sized at `sw` x `sh`.
            movieData.params.viewBoxWidth = sw;
            movieData.params.viewBoxHeight = sh;
            
            const overlayKey = "overlay_" + Date.now();
            movieData.images[overlayKey] = bytes;
            
            const framesCount = movieData.params.frames || 1;
            const overlayFrames = [];
            for (let i = 0; i < framesCount; i++) {
               overlayFrames.push({
                  alpha: 1.0,
                  layout: { x: 0, y: 0, width: sw, height: sh },
                  transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
               });
            }
            
            // Place overlay sprite ON TOP
            movieData.sprites.push({
               imageKey: overlayKey,
               frames: overlayFrames
            });
            
        } else {
            // Standard single frame SVGA
            movieData = {
               version: "2.0",
               params: {
                  viewBoxWidth: sw,
                  viewBoxHeight: sh,
                  fps: 30,
                  frames: 1
               },
               images: { "export_img": bytes },
               sprites: [{
                  imageKey: "export_img",
                  frames: [{
                     alpha: 1.0,
                     layout: { x: 0, y: 0, width: sw, height: sh },
                     transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
                  }]
               }],
               audios: []
            };
        }
        
        const blob = await encodeSVGA(movieData);
        downloadUrl = URL.createObjectURL(blob);
      } else if (format === 'png') {
        downloadUrl = await toPng(stageRef.current, opts);
      } else if (format === 'jpg') {
        downloadUrl = await toJpeg(stageRef.current, { ...opts, backgroundColor: canvasBg === 'transparent' ? '#ffffff' : canvasBg });
      } else if (format === 'svg') {
        downloadUrl = await toSvg(stageRef.current, opts);
      } else if (format === 'webp') {
        // Need to use canvas to convert to webp
        const pngDataUrl = await toPng(stageRef.current, opts);
        const img = new Image();
        img.src = pngDataUrl;
        await new Promise(r => { img.onload = r; });
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
           if (canvasBg !== 'transparent') {
               ctx.fillStyle = canvasBg;
               ctx.fillRect(0, 0, canvas.width, canvas.height);
           }
           ctx.drawImage(img, 0, 0);
           downloadUrl = canvas.toDataURL('image/webp', 1.0);
        }
      }

      const link = document.createElement('a');
      link.download = `design_export_${Date.now()}.${format}`;
      link.href = downloadUrl;
      link.click();
      
      // Restore active layer
      setActiveLayerId(prevActive);
      setShowExportModal(false);
    } catch (err) {
      console.error("Export failed", err);
      alert("Failed to export. An error occurred.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0a] flex flex-col font-sans transition-colors duration-300">
      
      {/* Top Header */}
      <div className="h-16 bg-slate-900 border-b border-white/10 flex items-center justify-between px-6 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
            <Palette className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold tracking-wide">Design Studio PRO</h1>
            <p className="text-[10px] text-indigo-400 font-medium uppercase tracking-widest">Advanced Compositing Engine</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowExportModal(true)}
            disabled={layers.length === 0}
            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-all shadow-lg hover:shadow-indigo-500/25"
          >
            <Download className="w-4 h-4" />
            <span>حفظ الصورة (Export)</span>
          </button>
          
          <div className="w-px h-8 bg-white/10 mx-2"></div>
          
          <button 
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Layers & Tools */}
        <div className="w-72 bg-slate-900/50 border-r border-white/10 flex flex-col shrink-0">
          <div className="p-4 border-b border-white/10 flex justify-between gap-2 shrink-0">
             <label className="flex-1 flex flex-col items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 border border-dashed border-white/20 rounded-xl cursor-pointer transition-all">
                <ImageIcon className="w-5 h-5 text-indigo-400" />
                <span className="text-xs text-slate-300 font-medium whitespace-nowrap">Add Image</span>
                <input type="file" accept="image/*,.svg,.svga" className="hidden" onChange={addImageLayer} />
             </label>

             <button 
               onClick={addTextLayer}
               className="flex-1 flex flex-col items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 border border-dashed border-white/20 rounded-xl cursor-pointer transition-all"
             >
                <Type className="w-5 h-5 text-purple-400" />
                <span className="text-xs text-slate-300 font-medium whitespace-nowrap">Add Text</span>
             </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" /> Layers ({layers.length})
            </h3>
            
            <div className="flex flex-col-reverse gap-2">
               {layers.length === 0 ? (
                 <div className="text-center py-8 text-slate-500 text-sm">
                   No layers yet. Add an image or text to begin.
                 </div>
               ) : (
                 layers.slice().sort((a, b) => a.zIndex - b.zIndex).map(layer => (
                   <div 
                     key={layer.id}
                     onClick={() => setActiveLayerId(layer.id)}
                     className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                       activeLayerId === layer.id ? 'bg-indigo-500/20 border-indigo-500/50' : 'bg-white/5 border-transparent hover:bg-white/10'
                     }`}
                   >
                     <div className="flex items-center gap-3 overflow-hidden">
                       {layer.type === 'text' ? <Type className="w-4 h-4 text-purple-400 shrink-0" /> : layer.type === 'svga' ? <Sparkles className="w-4 h-4 text-pink-400 shrink-0" /> : <ImageIcon className="w-4 h-4 text-indigo-400 shrink-0" />}
                       <span className="text-sm text-slate-200 truncate">{layer.name}</span>
                     </div>
                     
                     <div className="flex items-center gap-1 shrink-0">
                        <button 
                          onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }); }}
                          className="p-1 text-slate-500 hover:text-white"
                        >
                          {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }}
                          className="p-1 text-slate-500 hover:text-red-400"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                     </div>
                   </div>
                 ))
               )}
            </div>
          </div>
          
          {/* Canvas Settings */}
          <div className="p-4 border-t border-white/10 bg-black/20 shrink-0">
             <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-3">
               <Settings className="w-3.5 h-3.5" /> Canvas Properties
             </h3>
             <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                   <div>
                     <label className="block text-[10px] text-slate-400 mb-1">Width</label>
                     <input type="number" value={canvasWidth} onChange={(e) => setCanvasWidth(Number(e.target.value))} className="w-full bg-black/50 border border-white/10 rounded px-2 py-1.5 text-xs text-white" />
                   </div>
                   <div>
                     <label className="block text-[10px] text-slate-400 mb-1">Height</label>
                     <input type="number" value={canvasHeight} onChange={(e) => setCanvasHeight(Number(e.target.value))} className="w-full bg-black/50 border border-white/10 rounded px-2 py-1.5 text-xs text-white" />
                   </div>
                </div>
                <div>
                   <label className="block text-[10px] text-slate-400 mb-1">Background Color (transparent = empty)</label>
                   <div className="flex gap-2">
                     <input type="color" value={canvasBg === 'transparent' ? '#ffffff' : canvasBg} onChange={(e) => setCanvasBg(e.target.value)} className="h-8 w-1/2 p-0 border-0 rounded bg-transparent cursor-pointer" />
                     <button 
                       onClick={() => setCanvasBg(canvasBg === 'transparent' ? '#ffffff' : 'transparent')}
                       className={`w-1/2 text-xs rounded border ${canvasBg === 'transparent' ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}
                     >
                       Transparent
                     </button>
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* Center Canvas Area (Interactive Stage) */}
        <div className="flex-1 bg-[#121212] overflow-auto relative flex items-center justify-center p-8 bg-[radial-gradient(#ffffff11_1px,transparent_1px)] [background-size:20px_20px]">
          
          <div 
            ref={stageRef}
            className="relative shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-all duration-300 overflow-hidden select-none"
            style={{ 
               width: canvasWidth, 
               height: canvasHeight, 
               backgroundColor: canvasBg === 'transparent' ? 'transparent' : canvasBg,
               backgroundImage: canvasBg === 'transparent' && !isExporting ? 'url("data:image/svg+xml,%3Csvg width=\'16\' height=\'16\' viewBox=\'0 0 16 16\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h8v8H0zm8 8h8v8H8z\' fill=\'%23222\'/%3E%3Cpath d=\'M8 0h8v8H8zM0 8h8v8H0z\' fill=\'%23333\'/%3E%3C/svg%3E")' : 'none'
            }}
            onClick={(e) => {
               if (e.target === e.currentTarget) {
                  setActiveLayerId(null);
               }
            }}
          >
             {layers.filter(l => l.visible).sort((a, b) => a.zIndex - b.zIndex).map(layer => {
               const isActive = activeLayerId === layer.id;
               
               if (layer.type === 'text') {
                 const textLayer = layer as TextLayer;
                 return (
                   <motion.div
                     key={layer.id}
                     drag
                     dragMomentum={false}
                     onDrag={(e, info) => {
                        updateLayer(layer.id, { x: layer.x + info.delta.x, y: layer.y + info.delta.y });
                     }}
                     onClick={(e) => {
                       e.stopPropagation();
                       setActiveLayerId(layer.id);
                     }}
                     style={{
                       position: 'absolute',
                       left: layer.x,
                       top: layer.y,
                       rotate: layer.rotation,
                       scale: layer.scale,
                       transformOrigin: 'center center',
                       zIndex: layer.zIndex,
                       cursor: 'grab',
                       color: textLayer.color,
                       fontFamily: textLayer.fontFamily,
                       fontSize: `${textLayer.fontSize}px`,
                       letterSpacing: `${textLayer.letterSpacing}px`,
                       lineHeight: textLayer.lineHeight,
                       textAlign: textLayer.textAlign,
                       textShadow: generate3DTextShadow(textLayer),
                       whiteSpace: 'pre-wrap',
                       padding: '10px',
                       outline: isActive && !isExporting ? '2px dashed #6366f1' : 'none',
                       outlineOffset: '4px'
                     }}
                     whileTap={{ cursor: 'grabbing' }}
                   >
                     {textLayer.text}
                   </motion.div>
                 );
               }
               
               if (layer.type === 'svga') {
                 const svgaLayer = layer as SvgaLayer;
                 return (
                   <motion.div
                     key={layer.id}
                     drag
                     dragMomentum={false}
                     onDrag={(e, info) => {
                        updateLayer(layer.id, { x: layer.x + info.delta.x, y: layer.y + info.delta.y });
                     }}
                     onClick={(e) => {
                       e.stopPropagation();
                       setActiveLayerId(layer.id);
                     }}
                     className="svga-layer-container"
                     style={{
                       position: 'absolute',
                       left: layer.x,
                       top: layer.y,
                       rotate: layer.rotation,
                       scale: layer.scale,
                       transformOrigin: 'center center',
                       zIndex: layer.zIndex,
                       cursor: 'grab',
                       opacity: svgaLayer.opacity / 100,
                       outline: isActive && !isExporting ? '2px dashed #6366f1' : 'none',
                       outlineOffset: '2px',
                       width: (svgaLayer.movieData.params?.viewBoxWidth || 800) + 'px',
                       height: (svgaLayer.movieData.params?.viewBoxHeight || 600) + 'px'
                     }}
                     whileTap={{ cursor: 'grabbing' }}
                   >
                     <div style={{ pointerEvents: 'none', width: '100%', height: '100%' }}>
                       <SVGAPlayer data={svgaLayer.fileBuffer} className="w-full h-full" />
                     </div>
                   </motion.div>
                 );
               }

               if (layer.type === 'image') {
                 const imgLayer = layer as ImageLayer;
                 return (
                   <motion.div
                     key={layer.id}
                     drag
                     dragMomentum={false}
                     onDrag={(e, info) => {
                        updateLayer(layer.id, { x: layer.x + info.delta.x, y: layer.y + info.delta.y });
                     }}
                     onClick={(e) => {
                       e.stopPropagation();
                       setActiveLayerId(layer.id);
                     }}
                     style={{
                       position: 'absolute',
                       left: layer.x,
                       top: layer.y,
                       rotate: layer.rotation,
                       scale: layer.scale,
                       transformOrigin: 'center center',
                       zIndex: layer.zIndex,
                       cursor: 'grab',
                       opacity: imgLayer.opacity / 100,
                       outline: isActive && !isExporting ? '2px dashed #6366f1' : 'none',
                       outlineOffset: '2px'
                     }}
                     whileTap={{ cursor: 'grabbing' }}
                   >
                     <img 
                       src={imgLayer.src} 
                       alt="Layer" 
                       draggable={false}
                       style={{ pointerEvents: 'none', display: 'block' }}
                     />
                   </motion.div>
                 );
               }
               return null;
             })}
          </div>
        </div>

        {/* Right Sidebar - Properties Panel */}
        <div className="w-80 bg-slate-900/50 border-l border-white/10 flex flex-col shrink-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeLayer ? (
            <div className="p-5 flex flex-col gap-6">
              
              {/* Layer Header Actions */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                 <h2 className="text-sm font-bold text-white flex items-center gap-2">
                   {activeLayer.type === 'text' ? <Type className="w-4 h-4 text-purple-400" /> : activeLayer.type === 'svga' ? <Sparkles className="w-4 h-4 text-pink-400" /> : <ImageIcon className="w-4 h-4 text-indigo-400" />}
                   Edit {activeLayer.type === 'text' ? 'Text' : activeLayer.type === 'svga' ? 'Animation' : 'Image'}
                 </h2>
                 <div className="flex gap-1">
                   <button onClick={() => changeZIndex(activeLayer.id, 'up')} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded" title="Bring Forward">
                      <ChevronsUp className="w-4 h-4" />
                   </button>
                   <button onClick={() => changeZIndex(activeLayer.id, 'down')} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded" title="Send Backward">
                      <ChevronsDown className="w-4 h-4" />
                   </button>
                   <button onClick={() => duplicateLayer(activeLayer.id)} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded" title="Duplicate">
                      <Copy className="w-4 h-4" />
                   </button>
                   <button onClick={() => deleteLayer(activeLayer.id)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded" title="Delete">
                      <Trash className="w-4 h-4" />
                   </button>
                 </div>
              </div>

              {/* Transform Controls (Common) */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <Move className="w-3 h-3" /> Transform & Position
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="flex justify-between text-[10px] text-slate-400 mb-1">
                       <span>Scale: {(activeLayer.scale).toFixed(2)}x</span>
                     </label>
                     <input 
                       type="range" min="0.1" max="5" step="0.05" 
                       value={activeLayer.scale} 
                       onChange={(e) => updateLayer(activeLayer.id, { scale: parseFloat(e.target.value) })}
                       className="w-full accent-indigo-500"
                     />
                  </div>
                  <div>
                     <label className="flex justify-between text-[10px] text-slate-400 mb-1">
                       <span>Rotation: {activeLayer.rotation}°</span>
                     </label>
                     <input 
                       type="range" min="-180" max="180" step="1" 
                       value={activeLayer.rotation} 
                       onChange={(e) => updateLayer(activeLayer.id, { rotation: parseInt(e.target.value) })}
                       className="w-full accent-indigo-500"
                     />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mt-2">
                   <div className="flex items-center bg-black/30 rounded px-2 border border-white/5">
                     <span className="text-[10px] text-slate-500 mr-2">X:</span>
                     <input 
                       type="number" 
                       value={Math.round(activeLayer.x)} 
                       onChange={(e) => updateLayer(activeLayer.id, { x: parseInt(e.target.value) || 0 })}
                       className="w-full bg-transparent py-1 text-xs text-white outline-none"
                     />
                   </div>
                   <div className="flex items-center bg-black/30 rounded px-2 border border-white/5">
                     <span className="text-[10px] text-slate-500 mr-2">Y:</span>
                     <input 
                       type="number" 
                       value={Math.round(activeLayer.y)} 
                       onChange={(e) => updateLayer(activeLayer.id, { y: parseInt(e.target.value) || 0 })}
                       className="w-full bg-transparent py-1 text-xs text-white outline-none"
                     />
                   </div>
                </div>
              </div>

              {/* Text specific controls */}
              {activeLayer.type === 'text' && (
                <>
                  <div className="space-y-4 pt-4 border-t border-white/10">
                    <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                       <Type className="w-3 h-3" /> Text Content
                    </h3>
                    <textarea 
                      value={(activeLayer as TextLayer).text}
                      onChange={(e) => updateLayer(activeLayer.id, { text: e.target.value })}
                      className="w-full h-24 bg-black/50 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-indigo-500 outline-none resize-none"
                      dir="auto"
                    />
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/10">
                    <div className="flex justify-between items-center">
                       <h3 className="text-xs font-bold text-slate-500 uppercase">Typography</h3>
                       <button 
                         onClick={() => setShowDecorationsModal(true)}
                         className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/40 hover:to-pink-500/40 text-purple-300 hover:text-white rounded-lg text-[10px] font-bold uppercase transition-all border border-purple-500/30"
                       >
                         <Sparkles className="w-3 h-3" />
                         مكتبة الزخارف
                       </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 flex gap-2">
                        <select 
                          value={(activeLayer as TextLayer).fontFamily}
                          onChange={(e) => updateLayer(activeLayer.id, { fontFamily: e.target.value })}
                          className="flex-1 bg-black/50 border border-white/10 rounded px-2 py-2 text-xs text-white outline-none"
                        >
                          {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <input 
                          type="color" 
                          value={(activeLayer as TextLayer).color} 
                          onChange={(e) => updateLayer(activeLayer.id, { color: e.target.value })}
                          className="w-10 h-8 rounded border-0 bg-transparent cursor-pointer self-center"
                        />
                      </div>
                      
                      <div>
                        <label className="text-[10px] text-slate-400 mb-1 block">Size</label>
                        <input 
                          type="number" value={(activeLayer as TextLayer).fontSize}
                          onChange={(e) => updateLayer(activeLayer.id, { fontSize: parseInt(e.target.value) })}
                          className="w-full bg-black/50 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">Align</label>
                        <div className="flex bg-black/50 rounded border border-white/10 p-0.5">
                          {['left', 'center', 'right'].map(align => (
                            <button
                              key={align}
                              onClick={() => updateLayer(activeLayer.id, { textAlign: align as any })}
                              className={`flex-1 flex justify-center py-1 rounded ${
                                (activeLayer as TextLayer).textAlign === align ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-500'
                              }`}
                            >
                              {align === 'left' ? <AlignLeft className="w-3.5 h-3.5" /> : align === 'center' ? <AlignCenter className="w-3.5 h-3.5" /> : <AlignRight className="w-3.5 h-3.5" />}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">Spacing</label>
                        <input 
                          type="range" min="-10" max="50" step="1" 
                          value={(activeLayer as TextLayer).letterSpacing} 
                          onChange={(e) => updateLayer(activeLayer.id, { letterSpacing: parseInt(e.target.value) })}
                          className="w-full accent-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">Line Height</label>
                        <input 
                          type="range" min="0.5" max="3" step="0.1" 
                          value={(activeLayer as TextLayer).lineHeight} 
                          onChange={(e) => updateLayer(activeLayer.id, { lineHeight: parseFloat(e.target.value) })}
                          className="w-full accent-purple-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-500 uppercase">Advanced 3D Effect</h3>
                      <button 
                        onClick={() => updateLayer(activeLayer.id, { is3D: !(activeLayer as TextLayer).is3D })}
                        className={`w-10 h-5 rounded-full relative transition-colors ${
                          (activeLayer as TextLayer).is3D ? 'bg-indigo-500' : 'bg-slate-700'
                        }`}
                      >
                        <span className={`absolute top-0.5 left-0.5 bottom-0.5 w-4 bg-white rounded-full transition-transform ${
                          (activeLayer as TextLayer).is3D ? 'translate-x-5' : 'translate-x-0'
                        }`}></span>
                      </button>
                    </div>
                    
                    <AnimatePresence>
                      {(activeLayer as TextLayer).is3D && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-4 overflow-hidden"
                        >
                          <div className="flex gap-4">
                            <div className="flex-1">
                              <label className="block text-[10px] text-slate-400 mb-1">Extrusion Depth Size</label>
                              <input 
                                type="range" min="1" max="50" step="1" 
                                value={(activeLayer as TextLayer).depthSize} 
                                onChange={(e) => updateLayer(activeLayer.id, { depthSize: parseInt(e.target.value) })}
                                className="w-full accent-indigo-500"
                              />
                            </div>
                            <div className="shrink-0 w-12">
                              <label className="block text-[10px] text-slate-400 mb-1">Color</label>
                              <input 
                                type="color" 
                                value={(activeLayer as TextLayer).depthColor} 
                                onChange={(e) => updateLayer(activeLayer.id, { depthColor: e.target.value })}
                                className="w-full h-8 rounded border-0 bg-transparent p-0 cursor-pointer"
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    <div className="flex gap-4 pt-2">
                       <div className="flex-1">
                         <label className="block text-[10px] text-slate-400 mb-1">Drop Shadow Intensity</label>
                         <input 
                           type="range" min="0" max="100" step="1" 
                           value={(activeLayer as TextLayer).shadowIntensity} 
                           onChange={(e) => updateLayer(activeLayer.id, { shadowIntensity: parseInt(e.target.value) })}
                           className="w-full accent-indigo-500"
                         />
                       </div>
                       <div className="shrink-0 w-12">
                         <label className="block text-[10px] text-slate-400 mb-1">Color</label>
                         <input 
                           type="color" 
                           value={(activeLayer as TextLayer).shadowColor} 
                           onChange={(e) => updateLayer(activeLayer.id, { shadowColor: e.target.value })}
                           className="w-full h-8 rounded border-0 bg-transparent p-0 cursor-pointer"
                         />
                       </div>
                     </div>
                  </div>
                </>
              )}

              {/* Image / SVGA specific controls */}
              {(activeLayer.type === 'image' || activeLayer.type === 'svga') && (
                <div className="space-y-4 pt-4 border-t border-white/10">
                   <h3 className="text-xs font-bold text-slate-500 uppercase">{activeLayer.type === 'svga' ? 'Animation Settings' : 'Image Filters'}</h3>
                   <div>
                     <label className="flex justify-between text-[10px] text-slate-400 mb-1">
                       <span>Opacity: {(activeLayer as ImageLayer).opacity}%</span>
                     </label>
                     <input 
                       type="range" min="0" max="100" step="1" 
                       value={(activeLayer as ImageLayer).opacity} 
                       onChange={(e) => updateLayer(activeLayer.id, { opacity: parseInt(e.target.value) })}
                       className="w-full accent-indigo-500"
                     />
                   </div>
                </div>
              )}
              
            </div>
          ) : (
            <div className="flex-1 flex flex-col p-6 text-slate-500 text-sm">
               <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 pt-10">
                 <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                   <Palette className="w-8 h-8 text-slate-600" />
                 </div>
                 <p className="max-w-[200px]">Select or create a layer to view its properties.</p>
               </div>
            </div>
          )}
          </div>
          
          <div className="shrink-0 p-5 border-t border-white/10 space-y-4 bg-slate-900/80 w-full mt-auto">
             <h3 className="text-xs font-bold text-white uppercase tracking-widest text-center mb-4">خيارات حفظ الصورة</h3>
             <button 
                onClick={() => { setExportFormat('png'); setShowExportModal(true); }}
                disabled={layers.length === 0}
                className="w-full flex items-center justify-between p-3 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-xl transition-all font-bold disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <Download className="w-5 h-5" />
                  <span>حفظ (PNG)</span>
                </div>
                <span className="text-[10px] bg-blue-500/20 px-2 py-0.5 rounded-full">شفاف</span>
             </button>
             <button 
                onClick={() => { setExportFormat('jpg'); setShowExportModal(true); }}
                disabled={layers.length === 0}
                className="w-full flex items-center justify-between p-3 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 rounded-xl transition-all font-bold disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <Download className="w-5 h-5" />
                  <span>حفظ (JPG)</span>
                </div>
                <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-full">قياسي</span>
             </button>
             <button 
                onClick={() => { setExportFormat('webp'); setShowExportModal(true); }}
                disabled={layers.length === 0}
                className="w-full flex items-center justify-between p-3 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/30 text-purple-400 rounded-xl transition-all font-bold disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <Download className="w-5 h-5" />
                  <span>حفظ (WEBP)</span>
                </div>
                <span className="text-[10px] bg-purple-500/20 px-2 py-0.5 rounded-full">سريع/ويب بي</span>
             </button>
             <button 
                onClick={() => { setExportFormat('svg'); setShowExportModal(true); }}
                disabled={layers.length === 0}
                className="w-full flex items-center justify-between p-3 bg-orange-600/10 hover:bg-orange-600/20 border border-orange-500/30 text-orange-400 rounded-xl transition-all font-bold disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <Download className="w-5 h-5" />
                  <span>حفظ (SVG)</span>
                </div>
                <span className="text-[10px] bg-orange-500/20 px-2 py-0.5 rounded-full">فيكتور</span>
             </button>
             <button 
                onClick={() => { setExportFormat('svga'); setShowExportModal(true); }}
                disabled={layers.length === 0}
                className="w-full flex items-center justify-between p-3 bg-pink-600/10 hover:bg-pink-600/20 border border-pink-500/30 text-pink-400 rounded-xl transition-all font-bold disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <Download className="w-5 h-5" />
                  <span>SVGA → Animated SVG</span>
                </div>
                <span className="text-[10px] bg-pink-500/20 px-2 py-0.5 rounded-full">أنيميشن/ملصق</span>
             </button>
          </div>
        </div>
      </div>
      
      {/* Export Modal Overlay */}
      <AnimatePresence>
         {showExportModal && (
           <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
           >
             <motion.div 
               initial={{ scale: 0.9, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
             >
                <div className="p-5 border-b border-white/10 flex justify-between items-center bg-slate-800/50">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <Download className="w-4 h-4 text-indigo-400" /> حفظ الصورة (Export Design)
                  </h3>
                  <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="p-5 space-y-5">
                   <div>
                     <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Format</label>
                     <div className="grid grid-cols-5 gap-2">
                       {['png', 'jpg', 'webp', 'svg', 'svga'].map(format => (
                         <button
                           key={format}
                           onClick={() => setExportFormat(format as any)}
                           className={`py-2 rounded-lg text-sm font-bold uppercase transition-all ${
                             exportFormat === format 
                               ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' 
                               : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                           }`}
                         >
                           {format}
                         </button>
                       ))}
                     </div>
                   </div>
                   
                   <div>
                     <label className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                       <span>Quality Scale</span>
                       <span className="text-white">{exportScale}x ({(canvasWidth * exportScale).toFixed()}px × {(canvasHeight * exportScale).toFixed()}px)</span>
                     </label>
                     <input 
                       type="range" min="0.5" max="4" step="0.5" 
                       value={exportScale} 
                       onChange={(e) => setExportScale(parseFloat(e.target.value))}
                       className="w-full accent-purple-500"
                     />
                   </div>
                   
                   <button 
                     onClick={handleExport}
                     disabled={isExporting}
                     className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl mt-4 transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
                   >
                     {isExporting ? 'Exporting processing...' : 'Download Now (حفظ الآن)'}
                   </button>
                </div>
             </motion.div>
           </motion.div>
         )}
      </AnimatePresence>

      {/* Decorations Modal Overlay */}
      <AnimatePresence>
         {showDecorationsModal && activeLayer?.type === 'text' && (
           <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
           >
             <motion.div 
               initial={{ scale: 0.9, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
             >
                <div className="p-5 border-b border-white/10 flex justify-between items-center bg-slate-800/50 shrink-0">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" /> مكتبة الزخارف (Decoration Library)
                  </h3>
                  <button onClick={() => setShowDecorationsModal(false)} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                     {generateDecorations((activeLayer as TextLayer).text).map((decoratedText, i) => (
                        <button
                          key={i}
                          onClick={() => {
                             updateLayer(activeLayer.id, { text: decoratedText });
                             setShowDecorationsModal(false);
                          }}
                          className="bg-white/5 hover:bg-indigo-500/20 border border-white/5 hover:border-indigo-500/50 p-4 rounded-xl text-center transition-all group"
                        >
                          <span className="text-white font-medium text-lg pointer-events-none group-hover:text-indigo-300 drop-shadow-sm">{decoratedText}</span>
                        </button>
                     ))}
                   </div>
                </div>
             </motion.div>
           </motion.div>
         )}
      </AnimatePresence>

    </div>
  );
};
