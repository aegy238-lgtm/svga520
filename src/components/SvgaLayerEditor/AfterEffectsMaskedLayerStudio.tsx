import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Layers, Upload, X, Eye, EyeOff, Lock, Unlock, Play, Pause, Download } from 'lucide-react';

// ==========================================
// 1. الأنواع والواجهات البرمجية (Types & Interfaces)
// ==========================================

export interface Keyframe<T> {
  frame: number;
  value: T;
}

export interface AELayer {
  id: string;
  name: string;
  kind: 'image' | 'shape' | 'text' | 'solid';
  visible: boolean;
  locked: boolean;
  
  // خصائص التحويل والتحريك
  position: { x: number; y: number };
  scale: number;
  rotation: number;
  opacity: number;
  
  // مسارات الفريمات المفتاحية (Keyframes)
  positionKeyframes?: Keyframe<{ x: number; y: number }>[];
  scaleKeyframes?: Keyframe<number>[];
  rotationKeyframes?: Keyframe<number>[];
  opacityKeyframes?: Keyframe<number>[];

  // بيانات الصورة
  imageSrc?: string;
  imageElement?: HTMLImageElement | null;
  width?: number;
  height?: number;

  // ⭐️ المفتاح الأساسي لميزة الطبقة المدمجة (Alpha Matte / Clipping Mask)
  clipToLayerId?: string; // إذا وجد، تصبح هذه الطبقة مقصوصة ومدمجة داخل حدود الطبقة الأم
  blendMode?: 'source-atop' | 'source-over' | 'multiply' | 'screen';
}

// ==========================================
// 2. المكون البرمجي الرئيسي (Main Component)
// ==========================================

export const AfterEffectsMaskedLayerStudio: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  // إعدادات مساحة العمل (Composition Settings)
  const [compWidth, setCompWidth] = useState<number>(500);
  const [compHeight, setCompHeight] = useState<number>(500);
  const [fps, setFps] = useState<number>(30);
  const [totalFrames, setTotalFrames] = useState<number>(90);
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // قائمة الطبقات والطبقة المحددة حالياً
  const [layers, setLayers] = useState<AELayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  // مراجع الكانفاس وزر الرفع المخفي
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const additionalLayerFileInputRef = useRef<HTMLInputElement | null>(null);
  const mainImageInputRef = useRef<HTMLInputElement | null>(null);

  // الطبقة المحددة الحالية
  const selectedLayer = useMemo(() => {
    return layers.find(l => l.id === selectedLayerId) || null;
  }, [layers, selectedLayerId]);

  // ==========================================
  // 3. دوال التحريك وحساب الإحداثيات (Interpolation)
  // ==========================================

  const interpolateNumber = (keyframes: Keyframe<number>[] | undefined, frame: number, defaultVal: number): number => {
    if (!keyframes || keyframes.length === 0) return defaultVal;
    if (keyframes.length === 1 || frame <= keyframes[0].frame) return keyframes[0].value;
    if (frame >= keyframes[keyframes.length - 1].frame) return keyframes[keyframes.length - 1].value;

    for (let i = 0; i < keyframes.length - 1; i++) {
      const kf1 = keyframes[i];
      const kf2 = keyframes[i + 1];
      if (frame >= kf1.frame && frame <= kf2.frame) {
        const t = (frame - kf1.frame) / (kf2.frame - kf1.frame);
        return kf1.value + (kf2.value - kf1.value) * t;
      }
    }
    return defaultVal;
  };

  const evaluateLayerTransform = useCallback((layer: AELayer, frame: number) => {
    const scale = interpolateNumber(layer.scaleKeyframes, frame, layer.scale);
    const rotation = interpolateNumber(layer.rotationKeyframes, frame, layer.rotation);
    const opacity = interpolateNumber(layer.opacityKeyframes, frame, layer.opacity);

    let posX = layer.position.x;
    let posY = layer.position.y;
    if (layer.positionKeyframes && layer.positionKeyframes.length > 0) {
      const kfs = layer.positionKeyframes;
      if (frame <= kfs[0].frame) {
        posX = kfs[0].value.x;
        posY = kfs[0].value.y;
      } else if (frame >= kfs[kfs.length - 1].frame) {
        posX = kfs[kfs.length - 1].value.x;
        posY = kfs[kfs.length - 1].value.y;
      } else {
        for (let i = 0; i < kfs.length - 1; i++) {
          if (frame >= kfs[i].frame && frame <= kfs[i + 1].frame) {
            const t = (frame - kfs[i].frame) / (kfs[i + 1].frame - kfs[i].frame);
            posX = kfs[i].value.x + (kfs[i + 1].value.x - kfs[i].value.x) * t;
            posY = kfs[i].value.y + (kfs[i + 1].value.y - kfs[i].value.y) * t;
            break;
          }
        }
      }
    }

    return { pos: { x: posX, y: posY }, scale, rotation, opacity };
  }, []);

  // ==========================================
  // 4. محرك الرسم بالكانفاس مع دعم القناع والدمج (Canvas Engine)
  // ==========================================

  const drawLayer = useCallback((ctx: CanvasRenderingContext2D, layer: AELayer, frame: number, w: number, h: number) => {
    if (!layer.visible || !layer.imageElement) return;

    const { pos, scale, rotation, opacity } = evaluateLayerTransform(layer, frame);
    if (opacity <= 0) return;

    ctx.save();
    ctx.globalAlpha = (opacity / 100);

    // التحويل إلى منتصف الكانفاس مع الإزاحة والدوران
    ctx.translate(w / 2 + pos.x, h / 2 + pos.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale / 100, scale / 100);

    const lw = layer.width || layer.imageElement.naturalWidth || 200;
    const lh = layer.height || layer.imageElement.naturalHeight || 200;

    ctx.drawImage(layer.imageElement, -lw / 2, -lh / 2, lw, lh);
    ctx.restore();
  }, [evaluateLayerTransform]);

  const drawChildLayerInsideParent = useCallback((
    ctx: CanvasRenderingContext2D,
    child: AELayer,
    parent: AELayer,
    frame: number,
    w: number,
    h: number
  ) => {
    if (!child.visible || !child.imageElement) return;

    const parentTrans = evaluateLayerTransform(parent, frame);
    const childTrans = evaluateLayerTransform(child, frame);

    ctx.save();
    // دمج شفافية القطعة مع شفافية الطبقة الأم
    ctx.globalAlpha = (parentTrans.opacity / 100) * (childTrans.opacity / 100);

    // نقل نقطة الأصل إلى مركز الطبقة الأم مع تطبيق دوران وحجم الأم
    ctx.translate(w / 2 + parentTrans.pos.x, h / 2 + parentTrans.pos.y);
    ctx.rotate((parentTrans.rotation * Math.PI) / 180);
    ctx.scale(parentTrans.scale / 100, parentTrans.scale / 100);

    // تطبيق حركة وموضع القطعة المدمجة داخلياً بالنسبة للأم
    ctx.translate(childTrans.pos.x, childTrans.pos.y);
    ctx.rotate((childTrans.rotation * Math.PI) / 180);
    ctx.scale(childTrans.scale / 100, childTrans.scale / 100);

    const cw = child.width || child.imageElement.naturalWidth || 150;
    const ch = child.height || child.imageElement.naturalHeight || 150;

    ctx.drawImage(child.imageElement, -cw / 2, -ch / 2, cw, ch);
    ctx.restore();
  }, [evaluateLayerTransform]);

  // دالة رسم المشهد الكامل بكل الطبقات المدمجة
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, compWidth, compHeight);

    // الترتيب من الأسفل للأعلى مثل After Effects
    const reversed = [...layers].reverse();

    reversed.forEach(layer => {
      // إذا كانت الطبقة مدمجة داخل طبقة أم، ستُرسم لاحقاً بداخلها
      if (layer.clipToLayerId) {
        const parentExists = layers.some(l => l.id === layer.clipToLayerId);
        if (parentExists) return;
        drawLayer(ctx, layer, currentFrame, compWidth, compHeight);
        return;
      }

      // البحث عن كل الطبقات المدمجة داخل هذه الطبقة
      const childLayers = layers.filter(l => l.clipToLayerId === layer.id && l.visible);

      if (childLayers.length === 0) {
        // طبقة مفردة عادية
        drawLayer(ctx, layer, currentFrame, compWidth, compHeight);
      } else {
        // ⭐️ دمج احترافي بقناع Alpha Matte بواسطة Offscreen Canvas ⭐️
        if (!offscreenCanvasRef.current) {
          offscreenCanvasRef.current = document.createElement('canvas');
        }
        const offCanvas = offscreenCanvasRef.current;
        if (offCanvas.width !== compWidth || offCanvas.height !== compHeight) {
          offCanvas.width = compWidth;
          offCanvas.height = compHeight;
        }
        const offCtx = offCanvas.getContext('2d');
        if (offCtx) {
          offCtx.clearRect(0, 0, compWidth, compHeight);

          // 1. رسم الطبقة الأم
          drawLayer(offCtx, layer, currentFrame, compWidth, compHeight);

          // 2. قص ودمج كل الطبقات التابعة بداخلها
          childLayers.forEach(child => {
            offCtx.save();
            offCtx.globalCompositeOperation = (child.blendMode as any) || 'source-atop'; // ⭐️ قناع الدمج الداخلي
            drawChildLayerInsideParent(offCtx, child, layer, currentFrame, compWidth, compHeight);
            offCtx.restore();
          });

          // 3. تصيير النتيجة المدمجة للكانفاس النهائي
          ctx.drawImage(offCanvas, 0, 0);
        }
      }
    });
  }, [layers, currentFrame, compWidth, compHeight, drawLayer, drawChildLayerInsideParent]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // تشغيل شريط الوقت
  useEffect(() => {
    let animId: number;
    if (isPlaying) {
      animId = window.setInterval(() => {
        setCurrentFrame(prev => (prev + 1) % totalFrames);
      }, 1000 / fps);
    }
    return () => clearInterval(animId);
  }, [isPlaying, fps, totalFrames]);

  // ==========================================
  // 5. دوال الإضافة ورفع الطبقات المدمجة (Action Handlers)
  // ==========================================

  // إضافة طبقة رئيسية جديدة
  const handleUploadMainLayer = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const newLayer: AELayer = {
        id: `layer-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        kind: 'image',
        visible: true,
        locked: false,
        position: { x: 0, y: 0 },
        scale: 100,
        rotation: 0,
        opacity: 100,
        imageSrc: url,
        imageElement: img,
        width: img.naturalWidth || compWidth,
        height: img.naturalHeight || compHeight
      };
      setLayers(prev => [newLayer, ...prev]);
      setSelectedLayerId(newLayer.id);
    };
    img.src = url;
    e.target.value = '';
  };

  // ⭐️ دالة تفعيل زر «إضافة قطعة مدمجة كقناع» داخل الطبقة المحددة ⭐️
  const handleUploadMaskedChildLayer = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedLayerId || !e.target.files || !e.target.files[0]) return;
    const parentLayer = layers.find(l => l.id === selectedLayerId);
    if (!parentLayer) return;

    const file = e.target.files[0];
    const url = URL.createObjectURL(file);
    const pieceName = file.name.replace(/\.[^/.]+$/, '');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const childLayerId = `layer-masked-${Date.now()}`;
      
      const newChildLayer: AELayer = {
        id: childLayerId,
        name: `${parentLayer.name} - ${pieceName}`,
        kind: 'image',
        visible: true,
        locked: false,
        position: { x: 0, y: 0 }, // موضع نسبي يبدأ في مركز الطبقة الأم
        scale: 75,
        rotation: 0,
        opacity: 100,
        imageSrc: url,
        imageElement: img,
        width: img.naturalWidth || 150,
        height: img.naturalHeight || 150,
        clipToLayerId: parentLayer.id, // ⭐️ ربط هذه الطبقة كقناع بالطبقة الأم
        blendMode: 'source-atop'
      };

      setLayers(prev => {
        const pIdx = prev.findIndex(l => l.id === parentLayer.id);
        const next = [...prev];
        if (pIdx >= 0) {
          next.splice(pIdx, 0, newChildLayer);
        } else {
          next.unshift(newChildLayer);
        }
        return next;
      });

      setSelectedLayerId(childLayerId); // تحديد الطبقة المدمجة فوراً لتعديلها وتحريكها
    };
    img.src = url;
    e.target.value = '';
  }, [selectedLayerId, layers]);

  // تحديث خصائص الطبقة المحددة
  const updateSelectedLayer = (updates: Partial<AELayer>) => {
    if (!selectedLayerId) return;
    setLayers(prev => prev.map(l => l.id === selectedLayerId ? { ...l, ...updates } : l));
  };

  // ==========================================
  // 6. تصدير إلى سكربت After Effects (.jsx)
  // ==========================================

  const exportToAfterEffectsJsx = () => {
    let jsx = `// Adobe After Effects Script Generated by Flex Studio\n`;
    jsx += `app.beginUndoGroup("Create Masked Composition");\n`;
    jsx += `var comp = app.project.items.addComp("Comp_Masked", ${compWidth}, ${compHeight}, 1, ${totalFrames / fps}, ${fps});\n`;
    jsx += `var layerMap = {};\n\n`;

    // 1. إنشاء الطبقات
    layers.forEach((layer, idx) => {
      jsx += `// Layer: ${layer.name}\n`;
      jsx += `var l_${idx} = comp.layers.addSolid([1,1,1], "${layer.name}", ${layer.width || 200}, ${layer.height || 200}, 1);\n`;
      jsx += `l_${idx}.property("Transform").property("Position").setValue([${compWidth / 2 + layer.position.x}, ${compHeight / 2 + layer.position.y}]);\n`;
      jsx += `l_${idx}.property("Transform").property("Scale").setValue([${layer.scale}, ${layer.scale}]);\n`;
      jsx += `l_${idx}.property("Transform").property("Rotation").setValue(${layer.rotation});\n`;
      jsx += `l_${idx}.property("Transform").property("Opacity").setValue(${layer.opacity});\n`;
      jsx += `layerMap["${layer.id}"] = l_${idx};\n\n`;
    });

    // 2. تطبيق Alpha Matte والربط (Parenting & Track Matte)
    layers.forEach((layer) => {
      if (layer.clipToLayerId) {
        jsx += `// ⭐️ Set Track Matte for Masked Layer\n`;
        jsx += `if (layerMap["${layer.id}"] && layerMap["${layer.clipToLayerId}"]) {\n`;
        jsx += `    layerMap["${layer.id}"].setTrackMatte(layerMap["${layer.clipToLayerId}"], TrackMatteType.ALPHA);\n`;
        jsx += `    layerMap["${layer.id}"].parent = layerMap["${layer.clipToLayerId}"];\n`;
        jsx += `}\n`;
      }
    });

    jsx += `app.endUndoGroup();\n`;

    const blob = new Blob([jsx], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `after_effects_masked_project.jsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ==========================================
  // 7. واجهة المستخدم (User Interface / JSX)
  // ==========================================

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 bg-slate-950 text-slate-100 min-h-screen font-sans" dir="rtl">
      
      {/* العمود الأيمن: شاشة العرض والتحكم بالوقت */}
      <div className="flex-1 flex flex-col items-center gap-4 bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-2xl">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            {onClose && (
              <button
                onClick={onClose}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-white text-xs font-bold transition-all cursor-pointer"
              >
                ✕ خروج
              </button>
            )}
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Layers className="text-violet-400" size={20} />
              <span>استوديو الطبقات المدمجة (After Effects Alpha Matte)</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-xl text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              <span>{isPlaying ? 'إيقاف' : 'تشغيل'}</span>
            </button>
            <button
              onClick={exportToAfterEffectsJsx}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-200 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <Download size={14} />
              <span>تصدير سكربت After Effects (.jsx)</span>
            </button>
          </div>
        </div>

        {/* مساحة عرض الكانفاس */}
        <div 
          className="relative bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center"
          style={{ width: compWidth, height: compHeight }}
        >
          <canvas
            ref={canvasRef}
            width={compWidth}
            height={compHeight}
            className="w-full h-full object-contain"
          />
        </div>

        {/* شريط التحكم بالوقت (Timeline Scrubber) */}
        <div className="w-full flex items-center gap-4 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
          <span className="text-xs font-mono text-slate-400 w-16 text-center">F: {currentFrame} / {totalFrames}</span>
          <input
            type="range"
            min="0"
            max={totalFrames - 1}
            value={currentFrame}
            onChange={(e) => setCurrentFrame(Number(e.target.value))}
            className="flex-1 accent-violet-500 cursor-pointer"
          />
        </div>
      </div>

      {/* العمود الأيسر: لوحة الطبقات وخصائص الطبقة المدمجة */}
      <div className="w-full lg:w-96 flex flex-col gap-4">
        
        {/* قائمة الطبقات */}
        <div className="bg-slate-900/50 p-4 rounded-3xl border border-slate-800 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">الطبقات (Layers)</h3>
            <button
              onClick={() => mainImageInputRef.current?.click()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
            >
              <Upload size={12} />
              <span>+ طبقة جديدة</span>
            </button>
            <input
              ref={mainImageInputRef}
              type="file"
              accept="image/*"
              onChange={handleUploadMainLayer}
              className="hidden"
            />
          </div>

          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
            {layers.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">لا توجد طبقات بعد، قم بإضافة طبقة للبدء.</p>
            ) : (
              layers.map((l) => (
                <div
                  key={l.id}
                  onClick={() => setSelectedLayerId(l.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                    selectedLayerId === l.id
                      ? 'bg-violet-600/20 border-violet-500 text-white'
                      : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {l.clipToLayerId && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-600/30 text-violet-300 border border-violet-500/40 font-bold shrink-0">
                        قناع ↳
                      </span>
                    )}
                    <span className="text-xs font-bold truncate">{l.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLayers(prev => prev.map(item => item.id === l.id ? { ...item, visible: !item.visible } : item));
                      }}
                      className="p-1 hover:text-white"
                    >
                      {l.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLayers(prev => prev.filter(item => item.id !== l.id && item.clipToLayerId !== l.id));
                        if (selectedLayerId === l.id) setSelectedLayerId(null);
                      }}
                      className="p-1 hover:text-red-400"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* لوحة خصائص الطبقة المحددة وتفعيل زر الدمج */}
        {selectedLayer && (
          <div className="bg-slate-900/50 p-5 rounded-3xl border border-slate-800 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white">خصائص: {selectedLayer.name}</h3>
            </div>

            {/* أدوات التحويل: الموضع، الحجم، الدوران، والشفافية */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-slate-400">الموضع الأفقي (X)</label>
                <input
                  type="number"
                  value={selectedLayer.position.x}
                  onChange={(e) => updateSelectedLayer({ position: { ...selectedLayer.position, x: Number(e.target.value) } })}
                  className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-400">الموضع الرأسي (Y)</label>
                <input
                  type="number"
                  value={selectedLayer.position.y}
                  onChange={(e) => updateSelectedLayer({ position: { ...selectedLayer.position, y: Number(e.target.value) } })}
                  className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-400">الحجم ({selectedLayer.scale}%)</label>
                <input
                  type="range"
                  min="1"
                  max="300"
                  value={selectedLayer.scale}
                  onChange={(e) => updateSelectedLayer({ scale: Number(e.target.value) })}
                  className="accent-violet-500 cursor-pointer"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-400">الدوران ({selectedLayer.rotation}°)</label>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={selectedLayer.rotation}
                  onChange={(e) => updateSelectedLayer({ rotation: Number(e.target.value) })}
                  className="accent-violet-500 cursor-pointer"
                />
              </div>
            </div>

            {/* ⭐️ قسم تفعيل وإدارة الطبقة المدمجة (Alpha Matte Section) ⭐️ */}
            <div className="mt-2 pt-3 border-t border-slate-800">
              {selectedLayer.clipToLayerId ? (
                /* حالة 1: الطبقة الحالية مدمجة داخل طبقة أخرى */
                <div className="p-3 rounded-2xl bg-violet-950/30 border border-violet-500/30 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-violet-300">قطعة مدمجة كقناع (Alpha Matte)</span>
                    <button
                      onClick={() => updateSelectedLayer({ clipToLayerId: undefined, blendMode: 'source-over' })}
                      className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                    >
                      فك الدمج ✕
                    </button>
                  </div>
                  <div className="text-xs text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-slate-800 flex justify-between">
                    <span className="text-slate-400">مدمجة داخل:</span>
                    <strong className="text-violet-200">
                      {layers.find(l => l.id === selectedLayer.clipToLayerId)?.name || 'الطبقة الأصلية'}
                    </strong>
                  </div>
                </div>
              ) : (
                /* حالة 2: الطبقة الحالية أصلية وتتيح إضافة قطعة مدمجة بداخلها */
                <div className="flex flex-col gap-2.5 p-3.5 bg-violet-950/20 rounded-2xl border border-violet-500/25">
                  <input
                    ref={additionalLayerFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadMaskedChildLayer}
                    className="hidden"
                  />

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-violet-300">دمج قطعة إضافية داخل هذه الطبقة</span>
                  </div>

                  {/* ⭐️ زر إضافة طبقة مدمجة كقناع ⭐️ */}
                  <button
                    type="button"
                    onClick={() => additionalLayerFileInputRef.current?.click()}
                    className="w-full py-2.5 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white text-xs font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-600/30 cursor-pointer"
                  >
                    <Upload size={14} />
                    <span>+ إضافة قطعة مدمجة (Alpha Matte)</span>
                  </button>

                  {/* قائمة بالقطع المدمجة داخل هذه الطبقة */}
                  {layers.filter(l => l.clipToLayerId === selectedLayer.id).length > 0 && (
                    <div className="flex flex-col gap-1.5 mt-2">
                      <span className="text-[10px] text-slate-400 font-bold">القطع المدمجة بالداخل:</span>
                      {layers.filter(l => l.clipToLayerId === selectedLayer.id).map(child => (
                        <div
                          key={child.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                        >
                          <span className="truncate text-slate-200">{child.name}</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedLayerId(child.id)}
                              className="text-violet-400 hover:text-violet-300 text-[10px] font-bold px-1.5 py-0.5 rounded hover:bg-violet-500/10 cursor-pointer"
                            >
                              تحريك ➔
                            </button>
                            <button
                              type="button"
                              onClick={() => setLayers(prev => prev.map(l => l.id === child.id ? { ...l, clipToLayerId: undefined, blendMode: 'source-over' } : l))}
                              className="text-red-400 hover:text-red-300 px-1 cursor-pointer"
                              title="فك الدمج"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AfterEffectsMaskedLayerStudio;
