import React, { Suspense, lazy } from 'react';
import { 
  X, Eye, Star, Crown, Play, Loader2, Sparkles, AlertCircle, ArrowLeft
} from 'lucide-react';
import { ToolRegistryItem } from '../config/toolsRegistry';
import { UserRecord, AppSettings } from '../types';
import { useStarredTools } from '../utils/starredTools';
import { calculateSubscriptionInfo } from '../utils/subscriptionUtils';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ErrorBoundary } from './ErrorBoundary';

const safeLazy = (importFn: () => Promise<any>, namedExport?: string) => {
  return lazy(() =>
    importFn().then(m => {
      const comp = (namedExport && m[namedExport]) || m.default || (namedExport ? undefined : Object.values(m).find(v => typeof v === 'function'));
      if (!comp) {
        console.error("Component failed to resolve in safeLazy:", namedExport, m);
        return { default: () => <div className="p-8 text-center text-red-400 font-bold">تعذر تحميل واجهة هذه الأداة للمعاينة</div> };
      }
      return { default: comp };
    }).catch(err => {
      console.error("Failed to dynamically import component in safeLazy:", err);
      return { default: () => <div className="p-8 text-center text-red-400 font-bold">حدث خطأ في تحميل الأداة</div> };
    })
  );
};

// Resilient Lazy load actual real components for live feature preview
const AfterEffectsStudio = safeLazy(() => import('./AfterEffectsStudio'), 'AfterEffectsStudio');
const VideoDurationSpeedModal = safeLazy(() => import('./VideoDurationSpeedModal'), 'VideoDurationSpeedModal');
const SvgaLayerEditor = safeLazy(() => import('./SvgaLayerEditor/SvgaLayerEditor'), 'SvgaLayerEditor');
const UniversalMotionTools = safeLazy(() => import('./UniversalMotionTools'), 'UniversalMotionTools');
const SvgaBatchCompressor = safeLazy(() => import('./SvgaBatchCompressor'), 'SvgaBatchCompressor');
const BatchSvgaConverter = safeLazy(() => import('./BatchSvgaConverter'), 'BatchSvgaConverter');
const ImageToSvga = safeLazy(() => import('./ImageToSvga'), 'ImageToSvga');
const ImageProcessor = safeLazy(() => import('./ImageProcessor'), 'ImageProcessor');
const ImageEnhancer = safeLazy(() => import('./ImageEnhancer'), 'ImageEnhancer');
const BatchImageProcessor = safeLazy(() => import('./BatchImageProcessor'), 'BatchImageProcessor');
const ImageEditor = safeLazy(() => import('./ImageEditor'), 'ImageEditor');
const ImageMatcher = safeLazy(() => import('./ImageMatcher'), 'ImageMatcher');
const BatchCropper = safeLazy(() => import('./BatchCropper'), 'BatchCropper');
const Name3DEditor = safeLazy(() => import('./Name3DEditor/Name3DEditor'), 'Name3DEditor');
const MultiSvgaViewer = safeLazy(() => import('./MultiSvgaViewer'), 'MultiSvgaViewer');
const AudioExtractor = safeLazy(() => import('./AudioExtractor'), 'AudioExtractor');
const AIVideoMattingStudio = safeLazy(() => import('./AIVideoMattingStudio'), 'AIVideoMattingStudio');
const ImageCollageStudio = safeLazy(() => import('./ImageCollageStudio/ImageCollageStudio'), 'ImageCollageStudio');
const AnimationManager = safeLazy(() => import('./AnimationManager/AnimationManager'), 'AnimationManager');
const Store = safeLazy(() => import('./Store'), 'Store');
const VapHub = safeLazy(() => import('./VapHub'), 'VapHub');
const VideoConverter = safeLazy(() => import('./VideoConverter'), 'VideoConverter');
const BatchCompressor = safeLazy(() => import('./BatchCompressor'), 'BatchCompressor');

interface FeaturePreviewModalProps {
  tool: ToolRegistryItem | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserRecord | null;
  settings?: AppSettings | null;
  onUpdateSettings?: (newSettings: AppSettings) => void;
  onLaunchFeature: (tool: ToolRegistryItem) => void;
}

export const FeaturePreviewModal: React.FC<FeaturePreviewModalProps> = ({
  tool,
  isOpen,
  onClose,
  currentUser,
  settings,
  onUpdateSettings,
  onLaunchFeature,
}) => {
  const { isStarred, toggleStar } = useStarredTools();

  if (!isOpen || !tool) return null;

  const isAdminOrMod = currentUser?.role === 'admin' || currentUser?.role === 'moderator' || currentUser?.isSuperAdmin;
  const subInfo = currentUser ? calculateSubscriptionInfo(currentUser) : null;
  const isSubscriptionActive = subInfo ? (subInfo.isActive || subInfo.isLifetime) : true;
  const isUserVip = !!(isAdminOrMod || (currentUser?.isVIP === true && isSubscriptionActive));
  const isVib = 
    tool.isVip ||
    tool.id === 'svga-layer-editor' || 
    tool.id === 'after-effects-studio' ||
    settings?.vibFeatures?.includes(tool.id) ||
    (tool.dashboardActionKey && settings?.vibFeatures?.includes(tool.dashboardActionKey)) ||
    (tool.featureAccessKey && settings?.vibFeatures?.includes(tool.featureAccessKey));
  const starred = isStarred(tool.id);

  const handleToggleVib = async () => {
    if (!settings) return;
    const currentVibs = settings.vibFeatures || [];
    const currentlyVip = 
      currentVibs.includes(tool.id) ||
      (tool.dashboardActionKey && currentVibs.includes(tool.dashboardActionKey)) ||
      (tool.featureAccessKey && currentVibs.includes(tool.featureAccessKey));

    const newVibs = currentlyVip
      ? currentVibs.filter(id => id !== tool.id && id !== tool.dashboardActionKey && id !== tool.featureAccessKey)
      : [...currentVibs, tool.id];

    const updatedSettings: AppSettings = {
      ...settings,
      vibFeatures: newVibs
    };

    if (onUpdateSettings) {
      onUpdateSettings(updatedSettings);
    }

    try {
      await setDoc(doc(db, 'settings', 'global'), {
        vibFeatures: newVibs
      }, { merge: true });
    } catch (err) {
      console.error("Error toggling VIB in preview modal:", err);
    }
  };

  const renderRealFeature = () => {
    const commonProps = {
      onCancel: onClose,
      onClose: onClose,
      onBack: onClose,
      currentUser: currentUser || null,
      onLoginRequired: () => {},
      onSubscriptionRequired: () => {},
    };

    switch (tool.id) {
      case 'after-effects-studio':
        return (
          <AfterEffectsStudio 
            initialFile={null} 
            initialMetadata={null} 
            onCancel={onClose} 
            onClose={onClose} 
          />
        );

      case 'video-duration-speed':
        return (
          <VideoDurationSpeedModal 
            isOpen={true} 
            onClose={onClose} 
          />
        );

      case 'svga-layer-editor':
        return (
          <SvgaLayerEditor 
            onClose={onClose} 
          />
        );

      case 'universal':
      case 'universalConverter':
        return (
          <UniversalMotionTools 
            {...commonProps} 
            initialFile={null} 
          />
        );

      case 'svgaBatchCompressor':
      case 'svga-compressor':
        return (
          <SvgaBatchCompressor 
            {...commonProps} 
          />
        );

      case 'batchSvgaConverter':
      case 'batch-svga':
        return (
          <BatchSvgaConverter 
            {...commonProps} 
            settings={settings || undefined} 
          />
        );

      case 'imageConverter':
      case 'image-converter':
        return (
          <ImageToSvga 
            {...commonProps} 
            globalQuality="high" 
            initialFile={null} 
          />
        );

      case 'imageProcessor':
      case 'image-processor':
        return (
          <ImageProcessor 
            {...commonProps} 
          />
        );

      case 'imageEnhancer':
      case 'image-enhancer':
        return (
          <ImageEnhancer 
            {...commonProps} 
          />
        );

      case 'batchImageProcessor':
      case 'batch-image-processor':
        return (
          <BatchImageProcessor 
            {...commonProps} 
          />
        );

      case 'imageEditor':
      case 'image-editor':
        return (
          <ImageEditor 
            {...commonProps} 
          />
        );

      case 'imageMatcher':
      case 'image-matcher':
        return (
          <ImageMatcher 
            {...commonProps} 
          />
        );

      case 'cropper':
      case 'batchCropper':
        return (
          <BatchCropper 
            {...commonProps} 
          />
        );

      case 'name3DEditor':
      case 'name-3d-editor':
        return (
          <Name3DEditor 
            {...commonProps} 
          />
        );

      case 'multiSvga':
      case 'multi-svga':
        return (
          <MultiSvgaViewer 
            {...commonProps} 
            initialFiles={[]} 
          />
        );

      case 'audioExtractor':
      case 'audio-extractor':
        return (
          <AudioExtractor 
            {...commonProps} 
          />
        );

      case 'aiVideoMatting':
      case 'ai-video-matting':
        return (
          <AIVideoMattingStudio 
            {...commonProps} 
            initialVideoFile={null} 
          />
        );

      case 'imageCollageStudio':
      case 'image-collage-studio':
        return (
          <ImageCollageStudio 
            onBack={onClose} 
            initialFiles={null} 
          />
        );

      case 'animationManager':
      case 'animation-manager':
        return (
          <AnimationManager 
            onBack={onClose} 
          />
        );

      case 'store':
        return (
          <Store 
            currentUser={currentUser || null} 
            onLoginRequired={() => {}} 
          />
        );

      case 'vapHub':
      case 'vap-hub':
        return (
          <VapHub />
        );

      case 'converter':
      case 'videoConverter':
        return (
          <VideoConverter 
            {...commonProps} 
            globalQuality="high" 
            initialFiles={[]} 
          />
        );

      case 'batchCompress':
      case 'batch-compressor':
        return (
          <BatchCompressor 
            {...commonProps} 
          />
        );

      default:
        return (
          <UniversalMotionTools 
            {...commonProps} 
          />
        );
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[99999] flex flex-col bg-slate-950/95 backdrop-blur-xl animate-fade-in" 
      dir="rtl"
    >
      {/* Top Floating Control Bar for Real Live Inspection */}
      <div className="flex-shrink-0 w-full bg-[#0a0f1d] border-b border-white/10 px-4 py-3 sm:px-6 sm:py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xl z-50">
        
        {/* Tool Info & Live Preview Badge */}
        <div className="flex items-center gap-3">
          <span className="p-2 sm:p-2.5 rounded-2xl bg-slate-900 border border-white/10 text-amber-400 shadow-inner flex items-center justify-center">
            {React.isValidElement(tool.icon) ? (
              React.cloneElement(tool.icon as React.ReactElement<any>, { className: 'w-5 h-5 text-amber-400' })
            ) : (
              <Crown className="w-5 h-5 text-amber-400" />
            )}
          </span>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-white">{tool.label}</h2>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 shadow-sm">
                <Eye className="w-3 h-3 text-indigo-400 animate-pulse" />
                <span>المعاينة الحية للشكل والواجهة الحقيقية</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
              {tool.categoryNameAr} • يمكنك تجربة الأداة بالكامل وفحص واجهتها الحقيقية مباشرة هنا
            </p>
          </div>
        </div>

        {/* Admin Decisions & Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* VIP / VIB Toggle for Admin */}
          {isAdminOrMod && (
            <button
              type="button"
              disabled={tool.id === 'svga-layer-editor' || tool.id === 'after-effects-studio'}
              onClick={handleToggleVib}
              className={`px-3 sm:px-4 py-2 rounded-xl border text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md ${
                isVib 
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-amber-500/15 hover:bg-amber-500/30' 
                  : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:border-white/20'
              }`}
              title={isVib ? 'انقر لجعل الميزة عامة ومتاحة للجميع' : 'انقر لجعل الميزة حصرية لـ VIP'}
            >
              <Crown className={`w-4 h-4 ${isVib ? 'text-amber-400' : 'text-slate-400'}`} />
              <span>{isVib ? 'ميزة VIP حصرية 👑' : 'متاحة للجميع (عامة)'}</span>
            </button>
          )}

          {/* Star Pin Toggle */}
          <button
            type="button"
            onClick={() => toggleStar(tool.id)}
            className={`px-3 sm:px-4 py-2 rounded-xl border text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md ${
              starred 
                ? 'bg-indigo-500/25 border-indigo-500/50 text-indigo-300 shadow-indigo-500/15' 
                : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:border-white/20'
            }`}
            title={starred ? 'إلغاء التثبيت بنجمة' : 'تثبيت الأداة بنجمة في البداية'}
          >
            <Star className={`w-4 h-4 ${starred ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}`} />
            <span>{starred ? 'مثبتة بنجمة ⭐' : 'تثبيت بنجمة ⭐'}</span>
          </button>

          {/* Close / Return Button */}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-black border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            title="إغلاق المعاينة والرجوع"
          >
            <X className="w-4 h-4 text-slate-300" />
            <span>إغلاق المعاينة</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Body - Rendering The Real Tool Interface */}
      <div className="flex-1 w-full h-full overflow-y-auto custom-scrollbar bg-[#050811] relative">
        {isVib && !isUserVip ? (
          <div className="w-full h-[65vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-4 shadow-xl shadow-amber-500/20">
              <Crown className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-white mb-2">ميزة VIP حصرية 👑</h3>
            <p className="text-sm text-slate-300 max-w-md leading-relaxed mb-6">
              تم تحديد أداة &quot;{tool.label}&quot; كميزة حصرية لمشتركي VIP فقط. يرجى تفعيل اشتراك VIP للوصول إلى كافة إمكانياتها واستخدامها.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition-all shadow-lg shadow-amber-500/25 cursor-pointer"
            >
              إغلاق المعاينة
            </button>
          </div>
        ) : (
          <ErrorBoundary fallbackTitle="حدث خطأ في تحميل الواجهة الحقيقية للأداة" onReset={onClose}>
            <Suspense fallback={
              <div className="w-full h-[60vh] flex flex-col items-center justify-center gap-3 text-indigo-400">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                <span className="text-sm font-bold text-slate-300">جاري تحميل واجهة {tool.label} الحقيقية بالكامل...</span>
              </div>
            }>
              <div className="w-full min-h-full">
                {renderRealFeature()}
              </div>
            </Suspense>
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
};
