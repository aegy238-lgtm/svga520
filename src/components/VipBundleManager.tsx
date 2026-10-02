import React, { useState } from 'react';
import { 
  Crown, 
  Gift, 
  Sparkles, 
  Plus, 
  Trash2, 
  Edit3, 
  Eye, 
  EyeOff, 
  ArrowUp, 
  ArrowDown, 
  ExternalLink, 
  Link as LinkIcon, 
  Check, 
  AlertCircle, 
  Layers, 
  FileText, 
  Star, 
  Flame, 
  Gem, 
  Rocket, 
  Copy, 
  Info,
  X,
  PlusCircle,
  HelpCircle
} from 'lucide-react';
import { VipBundle, VipSubItem, Language } from '../types';
import { 
  saveVipBundle, 
  deleteVipBundle, 
  toggleVipBundleVisibility, 
  reorderVipBundles 
} from '../lib/firebaseService';

interface VipBundleManagerProps {
  lang: Language;
  bundles: VipBundle[];
  setBundles: React.Dispatch<React.SetStateAction<VipBundle[]>>;
  onPreviewBundle?: (bundle: VipBundle) => void;
}

const AVAILABLE_ICONS = [
  { id: 'gift', label: '🎁 هدية', icon: Gift },
  { id: 'crown', label: '👑 تاج', icon: Crown },
  { id: 'sparkles', label: '✨ بريق', icon: Sparkles },
  { id: 'gem', label: '💎 ماسة', icon: Gem },
  { id: 'flame', label: '🔥 مميز', icon: Flame },
  { id: 'rocket', label: '🚀 صاروخ', icon: Rocket },
  { id: 'star', label: '⭐ نجمة', icon: Star },
  { id: 'layers', label: '📦 حزمة', icon: Layers }
];

export const VipBundleManager: React.FC<VipBundleManagerProps> = ({
  lang,
  bundles,
  setBundles,
  onPreviewBundle
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingBundleId, setEditingBundleId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('gift');
  const [imageUrl, setImageUrl] = useState('');
  const [badge, setBadge] = useState('VIP حصري');
  const [isVisible, setIsVisible] = useState(true);
  const [subItems, setSubItems] = useState<VipSubItem[]>([]);

  // Feedback State
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  // Start Creating New Bundle
  const handleStartCreate = () => {
    setEditingBundleId(null);
    setName('🎁 هدية VIP');
    setDescription('باقة الهدايا الحصرية الشاملة لأعضاء VIP مع تحديثات فورية وروابط مباشرة');
    setIcon('gift');
    setImageUrl('');
    setBadge('VIP حصري');
    setIsVisible(true);
    setSubItems([
      {
        id: `sub_${Date.now()}_1`,
        title: '👑 باقة المؤثرات الملكية الكاملة (SVGA + MP4)',
        description: 'رابط مباشر لتحميل مكتبة المؤثرات الشاملة عالية الدقة',
        url: 'https://drive.google.com',
        badge: 'تحميل فوري',
        buttonText: 'فتح الرابط',
        isHighlighted: true,
        order: 1
      }
    ]);
    setIsEditing(true);
  };

  // Start Editing Existing Bundle
  const handleStartEdit = (bundle: VipBundle) => {
    setEditingBundleId(bundle.id);
    setName(bundle.name || '');
    setDescription(bundle.description || '');
    setIcon(bundle.icon || 'gift');
    setImageUrl(bundle.imageUrl || '');
    setBadge(bundle.badge || 'VIP حصري');
    setIsVisible(bundle.isVisible !== false);
    setSubItems(bundle.subItems ? [...bundle.subItems] : []);
    setIsEditing(true);
  };

  // Add Sub-Item to current bundle form
  const handleAddSubItem = () => {
    const newItem: VipSubItem = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title: '',
      description: '',
      url: '',
      badge: 'رابط مباشر',
      buttonText: 'فتح الرابط',
      isHighlighted: false,
      order: subItems.length + 1
    };
    setSubItems([...subItems, newItem]);
  };

  // Update a specific field of a sub-item
  const handleUpdateSubItem = (id: string, field: keyof VipSubItem, value: any) => {
    setSubItems(subItems.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  // Delete Sub-Item
  const handleDeleteSubItem = (id: string) => {
    setSubItems(subItems.filter(item => item.id !== id));
  };

  // Reorder Sub-Items
  const handleMoveSubItem = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === subItems.length - 1)) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newItems = [...subItems];
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;
    setSubItems(newItems);
  };

  // Save Main Bundle
  const handleSaveBundle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert(lang === 'ar' ? 'يرجى إدخال اسم الباقة الرئيسية' : 'Please enter the bundle name');
      return;
    }

    setSaveStatus('saving');
    try {
      const bundleId = editingBundleId || `bundle_${Date.now()}`;
      const bundleOrder = editingBundleId 
        ? (bundles.find(b => b.id === editingBundleId)?.order || 1)
        : bundles.length + 1;

      const updatedBundle: VipBundle = {
        id: bundleId,
        name: name.trim(),
        nameAr: name.trim(),
        description: description.trim(),
        descriptionAr: description.trim(),
        icon,
        imageUrl: imageUrl.trim() || undefined,
        badge: badge.trim() || undefined,
        isVisible,
        order: bundleOrder,
        subItems: subItems.map((item, idx) => ({
          ...item,
          order: idx + 1,
          title: item.title.trim() || `رابط ${idx + 1}`,
          url: item.url.trim() || '#'
        })),
        createdAt: editingBundleId 
          ? (bundles.find(b => b.id === editingBundleId)?.createdAt || new Date().toISOString())
          : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await saveVipBundle(updatedBundle);

      setBundles(prev => {
        const exists = prev.some(b => b.id === bundleId);
        if (exists) {
          return prev.map(b => b.id === bundleId ? updatedBundle : b);
        } else {
          return [...prev, updatedBundle];
        }
      });

      setSaveStatus('saved');
      setStatusMsg(lang === 'ar' ? 'تم حفظ باقة VIP بنجاح!' : 'VIP bundle saved successfully!');
      setTimeout(() => {
        setSaveStatus('idle');
        setIsEditing(false);
      }, 1200);
    } catch (err: any) {
      console.error(err);
      setSaveStatus('error');
      setStatusMsg(err.message || 'Error saving bundle');
    }
  };

  // Toggle Visibility directly from the list
  const handleToggleVisibility = async (bundle: VipBundle) => {
    const newStatus = !bundle.isVisible;
    try {
      await toggleVipBundleVisibility(bundle.id, newStatus);
      setBundles(prev => prev.map(b => b.id === bundle.id ? { ...b, isVisible: newStatus } : b));
    } catch (err) {
      console.error(err);
      alert(lang === 'ar' ? 'فشل تغيير حالة الباقة' : 'Failed to update visibility');
    }
  };

  // Delete Bundle
  const handleDeleteBundle = async (bundle: VipBundle) => {
    if (!confirm(lang === 'ar' ? `هل أنت متأكد من حذف الباقة "${bundle.name}" بالكامل؟` : `Delete bundle "${bundle.name}"?`)) {
      return;
    }
    try {
      await deleteVipBundle(bundle.id);
      setBundles(prev => prev.filter(b => b.id !== bundle.id));
    } catch (err) {
      console.error(err);
      alert(lang === 'ar' ? 'فشل حذف الباقة' : 'Failed to delete bundle');
    }
  };

  // Move bundle up or down
  const handleMoveBundle = async (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === bundles.length - 1)) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...bundles];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;
    
    // Update state immediately for instant feedback
    setBundles(reordered);
    try {
      await reorderVipBundles(reordered);
    } catch (err) {
      console.error(err);
    }
  };

  // Helper icon renderer
  const renderIconBadge = (iconKey?: string) => {
    const found = AVAILABLE_ICONS.find(i => i.id === iconKey);
    const IconComp = found ? found.icon : Gift;
    return <IconComp className="w-5 h-5" />;
  };

  return (
    <div className="space-y-6">
      {/* Informational Guidance Header */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-yellow-900/20 to-slate-900 border border-amber-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 shrink-0">
            <Crown className="w-6 h-6 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white">
                {lang === 'ar' ? 'تخصيص باقات وهدايا VIP الحصرية' : 'VIP Bundles Customization'}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {bundles.length} {lang === 'ar' ? 'باقة رئيسية' : 'Bundles'}
              </span>
            </div>
            <p className="text-xs text-amber-200/80 mt-1 max-w-2xl leading-relaxed">
              {lang === 'ar' 
                ? 'أنشئ باقات رئيسية حصرية (مثل: 🎁 هدية VIP)، وأضف بداخلها روابط فرعية غير محدودة. يرى المستخدم في واجهة المتجر الباقة الرئيسية فقط، وبمجرد النقر عليها تفتح له صفحة تعرض كافة الروابط والباقات المرتبطة.'
                : 'Create VIP main bundles (e.g. 🎁 VIP Gift) with unlimited nested links. Users see the main bundle in the storefront, clicking it reveals all nested links.'}
            </p>
          </div>
        </div>

        {!isEditing && (
          <button
            type="button"
            onClick={handleStartCreate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-600 hover:from-amber-300 hover:to-yellow-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all shrink-0 active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{lang === 'ar' ? '+ إنشاء باقة VIP رئيسية جديدة' : '+ Create New VIP Bundle'}</span>
          </button>
        )}
      </div>

      {/* EDIT / CREATE FORM MODAL OR INLINE VIEW */}
      {isEditing ? (
        <form onSubmit={handleSaveBundle} className="p-6 rounded-2xl bg-[#111622] border border-amber-500/40 shadow-2xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                <Edit3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {editingBundleId 
                    ? (lang === 'ar' ? 'تعديل الباقة الرئيسية والروابط الفرعية' : 'Edit VIP Bundle')
                    : (lang === 'ar' ? 'إنشاء باقة VIP رئيسية جديدة' : 'Create New VIP Bundle')}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {lang === 'ar' ? 'حدد اسم ووصف الباقة وأيقونتها والروابط الفرعية بداخلها' : 'Configure bundle name, icon, description, and nested links'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Section 1: Main Bundle Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bundle Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {lang === 'ar' ? 'اسم الباقة الرئيسية (يظهر للمستخدمين في الواجهة) *' : 'Main Bundle Name *'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: 🎁 هدية VIP' : 'e.g. 🎁 VIP Gift'}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Badge */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {lang === 'ar' ? 'شارة الباقة (Badge)' : 'Bundle Badge'}
              </label>
              <input
                type="text"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                placeholder={lang === 'ar' ? 'مثال: VIP حصري، هدية مجانية، خصم 60%' : 'e.g. VIP Exclusive, Free'}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {lang === 'ar' ? 'وصف الباقة الرئيسية *' : 'Bundle Description *'}
              </label>
              <textarea
                rows={2}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={lang === 'ar' ? 'اكتب وصفاً جذاباً يوضح محتويات ومميزات هذه الباقة الحصرية...' : 'Write an attractive description of what this bundle contains...'}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Icon Picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                {lang === 'ar' ? 'اختر أيقونة الباقة' : 'Choose Bundle Icon'}
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {AVAILABLE_ICONS.map((item) => {
                  const IconComp = item.icon;
                  const isSelected = icon === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setIcon(item.id)}
                      className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md shadow-amber-500/10'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <IconComp className="w-5 h-5" />
                      <span className="text-[10px] font-medium">{item.label.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Image / Poster URL (Optional) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {lang === 'ar' ? 'رابط صورة أو غلاف مخصص (اختياري)' : 'Custom Image URL (Optional)'}
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/... or https://..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                {lang === 'ar' ? 'يمكن تركها فارغة للاعتماد على الأيقونة المحددة' : 'Leave empty to use the selected icon'}
              </p>
            </div>

            {/* Visibility Toggle */}
            <div className="md:col-span-2 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isVisible ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                }`}>
                  {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">
                    {lang === 'ar' ? 'هل تظهر الباقة للمستخدمين في الواجهة؟' : 'Visible to users on storefront?'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {isVisible 
                      ? (lang === 'ar' ? 'مفعلة وتظهر فوراً لجميع الزوار في الموقع' : 'Visible to all users on the site')
                      : (lang === 'ar' ? 'مخفية مؤقتاً ولن تظهر في واجهة المتجر حتى تقوم بتفعيلها' : 'Hidden from users')}
                  </div>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={(e) => setIsVisible(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
          </div>

          {/* Section 2: Sub-items & Nested Links Builder */}
          <div className="pt-5 border-t border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-cyan-400" />
                <h4 className="text-sm font-bold text-white">
                  {lang === 'ar' ? 'الروابط والباقات الفرعية التابعة لهذه الباقة' : 'Nested Links and Sub-Items'}
                </h4>
                <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">
                  {subItems.length} {lang === 'ar' ? 'رابط' : 'Links'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleAddSubItem}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? '+ إضافة رابط فرعي جديد' : '+ Add Sub-Link'}</span>
              </button>
            </div>

            {subItems.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-900/50 border border-dashed border-slate-800 space-y-3">
                <p className="text-xs text-slate-400">
                  {lang === 'ar' ? 'لا توجد روابط أو باقات فرعية مضافة حتى الآن داخل هذه الباقة.' : 'No sub-links added yet.'}
                </p>
                <button
                  type="button"
                  onClick={handleAddSubItem}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md"
                >
                  {lang === 'ar' ? 'إضافة أول رابط فرعي' : 'Add First Sub-Link'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {subItems.map((item, index) => (
                  <div 
                    key={item.id} 
                    className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-amber-300 text-[11px] font-mono font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className="text-xs font-semibold text-slate-300">
                          {item.title || (lang === 'ar' ? `رابط فرعي #${index + 1}` : `Link #${index + 1}`)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMoveSubItem(index, 'up')}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-400 hover:text-white"
                          title="تحريك لأعلى"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === subItems.length - 1}
                          onClick={() => handleMoveSubItem(index, 'down')}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-400 hover:text-white"
                          title="تحريك لأسفل"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSubItem(item.id)}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 ml-1"
                          title="حذف هذا الرابط"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Sub-item Title */}
                      <div className="md:col-span-2">
                        <label className="block text-[11px] text-slate-400 mb-1">
                          {lang === 'ar' ? 'عنوان الرابط / الباقة الفرعية *' : 'Sub-link Title *'}
                        </label>
                        <input
                          type="text"
                          required
                          value={item.title}
                          onChange={(e) => handleUpdateSubItem(item.id, 'title', e.target.value)}
                          placeholder={lang === 'ar' ? 'مثال: باقة السيارات الملكية 3D (تحميل مباشر)' : 'e.g. 3D Cars VIP Pack'}
                          className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      {/* Sub-item Badge */}
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          {lang === 'ar' ? 'شارة فرعية (Badge)' : 'Badge'}
                        </label>
                        <input
                          type="text"
                          value={item.badge || ''}
                          onChange={(e) => handleUpdateSubItem(item.id, 'badge', e.target.value)}
                          placeholder={lang === 'ar' ? 'مثال: تحميل مباشر، جوجل درايف، كود خاص' : 'e.g. Direct Download'}
                          className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      {/* Sub-item Target URL */}
                      <div className="md:col-span-2">
                        <label className="block text-[11px] text-slate-400 mb-1">
                          {lang === 'ar' ? 'الرابط المستهدف (URL) *' : 'Target URL *'}
                        </label>
                        <input
                          type="text"
                          required
                          value={item.url}
                          onChange={(e) => handleUpdateSubItem(item.id, 'url', e.target.value)}
                          placeholder="https://drive.google.com/... or https://wa.me/... or https://..."
                          className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-cyan-300 text-xs font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      {/* Button Text */}
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          {lang === 'ar' ? 'نص زر الفتح' : 'Button Text'}
                        </label>
                        <input
                          type="text"
                          value={item.buttonText || ''}
                          onChange={(e) => handleUpdateSubItem(item.id, 'buttonText', e.target.value)}
                          placeholder={lang === 'ar' ? 'فتح الرابط' : 'Open Link'}
                          className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      {/* Sub-item Description */}
                      <div className="md:col-span-3">
                        <label className="block text-[11px] text-slate-400 mb-1">
                          {lang === 'ar' ? 'وصف الرابط الفرعي (اختياري)' : 'Description (Optional)'}
                        </label>
                        <input
                          type="text"
                          value={item.description || ''}
                          onChange={(e) => handleUpdateSubItem(item.id, 'description', e.target.value)}
                          placeholder={lang === 'ar' ? 'تفاصيل إضافية عن الملف أو طريقة فك الضغط أو المجلد...' : 'Additional details...'}
                          className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
            <div className="flex items-center gap-2 text-xs">
              {saveStatus === 'saved' && (
                <span className="text-emerald-400 flex items-center gap-1.5 font-bold animate-fadeIn">
                  <Check className="w-4 h-4" />
                  {statusMsg}
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="text-red-400 flex items-center gap-1.5 font-bold">
                  <AlertCircle className="w-4 h-4" />
                  {statusMsg}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="submit"
                disabled={saveStatus === 'saving'}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-600 hover:from-amber-300 hover:to-yellow-500 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {saveStatus === 'saving' 
                  ? (lang === 'ar' ? 'جاري الحفظ في السحابة...' : 'Saving...')
                  : (lang === 'ar' ? 'حفظ باقة VIP في الموقع' : 'Save VIP Bundle')}
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* MAIN BUNDLES SHOWCASE LIST IN DASHBOARD */
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="text-xs font-bold text-slate-300">
              {lang === 'ar' ? 'قائمة الباقات الرئيسية الحالية:' : 'Current VIP Main Bundles:'}
            </div>
            <div className="text-[11px] text-slate-400">
              {lang === 'ar' ? 'يمكنك إعادة ترتيب الباقات، أو إخفائها وإظهارها بنقرة واحدة' : 'Reorder or toggle visibility easily'}
            </div>
          </div>

          {bundles.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto">
                <Crown className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {lang === 'ar' ? 'لم تقم بإنشاء أي باقة VIP بعد' : 'No VIP Bundles Created Yet'}
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  {lang === 'ar' ? 'أنشئ أول باقة رئيسية مثل "🎁 هدية VIP" وأضف بداخلها روابط حزمك الحصرية للمستخدمين.' : 'Create your first bundle now.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleStartCreate}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-600 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20"
              >
                {lang === 'ar' ? '+ إنشاء باقة VIP الآن' : '+ Create VIP Bundle Now'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {bundles.map((bundle, index) => {
                const subCount = bundle.subItems ? bundle.subItems.length : 0;
                return (
                  <div
                    key={bundle.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      bundle.isVisible
                        ? 'bg-[#101420] border-amber-500/40 shadow-lg shadow-amber-500/5'
                        : 'bg-slate-950/70 border-slate-800/80 opacity-75'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Icon, Name, Description, Stats */}
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400/20 to-yellow-600/20 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0 shadow-md">
                          {renderIconBadge(bundle.icon)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="text-base font-black text-white truncate">
                              {bundle.name}
                            </h3>

                            {bundle.badge && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                {bundle.badge}
                              </span>
                            )}

                            {/* Visibility Badge */}
                            {bundle.isVisible ? (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <Eye className="w-3 h-3" />
                                {lang === 'ar' ? 'ظاهرة للمستخدمين' : 'Visible'}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                                <EyeOff className="w-3 h-3" />
                                {lang === 'ar' ? 'مخفية مؤقتاً' : 'Hidden'}
                              </span>
                            )}

                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                              {subCount} {lang === 'ar' ? 'روابط فرعية' : 'Links'}
                            </span>
                          </div>

                          <p className="text-xs text-slate-300 mt-1 leading-relaxed line-clamp-2">
                            {bundle.description}
                          </p>

                          {/* Sub-Items preview tags */}
                          {subCount > 0 && (
                            <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                              {bundle.subItems.slice(0, 3).map((sub) => (
                                <span key={sub.id} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400 flex items-center gap-1">
                                  <LinkIcon className="w-2.5 h-2.5 text-cyan-400" />
                                  <span className="truncate max-w-[150px]">{sub.title}</span>
                                </span>
                              ))}
                              {subCount > 3 && (
                                <span className="text-[10px] text-slate-500">
                                  +{subCount - 3} {lang === 'ar' ? 'روابط أخرى' : 'more'}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                        {/* Move Up/Down */}
                        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveBundle(index, 'up')}
                            className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-25 text-slate-400 hover:text-white transition-all"
                            title="تحريك الباقة لأعلى"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={index === bundles.length - 1}
                            onClick={() => handleMoveBundle(index, 'down')}
                            className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-25 text-slate-400 hover:text-white transition-all"
                            title="تحريك الباقة لأسفل"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Visibility Quick Toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleVisibility(bundle)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                            bundle.isVisible
                              ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
                          }`}
                          title={bundle.isVisible ? 'إخفاء الباقة عن المستخدمين' : 'إظهار الباقة للمستخدمين'}
                        >
                          {bundle.isVisible ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5" />}
                          <span>{bundle.isVisible ? (lang === 'ar' ? 'ظاهر' : 'Visible') : (lang === 'ar' ? 'إظهار' : 'Show')}</span>
                        </button>

                        {/* Live User Preview Modal Trigger */}
                        {onPreviewBundle && (
                          <button
                            type="button"
                            onClick={() => onPreviewBundle(bundle)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-800 hover:border-cyan-500/40 text-xs font-semibold transition-all"
                            title="معاينة الباقة كما سيراها المستخدم"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'معاينة' : 'Preview'}</span>
                          </button>
                        )}

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleStartEdit(bundle)}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteBundle(bundle)}
                          className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all"
                          title="حذف الباقة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
