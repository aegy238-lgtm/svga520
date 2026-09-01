import React, { useState, useRef } from 'react';
import { EditableLayer } from './types';
import { 
  Eye, EyeOff, Lock, Unlock, Trash2, Copy, 
  ArrowUp, ArrowDown, ArrowUpToLine, ArrowDownToLine, 
  Search, Layers, Image as ImageIcon, Box, Shapes, Edit2, Check,
  Plus, Upload, Sparkles, Type, Circle, Square, Star, Award, SlidersHorizontal,
  GripVertical, Maximize2, Minimize2, Move, ArrowUpDown, Diamond, Package,
  CheckSquare, Square as UncheckedSquare, CheckCheck, X, Music,
  Link2, Film, RotateCcw
} from 'lucide-react';

interface SvgaLayersListProps {
  layers: EditableLayer[];
  selectedLayerId: string | null;
  selectedLayerIds?: string[];
  currentFrame: number;
  onSelectLayer: (id: string, isMulti?: boolean, isRange?: boolean) => void;
  onSelectAllLayers?: (select: boolean, filterScope?: 'all' | 'bundles' | 'base') => void;
  onToggleLayerSelection?: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleAllVisibility?: (makeVisible?: boolean) => void;
  onToggleLock: (id: string) => void;
  onToggleAllLock?: (makeLocked?: boolean) => void;
  onResetLayerTransform?: (layerId?: string) => void;
  onReorderLayer: (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
  onMoveLayer?: (sourceId: string, targetId: string, position: 'above' | 'below') => void;
  onDuplicateLayer: (id: string, mirror?: boolean) => void;
  onDeleteLayer: (id: string) => void;
  onRenameLayer: (id: string, newName: string) => void;
  onAddImageLayer: (file: File) => void;
  onAddShapeLayer: (shapeType: 'rect' | 'circle' | 'star' | 'badge' | 'text', customText?: string) => void;
  onMergeSvga?: () => void;
  onOpenAudioStudio?: () => void;
  onMergeAllLayers?: () => void;
  onMergeSelectedLayers?: () => void;
  onMergeTwoLayers?: (sourceLayerId: string, targetLayerId: string, options?: { syncMotion?: boolean }) => void;
  onUngroupLayer?: (layerId: string) => void;
  isMerging?: boolean;
}

type FilterTab = 'all' | 'active' | 'images' | 'shapes' | 'bundles';

export const SvgaLayersList: React.FC<SvgaLayersListProps> = ({
  layers,
  selectedLayerId,
  selectedLayerIds = [],
  currentFrame,
  onSelectLayer,
  onSelectAllLayers,
  onToggleLayerSelection,
  onToggleVisibility,
  onToggleAllVisibility,
  onToggleLock,
  onToggleAllLock,
  onResetLayerTransform,
  onReorderLayer,
  onMoveLayer,
  onDuplicateLayer,
  onDeleteLayer,
  onRenameLayer,
  onAddImageLayer,
  onAddShapeLayer,
  onMergeSvga,
  onOpenAudioStudio,
  onMergeAllLayers,
  onMergeSelectedLayers,
  onMergeTwoLayers,
  onUngroupLayer,
  isMerging = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showTextModal, setShowTextModal] = useState(false);
  const [customTextVal, setCustomTextVal] = useState('نص جديد');
  const [viewDensity, setViewDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [showQuickLinkModal, setShowQuickLinkModal] = useState(false);
  const [linkSourceLayerId, setLinkSourceLayerId] = useState<string | null>(null);
  const [linkTargetLayerId, setLinkTargetLayerId] = useState<string | null>(null);
  const [linkSyncMotion, setLinkSyncMotion] = useState(true);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');

  // Drag and Drop state
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null);
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'above' | 'below'>('below');

  // Quick move modal state
  const [showQuickMoveModal, setShowQuickMoveModal] = useState(false);
  const [quickMoveTargetId, setQuickMoveTargetId] = useState<string>('');
  const [quickMovePosition, setQuickMovePosition] = useState<'above' | 'below'>('below');

  // Full Screen Image Preview Modal
  const [previewLayerModal, setPreviewLayerModal] = useState<EditableLayer | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if a layer is active at current frame
  const isLayerActiveAtFrame = (layer: EditableLayer): boolean => {
    const frames = layer.spriteRef?.frames;
    if (!frames || !frames[currentFrame]) return false;
    const frame = frames[currentFrame];
    const hasAnyExplicitAlpha = frames.some((fr: any) => fr && fr.alpha !== undefined && fr.alpha > 0.005);
    if (hasAnyExplicitAlpha) {
      return frame.alpha !== undefined && frame.alpha > 0.005;
    }
    return frame.alpha === undefined || frame.alpha > 0.005;
  };

  const filteredLayers = layers.filter(l => {
    const matchesSearch = l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.imageKey.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (activeTab === 'active') {
      return isLayerActiveAtFrame(l);
    }
    if (activeTab === 'images') {
      return l.type === 'image' || !!l.thumbnailUrl;
    }
    if (activeTab === 'shapes') {
      return l.type === 'shape' || l.keyframeSummary.hasShapes;
    }
    if (activeTab === 'bundles') {
      return !!l.groupId;
    }
    return true;
  });

  const handleStartRename = (layer: EditableLayer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(layer.id);
    setTempName(layer.name);
  };

  const handleSaveRename = (id: string) => {
    if (tempName.trim()) {
      onRenameLayer(id, tempName.trim());
    }
    setEditingId(null);
  };

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAddImageLayer(file);
      setShowAddMenu(false);
    }
    if (e.target) e.target.value = '';
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, layerId: string) => {
    setDraggingLayerId(layerId);
    e.dataTransfer.setData('text/plain', layerId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggingLayerId || draggingLayerId === targetId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const isAbove = offsetY < rect.height / 2;

    setDragOverLayerId(targetId);
    setDropPosition(isAbove ? 'above' : 'below');
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = () => {
    setDragOverLayerId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggingLayerId && draggingLayerId !== targetId && onMoveLayer) {
      onMoveLayer(draggingLayerId, targetId, dropPosition);
    }
    setDraggingLayerId(null);
    setDragOverLayerId(null);
  };

  const handleDragEnd = () => {
    setDraggingLayerId(null);
    setDragOverLayerId(null);
  };

  // Execute quick move modal
  const handleExecuteQuickMove = () => {
    if (selectedLayerId && quickMoveTargetId && onMoveLayer) {
      onMoveLayer(selectedLayerId, quickMoveTargetId, quickMovePosition);
      setShowQuickMoveModal(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#070b14] border-r border-white/10 select-none text-right" dir="rtl">
      {/* Hidden file input for adding new image layer */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleFilePicked}
      />

      {/* Header with Title & Add Layer Button */}
      <div className="p-3.5 border-b border-white/10 flex items-center justify-between gap-2 bg-slate-900/30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Layers size={16} />
          </div>
          <div>
            <h3 className="text-white font-black text-sm tracking-wide">قائمة الطبقات</h3>
            <p className="text-[11px] text-slate-400 font-mono">
              <span className="text-emerald-400 font-bold">{layers.filter(l => l.visible).length}</span> من أصل <span className="text-white font-bold">{layers.length}</span> طبقة
            </p>
          </div>
        </div>

        {/* Quick Master Controls, View density toggle & Add Button */}
        <div className="flex items-center gap-1.5">
          {/* Quick Master Eye Toggle */}
          {(() => {
            const allVisible = layers.length > 0 && layers.every(l => l.visible);
            return (
              <button
                type="button"
                onClick={() => onToggleAllVisibility && onToggleAllVisibility(!allVisible)}
                className={`p-1.5 rounded-xl border transition-all ${
                  allVisible
                    ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30 hover:bg-indigo-600/30'
                    : 'bg-white/5 text-slate-500 hover:text-slate-200 border-white/10'
                }`}
                title={allVisible ? 'إخفاء جميع الطبقات دفعة واحدة' : 'إظهار جميع الطبقات دفعة واحدة'}
              >
                {allVisible ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
            );
          })()}

          {/* Quick Master Lock Toggle */}
          {(() => {
            const allLocked = layers.length > 0 && layers.every(l => l.locked);
            return (
              <button
                type="button"
                onClick={() => onToggleAllLock && onToggleAllLock(!allLocked)}
                className={`p-1.5 rounded-xl border transition-all ${
                  allLocked
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30'
                    : 'bg-white/5 text-slate-500 hover:text-slate-200 border-white/10'
                }`}
                title={allLocked ? 'فتح قفل جميع الطبقات دفعة واحدة' : 'قفل جميع الطبقات دفعة واحدة'}
              >
                {allLocked ? <Lock size={13} /> : <Unlock size={13} />}
              </button>
            );
          })()}

          {/* Density toggle button */}
          <button
            onClick={() => setViewDensity(prev => prev === 'comfortable' ? 'compact' : 'comfortable')}
            className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl border border-white/10 transition-colors"
            title={viewDensity === 'comfortable' ? 'التبديل إلى العرض المضغوط' : 'التبديل إلى العرض الواضح والمكبر'}
          >
            {viewDensity === 'comfortable' ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          {/* Quick Merge All Layers button if more than 1 layer exists */}
          {onMergeAllLayers && layers.length > 1 && (
            <button
              type="button"
              onClick={onMergeAllLayers}
              disabled={isMerging}
              className="px-2.5 py-1.5 bg-gradient-to-r from-purple-600/30 to-indigo-600/30 hover:from-purple-600 hover:to-indigo-600 border border-purple-500/40 hover:border-purple-400 text-purple-200 hover:text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
              title="دمج كافة طبقات ملف SVGA في Layer واحد موحد مع الحفاظ على كامل الحركة"
            >
              <Sparkles size={13} className="text-purple-300" />
              <span className="hidden sm:inline">دمج الكل</span>
            </button>
          )}

          {/* Add Layer Button with Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer hover:scale-105"
            >
              <Plus size={14} />
              <span>إضافة طبقة</span>
            </button>

            {/* Add Layer Dropdown Menu */}
            {showAddMenu && (
              <div className="absolute left-0 top-full mt-2 w-64 bg-slate-900 border border-white/15 rounded-2xl shadow-2xl p-2 z-50 space-y-1 backdrop-blur-xl">
                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 border-b border-white/5 uppercase">
                  اختر نوع الطبقة أو الإجراء:
                </div>

                {/* Merge All Layers option */}
                {onMergeAllLayers && layers.length > 1 && (
                  <button
                    onClick={() => {
                      setShowAddMenu(false);
                      onMergeAllLayers();
                    }}
                    className="w-full px-3 py-2.5 bg-gradient-to-r from-purple-900/60 to-indigo-900/60 hover:from-purple-800 hover:to-indigo-800 border border-purple-500/40 text-white rounded-xl text-xs flex items-center gap-2.5 transition-colors text-right cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-purple-500/30 border border-purple-400/40 flex items-center justify-center text-purple-300 shrink-0">
                      <Sparkles size={14} />
                    </div>
                    <div>
                      <span className="font-bold block text-xs text-purple-200">دمج جميع الطبقات في Layer واحد</span>
                      <span className="text-[10px] text-purple-300/70 block">توحيد كامل الطبقات مع صيانة الأنيميشن</span>
                    </div>
                  </button>
                )}

                {/* Upload Image Layer */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-3 py-2.5 hover:bg-white/10 text-white rounded-xl text-xs flex items-center gap-2.5 transition-colors text-right cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                    <Upload size={14} />
                  </div>
                  <div>
                    <span className="font-bold block text-xs">إضافة صورة من الجهاز</span>
                    <span className="text-[10px] text-slate-400 block">PNG, WebP, SVG, JPG</span>
                  </div>
                </button>

                {/* Merge Another SVGA file */}
                {onMergeSvga && (
                  <button
                    onClick={() => {
                      setShowAddMenu(false);
                      onMergeSvga();
                    }}
                    className="w-full px-3 py-2.5 bg-gradient-to-r from-purple-900/50 to-indigo-900/50 hover:from-purple-800/60 hover:to-indigo-800/60 border border-purple-500/30 text-white rounded-xl text-xs flex items-center gap-2.5 transition-colors text-right cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-purple-500/30 border border-purple-400/40 flex items-center justify-center text-purple-300 shrink-0">
                      <Sparkles size={14} />
                    </div>
                    <div>
                      <span className="font-bold block text-xs text-purple-200">استدعاء ودمج ملف SVGA آخر</span>
                      <span className="text-[10px] text-purple-300/70 block">دمج طبقات وحركات أنيميشن كاملة</span>
                    </div>
                  </button>
                )}

                {/* Audio Studio Option */}
                {onOpenAudioStudio && (
                  <button
                    onClick={() => {
                      setShowAddMenu(false);
                      onOpenAudioStudio();
                    }}
                    className="w-full px-3 py-2.5 bg-gradient-to-r from-indigo-950/80 to-purple-950/80 hover:from-indigo-900 hover:to-purple-900 border border-indigo-500/30 text-white rounded-xl text-xs flex items-center gap-2.5 transition-colors text-right cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shrink-0">
                      <Music size={14} />
                    </div>
                    <div>
                      <span className="font-bold block text-xs text-indigo-200">قص ودمج مسار صوتي (Audio)</span>
                      <span className="text-[10px] text-indigo-300/70 block">إضافة MP3/WAV مع استوديو القص والترددات</span>
                    </div>
                  </button>
                )}

                {/* Shapes */}
                <button
                  onClick={() => {
                    onAddShapeLayer('rect');
                    setShowAddMenu(false);
                  }}
                  className="w-full px-3 py-2 hover:bg-white/10 text-white rounded-xl text-xs flex items-center gap-2.5 transition-colors text-right cursor-pointer"
                >
                  <Square size={14} className="text-amber-400" />
                  <span className="font-semibold">مستطيل هندسي (Box)</span>
                </button>

                <button
                  onClick={() => {
                    onAddShapeLayer('circle');
                    setShowAddMenu(false);
                  }}
                  className="w-full px-3 py-2 hover:bg-white/10 text-white rounded-xl text-xs flex items-center gap-2.5 transition-colors text-right cursor-pointer"
                >
                  <Circle size={14} className="text-amber-400" />
                  <span className="font-semibold">دائرة ذهبية (Circle)</span>
                </button>

                <button
                  onClick={() => {
                    onAddShapeLayer('star');
                    setShowAddMenu(false);
                  }}
                  className="w-full px-3 py-2 hover:bg-white/10 text-white rounded-xl text-xs flex items-center gap-2.5 transition-colors text-right cursor-pointer"
                >
                  <Star size={14} className="text-amber-400" />
                  <span className="font-semibold">نجمة مميزة (Star)</span>
                </button>

                <button
                  onClick={() => {
                    onAddShapeLayer('badge');
                    setShowAddMenu(false);
                  }}
                  className="w-full px-3 py-2 hover:bg-white/10 text-white rounded-xl text-xs flex items-center gap-2.5 transition-colors text-right cursor-pointer"
                >
                  <Award size={14} className="text-amber-400" />
                  <span className="font-semibold">شارة ذهبية (Badge)</span>
                </button>

                <button
                  onClick={() => {
                    setShowTextModal(true);
                    setShowAddMenu(false);
                  }}
                  className="w-full px-3 py-2 hover:bg-white/10 text-white rounded-xl text-xs flex items-center gap-2.5 transition-colors text-right cursor-pointer"
                >
                  <Type size={14} className="text-purple-400" />
                  <span className="font-semibold">نص مخصص (Custom Text)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-3 pt-2.5 pb-2 flex items-center gap-1.5 border-b border-white/10 overflow-x-auto no-scrollbar bg-black/20">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'all'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          الكل ({layers.length})
        </button>
        <button
          onClick={() => setActiveTab('active')}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'active'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-emerald-300 hover:bg-white/5'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>نشط بالفريم F{currentFrame}</span>
        </button>
        <button
          onClick={() => setActiveTab('images')}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'images'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          الصور
        </button>
        {layers.some(l => !!l.groupId) && (
          <button
            onClick={() => setActiveTab('bundles')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'bundles'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-purple-300 hover:text-white hover:bg-purple-600/20'
            }`}
          >
            <Package size={12} />
            <span>الحزم المدمجة ({layers.filter(l => !!l.groupId).length})</span>
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="p-2.5 border-b border-white/10 bg-slate-900/20">
        <div className="relative">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في أسماء الطبقات أو المفاتيح..."
            className="w-full bg-slate-900/90 border border-white/10 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-all font-sans"
          />
        </div>
      </div>

      {/* Master Global Controls Bar: Multi-select All, Lock All & Eye All */}
      <div className="px-3 py-2 bg-slate-900/90 border-b border-white/10 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-bold">
            <SlidersHorizontal size={13} className="text-indigo-400" />
            <span>تحكم جماعي:</span>
            {selectedLayerIds.length > 0 && (
              <span className="text-[10px] text-amber-300 bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-mono font-bold">
                {selectedLayerIds.length} محددة
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Quick Multi-Select All / Clear */}
            {onSelectAllLayers && (
              <button
                type="button"
                onClick={() => {
                  const allSelected = selectedLayerIds.length === layers.length;
                  onSelectAllLayers(!allSelected);
                }}
                className={`px-2 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                  selectedLayerIds.length === layers.length && layers.length > 0
                    ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/30'
                    : selectedLayerIds.length > 0
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                }`}
                title={selectedLayerIds.length === layers.length ? 'إلغاء تحديد الكل' : 'تحديد جميع الطبقات دفعة واحدة (Select All)'}
              >
                <CheckSquare size={12} className={selectedLayerIds.length > 0 ? 'text-amber-300' : 'text-slate-400'} />
                <span>{selectedLayerIds.length === layers.length && layers.length > 0 ? 'إلغاء التحديد' : 'تحديد الكل'}</span>
              </button>
            )}

            {/* Master Visibility Button */}
            {(() => {
              const allVisible = layers.length > 0 && layers.every(l => l.visible);
              const noneVisible = layers.length > 0 && layers.every(l => !l.visible);

              return (
                <button
                  type="button"
                  onClick={() => onToggleAllVisibility && onToggleAllVisibility(!allVisible)}
                  className={`px-2 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                    allVisible
                      ? 'bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-200 border-indigo-500/40'
                      : noneVisible
                      ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/40'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                  }`}
                  title={allVisible ? 'إخفاء كل الطبقات' : 'إظهار كل الطبقات'}
                >
                  {allVisible ? <Eye size={12} className="text-indigo-300" /> : <EyeOff size={12} className="text-slate-400" />}
                </button>
              );
            })()}

            {/* Master Lock Button */}
            {(() => {
              const allLocked = layers.length > 0 && layers.every(l => l.locked);
              return (
                <button
                  type="button"
                  onClick={() => onToggleAllLock && onToggleAllLock(!allLocked)}
                  className={`px-2 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                    allLocked
                      ? 'bg-amber-500/30 hover:bg-amber-500/40 text-amber-200 border-amber-500/40'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                  }`}
                  title={allLocked ? 'فتح قفل الكل' : 'قفل الكل'}
                >
                  {allLocked ? <Lock size={12} className="text-amber-400" /> : <Unlock size={12} className="text-slate-400" />}
                </button>
              );
            })()}
          </div>
        </div>

        {/* Quick Selection Filter Chips for Base vs Merged SVGA */}
        {layers.some(l => !!l.groupId || l.id.startsWith('mrg_') || l.imageKey.startsWith('mrg_') || (l.name && l.name.includes('(مدمج)'))) && onSelectAllLayers && (
          <div className="flex items-center gap-1.5 pt-1 border-t border-white/10 flex-wrap">
            <span className="text-[10px] text-slate-400 font-bold">تحديد سريع:</span>
            <button
              type="button"
              onClick={() => onSelectAllLayers(true, 'base')}
              className="px-2 py-0.5 bg-blue-500/15 hover:bg-blue-500/30 text-blue-300 border border-blue-500/25 rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-sm active:scale-95"
              title="تحديد كافة طبقات الملف الأصلي الأساسي فقط"
            >
              الطبقات الأساسية ({layers.filter(l => !l.groupId && !l.id.startsWith('mrg_') && !l.imageKey.startsWith('mrg_') && !(l.name && l.name.includes('(مدمج)'))).length})
            </button>
            <button
              type="button"
              onClick={() => onSelectAllLayers(true, 'bundles')}
              className="px-2.5 py-0.5 bg-purple-500/25 hover:bg-purple-600/40 text-purple-200 border border-purple-400/40 rounded-lg text-[10px] font-black transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1"
              title="تحديد كافة طبقات ملف SVGA المدمج الثاني دفعة واحدة"
            >
              <Package size={11} className="text-purple-300" />
              <span>الملف المدمج ({layers.filter(l => !!l.groupId || l.id.startsWith('mrg_') || l.imageKey.startsWith('mrg_') || (l.name && l.name.includes('(مدمج)'))).length})</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectAllLayers(true, 'all')}
              className="px-2 py-0.5 bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/25 rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-sm active:scale-95"
              title="تحديد كلتا الطبقات من الملفين معاً"
            >
              كلا الملفين (الكل)
            </button>
          </div>
        )}
        {/* Multi-Selection Action Banner if multiple layers are selected */}
        {selectedLayerIds.length === 2 && onMergeTwoLayers ? (
          <div className="p-2.5 bg-gradient-to-r from-purple-950/95 via-indigo-950/95 to-purple-950/95 border-t border-purple-500/40 flex flex-col gap-2 shadow-xl animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-5 h-5 rounded-md bg-purple-500/30 border border-purple-400/50 flex items-center justify-center text-purple-300">
                  <Link2 size={12} />
                </div>
                <span className="text-[11px] font-black text-purple-100 truncate">
                  تم تحديد طبقتين بعلامة الصح (✓)
                </span>
              </div>
              <span className="text-[9px] text-purple-300 font-mono font-bold bg-purple-500/20 px-1.5 py-0.5 rounded border border-purple-400/30">
                ربط ثنائي منفصل
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onMergeTwoLayers(selectedLayerIds[0], selectedLayerIds[1], { syncMotion: true })}
                disabled={isMerging}
                className="flex-1 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/30 transition-all cursor-pointer active:scale-95 border border-purple-400/40"
                title="دمج الطبقتين المحددين في طبقة واحدة مدمجة مستقلة مع توريث ومزامنة الحركة"
              >
                <Sparkles size={13} className="text-purple-200 animate-pulse" />
                <span>🔗 دمج الطبقتين معاً (مع توريث الحركة)</span>
              </button>
            </div>
          </div>
        ) : selectedLayerIds.length > 1 && onMergeSelectedLayers ? (
          <div className="p-2.5 bg-gradient-to-r from-purple-950/90 via-indigo-950/90 to-purple-950/90 border-t border-purple-500/30 flex items-center justify-between gap-2 shadow-lg">
            <div className="flex items-center gap-1.5 min-w-0">
              <Sparkles size={13} className="text-purple-300 shrink-0 animate-pulse" />
              <span className="text-[11px] font-black text-purple-200 truncate">
                تم تحديد {selectedLayerIds.length} طبقات
              </span>
            </div>
            <button
              type="button"
              onClick={onMergeSelectedLayers}
              disabled={isMerging}
              className="px-3 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-md shadow-purple-600/30 transition-all cursor-pointer active:scale-95 shrink-0 border border-purple-400/40"
              title="دمج الطبقات المحددة حالياً في Layer واحد موحد"
            >
              <Layers size={13} />
              <span>دمج المحدد ({selectedLayerIds.length})</span>
            </button>
          </div>
        ) : null}
      </div>

      {/* Drag & Drop Instruction Hint */}
      <div className="px-3 py-1.5 bg-indigo-950/40 border-b border-indigo-500/10 flex items-center justify-between text-[10px] text-indigo-300">
        <span className="flex items-center gap-1">
          <GripVertical size={11} className="text-indigo-400" />
          <span>اسحب أي طبقة لترتيبها فوق أو تحت أي طبقة أخرى</span>
        </span>
        {selectedLayerId && (
          <button
            onClick={() => {
              const otherLayer = layers.find(l => l.id !== selectedLayerId);
              if (otherLayer) setQuickMoveTargetId(otherLayer.id);
              setShowQuickMoveModal(true);
            }}
            className="text-[10px] text-indigo-400 hover:text-indigo-200 underline font-bold"
          >
            نقل تحت...
          </button>
        )}
      </div>

      {/* Layer List Scroll Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2.5 space-y-1.5">
        {filteredLayers.map((layer, index) => {
          const isSelected = selectedLayerIds.includes(layer.id) || layer.id === selectedLayerId;
          const isEditing = editingId === layer.id;
          const isActiveNow = isLayerActiveAtFrame(layer);
          const isDragging = draggingLayerId === layer.id;
          const isDragOver = dragOverLayerId === layer.id;

          const isComfortable = viewDensity === 'comfortable';

          return (
            <div
              key={layer.id}
              draggable={!layer.locked && !isEditing}
              onDragStart={(e) => handleDragStart(e, layer.id)}
              onDragOver={(e) => handleDragOver(e, layer.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, layer.id)}
              onDragEnd={handleDragEnd}
              onClick={(e) => {
                const isMulti = e.ctrlKey || e.metaKey;
                const isRange = e.shiftKey;
                onSelectLayer(layer.id, isMulti, isRange);
              }}
              className={`group relative flex items-center justify-between rounded-2xl border transition-all cursor-pointer ${
                isComfortable ? 'p-2.5 min-h-[64px]' : 'px-2 py-1.5 min-h-[44px]'
              } ${
                isSelected
                  ? 'bg-indigo-600/25 border-indigo-500 text-white shadow-lg shadow-indigo-600/20 ring-2 ring-indigo-500/50'
                  : 'bg-slate-900/60 hover:bg-white/10 border-white/10 text-slate-300'
              } ${isDragging ? 'opacity-40 scale-95 border-dashed border-indigo-400' : ''}`}
            >
              {/* Drop Target Visual Highlight Lines */}
              {isDragOver && (
                <div
                  className={`absolute left-0 right-0 z-30 pointer-events-none ${
                    dropPosition === 'above' ? '-top-1' : '-bottom-1'
                  }`}
                >
                  <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full shadow-lg shadow-indigo-500/50 animate-pulse" />
                  <div
                    className={`absolute right-4 ${
                      dropPosition === 'above' ? '-top-3' : '-bottom-3'
                    } bg-indigo-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-md`}
                  >
                    {dropPosition === 'above' ? 'إفلات فوق هذه الطبقة ↑' : 'إفلات تحت هذه الطبقة ↓'}
                  </div>
                </div>
              )}

              {/* Right Side: Selection Checkbox + Drag Handle + Thumbnail + Info */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {/* Selection Checkbox */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onToggleLayerSelection) {
                      onToggleLayerSelection(layer.id);
                    } else {
                      onSelectLayer(layer.id, true);
                    }
                  }}
                  className={`p-1 rounded-lg border transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-400'
                      : 'bg-white/5 border-white/15 text-slate-600 hover:text-slate-300 hover:border-white/30'
                  }`}
                  title={isSelected ? 'إلغاء تحديد هذه الطبقة' : 'تحديد هذه الطبقة للتحكم الجماعي'}
                >
                  {isSelected ? <CheckSquare size={13} /> : <UncheckedSquare size={13} />}
                </button>

                {/* Drag Grip Handle */}
                <div
                  className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-indigo-400 p-0.5 shrink-0 transition-colors"
                  title="اضغط واسحب لتغيير ترتيب الطبقة"
                >
                  <GripVertical size={isComfortable ? 16 : 14} />
                </div>

                {/* Layer Index Badge */}
                <span className="text-[10px] font-mono text-slate-500 font-bold shrink-0 w-4 text-center">
                  #{layers.length - index}
                </span>

                {/* Thumbnail Preview (High-Contrast Checkerboard Background) */}
                <div className="relative shrink-0 group/thumb">
                  <div
                    onClick={(e) => {
                      if (layer.thumbnailUrl) {
                        e.stopPropagation();
                        setPreviewLayerModal(layer);
                      }
                    }}
                    className={`rounded-xl border border-white/15 overflow-hidden flex items-center justify-center bg-[#141926] relative transition-transform hover:scale-105 active:scale-95 ${
                      layer.thumbnailUrl ? 'cursor-zoom-in' : ''
                    } ${
                      isComfortable ? 'w-13 h-13' : 'w-9 h-9'
                    }`}
                    style={{
                      backgroundImage: `radial-gradient(#2d3748 15%, transparent 16%), radial-gradient(#2d3748 15%, transparent 16%)`,
                      backgroundSize: '8px 8px',
                      backgroundPosition: '0 0, 4px 4px'
                    }}
                    title={layer.thumbnailUrl ? 'انقر لعرض الصورة بالحجم الكامل وبدقة عالية' : undefined}
                  >
                    {layer.thumbnailUrl ? (
                      <>
                        <img 
                          src={layer.thumbnailUrl} 
                          alt={layer.name}
                          className="w-full h-full object-contain p-1 drop-shadow"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                          <Maximize2 size={isComfortable ? 14 : 11} className="text-white drop-shadow" />
                        </div>
                      </>
                    ) : layer.type === 'shape' ? (
                      <Shapes size={isComfortable ? 20 : 14} className="text-purple-400" />
                    ) : (
                      <Box size={isComfortable ? 20 : 14} className="text-slate-500" />
                    )}
                  </div>

                  {/* Active glowing indicator for current frame */}
                  {isActiveNow && (
                    <span 
                      className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#070b14] ring-2 ring-emerald-500/40 shadow-md animate-pulse pointer-events-none"
                      title="نشطة ومعروضة في الفريم الحالي"
                    />
                  )}
                </div>

                {/* Layer Name & Details */}
                <div className="flex flex-col min-w-0 flex-1">
                  {isEditing ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(layer.id)}
                        autoFocus
                        className="bg-slate-800 border border-indigo-500 rounded-lg px-2 py-1 text-xs text-white outline-none w-full font-bold"
                      />
                      <button
                        onClick={() => handleSaveRename(layer.id)}
                        className="p-1 hover:bg-emerald-500/20 text-emerald-400 rounded-lg"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 group/name">
                      <span className={`truncate font-bold ${
                        isComfortable ? 'text-xs text-white' : 'text-[11px] text-slate-200'
                      } ${isSelected ? 'text-indigo-200 font-black' : ''}`}>
                        {layer.name}
                      </span>
                      <button
                        onClick={(e) => handleStartRename(layer, e)}
                        className="opacity-0 group-hover/name:opacity-100 p-1 hover:text-white text-slate-500 transition-opacity"
                        title="إعادة التسمية"
                      >
                        <Edit2 size={11} />
                      </button>
                    </div>
                  )}

                  {/* Sub-info badges */}
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5 flex-wrap">
                    {layer.isMerged ? (
                      <span className="text-[9px] text-purple-300 font-black bg-purple-500/25 border border-purple-400/40 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Sparkles size={9} className="text-purple-300" />
                        <span>طبقة مدمجة ({layer.mergedLayersCount || layer.mergedLayers?.length || 0} طبقات)</span>
                      </span>
                    ) : (
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-bold text-slate-300">
                        {layer.type}
                      </span>
                    )}
                    <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                      F{layer.keyframeSummary.startFrame}→{layer.keyframeSummary.endFrame}
                    </span>
                    {layer.groupId && (
                      <span className="text-[9px] text-purple-300 font-bold bg-purple-500/20 border border-purple-500/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Package size={9} />
                        <span>{layer.groupName || 'مدمج'}</span>
                      </span>
                    )}
                    {layer.keyframes && layer.keyframes.length > 0 && (
                      <span className="text-[9px] text-amber-300 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 flex items-center gap-0.5">
                        <Diamond size={8} className="fill-amber-400" />
                        <span>{layer.keyframes.length} فريم حركة</span>
                      </span>
                    )}
                    {isComfortable && (
                      <span className="text-[9px] text-slate-500 truncate max-w-[90px]" title={layer.imageKey}>
                        {layer.imageKey}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Left Side: Controls (Ungroup if merged, Quick Link, Visibility, Lock) */}
              <div className="flex items-center gap-1 shrink-0 mr-1" onClick={(e) => e.stopPropagation()}>
                {/* Ungroup button for merged layer */}
                {layer.isMerged && onUngroupLayer && (
                  <button
                    type="button"
                    onClick={() => onUngroupLayer(layer.id)}
                    className="p-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-400/30 transition-all text-[10px] font-bold"
                    title="فك دمج هذه الطبقة واسترجاع الطبقات الفرعية المنفصلة"
                  >
                    <span>فك الدمج</span>
                  </button>
                )}

                {/* Quick Link Button */}
                {!layer.isMerged && onMergeTwoLayers && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLinkSourceLayerId(layer.id);
                      const firstOther = layers.find(l => l.id !== layer.id);
                      setLinkTargetLayerId(firstOther ? firstOther.id : null);
                      setShowQuickLinkModal(true);
                    }}
                    className="p-1.5 rounded-xl text-indigo-400 hover:text-white hover:bg-indigo-600/30 border border-indigo-500/20 transition-all"
                    title="ربط ودمج هذه الطبقة مع طبقة أخرى بوضع علامة صح (✓)"
                  >
                    <Link2 size={14} />
                  </button>
                )}

                {/* Visibility Toggle */}
                <button
                  onClick={() => onToggleVisibility(layer.id)}
                  className={`p-2 rounded-xl transition-all ${
                    layer.visible
                      ? 'text-slate-300 hover:text-white hover:bg-white/15'
                      : 'text-slate-600 hover:text-slate-300 bg-black/40'
                  }`}
                  title={layer.visible ? 'إخفاء الطبقة' : 'إظهار الطبقة'}
                >
                  {layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>

                {/* Reset to Original Main Location Button (استعادة الموضع والمكان الرئيسي للطبقة) */}
                {onResetLayerTransform && (() => {
                  const isMoved = 
                    Math.round(layer.transform.x) !== Math.round(layer.initialBounds.x) ||
                    Math.round(layer.transform.y) !== Math.round(layer.initialBounds.y) ||
                    (layer.transform.scaleX !== undefined && Math.abs(layer.transform.scaleX - 1) > 0.001) ||
                    (layer.transform.scaleY !== undefined && Math.abs(layer.transform.scaleY - 1) > 0.001) ||
                    (layer.transform.rotation !== undefined && layer.transform.rotation !== 0) ||
                    !!layer.isMotionSynced ||
                    !!layer.motionReferenceLayerId;

                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onResetLayerTransform(layer.id);
                      }}
                      className={`p-2 rounded-xl transition-all cursor-pointer group/resetBtn ${
                        isMoved
                          ? 'text-cyan-400 hover:text-white bg-cyan-500/20 hover:bg-cyan-600 border border-cyan-400/40 shadow-sm'
                          : 'text-slate-500 hover:text-cyan-300 hover:bg-white/15'
                      }`}
                      title={
                        isMoved
                          ? 'الطبقة تحركت من مكانها: انقر لإرجاعها لمكانها وموضعها الرئيسي الأصلي (Reset Position)'
                          : 'استعادة الطبقة إلى مكانها وموضعها الرئيسي الأصلي (Reset to Default Position)'
                      }
                    >
                      <RotateCcw size={15} className="group-hover/resetBtn:-rotate-90 transition-transform duration-300" />
                    </button>
                  );
                })()}

                {/* Lock Toggle */}
                <button
                  onClick={() => onToggleLock(layer.id)}
                  className={`p-2 rounded-xl transition-all ${
                    layer.locked
                      ? 'text-amber-400 bg-amber-500/20 border border-amber-500/30'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/15'
                  }`}
                  title={layer.locked ? 'إلغاء قفل الطبقة' : 'قفل الطبقة'}
                >
                  {layer.locked ? <Lock size={15} /> : <Unlock size={15} />}
                </button>
              </div>
            </div>
          );
        })}

        {filteredLayers.length === 0 && (
          <div className="text-center py-12 text-xs text-slate-500 space-y-2">
            <Layers size={24} className="mx-auto text-slate-600" />
            <p>لا توجد طبقات مطابقة للبحث أو التصفية</p>
          </div>
        )}
      </div>

      {/* Layer Order Tools (Bottom) */}
      {(selectedLayerId || selectedLayerIds.length > 0) && (
        <div className="p-3 border-t border-white/10 bg-slate-900/95 backdrop-blur-md flex flex-col gap-2 shadow-2xl">
          {selectedLayerIds.length > 1 && (
            <div className="flex items-center justify-between px-2.5 py-1 text-[11px] text-amber-300 font-bold bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <span className="flex items-center gap-1.5">
                <CheckCheck size={14} className="text-amber-400" />
                <span>تحكم جماعي نشط ({selectedLayerIds.length} طبقات محددة معاً)</span>
              </span>
              <button
                type="button"
                onClick={() => onSelectAllLayers && onSelectAllLayers(false)}
                className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
              >
                إلغاء التحديد
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onDuplicateLayer(selectedLayerId || selectedLayerIds[0])}
                className="p-2 hover:bg-white/10 text-slate-400 hover:text-indigo-300 rounded-xl transition-colors cursor-pointer"
                title={selectedLayerIds.length > 1 ? `تكرار كافة الطبقات المحددة (${selectedLayerIds.length})` : "تكرار الطبقة (Duplicate)"}
              >
                <Copy size={15} />
              </button>
              <button
                type="button"
                onClick={() => onDuplicateLayer(selectedLayerId || selectedLayerIds[0], true)}
                className="p-2 bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/40 text-indigo-400 hover:text-indigo-200 rounded-xl transition-colors cursor-pointer"
                title={selectedLayerIds.length > 1 ? `تكرار وعكس كافة الطبقات المحددة (${selectedLayerIds.length}) أفقياً` : "تكرار وعكس الطبقة أفقياً (Duplicate & Mirror)"}
              >
                <ArrowUpDown size={15} className="rotate-90" />
              </button>
              <button
                type="button"
                onClick={() => onDeleteLayer(selectedLayerId || selectedLayerIds[0])}
                className="p-2 hover:bg-red-500/15 text-slate-400 hover:text-red-400 rounded-xl transition-colors cursor-pointer"
                title={selectedLayerIds.length > 1 ? `حذف كافة الطبقات المحددة (${selectedLayerIds.length})` : "حذف الطبقة (Delete)"}
              >
                <Trash2 size={15} />
              </button>
              {onResetLayerTransform && (
                <button
                  type="button"
                  onClick={() => onResetLayerTransform(selectedLayerId || selectedLayerIds[0])}
                  className="p-2 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-300 rounded-xl transition-colors cursor-pointer"
                  title={selectedLayerIds.length > 1 ? `استعادة الموضع الرئيسي لكافة الطبقات المحددة (${selectedLayerIds.length})` : "استعادة الطبقة لموضعها ومكانها الرئيسي الأصلي (Reset)"}
                >
                  <RotateCcw size={15} />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const nonSelectedLayers = layers.filter(l => !selectedLayerIds.includes(l.id) && l.id !== selectedLayerId);
                  if (nonSelectedLayers.length > 0) {
                    setQuickMoveTargetId(nonSelectedLayers[0].id);
                  }
                  setShowQuickMoveModal(true);
                }}
                className="p-2 hover:bg-indigo-600/20 text-slate-400 hover:text-indigo-300 rounded-xl transition-colors cursor-pointer"
                title={selectedLayerIds.length > 1 ? `نقل كافة الطبقات المحددة (${selectedLayerIds.length}) تحت أو فوق أي طبقة أخرى` : "نقل وتنزيل تحت أي طبقة أخرى"}
              >
                <ArrowUpDown size={15} />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onReorderLayer(selectedLayerId || selectedLayerIds[0], 'top')}
                className="p-2 bg-white/5 hover:bg-indigo-600/30 text-slate-300 hover:text-white rounded-xl transition-all border border-white/10 cursor-pointer"
                title={selectedLayerIds.length > 1 ? `إلى أعلى المقدمة لجميع الطبقات المحددة (${selectedLayerIds.length})` : "إلى أعلى المقدمة (Top)"}
              >
                <ArrowUpToLine size={15} />
              </button>
              <button
                type="button"
                onClick={() => onReorderLayer(selectedLayerId || selectedLayerIds[0], 'up')}
                className="p-2 bg-white/5 hover:bg-indigo-600/30 text-slate-300 hover:text-white rounded-xl transition-all border border-white/10 cursor-pointer"
                title={selectedLayerIds.length > 1 ? `رفع جميع الطبقات المحددة للأعلى خطوة (${selectedLayerIds.length})` : "للأعلى خطوة واحدة (Up)"}
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                onClick={() => onReorderLayer(selectedLayerId || selectedLayerIds[0], 'down')}
                className="p-2 bg-white/5 hover:bg-indigo-600/30 text-slate-300 hover:text-white rounded-xl transition-all border border-white/10 cursor-pointer"
                title={selectedLayerIds.length > 1 ? `إنزال جميع الطبقات المحددة للأسفل خطوة (${selectedLayerIds.length})` : "للأسفل خطوة واحدة (Down)"}
              >
                <ArrowDown size={15} />
              </button>
              <button
                type="button"
                onClick={() => onReorderLayer(selectedLayerId || selectedLayerIds[0], 'bottom')}
                className="p-2 bg-white/5 hover:bg-indigo-600/30 text-slate-300 hover:text-white rounded-xl transition-all border border-white/10 cursor-pointer"
                title={selectedLayerIds.length > 1 ? `إلى أسفل الخلفية لجميع الطبقات المحددة (${selectedLayerIds.length})` : "إلى أسفل الخلفية (Bottom)"}
              >
                <ArrowDownToLine size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Move Layer Modal */}
      {showQuickMoveModal && (selectedLayerId || selectedLayerIds.length > 0) && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/15 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h4 className="text-white font-black text-sm flex items-center gap-2">
                <ArrowUpDown size={16} className="text-indigo-400" />
                <span>
                  {selectedLayerIds.length > 1 
                    ? `نقل ${selectedLayerIds.length} طبقة محددة إلى موضع محدد دفعة واحدة`
                    : 'نقل الطبقة إلى موضع محدد'}
                </span>
              </h4>
              <button
                onClick={() => setShowQuickMoveModal(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              {selectedLayerIds.length > 1 
                ? `سيتم نقل كافة الطبقات المحددة (${selectedLayerIds.length} طبقة) معاً مع الحفاظ على ترتيبها الداخلي.` 
                : 'حدد الطبقة المستهدفة وموضع النقل:'}
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-bold">الطبقة المستهدفة:</label>
                <select
                  value={quickMoveTargetId}
                  onChange={(e) => setQuickMoveTargetId(e.target.value)}
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {layers.filter(l => !selectedLayerIds.includes(l.id) && l.id !== selectedLayerId).map(l => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.imageKey})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1 font-bold">الموضع بالنسبة للطبقة المستهدفة:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickMovePosition('below')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      quickMovePosition === 'below'
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                        : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    تحت الطبقة مباشرة (Behind)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickMovePosition('above')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      quickMovePosition === 'above'
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                        : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    فوق الطبقة مباشرة (In front)
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                onClick={() => setShowQuickMoveModal(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleExecuteQuickMove}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                تطبيق النقل الجماعي
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Text Modal */}
      {showTextModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/15 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <h4 className="text-white font-bold text-sm flex items-center gap-2">
              <Type size={16} className="text-indigo-400" />
              <span>إضافة طبقة نص / شارة</span>
            </h4>
            <div>
              <label className="text-xs text-slate-400 block mb-1">اكتب النص المراد إضافته:</label>
              <input
                type="text"
                value={customTextVal}
                onChange={(e) => setCustomTextVal(e.target.value)}
                className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                placeholder="مثال: الفائز الأول، VIP، مرحباً..."
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowTextModal(false)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  if (customTextVal.trim()) {
                    onAddShapeLayer('badge', customTextVal.trim());
                    setShowTextModal(false);
                  }
                }}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
              >
                إضافة كطبقة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Link & Merge Modal (ربط ودمج طبقتين بعلامة صح) - Large & Eye-Friendly */}
      {showQuickLinkModal && linkSourceLayerId && (() => {
        const sourceLayer = layers.find(l => l.id === linkSourceLayerId);
        const filteredTargetLayers = layers
          .filter(l => l.id !== linkSourceLayerId)
          .filter(l => !linkSearchQuery.trim() || l.name.toLowerCase().includes(linkSearchQuery.toLowerCase()));

        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
            <div className="bg-slate-900/95 border border-indigo-500/40 rounded-3xl p-6 sm:p-7 max-w-3xl w-full max-h-[90vh] flex flex-col space-y-5 shadow-2xl ring-1 ring-white/10">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-600/30 text-indigo-300 flex items-center justify-center border border-indigo-400/40 shadow-inner">
                    <Link2 size={22} className="text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-black text-lg tracking-wide flex items-center gap-2">
                      <span>ربط ودمج الطبقات بعلامة الصح (✓)</span>
                      <span className="text-xs font-normal text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                        مزامنة الحركة
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      اختر الطبقة المرجعية التي ترغب في ربط حركتها ومسارها مع الطبقة الحالية
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowQuickLinkModal(false);
                    setLinkSearchQuery('');
                  }}
                  className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Source Layer Card (Current Selected Layer) */}
              <div className="bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900/80 border border-indigo-500/30 rounded-2xl p-4 flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    onClick={(e) => {
                      if (sourceLayer?.thumbnailUrl) {
                        e.stopPropagation();
                        setPreviewLayerModal(sourceLayer);
                      }
                    }}
                    className={`w-14 h-14 rounded-xl bg-black/60 border border-indigo-500/30 overflow-hidden flex items-center justify-center shrink-0 shadow-md relative group/srcThumb transition-transform ${
                      sourceLayer?.thumbnailUrl ? 'cursor-zoom-in hover:scale-105 active:scale-95' : ''
                    }`}
                    title={sourceLayer?.thumbnailUrl ? 'انقر لعرض صورة الطبقة بالحجم الكامل' : undefined}
                  >
                    {sourceLayer?.thumbnailUrl ? (
                      <>
                        <img src={sourceLayer.thumbnailUrl} alt="source" className="w-full h-full object-contain p-1" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/srcThumb:opacity-100 flex items-center justify-center transition-opacity">
                          <Maximize2 size={16} className="text-white drop-shadow" />
                        </div>
                      </>
                    ) : (
                      <Layers size={24} className="text-indigo-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-indigo-400 font-bold flex items-center gap-1.5 mb-0.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                      الطبقة المراد ربطها (الطبقة الحالية):
                    </span>
                    <span className="text-white font-black text-sm truncate block">
                      {sourceLayer?.name || 'طبقة غير مسماة'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                      النوع: {sourceLayer?.type || 'عنصر'} • العرض: {sourceLayer?.transform.width || sourceLayer?.initialBounds.width || 0}px × الارتفاع: {sourceLayer?.transform.height || sourceLayer?.initialBounds.height || 0}px
                    </span>
                  </div>
                </div>
                
                {sourceLayer?.keyframes && sourceLayer.keyframes.length > 0 ? (
                  <span className="text-xs font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-xl shrink-0">
                    متحركة ({sourceLayer.keyframes.length} فريم)
                  </span>
                ) : (
                  <span className="text-xs font-bold text-slate-300 bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl shrink-0">
                    طبقة ثابتة
                  </span>
                )}
              </div>

              {/* Target Layers Selection Header & Search */}
              <div className="space-y-3 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between gap-3 shrink-0">
                  <label className="text-sm text-slate-200 font-black flex items-center gap-2">
                    <span>اختر الطبقة المرجعية المستهدفة:</span>
                    <span className="text-xs font-bold text-indigo-300 bg-indigo-600/20 border border-indigo-500/30 px-2 py-0.5 rounded-md">
                      {filteredTargetLayers.length} طبقة متاحة
                    </span>
                  </label>

                  {/* Search filter */}
                  <div className="relative w-64">
                    <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="بحث في أسماء الطبقات..."
                      value={linkSearchQuery}
                      onChange={(e) => setLinkSearchQuery(e.target.value)}
                      className="w-full bg-black/40 border border-white/15 focus:border-indigo-500 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Checklist of Target Layers - Large & Scrollable */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-black/40 rounded-2xl border border-white/10 space-y-2 max-h-[340px]">
                  {filteredTargetLayers.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      لا توجد طبقات تطابق البحث
                    </div>
                  ) : (
                    filteredTargetLayers.map(targetL => {
                      const isChecked = linkTargetLayerId === targetL.id;
                      const hasMotion = targetL.keyframes && targetL.keyframes.length > 0;
                      return (
                        <div
                          key={targetL.id}
                          onClick={() => setLinkTargetLayerId(targetL.id)}
                          className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-gradient-to-r from-indigo-600/40 via-purple-600/30 to-indigo-900/40 border-indigo-400 text-white shadow-lg ring-2 ring-indigo-400/60 scale-[1.008]'
                              : 'bg-white/5 hover:bg-white/10 border-white/5 text-slate-300 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className={`p-1 rounded-lg transition-transform ${isChecked ? 'scale-110' : ''}`}>
                              {isChecked ? (
                                <CheckSquare size={22} className="text-indigo-400 fill-indigo-400/20" />
                              ) : (
                                <UncheckedSquare size={22} className="text-slate-500 hover:text-slate-300" />
                              )}
                            </div>

                            {/* Large Thumbnail */}
                            <div 
                              onClick={(e) => {
                                if (targetL.thumbnailUrl) {
                                  e.stopPropagation();
                                  setPreviewLayerModal(targetL);
                                }
                              }}
                              className={`w-12 h-12 rounded-xl bg-black/60 border border-white/15 overflow-hidden flex items-center justify-center shrink-0 shadow-inner relative group/tgtThumb transition-transform ${
                                targetL.thumbnailUrl ? 'cursor-zoom-in hover:scale-105 active:scale-95' : ''
                              }`}
                              title={targetL.thumbnailUrl ? 'انقر لعرض صورة الطبقة بالحجم الكامل' : undefined}
                            >
                              {targetL.thumbnailUrl ? (
                                <>
                                  <img src={targetL.thumbnailUrl} alt={targetL.name} className="w-full h-full object-contain p-1" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/tgtThumb:opacity-100 flex items-center justify-center transition-opacity">
                                    <Maximize2 size={14} className="text-white drop-shadow" />
                                  </div>
                                </>
                              ) : (
                                <Layers size={18} className="text-slate-400" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <span className="font-black text-sm text-white truncate block max-w-sm">
                                {targetL.name}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                                <span className="font-mono bg-white/5 px-2 py-0.5 rounded border border-white/5 text-[10px]">
                                  {targetL.type}
                                </span>
                                <span>
                                  {targetL.transform.width || targetL.initialBounds.width} × {targetL.transform.height || targetL.initialBounds.height} px
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {hasMotion ? (
                              <span className="text-xs font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                                <Film size={14} className="text-amber-400" />
                                <span>متحركة ({targetL.keyframes!.length} فريم)</span>
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
                                ثابتة
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Motion sync option */}
              <label className="flex items-center gap-3 text-sm text-indigo-200 cursor-pointer bg-indigo-950/50 hover:bg-indigo-950/70 p-3.5 rounded-2xl border border-indigo-500/30 transition-colors shrink-0">
                <input
                  type="checkbox"
                  checked={linkSyncMotion}
                  onChange={(e) => setLinkSyncMotion(e.target.checked)}
                  className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                />
                <div>
                  <span className="font-bold text-white block">توريث ومزامنة حركة الطبقة المستهدفة فريماً بفريم (Motion Sync)</span>
                  <span className="text-xs text-indigo-300/80">ستتبع الطبقة الحالية نفس إزاحة ومسار حركة الطبقة المختارة تلقائياً</span>
                </div>
              </label>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-white/10 shrink-0">
                <span className="text-xs text-slate-400">
                  {linkTargetLayerId ? '✓ تم تحديد الطبقة، جاهز للتنفيذ' : 'الرجاء تحديد طبقة للربط معها'}
                </span>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickLinkModal(false);
                      setLinkSearchQuery('');
                    }}
                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    disabled={!linkTargetLayerId}
                    onClick={() => {
                      if (onMergeTwoLayers && linkSourceLayerId && linkTargetLayerId) {
                        onMergeTwoLayers(linkSourceLayerId, linkTargetLayerId, { syncMotion: linkSyncMotion });
                        setShowQuickLinkModal(false);
                        setLinkSearchQuery('');
                      }
                    }}
                    className="px-6 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-black shadow-lg shadow-purple-600/30 cursor-pointer active:scale-95 border border-purple-400/40 flex items-center gap-2 transition-all"
                  >
                    <Sparkles size={16} className="text-purple-200" />
                    <span>تنفيذ ربط ودمج الطبقتين معاً (✓)</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Full-Screen Image Preview Modal (عرض صورة الطبقة بالحجم الكامل) */}
      {previewLayerModal && (
        <div 
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-8 animate-fadeIn select-none"
          onClick={() => setPreviewLayerModal(null)}
        >
          <div 
            className="bg-slate-900/95 border border-indigo-500/40 rounded-3xl p-5 max-w-4xl w-full max-h-[92vh] flex flex-col space-y-4 shadow-2xl ring-1 ring-white/15"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 text-indigo-300 flex items-center justify-center border border-indigo-500/40">
                  <ImageIcon size={20} className="text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-white font-black text-base flex items-center gap-2">
                    <span>{previewLayerModal.name}</span>
                    <span className="text-xs font-mono font-normal text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                      {previewLayerModal.type}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    الأبعاد: {Math.round(previewLayerModal.transform.width || previewLayerModal.initialBounds.width)} × {Math.round(previewLayerModal.transform.height || previewLayerModal.initialBounds.height)} بكسل
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {previewLayerModal.thumbnailUrl && (
                  <a
                    href={previewLayerModal.thumbnailUrl}
                    download={`${previewLayerModal.name || 'layer'}.png`}
                    className="px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-indigo-500/30 flex items-center gap-1.5 cursor-pointer"
                    title="تحميل الصورة على جهازك"
                  >
                    <span>تحميل الصورة</span>
                  </a>
                )}
                <button
                  onClick={() => setPreviewLayerModal(null)}
                  className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer transition-colors"
                  title="إغلاق"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* High-Resolution Large Image Canvas */}
            <div 
              className="flex-1 min-h-[300px] max-h-[65vh] rounded-2xl border border-white/10 overflow-hidden flex items-center justify-center bg-[#0d121f] relative p-4 shadow-inner"
              style={{
                backgroundImage: `radial-gradient(#2d3748 18%, transparent 19%), radial-gradient(#2d3748 18%, transparent 19%)`,
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 8px 8px'
              }}
            >
              {previewLayerModal.thumbnailUrl ? (
                <img 
                  src={previewLayerModal.thumbnailUrl} 
                  alt={previewLayerModal.name}
                  className="max-w-full max-h-[60vh] object-contain drop-shadow-2xl transition-transform"
                />
              ) : (
                <div className="text-center text-slate-500 py-12">
                  <Box size={48} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">لا تتوفر صورة نقطية لهذه الطبقة</p>
                </div>
              )}
            </div>

            {/* Modal Footer Info */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs text-slate-400 shrink-0">
              <div className="flex items-center gap-4">
                <span>الموضع: X: {previewLayerModal.transform.x} , Y: {previewLayerModal.transform.y}</span>
                <span>الشفافية: {previewLayerModal.transform.opacity}%</span>
                <span>الزاوية: {previewLayerModal.transform.rotation}°</span>
              </div>
              <button
                onClick={() => setPreviewLayerModal(null)}
                className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold cursor-pointer transition-colors"
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
