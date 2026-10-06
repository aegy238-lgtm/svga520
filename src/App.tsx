import React, { useState, useCallback, useEffect, useRef, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Header } from './components/Header';
import { FeaturesGuideModal } from './components/FeaturesGuideModal';
import { Uploader } from './components/Uploader';
import { Dashboard } from './components/Dashboard';
import { calculateSubscriptionInfo } from './utils/subscriptionUtils';

// Resilient lazy-loader with auto-retry and chunk failure recovery
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T } | any>,
  retriesLeft = 3,
  interval = 600
): React.LazyExoticComponent<T> {
  return lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (retries: number) => {
        factory()
          .then((mod: any) => {
            try {
              if (typeof window !== 'undefined') {
                sessionStorage.removeItem('chunk_reload_attempted');
              }
            } catch {}

            const component = mod?.default || mod?.Workspace || mod;
            if (component) {
              resolve({ default: component });
            } else {
              resolve({ default: mod as T });
            }
          })
          .catch((error: any) => {
            console.warn(`[LazyRetry] Dynamic import error (${retries} retries remaining):`, error);
            if (retries <= 0) {
              const errMsg = String(error?.message || '');
              const isChunkFailed = 
                errMsg.includes('Failed to fetch dynamically imported module') ||
                errMsg.includes('Loading chunk') ||
                errMsg.includes('dynamically imported module') ||
                errMsg.includes('error loading') ||
                errMsg.includes('Importing a module script failed');
              
              if (isChunkFailed && typeof window !== 'undefined') {
                const reloadKey = 'chunk_reload_attempted';
                if (!sessionStorage.getItem(reloadKey)) {
                  sessionStorage.setItem(reloadKey, 'true');
                  window.location.reload();
                  return;
                }
              }
              reject(error);
              return;
            }
            setTimeout(() => {
              attempt(retries - 1);
            }, interval);
          });
      };
      attempt(retriesLeft);
    })
  );
}

// Lazy load heavy tools to drastically reduce initial bundle size with resilient retries
const Workspace = lazyWithRetry(() => import('./components/Workspace').then(m => ({ default: m.Workspace || m.default })));
const BatchCompressor = lazyWithRetry(() => import('./components/BatchCompressor').then(m => ({ default: m.BatchCompressor })));
const BatchCropper = lazyWithRetry(() => import('./components/BatchCropper').then(m => ({ default: m.BatchCropper })));
const VideoConverter = lazyWithRetry(() => import('./components/VideoConverter').then(m => ({ default: m.VideoConverter })));
const UniversalMotionTools = lazyWithRetry(() => import('./components/UniversalMotionTools').then(m => ({ default: m.UniversalMotionTools })));
const MultiSvgaViewer = lazyWithRetry(() => import('./components/MultiSvgaViewer').then(m => ({ default: m.MultiSvgaViewer })));
const ImageToSvga = lazyWithRetry(() => import('./components/ImageToSvga').then(m => ({ default: m.ImageToSvga })));
const ImageProcessor = lazyWithRetry(() => import('./components/ImageProcessor').then(m => ({ default: m.ImageProcessor })));
const ImageEnhancer = lazyWithRetry(() => import('./components/ImageEnhancer').then(m => ({ default: m.ImageEnhancer })));
const BatchImageProcessor = lazyWithRetry(() => import('./components/BatchImageProcessor').then(m => ({ default: m.BatchImageProcessor })));
const BatchImageConverter = lazyWithRetry(() => import('./components/BatchImageConverter').then(m => ({ default: m.BatchImageConverter })));
const PagToSvgaStudio = lazyWithRetry(() => import('./components/PagToSvgaStudio').then(m => ({ default: m.PagToSvgaStudio })));
const SvgaBatchCompressor = lazyWithRetry(() => import('./components/SvgaBatchCompressor').then(m => ({ default: m.SvgaBatchCompressor })));
const BatchSvgaConverter = lazyWithRetry(() => import('./components/BatchSvgaConverter').then(m => ({ default: m.BatchSvgaConverter })));
const SvgaLayerEditor = lazyWithRetry(() => import('./components/SvgaLayerEditor/SvgaLayerEditor').then(m => ({ default: m.SvgaLayerEditor })));
const ImageEditor = lazyWithRetry(() => import('./components/ImageEditor').then(m => ({ default: m.ImageEditor })));
const Name3DEditor = lazyWithRetry(() => import('./components/Name3DEditor/Name3DEditor'));
const ImageMatcher = lazyWithRetry(() => import('./components/ImageMatcher').then(m => ({ default: m.ImageMatcher })));
const AudioExtractor = lazyWithRetry(() => import('./components/AudioExtractor').then(m => ({ default: m.AudioExtractor })));
const AIVideoMattingStudio = lazyWithRetry(() => import('./components/AIVideoMattingStudio').then(m => ({ default: m.AIVideoMattingStudio })));
const ImageCollageStudio = lazyWithRetry(() => import('./components/ImageCollageStudio/ImageCollageStudio').then(m => ({ default: m.ImageCollageStudio || m.default })));
const AnimationManager = lazyWithRetry(() => import('./components/AnimationManager/AnimationManager').then(m => ({ default: m.AnimationManager })));
const AdminPanel = lazyWithRetry(() => import('./components/AdminPanel').then(m => ({ default: m.AdminPanel })));
const Store = lazyWithRetry(() => import('./components/Store').then(m => ({ default: m.Store })));
const VapHub = lazyWithRetry(() => import('./components/VapHub').then(m => ({ default: m.VapHub })));
const EmbeddedPortalViewer = lazyWithRetry(() => import('./components/EmbeddedPortalViewer').then(m => ({ default: m.EmbeddedPortalViewer })));
const UniversalMultiFormatPlayerModal = lazyWithRetry(() => import('./components/UniversalMultiFormatPlayerModal').then(m => ({ default: m.UniversalMultiFormatPlayerModal || m.default })));
const AfterEffectsStudio = lazyWithRetry(() => import('./components/AfterEffectsStudio').then(m => ({ default: m.AfterEffectsStudio || m.default })));
const ApkAssetExtractor = lazyWithRetry(() => import('./components/ApkAssetExtractor').then(m => ({ default: m.ApkAssetExtractor || m.default })));

import { LanguageTranslatorWidget } from './components/LanguageTranslatorWidget';


import { Login } from './components/Auth/Login';
import { Signup } from './components/Auth/Signup';
import { Loading } from './components/Auth/Loading';
import { UserProfileModal } from './components/UserProfileModal';
import { SubscriptionModal } from './components/SubscriptionModal';
import { VideoDurationSpeedModal } from './components/VideoDurationSpeedModal';
import { VipSubscriptionModal } from './components/VipSubscriptionModal';
import { ScreenProtectionOverlay } from './components/ScreenProtectionOverlay';
import { useAuth } from './contexts/AuthContext';
import { AppState, FileMetadata, AppSettings } from './types';
import { useAccessControl } from './hooks/useAccessControl';
import { doc, getDoc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { logActivity } from './utils/logger';
import { MaintenanceScreen } from './components/MaintenanceScreen';
import { VersionBlockedModal } from './components/Auth/VersionBlockedModal';
import { checkVersionCompatibility, verifyAccountVersionWithServer, getActiveClientVersion } from './utils/versionControl';
import { AppUpdateToast } from './components/AppUpdateToast';
import { GlobalExportWidget } from './components/GlobalExportWidget';
import { extractSvgaFromPdfFile } from './utils/pdfSvgaExtractor';
import { ensureSvgaFile, batchDetectAndNormalizeFiles, detectIsSvga } from './utils/svgaUniversalEngine';
import { usePWAFileHandling } from './hooks/usePWAFileHandling';
import { PWAFloatingInstallButton } from './components/PWAFloatingInstallButton';

declare var SVGA: any;

import { OnboardingModal } from './components/OnboardingModal';
import { HelpCircle, BookOpen, Wrench, AlertTriangle, ShieldAlert, ShoppingBag, Film, Layers, X } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ImageDimensionModal, ImageDimensionsResult } from './components/ImageDimensionModal';

const videoWidth = 1334;
const videoHeight = 750;

const isVideoUrl = (url?: string | null): boolean => {
  if (!url) return false;
  const cleanUrl = url.trim().toLowerCase();
  
  // Explicit non-video image extensions
  const isImageExt = cleanUrl.match(/\.(png|jpe?g|svg|ico|webp)(\?.*)?$/) !== null;
  if (isImageExt && !cleanUrl.includes('.mp4') && !cleanUrl.includes('m_')) {
    return false;
  }

  return (
    cleanUrl.includes('.mp4') ||
    cleanUrl.includes('.webm') ||
    cleanUrl.includes('.mov') ||
    cleanUrl.includes('.ogg') ||
    cleanUrl.includes('.m4v') ||
    cleanUrl.includes('.mkv') ||
    cleanUrl.includes('.avi') ||
    cleanUrl.includes('.3gp') ||
    cleanUrl.includes('/m_') ||
    cleanUrl.includes('top4top') ||
    cleanUrl.includes('catbox') ||
    cleanUrl.includes('video') ||
    cleanUrl.includes('media') ||
    cleanUrl.includes('stream') ||
    cleanUrl.startsWith('data:video') ||
    cleanUrl.startsWith('blob:')
  );
};

const App: React.FC = () => {
  const { currentUser, loading, logout } = useAuth();
  const { checkAccess } = useAccessControl();
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(() => {
    const cached = localStorage.getItem('appSettings');
    return cached ? JSON.parse(cached) : null;
  });
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showFeaturesGuide, setShowFeaturesGuide] = useState(false);
  const [showWelcomeGuide, setShowWelcomeGuide] = useState(false);
  const [showBatchImage, setShowBatchImage] = useState(false);
  const [uploadedPagFile, setUploadedPagFile] = useState<File | null>(null);
  const [universalPlayerFile, setUniversalPlayerFile] = useState<File | null>(null);
  const [layerEditorInitialFile, setLayerEditorInitialFile] = useState<File | null>(null);
  const [aeStudioInitialFile, setAeStudioInitialFile] = useState<File | null>(null);
  const [aeStudioInitialDimensions, setAeStudioInitialDimensions] = useState<{ width: number; height: number } | null>(null);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [showImageDimensionModal, setShowImageDimensionModal] = useState<boolean>(false);
  const [layerEditorInitialProject, setLayerEditorInitialProject] = useState<any>(null);
  const [layerEditorInitialLayers, setLayerEditorInitialLayers] = useState<any[] | null>(null);
  const [globalQuality, setGlobalQuality] = useState<'low' | 'medium' | 'high'>('high');
  const [initialLottieFile, setInitialLottieFile] = useState<File | null>(null);
  const [initialVapFile, setInitialVapFile] = useState<File | null>(null);
  const [initialVideoFiles, setInitialVideoFiles] = useState<File[]>([]);
  const [initialSvgaFiles, setInitialSvgaFiles] = useState<File[]>([]);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showDurationSpeedModal, setShowDurationSpeedModal] = useState(false);
  const [showVipModal, setShowVipModal] = useState(false);
  const [vipFeatureName, setVipFeatureName] = useState<string>('تحرير طبقات SVGA');
  const [showSplash, setShowSplash] = useState(true);
  const [embeddedPortalTab, setEmbeddedPortalTab] = useState<'first' | 'second' | string>('first');
  const [videoBgError, setVideoBgError] = useState(false);

  useEffect(() => {
    setVideoBgError(false);
  }, [settings?.backgroundUrl]);

  const handleOpenEmbeddedPortal = useCallback((tabId: 'first' | 'second' | string = 'first') => {
    setEmbeddedPortalTab(tabId);
    setState(AppState.EMBEDDED_PORTAL);
  }, []);

  const handleVideoDurationSpeedOpen = useCallback(() => {
    const isVIP = !!(currentUser?.isVIP || currentUser?.role === 'admin' || currentUser?.isSuperAdmin);
    if (!isVIP) {
      setVipFeatureName('التحكم في سرعة ومدة الفيديو');
      setShowVipModal(true);
      return;
    }
    setShowDurationSpeedModal(true);
  }, [currentUser]);

  // Global action dispatcher to seamlessly open any feature from Dashboard or Modals
  useEffect(() => {
    (window as any).triggerAppAction = (actionKey: string) => {
      const keyToState: Record<string, AppState> = {
        onAfterEffectsStudioOpen: AppState.AFTER_EFFECTS_STUDIO,
        afterEffectsStudio: AppState.AFTER_EFFECTS_STUDIO,
        onApkExtractorOpen: AppState.APK_EXTRACTOR,
        apkExtractor: AppState.APK_EXTRACTOR,
        'apk-extractor': AppState.APK_EXTRACTOR,
        onVideoDurationSpeedOpen: AppState.VIDEO_DURATION_SPEED,
        videoDurationSpeed: AppState.VIDEO_DURATION_SPEED,
        onSvgaLayerEditorOpen: AppState.SVGA_LAYER_EDITOR,
        svgaLayerEditor: AppState.SVGA_LAYER_EDITOR,
        onUniversalConverterOpen: AppState.UNIVERSAL_CONVERTER,
        universalConverter: AppState.UNIVERSAL_CONVERTER,
        onSvgaBatchCompressorOpen: AppState.SVGA_BATCH_COMPRESSOR,
        svgaBatchCompressor: AppState.SVGA_BATCH_COMPRESSOR,
        onBatchSvgaConverterOpen: AppState.BATCH_SVGA_CONVERTER,
        batchSvgaConverter: AppState.BATCH_SVGA_CONVERTER,
        onSvgaExOpen: AppState.SVGA_EDITOR_EX,
        svgaEx: AppState.SVGA_EDITOR_EX,
        onMultiSvgaOpen: AppState.MULTI_SVGA_VIEWER,
        multiSvga: AppState.MULTI_SVGA_VIEWER,
        onImageConverterOpen: AppState.IMAGE_CONVERTER,
        imageConverter: AppState.IMAGE_CONVERTER,
        onImageProcessorOpen: AppState.IMAGE_PROCESSOR,
        imageProcessor: AppState.IMAGE_PROCESSOR,
        onImageEnhancerOpen: AppState.IMAGE_ENHANCER,
        imageEnhancer: AppState.IMAGE_ENHANCER,
        onBatchImageProcessorOpen: AppState.BATCH_IMAGE_PROCESSOR,
        batchImageProcessor: AppState.BATCH_IMAGE_PROCESSOR,
        onImageEditorOpen: AppState.IMAGE_EDITOR,
        imageEditor: AppState.IMAGE_EDITOR,
        onImageMatcherOpen: AppState.IMAGE_MATCHER,
        imageMatcher: AppState.IMAGE_MATCHER,
        onCropperOpen: AppState.BATCH_CROPPER,
        batchCropper: AppState.BATCH_CROPPER,
        onName3DEditorOpen: AppState.NAME_3D_EDITOR,
        name3DEditor: AppState.NAME_3D_EDITOR,
        onAudioExtractorOpen: AppState.AUDIO_EXTRACTOR,
        audioExtractor: AppState.AUDIO_EXTRACTOR,
        onAiVideoMattingOpen: AppState.AI_VIDEO_MATTING,
        aiVideoMatting: AppState.AI_VIDEO_MATTING,
        onImageCollageStudioOpen: AppState.IMAGE_COLLAGE_STUDIO,
        imageCollageStudio: AppState.IMAGE_COLLAGE_STUDIO,
        onStoreOpen: AppState.STORE,
        store: AppState.STORE,
      };
      const targetState = keyToState[actionKey];
      if (targetState !== undefined) {
        setState(targetState);
      }
    };
    return () => {
      delete (window as any).triggerAppAction;
    };
  }, []);

  // Prefetch lazy-loaded components and heavy engines silently in the background
  useEffect(() => {
    // Immediately prefetch core parser libraries in the background
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        import('svga.lite').catch(() => {});
        import('protobufjs').catch(() => {});
        import('pako').catch(() => {});
      });
    } else {
      setTimeout(() => {
        import('svga.lite').catch(() => {});
        import('protobufjs').catch(() => {});
        import('pako').catch(() => {});
      }, 500);
    }

    const timer = setTimeout(() => {
      const loadModules = [
        () => import('./components/Workspace'),
        () => import('./components/BatchCompressor'),
        () => import('./components/BatchCropper'),
        () => import('./components/VideoConverter'),
        () => import('./components/UniversalMotionTools'),
        () => import('./components/MultiSvgaViewer'),
        () => import('./components/ImageToSvga'),
        () => import('./components/ImageProcessor'),
        () => import('./components/ImageEnhancer'),
        () => import('./components/BatchImageProcessor'),
        () => import('./components/BatchImageConverter'),
        () => import('./components/PagToSvgaStudio'),
        () => import('./components/SvgaBatchCompressor'),
        () => import('./components/BatchSvgaConverter'),
        () => import('./components/SvgaLayerEditor/SvgaLayerEditor'),
        () => import('./components/ImageEditor'),
        () => import('./components/Name3DEditor/Name3DEditor'),
        () => import('./components/ImageMatcher'),
        () => import('./components/AudioExtractor'),
        () => import('./components/AIVideoMattingStudio'),
        () => import('./components/AnimationManager/AnimationManager'),
        () => import('./components/AdminPanel')
      ];

      let i = 0;
      const staggerLoad = () => {
        if (i < loadModules.length) {
          if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(() => {
              loadModules[i]().catch(() => {});
              i++;
              staggerLoad();
            });
          } else {
            setTimeout(() => {
              loadModules[i]().catch(() => {});
              i++;
              staggerLoad();
            }, 200);
          }
        }
      };
      staggerLoad();
    }, 2000); // Wait 2 seconds after initial render before background loading

    return () => clearTimeout(timer);
  }, []);

  // Server-Enforced Version Control State
  const [versionBlockedState, setVersionBlockedState] = useState<{
    isBlocked: boolean;
    requiredVersion: string;
    installedVersion: string;
  }>({
    isBlocked: false,
    requiredVersion: 'v3.0.0',
    installedVersion: 'v3.0.0'
  });

  // Ensure user always lands directly on the SVGA Editor / Dashboard home screen

  useEffect(() => {
    if (!currentUser) {
      setVersionBlockedState(prev => ({ ...prev, isBlocked: false }));
      return;
    }

    const clientVer = getActiveClientVersion();

    // CRITICAL: Admins are ALWAYS bypassed from version blocks to prevent lockouts.
    // We also correct database records if they were set incorrectly.
    if (currentUser.role === 'admin') {
      setVersionBlockedState(prev => ({ ...prev, isBlocked: false }));
      
      // Self-correct database if allowedVersion is not set to client version
      if (currentUser.allowedVersion !== clientVer) {
        updateDoc(doc(db, 'users', currentUser.id), {
          allowedVersion: clientVer,
          lastUsedVersion: clientVer
        }).catch(err => console.warn("Failed to correct admin allowedVersion:", err));
      }

      // Self-correct global default allowed version in settings
      if (settings && settings.defaultAllowedVersion !== clientVer) {
        updateDoc(doc(db, 'settings', 'global'), {
          defaultAllowedVersion: clientVer
        }).catch(err => console.warn("Failed to correct global defaultAllowedVersion:", err));
      }
      return;
    }

    const allowedVer = currentUser.allowedVersion || settings?.defaultAllowedVersion || 'v3.0.0';

    const localCheck = checkVersionCompatibility(allowedVer, clientVer);
    if (!localCheck.isAllowed) {
      setVersionBlockedState({
        isBlocked: true,
        requiredVersion: localCheck.requiredVersion,
        installedVersion: localCheck.currentVersion
      });
      return;
    }

    verifyAccountVersionWithServer(currentUser.id, currentUser.email, allowedVer)
      .then(res => {
        if (!res.allowed) {
          setVersionBlockedState({
            isBlocked: true,
            requiredVersion: res.requiredVersion,
            installedVersion: res.installedVersion
          });
        } else {
          setVersionBlockedState(prev => ({ ...prev, isBlocked: false }));
          // Update lastUsedVersion in database if it differs to show real-time version status to admins
          if (currentUser.lastUsedVersion !== clientVer) {
            updateDoc(doc(db, 'users', currentUser.id), {
              lastUsedVersion: clientVer
            }).catch(err => console.warn("Failed to update lastUsedVersion on success:", err));
          }
        }
      })
      .catch(() => {
        if (!localCheck.isAllowed) {
          setVersionBlockedState({
            isBlocked: true,
            requiredVersion: localCheck.requiredVersion,
            installedVersion: localCheck.currentVersion
          });
        } else {
          setVersionBlockedState(prev => ({ ...prev, isBlocked: false }));
          if (currentUser.lastUsedVersion !== clientVer) {
            updateDoc(doc(db, 'users', currentUser.id), {
              lastUsedVersion: clientVer
            }).catch(err => console.warn("Failed to update lastUsedVersion on local success:", err));
          }
        }
      });
  }, [currentUser?.id, currentUser?.role, currentUser?.allowedVersion, settings?.defaultAllowedVersion]);

  useEffect(() => {
    // Show splash screen for 2.8 seconds on startup, then smoothly fade out
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Check if user has seen onboarding
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }
  }, []);

  useEffect(() => {
    const guideSkipped = localStorage.getItem('guide_skipped');
    if (!guideSkipped) {
      setShowWelcomeGuide(true);
    }
  }, []);

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('hasSeenOnboarding', 'true');
  };

  const isSuperAdmin = currentUser?.email?.toLowerCase() === 'uhbijnokmpl098900@gmail.com' || currentUser?.email?.toLowerCase() === 'aegy238@gmail.com' || currentUser?.isSuperAdmin === true;
  const isAdminUser = isSuperAdmin || currentUser?.role === 'admin' || currentUser?.role === 'moderator';
  const isMaintenanceActive = Boolean(settings?.isMaintenanceMode);

  // Check if current user is explicitly allowed to use the app during server outage/maintenance
  const isUserExemptFromOutage = Boolean(
    isAdminUser ||
    currentUser?.canBypassMaintenance === true ||
    (currentUser?.id && Array.isArray(settings?.maintenanceAllowedUserIds) && settings.maintenanceAllowedUserIds.includes(currentUser.id)) ||
    (currentUser?.email && Array.isArray(settings?.maintenanceAllowedEmails) && settings.maintenanceAllowedEmails.some(e => e.toLowerCase() === currentUser.email?.toLowerCase()))
  );

  useEffect(() => {
    // Real-time listener for Global Settings
    const docRef = doc(db, 'settings', 'global');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as AppSettings;
        setSettings(data);
        localStorage.setItem('appSettings', JSON.stringify(data));
        // Sync with backend memory cache
        try {
          fetch('/api/maintenance/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              isMaintenanceMode: data.isMaintenanceMode,
              maintenanceMessage: data.maintenanceMessage,
              maintenanceTitle: data.maintenanceTitle,
              maintenanceEstimatedTime: data.maintenanceEstimatedTime
            })
          }).catch(() => {});
        } catch (e) {}
      }
    }, (e: any) => {
      console.warn("Settings Load Notice:", e.message);
      const cached = localStorage.getItem('appSettings');
      if (cached) {
        try {
          setSettings(JSON.parse(cached));
        } catch (parseError) {
          console.error("Failed to parse cached settings");
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Fail-safe VIB (VIP) authorization check to prevent direct state navigation
  useEffect(() => {
    if (state !== AppState.HOME && state !== AppState.ADMIN_PANEL && state !== AppState.LOGIN && state !== AppState.IDLE) {
      const stateToFeatureAliases: Partial<Record<AppState, string[]>> = {
        [AppState.AFTER_EFFECTS_STUDIO]: ['after-effects-studio', 'afterEffectsStudio', 'after_effects_studio'],
        [AppState.SVGA_LAYER_EDITOR]: ['svga-layer-editor', 'svgaLayerEditor', 'svga_layer_editor'],
        [AppState.VIDEO_DURATION_SPEED]: ['video-duration-speed', 'videoDurationSpeed', 'video_duration_speed'],
        [AppState.UNIVERSAL_CONVERTER]: ['universal', 'universalConverter', 'universal_converter'],
        [AppState.SVGA_BATCH_COMPRESSOR]: ['svga-compressor', 'svgaBatchCompressor', 'svga_compressor'],
        [AppState.BATCH_SVGA_CONVERTER]: ['batch-svga-converter', 'batchSvgaConverter'],
        [AppState.SVGA_EDITOR_EX]: ['svga-ex', 'svgaEx', 'svga_ex'],
        [AppState.MULTI_SVGA_VIEWER]: ['multi-svga', 'multiSvga', 'multi_svga'],
        [AppState.IMAGE_CONVERTER]: ['image-converter', 'imageConverter'],
        [AppState.IMAGE_COLLAGE_STUDIO]: ['image-collage-studio', 'imageCollageStudio'],
        [AppState.AI_VIDEO_MATTING]: ['ai-video-matting', 'aiVideoMatting'],
        [AppState.NAME_3D_EDITOR]: ['name-3d', 'name3DEditor'],
        [AppState.IMAGE_ENHANCER]: ['image-enhancer', 'imageEnhancer'],
        [AppState.IMAGE_PROCESSOR]: ['image-processor', 'imageProcessor'],
        [AppState.IMAGE_EDITOR]: ['image-editor', 'imageEditor'],
        [AppState.IMAGE_MATCHER]: ['imageMatcher', 'image-matcher'],
        [AppState.AUDIO_EXTRACTOR]: ['audioExtractor', 'audio-extractor'],
        [AppState.BATCH_IMAGE_PROCESSOR]: ['batchImageProcessor', 'batch-image-processor'],
        [AppState.BATCH_COMPRESSOR]: ['batch', 'batchCompress', 'batchCompressor'],
        [AppState.BATCH_CROPPER]: ['cropper', 'batchCropper'],
        [AppState.ANIMATION_MANAGER]: ['animationManager', 'animation-manager'],
        [AppState.VAP_HUB]: ['vapHub', 'vap-hub'],
        [AppState.STORE]: ['store'],
        [AppState.VIDEO_CONVERTER]: ['converter', 'videoConverter']
      };

      const aliases = stateToFeatureAliases[state] || [];
      const currentVibs = settings?.vibFeatures || [];
      const isVibFeature = 
        state === AppState.SVGA_LAYER_EDITOR ||
        state === AppState.AFTER_EFFECTS_STUDIO ||
        aliases.some(alias => currentVibs.includes(alias));

      if (isVibFeature) {
        const subInfo = currentUser ? calculateSubscriptionInfo(currentUser) : null;
        const isSubscriptionActive = subInfo ? (subInfo.isActive || subInfo.isLifetime) : true;
        const isVIP = !!(currentUser?.role === 'admin' || currentUser?.isSuperAdmin || currentUser?.role === 'moderator' || (currentUser?.isVIP === true && isSubscriptionActive));
        if (!isVIP) {
          setState(AppState.HOME);
          setVipFeatureName(aliases[0] || 'ميزة VIP');
          setShowVipModal(true);
        }
      }
    }
  }, [state, currentUser, settings]);

  const handleFeatureAccess = async (targetState: AppState, featureName: string) => {
    // 0. Check Exclusive VIP Feature Access (ميزة VIP الملكية الحصرية)
    const stateToFeatureAliases: Partial<Record<AppState, string[]>> = {
      [AppState.AFTER_EFFECTS_STUDIO]: ['after-effects-studio', 'afterEffectsStudio', 'after_effects_studio'],
      [AppState.SVGA_LAYER_EDITOR]: ['svga-layer-editor', 'svgaLayerEditor', 'svga_layer_editor'],
      [AppState.VIDEO_DURATION_SPEED]: ['video-duration-speed', 'videoDurationSpeed', 'video_duration_speed'],
      [AppState.UNIVERSAL_CONVERTER]: ['universal', 'universalConverter', 'universal_converter'],
      [AppState.SVGA_BATCH_COMPRESSOR]: ['svga-compressor', 'svgaBatchCompressor', 'svga_compressor'],
      [AppState.BATCH_SVGA_CONVERTER]: ['batch-svga-converter', 'batchSvgaConverter'],
      [AppState.SVGA_EDITOR_EX]: ['svga-ex', 'svgaEx', 'svga_ex'],
      [AppState.MULTI_SVGA_VIEWER]: ['multi-svga', 'multiSvga', 'multi_svga'],
      [AppState.IMAGE_CONVERTER]: ['image-converter', 'imageConverter'],
      [AppState.IMAGE_COLLAGE_STUDIO]: ['image-collage-studio', 'imageCollageStudio'],
      [AppState.AI_VIDEO_MATTING]: ['ai-video-matting', 'aiVideoMatting'],
      [AppState.NAME_3D_EDITOR]: ['name-3d', 'name3DEditor'],
      [AppState.IMAGE_ENHANCER]: ['image-enhancer', 'imageEnhancer'],
      [AppState.IMAGE_PROCESSOR]: ['image-processor', 'imageProcessor'],
      [AppState.IMAGE_EDITOR]: ['image-editor', 'imageEditor'],
      [AppState.IMAGE_MATCHER]: ['imageMatcher', 'image-matcher'],
      [AppState.AUDIO_EXTRACTOR]: ['audioExtractor', 'audio-extractor'],
      [AppState.BATCH_IMAGE_PROCESSOR]: ['batchImageProcessor', 'batch-image-processor'],
      [AppState.BATCH_COMPRESSOR]: ['batch', 'batchCompress', 'batchCompressor'],
      [AppState.BATCH_CROPPER]: ['cropper', 'batchCropper'],
      [AppState.ANIMATION_MANAGER]: ['animationManager', 'animation-manager'],
      [AppState.VAP_HUB]: ['vapHub', 'vap-hub'],
      [AppState.STORE]: ['store'],
      [AppState.VIDEO_CONVERTER]: ['converter', 'videoConverter']
    };

    const aliases = stateToFeatureAliases[targetState] || [];
    const currentVibs = settings?.vibFeatures || [];
    const isVibFeature = 
      targetState === AppState.SVGA_LAYER_EDITOR ||
      targetState === AppState.AFTER_EFFECTS_STUDIO ||
      aliases.some(alias => currentVibs.includes(alias));

    if (isVibFeature) {
      const subInfo = currentUser ? calculateSubscriptionInfo(currentUser) : null;
      const isSubscriptionActive = subInfo ? (subInfo.isActive || subInfo.isLifetime) : true;
      const isVIP = !!(currentUser?.role === 'admin' || currentUser?.isSuperAdmin || currentUser?.role === 'moderator' || (currentUser?.isVIP === true && isSubscriptionActive));
      if (!isVIP) {
        setVipFeatureName(featureName || 'ميزة VIP');
        setShowVipModal(true);
        return;
      }
    }

    // 1. Check Feature Access Control (تحديد الوظائف)
    if (currentUser) {
      const stateToActionKey: Record<string, string> = {
        [AppState.AI_VIDEO_MATTING]: 'aiVideoMatting',
        [AppState.ANIMATION_MANAGER]: 'animationManager',
        [AppState.VIDEO_CONVERTER]: 'videoConverter',
        [AppState.UNIVERSAL_CONVERTER]: 'universalConverter',
        [AppState.MULTI_SVGA_VIEWER]: 'multiSvga',
        [AppState.BATCH_IMAGE_PROCESSOR]: 'batchImageProcessor',
        [AppState.SVGA_BATCH_COMPRESSOR]: 'svgaBatchCompressor',
        [AppState.BATCH_SVGA_CONVERTER]: 'batchSvgaConverter',
        [AppState.SVGA_LAYER_EDITOR]: 'svgaLayerEditor',
        [AppState.BATCH_COMPRESSOR]: 'batchCompress',
        [AppState.BATCH_CROPPER]: 'batchCropper',
        [AppState.IMAGE_CONVERTER]: 'imageConverter',
        [AppState.SVGA_EDITOR_EX]: 'svgaEx',
        [AppState.IMAGE_PROCESSOR]: 'imageProcessor',
        [AppState.IMAGE_MATCHER]: 'imageMatcher',
        [AppState.IMAGE_EDITOR]: 'imageEditor',
        [AppState.IMAGE_ENHANCER]: 'imageEnhancer',
        [AppState.NAME_3D_EDITOR]: 'name3DEditor',
        [AppState.AUDIO_EXTRACTOR]: 'audioExtractor',
        [AppState.IMAGE_COLLAGE_STUDIO]: 'imageCollageStudio'
      };

      const actionKey = stateToActionKey[targetState];
      if (actionKey && currentUser.allFeaturesEnabled === false) {
        const allowed = currentUser.allowedFeatures || [];
        if (!allowed.includes(actionKey)) {
          alert("عذراً، هذه الوظيفة غير متاحة في حسابك بناءً على صلاحياتك المحددة.");
          return;
        }
      }
    }

    // 2. Check Subscription/Credits Access
    const { allowed } = await checkAccess(featureName, { decrement: false });
    if (allowed) {
      setState(targetState);
    } else {
      setShowSubscriptionModal(true);
    }
  };

  const handleImageConverterOpen = (file?: File) => {
    if (file) setInitialLottieFile(file);
    handleFeatureAccess(AppState.IMAGE_CONVERTER, 'Image Converter');
  };

  const handleFileUpload = useCallback(async (files: File[], uploadMode?: string) => {
    if (files.length === 0) return;

    // Direct routing for explicit Batch Modes
    if (uploadMode === 'batch-mp4') {
      setInitialVideoFiles(files);
      handleFeatureAccess(AppState.VIDEO_CONVERTER, 'Video Converter');
      return;
    }

    if (uploadMode === 'batch-svga') {
      setInitialSvgaFiles(files);
      handleFeatureAccess(AppState.MULTI_SVGA_VIEWER, 'Multi SVGA Preview');
      return;
    }

    if ((uploadMode as any) === 'universal' && files.length > 0) {
      setLayerEditorInitialFile(files[0]);
      handleFeatureAccess(AppState.SVGA_LAYER_EDITOR, 'SVGA Layer Editor');
      return;
    }

    // Expand any PDF files (single or multiple) into their extracted SVGA files
    const expandedFiles: File[] = [];
    for (const f of files) {
      if ((f?.name || '').toLowerCase().endsWith('.pdf')) {
        try {
          const extracted = await extractSvgaFromPdfFile(f);
          if (extracted.length > 0) {
            expandedFiles.push(...extracted.map(e => e.file));
          } else {
            alert(`لم يتم العثور على ملفات SVGA صالحة داخل: ${f.name}`);
          }
        } catch (err) {
          console.error('PDF extraction failed for:', f.name, err);
          alert(`تعذر فك واستخراج ملفات SVGA من: ${f.name}`);
        }
      } else {
        expandedFiles.push(f);
      }
    }

    if (expandedFiles.length === 0) return;

    // Universal SVGA Detection: Inspect binary content for SVGA regardless of name or extension (.zip, .dat, no-extension, etc.)
    const { svgaFiles: detectedSvgaList, otherFiles: nonSvgaList } = await batchDetectAndNormalizeFiles(expandedFiles);
    const currentFiles = [...detectedSvgaList, ...nonSvgaList];

    if (uploadMode === 'universal' && currentFiles.length > 0) {
      setLayerEditorInitialFile(currentFiles[0]);
      handleFeatureAccess(AppState.SVGA_LAYER_EDITOR, 'SVGA Layer Editor');
      return;
    }

    if (currentFiles.length > 1) {
      const { svgaFiles } = await batchDetectAndNormalizeFiles(currentFiles);
      const videoFiles = currentFiles.filter(f => {
        const name = (f?.name || '').toLowerCase();
        return name.endsWith('.mp4') || name.endsWith('.vap') || name.endsWith('.webm') || name.endsWith('.mov');
      });

      if (svgaFiles.length === currentFiles.length || svgaFiles.length > 1) {
        setInitialSvgaFiles(svgaFiles);
        handleFeatureAccess(AppState.MULTI_SVGA_VIEWER, 'Multi SVGA Preview');
        return;
      }

      if (videoFiles.length === currentFiles.length) {
        setInitialVideoFiles(currentFiles);
        handleFeatureAccess(AppState.VIDEO_CONVERTER, 'Video Converter');
        return;
      }
    }

    let file = currentFiles[0];
    const isDetectedAsSvga = Boolean((file as any).__isSvga) || (await detectIsSvga(file)).isSvga;
    if (isDetectedAsSvga && !file.name.toLowerCase().endsWith('.svga')) {
      const { file: norm } = await ensureSvgaFile(file);
      file = norm;
    }

    const fileUrl = URL.createObjectURL(file);
    const fileName = (file?.name || '').toLowerCase();

    // Check for Universal Multi-Format files (PAG, Lottie, DotLottie, GIF, WebP, APNG, PNG sequence ZIP, SVG/SMIL)
    // Only treat as non-SVGA zip if it is NOT a verified SVGA file
    const isMultiFormat = !isDetectedAsSvga && (
                          fileName.endsWith('.lottie') || 
                          fileName.endsWith('.pag') || 
                          fileName.endsWith('.gif') || 
                          fileName.endsWith('.webp') || 
                          fileName.endsWith('.apng') || 
                          fileName.endsWith('.svg') || 
                          (fileName.endsWith('.zip') && !fileName.endsWith('.svga')));

    if (isMultiFormat) {
      setUniversalPlayerFile(file);
      return;
    }

    // Check for Lottie JSON
    if (!isDetectedAsSvga && (fileName.endsWith('.json') || file?.type === 'application/json')) {
        try {
            const text = await file.text();
            const json = JSON.parse(text);
            if (json.v && json.layers && json.fr) {
                // Open in Universal Player for instant playback
                setUniversalPlayerFile(file);
                return;
            }
        } catch (e) {
            console.error("Not a valid Lottie JSON", e);
        }
    }

    // Log the upload activity if user exists
    if (currentUser) {
      logActivity(currentUser, 'upload', `Uploaded file: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
    }

    const isImageFile = (file?.type || '').startsWith('image/') || 
                         /\.(png|jpe?g|webp|svg)$/i.test(file?.name || '');

    if (isImageFile) {
      setPendingImageFile(file);
      setShowImageDimensionModal(true);
      return;
    }

    const isVapOrVideo = (file?.name || '').toLowerCase().endsWith('.vap') || 
                         (file?.name || '').toLowerCase().endsWith('.mp4') || 
                         (file?.name || '').toLowerCase().endsWith('.webm') || 
                         (file?.name || '').toLowerCase().endsWith('.mov') ||
                         file?.type?.startsWith('video/');

    if (isVapOrVideo) {
      setInitialVapFile(file);
      handleFeatureAccess(AppState.UNIVERSAL_CONVERTER, 'Universal Motion Tools');
      return;
    }

    if (!isDetectedAsSvga && !(file?.name || '').toLowerCase().endsWith('.svga')) {
      alert("يرجى رفع ملف بصيغة مدعومة (.svga, .vap, .mp4, .pag, .json)");
      URL.revokeObjectURL(fileUrl);
      return;
    }
    
    try {
      const parser = new SVGA.Parser();
      parser.load(fileUrl, (videoItem: any) => {
        // Robust FPS extraction
        let extractedFps = videoItem.FPS || videoItem.fps || 30;
        if (typeof extractedFps === 'string') extractedFps = parseFloat(extractedFps);
        if (!extractedFps || extractedFps <= 0) extractedFps = 30;

        const meta: FileMetadata = {
          name: file.name, size: file.size, type: 'SVGA',
          dimensions: { width: videoItem.videoSize?.width || 0, height: videoItem.videoSize?.height || 0 },
          fps: extractedFps, frames: videoItem.frames || 0, assets: [], videoItem,
          fileUrl: fileUrl,
          originalFile: file
        };
        
        setFileMetadata(meta);
        setState(AppState.PROCESSING);
      }, (err: any) => {
        console.error("SVGA Load Error:", err);
        alert("فشل في قراءة ملف SVGA.");
        URL.revokeObjectURL(fileUrl);
      });
    } catch (err) {
      setState(AppState.IDLE);
    }
  }, [currentUser, settings]);

  // Connect PWA File Handling API & Web Share Target for Android
  usePWAFileHandling({
    onFilesReceived: (files) => {
      if (files && files.length > 0) {
        handleFileUpload(files);
      }
    }
  });

  // Handle shortcut actions from Android launcher icons
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'editor') {
      handleFeatureAccess(AppState.SVGA_LAYER_EDITOR, 'SVGA Layer Editor');
    } else if (action === 'player') {
      handleFeatureAccess(AppState.MULTI_SVGA_VIEWER, 'Multi SVGA Preview');
    } else if (action === 'converter') {
      handleFeatureAccess(AppState.VIDEO_CONVERTER, 'Video Converter');
    }
  }, []);

  const handleReset = useCallback(() => {
    if (fileMetadata?.fileUrl) {
      URL.revokeObjectURL(fileMetadata.fileUrl);
    }
    setState(AppState.IDLE);
    setFileMetadata(null);
    setBatchFiles([]);
    setInitialLottieFile(null);
    setInitialVapFile(null);
    setInitialVideoFiles([]);
    setInitialSvgaFiles([]);
    setAeStudioInitialFile(null);
    setAeStudioInitialDimensions(null);
    setPendingImageFile(null);
    setShowImageDimensionModal(false);
  }, [fileMetadata]);

  const handleImageDimensionsConfirm = (result: ImageDimensionsResult) => {
    if (!pendingImageFile) return;
    setAeStudioInitialDimensions({ width: result.width, height: result.height });
    setAeStudioInitialFile(pendingImageFile);
    setShowImageDimensionModal(false);
    handleFeatureAccess(AppState.AFTER_EFFECTS_STUDIO, 'استوديو ومحرر After Effects الاحترافي');
  };

  if (loading) {
    return <Loading />;
  }

  // 🔴 Maintenance Mode Blocking for Non-Exempt Users
  if (isMaintenanceActive && !isUserExemptFromOutage) {
    return (
      <MaintenanceScreen 
        settings={settings} 
        currentUser={currentUser} 
        onRefresh={async () => {
          try {
            const docSnap = await getDoc(doc(db, 'settings', 'global'));
            if (docSnap.exists()) {
              setSettings(docSnap.data() as AppSettings);
            }
          } catch (e) {}
        }}
      />
    );
  }

  // 🔒 Dedicated Fullscreen Authentication Gateway
  if (!currentUser) {
    const hasCustomBg = settings?.backgroundUrl && !settings.backgroundUrl.includes('unsplash');
    return (
      <div 
        className="min-h-screen text-slate-200 overflow-x-hidden relative flex items-center justify-center p-4 bg-[#020617]" 
        style={hasCustomBg ? {
          backgroundImage: `linear-gradient(rgba(7, 10, 18, 0.85), rgba(7, 10, 18, 0.95)), url(${settings.backgroundUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        } : {
          backgroundColor: '#020617'
        }}
      >
        <div className="w-full max-w-md my-8 animate-in zoom-in-95 duration-300">
          <div className="flex flex-col items-center mb-6">
            {settings?.logoUrl ? (
              <img 
                src={settings.logoUrl} 
                alt="Logo" 
                className="w-20 h-20 object-cover rounded-2xl mb-4 shadow-2xl drop-shadow-[0_0_15px_rgba(99,102,241,0.4)]" 
              />
            ) : (
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-900 rounded-2xl flex items-center justify-center shadow-lg border border-white/20 mb-4 drop-shadow-[0_0_15px_rgba(99,102,241,0.4)]">
                <span className="text-white font-black text-4xl">S</span>
              </div>
            )}
            <h1 className="text-2xl font-black text-white uppercase tracking-wider">
              {settings?.appName?.trim() ? settings.appName : 'SVGA Studio'}
            </h1>
            <p className="text-xs text-indigo-400 font-bold tracking-widest mt-1">المنصة الاحترافية المتكاملة</p>
          </div>
          
          {authMode === 'login' ? (
            <Login onToggle={() => setAuthMode('signup')} />
          ) : (
            <Signup onToggle={() => setAuthMode('login')} />
          )}
        </div>
      </div>
    );
  }

  // Guest fallback if user is not signed in
  const guestUser: UserRecord = {
    id: 'guest_visitor',
    name: 'زائر المنصة',
    email: 'guest@svga.app',
    role: 'user',
    isVIP: false,
    points: 999,
    createdAt: new Date().toISOString()
  };
  const activeUser = currentUser || guestUser;

  const rawBgUrl = settings?.backgroundUrl ? settings.backgroundUrl.trim() : '';
  const isVideoBg = !!(rawBgUrl && isVideoUrl(rawBgUrl) && !videoBgError);
  const hasCustomBg = !!(rawBgUrl && !rawBgUrl.includes('unsplash') && !isVideoBg);

  const dynamicBgStyle: React.CSSProperties = hasCustomBg ? {
    backgroundImage: `linear-gradient(rgba(7, 10, 18, 0.85), rgba(7, 10, 18, 0.95)), url(${rawBgUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed'
  } : {
    backgroundColor: '#020617'
  };

  return (
    <div className="min-h-screen text-slate-200 overflow-x-hidden relative bg-[#020617]" style={dynamicBgStyle}>
      {isVideoBg && rawBgUrl && (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
          <video 
            key={rawBgUrl}
            autoPlay 
            loop 
            muted 
            playsInline 
            preload="auto"
            onError={(e) => {
              console.warn("Background video error, attempting retry/fallback:", rawBgUrl);
              const target = e.currentTarget;
              if (target.getAttribute('crossorigin')) {
                target.removeAttribute('crossorigin');
                target.load();
              } else {
                setVideoBgError(true);
              }
            }}
            src={rawBgUrl} 
            className="w-full h-full object-cover opacity-45 filter brightness-90 contrast-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#020617]/75 via-[#020617]/50 to-[#020617]/85" />
        </div>
      )}
      <ScreenProtectionOverlay currentUser={currentUser} settings={settings} />
      
      {/* 3D Splash Screen */}
      
      
      {showFeaturesGuide && (
        <FeaturesGuideModal onClose={() => {
          setShowFeaturesGuide(false);
          localStorage.setItem('guide_skipped', 'true');
        }} />
      )}

      {showSplash && (
        <div 
          onClick={() => setShowSplash(false)}
          className="fixed inset-0 z-[2000] bg-[#020617] flex flex-col items-center justify-center cursor-pointer select-none animate-in fade-in duration-500"
          title="انقر لتخطي الإعلان والدخول فوراً"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[#020617] via-[#090d1f]/60 to-[#020617] pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col items-center animate-in zoom-in-95 duration-700">
             {settings?.logoUrl ? (
               <img 
                 src={settings.logoUrl} 
                 alt="Logo" 
                 className="w-32 h-32 md:w-48 md:h-48 object-cover rounded-3xl mb-6 shadow-2xl drop-shadow-[0_0_30px_rgba(99,102,241,0.6)] animate-pulse" 
               />
             ) : (
               <div className="w-32 h-32 md:w-48 md:h-48 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-900 rounded-3xl flex items-center justify-center shadow-lg border-2 border-white/20 mb-6 drop-shadow-[0_0_30px_rgba(99,102,241,0.6)]">
                 <span className="text-white font-black text-6xl md:text-8xl drop-shadow-lg">S</span>
               </div>
             )}
             
             <h1 className="text-4xl md:text-6xl font-black animated-brand-text tracking-tight uppercase">
               {settings?.appName?.trim() ? settings.appName : 'SVGA Studio'}
             </h1>
             <span className="text-xs md:text-sm text-indigo-400 font-bold tracking-[0.4em] uppercase mt-4">
               Professional Platform
             </span>
             
             {/* 3D Core Loader Ring */}
             <div className="absolute inset-0 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] border-2 border-dashed border-indigo-500/30 rounded-full animate-[spin_10s_linear_infinite] -z-10"></div>
             <div className="absolute inset-0 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] border border-purple-500/20 rounded-full animate-[spin_15s_linear_infinite_reverse] -z-10"></div>

             {/* Dismiss hint & loading bar */}
             <div className="mt-8 flex flex-col items-center gap-2">
               <div className="w-36 h-1 bg-white/10 rounded-full overflow-hidden">
                 <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full w-full animate-pulse" />
               </div>
               <span className="text-[10px] text-slate-400 font-mono tracking-wider">
                 انقر في أي مكان للتخطي
               </span>
             </div>
          </div>
        </div>
      )}
      
      {isMaintenanceActive && isAdminUser && (
        <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-rose-700 via-amber-700 to-rose-700 text-white py-1.5 px-4 text-xs font-bold z-[300] flex items-center justify-between shadow-lg border-b border-rose-500/40">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
            <span>🔴 سيرفر التطبيق معطّل حالياً للعامة: تظهر للزوار رسالة "حالياً سيرفر التطبيق متعطل الآن" بالعربي والإنجليزي، وشغال لحساب المدير فقط.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                if (window.confirm('هل أنت متأكد من إعادة تشغيل الموقع للجميع وإلغاء حالة التعطيل؟')) {
                  await setDoc(doc(db, 'settings', 'global'), { isMaintenanceMode: false }, { merge: true });
                }
              }}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black border border-emerald-400/40 transition-all shadow"
            >
              إعادة تشغيل الموقع للجميع 🟢
            </button>
            <button
              onClick={() => setState(AppState.ADMIN_PANEL)}
              className="px-3 py-1 rounded-lg bg-black/40 hover:bg-black/60 text-white text-[11px] border border-white/20 transition-all font-bold"
            >
              فتح لوحة الإعدادات
            </button>
          </div>
        </div>
      )}

      {isQuotaExceeded && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500/90 backdrop-blur-sm text-black py-1 px-4 text-center text-[10px] font-bold z-[300] flex items-center justify-center gap-2">
          <span>⚠️ تم تجاوز حصة الاستخدام اليومية للسيرفر. الموقع يعمل الآن بالوضع الاحتياطي (Offline Mode).</span>
        </div>
      )}

      <Header 
        onOpenGuide={() => setShowFeaturesGuide(true)}
        onLogoClick={handleReset} 
        isAdmin={isAdminUser} 
        currentUser={currentUser}
        settings={settings}
        onAdminToggle={() => setState(AppState.ADMIN_PANEL)}
        onLogout={logout}
        isAdminOpen={state === AppState.ADMIN_PANEL}
        onBatchOpen={() => handleFeatureAccess(AppState.BATCH_COMPRESSOR, 'Batch Compressor')}
        onConverterOpen={() => handleFeatureAccess(AppState.VIDEO_CONVERTER, 'Video Converter')}
        onImageConverterOpen={() => handleImageConverterOpen()}
        onImageEditorOpen={() => handleFeatureAccess(AppState.IMAGE_EDITOR, 'Image Editor')}
        onImageMatcherOpen={() => handleFeatureAccess(AppState.IMAGE_MATCHER, 'Image Matcher')}
        onCropperOpen={() => handleFeatureAccess(AppState.BATCH_CROPPER, 'Batch Cropper')}
        onSvgaExOpen={() => handleFeatureAccess(AppState.SVGA_EDITOR_EX, 'SVGA Editor EX')}
        onMultiSvgaOpen={() => handleFeatureAccess(AppState.MULTI_SVGA_VIEWER, 'Multi SVGA Preview')}
        onImageProcessorOpen={() => handleFeatureAccess(AppState.IMAGE_PROCESSOR, 'Image Processor')}
        onImageEnhancerOpen={() => handleFeatureAccess(AppState.IMAGE_ENHANCER, 'AI Image Enhancer')}
        onBatchImageProcessorOpen={() => handleFeatureAccess(AppState.BATCH_IMAGE_PROCESSOR, 'Batch Image Processor')}
        onUniversalConverterOpen={() => handleFeatureAccess(AppState.UNIVERSAL_CONVERTER, 'Universal Motion Tools')}
        onName3DEditorOpen={() => handleFeatureAccess(AppState.NAME_3D_EDITOR, '3D Name Editor')}
        onAudioExtractorOpen={() => handleFeatureAccess(AppState.AUDIO_EXTRACTOR, 'Audio Extractor')}
        onAiVideoMattingOpen={() => handleFeatureAccess(AppState.AI_VIDEO_MATTING, 'AI Video Matting Studio')}
        onImageCollageStudioOpen={() => handleFeatureAccess(AppState.IMAGE_COLLAGE_STUDIO, 'Image Collage & Watermark Studio')}
        onSvgaBatchCompressorOpen={() => handleFeatureAccess(AppState.SVGA_BATCH_COMPRESSOR, 'SVGA Batch Compressor')}
        onAnimationManagerOpen={() => handleFeatureAccess(AppState.ANIMATION_MANAGER, 'Animation File Manager')}
        onVideoDurationSpeedOpen={handleVideoDurationSpeedOpen}
        onStoreOpen={() => handleFeatureAccess(AppState.STORE, 'SVGA Store & Library')}
        onAfterEffectsStudioOpen={() => handleFeatureAccess(AppState.AFTER_EFFECTS_STUDIO, 'استوديو ومحرر After Effects الاحترافي')}
        onApkExtractorOpen={() => handleFeatureAccess(AppState.APK_EXTRACTOR, 'مستخرج أصول التطبيقات ومشاريع السيارات')}
        onVapHubOpen={() => handleFeatureAccess(AppState.VAP_HUB, 'VAP Hub')}
        onSvgaLayerEditorOpen={() => {
          setLayerEditorInitialFile(fileMetadata?.originalFile || null);
          handleFeatureAccess(AppState.SVGA_LAYER_EDITOR, 'SVGA Layer Editor');
        }}
        onBatchSvgaConverterOpen={() => handleFeatureAccess(AppState.BATCH_SVGA_CONVERTER, 'Batch SVGA Converter')}
        onBatchImageOpen={() => setShowBatchImage(true)}
        onOpenFile={(files) => handleFileUpload(files)}
        onLoginClick={() => setShowAuthModal(true)}
        onProfileClick={() => setShowProfileModal(true)}
        onVipClick={() => setShowVipModal(true)}
        currentTab={
          state === AppState.AFTER_EFFECTS_STUDIO ? 'after-effects-studio' :
          state === AppState.APK_EXTRACTOR ? 'apk-extractor' :
          state === AppState.ANIMATION_MANAGER ? 'animation-manager' :
          state === AppState.IMAGE_COLLAGE_STUDIO ? 'image-collage-studio' :
          state === AppState.AI_VIDEO_MATTING ? 'ai-video-matting' :
          state === AppState.SVGA_LAYER_EDITOR ? 'svga-layer-editor' :
          state === AppState.SVGA_BATCH_COMPRESSOR ? 'svga-compressor' :
          state === AppState.BATCH_SVGA_CONVERTER ? 'batch-svga-converter' :
          state === AppState.BATCH_COMPRESSOR ? 'batch' : 
          state === AppState.STORE ? 'store' : 
          state === AppState.VIDEO_CONVERTER ? 'converter' : 
          state === AppState.IMAGE_CONVERTER ? 'image-converter' :
          state === AppState.IMAGE_PROCESSOR ? 'image-processor' :
          state === AppState.IMAGE_ENHANCER ? 'image-enhancer' :
          state === AppState.BATCH_IMAGE_PROCESSOR ? 'batch-image-processor' :
          state === AppState.IMAGE_EDITOR ? 'image-editor' :
          state === AppState.IMAGE_MATCHER ? 'image-matcher' :
          state === AppState.BATCH_CROPPER ? 'cropper' :
          state === AppState.SVGA_EDITOR_EX ? 'svga-ex' :
          state === AppState.MULTI_SVGA_VIEWER ? 'multi-svga' :
          state === AppState.NAME_3D_EDITOR ? 'name-3d' :
          state === AppState.AUDIO_EXTRACTOR ? 'audio-extractor' :
          state === AppState.UNIVERSAL_CONVERTER ? 'universal' :
          state === AppState.VAP_HUB ? 'vap-hub' :
          'svga'
        }
      />
      
      <div className="flex pt-28 h-screen overflow-hidden relative">
        <main className={`flex-1 overflow-y-auto transition-all duration-700 custom-scrollbar mr-0`}>
          <style>{`
            .no-scrollbar::-webkit-scrollbar {
              display: none;
            }
            .no-scrollbar {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
            .mask-edges {
              mask-image: linear-gradient(to right, transparent, black 2%, black 98%, transparent);
              -webkit-mask-image: linear-gradient(to right, transparent, black 2%, black 98%, transparent);
            }
            .animated-brand-text {
              background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899, #3b82f6, #2dd4bf, #6366f1);
              background-size: 200% auto;
              color: transparent;
              background-clip: text;
              -webkit-background-clip: text;
              animation: colorGradient 4s linear infinite;
              filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)) drop-shadow(0 0 10px rgba(168,85,247,0.4));
            }
            @keyframes colorGradient {
              to { background-position: 200% center; }
            }
          `}</style>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
            <Suspense fallback={<Loading />}>
            {state === AppState.IDLE && (
              <div className="py-10 animate-in fade-in zoom-in duration-700 w-[100vw] relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
                <Dashboard 
                  onUpload={handleFileUpload} 
                  onUniversalPlay={(file) => {
                    setLayerEditorInitialFile(file);
                    handleFeatureAccess(AppState.SVGA_LAYER_EDITOR, 'SVGA Layer Editor');
                  }}
                  currentUser={currentUser}
                  settings={settings}
                  onOpenVipModal={() => setShowVipModal(true)}
                  onOpenProfile={() => setShowProfileModal(true)}
                  onOpenEmbeddedPortal={handleOpenEmbeddedPortal}
                  onAction={(actionKey: string) => {
                     switch(actionKey) {
                        case 'universal':
                        case 'universalPlayer': {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = '.svga,.SVGA,.json,.JSON,.lottie,.LOTTIE,.pag,.PAG,.gif,.GIF,.webp,.WEBP,.apng,.APNG,.png,.PNG,.zip,.ZIP,.mp4,.MP4,.mov,.MOV,.webm,.WEBM,.vap,.VAP,.svg,.SVG,video/*,image/*,*/*';
                          input.onchange = (e: any) => {
                            if (e.target.files && e.target.files.length > 0) {
                              setLayerEditorInitialFile(e.target.files[0]);
                              handleFeatureAccess(AppState.SVGA_LAYER_EDITOR, 'SVGA Layer Editor');
                            }
                          };
                          input.click();
                          break;
                        }
                        case 'videoDurationSpeed': handleVideoDurationSpeedOpen(); break;
                        case 'afterEffectsStudio':
                        case 'onAfterEffectsStudioOpen':
                          handleFeatureAccess(AppState.AFTER_EFFECTS_STUDIO, 'استوديو ومحرر After Effects الاحترافي');
                          break;
                        case 'apkExtractor':
                        case 'onApkExtractorOpen':
                        case 'apk-extractor':
                          handleFeatureAccess(AppState.APK_EXTRACTOR, 'مستخرج أصول التطبيقات ومشاريع السيارات');
                          break;
                        case 'animationManager': handleFeatureAccess(AppState.ANIMATION_MANAGER, 'Animation File Manager'); break;
                        case 'aiVideoMatting': handleFeatureAccess(AppState.AI_VIDEO_MATTING, 'AI Video Matting Studio'); break;
                        case 'imageCollageStudio': handleFeatureAccess(AppState.IMAGE_COLLAGE_STUDIO, 'Image Collage & Watermark Studio'); break;
                        case 'videoConverter': handleFeatureAccess(AppState.VIDEO_CONVERTER, 'Video Converter'); break;
                        case 'universalConverter': handleFeatureAccess(AppState.UNIVERSAL_CONVERTER, 'Universal Motion Tools'); break;
                        case 'multiSvga': handleFeatureAccess(AppState.MULTI_SVGA_VIEWER, 'Multi SVGA Preview'); break;
                        case 'batchImageProcessor': handleFeatureAccess(AppState.BATCH_IMAGE_PROCESSOR, 'Batch Image Processor'); break;
                        case 'svgaBatchCompressor': handleFeatureAccess(AppState.SVGA_BATCH_COMPRESSOR, 'SVGA Batch Compressor'); break;
                         case 'batchSvgaConverter': handleFeatureAccess(AppState.BATCH_SVGA_CONVERTER, 'Batch SVGA Converter'); break;
                        case 'svgaLayerEditor': handleFeatureAccess(AppState.SVGA_LAYER_EDITOR, 'SVGA Layer Editor'); break;
                        case 'batchCompress': handleFeatureAccess(AppState.BATCH_COMPRESSOR, 'Batch Compressor'); break;
                        case 'batchCropper': handleFeatureAccess(AppState.BATCH_CROPPER, 'Batch Cropper'); break;
                        case 'imageConverter': handleImageConverterOpen(); break;
                        case 'svgaEx': handleFeatureAccess(AppState.SVGA_EDITOR_EX, 'SVGA Editor EX'); break;
                        case 'store': 
                          if (settings?.externalLinks?.storeLink?.enabled && settings?.externalLinks?.storeLink?.url) {
                            handleOpenEmbeddedPortal('first');
                          } else {
                            setState(AppState.STORE);
                          }
                          break;
                        case 'imageProcessor': handleFeatureAccess(AppState.IMAGE_PROCESSOR, 'Image Processor'); break;
                        case 'imageMatcher': handleFeatureAccess(AppState.IMAGE_MATCHER, 'Image Matcher'); break;
                        case 'imageEditor': handleFeatureAccess(AppState.IMAGE_EDITOR, 'Image Editor'); break;
                        case 'imageEnhancer': handleFeatureAccess(AppState.IMAGE_ENHANCER, 'AI Image Enhancer'); break;
                        case 'batchImageOpen': setShowBatchImage(true); break;
                        case 'name3DEditor': handleFeatureAccess(AppState.NAME_3D_EDITOR, '3D Name Editor'); break;
                        case 'audioExtractor': handleFeatureAccess(AppState.AUDIO_EXTRACTOR, 'Audio Extractor'); break;
                        case 'vapHub': handleFeatureAccess(AppState.VAP_HUB, 'VAP Hub'); break;
                     }
                  }}
                />
              </div>
            )}
            {(state === AppState.PROCESSING || state === AppState.SVGA_EDITOR_EX) && fileMetadata && (
              <ErrorBoundary fallbackTitle="حدث خطأ في تحميل مساحة العمل" onReset={handleReset}>
                <Workspace 
                  key={fileMetadata.fileUrl}
                  metadata={fileMetadata} 
                  onCancel={handleReset} 
                  settings={settings} 
                  currentUser={currentUser} 
                  onLoginRequired={() => {}}
                  onSubscriptionRequired={() => setShowSubscriptionModal(true)}
                  globalQuality={globalQuality}
                  onFileReplace={(meta) => setFileMetadata(meta)}
                  mode={state === AppState.SVGA_EDITOR_EX ? 'ex' : 'normal'}
                  onImageConverterOpen={handleImageConverterOpen}
                  onOpenLayerEditor={(file) => {
                    setLayerEditorInitialFile(file || fileMetadata?.originalFile || null);
                    handleFeatureAccess(AppState.SVGA_LAYER_EDITOR, 'SVGA Layer Editor');
                  }}
                />
              </ErrorBoundary>
            )}
            {state === AppState.BATCH_COMPRESSOR && (
              <BatchCompressor 
                onCancel={handleReset} 
                currentUser={currentUser} 
                onLoginRequired={() => {}}
                onSubscriptionRequired={() => setShowSubscriptionModal(true)}
              />
            )}
            {state === AppState.SVGA_BATCH_COMPRESSOR && (
              <SvgaBatchCompressor 
                onCancel={handleReset} 
                currentUser={currentUser} 
                onSubscriptionRequired={() => setShowSubscriptionModal(true)}
              />
            )}
            {state === AppState.BATCH_SVGA_CONVERTER && (
              <Suspense fallback={<div className="text-white text-center py-20 font-black">جاري تحميل المحول الجماعي...</div>}>
                <BatchSvgaConverter 
                  onCancel={handleReset} 
                  currentUser={currentUser} 
                  settings={settings}
                  onLoginRequired={() => {}}
                  onSubscriptionRequired={() => setShowSubscriptionModal(true)}
                  initialFiles={initialSvgaFiles}
                />
              </Suspense>
            )}
            {state === AppState.SVGA_LAYER_EDITOR && (
              <ErrorBoundary fallbackTitle="حدث خطأ في محرر طبقات SVGA" onReset={handleReset}>
                <SvgaLayerEditor 
                  initialFile={layerEditorInitialFile || fileMetadata?.originalFile || undefined}
                  initialProject={layerEditorInitialProject || undefined}
                  initialLayers={layerEditorInitialLayers || undefined}
                  onClose={() => {
                    setLayerEditorInitialFile(null);
                    setLayerEditorInitialProject(null);
                    setLayerEditorInitialLayers(null);
                    if (fileMetadata) {
                      setState(AppState.PROCESSING);
                    } else {
                      handleReset();
                    }
                  }}
                  onOpenViewer={(exportedFile) => handleFileUpload([exportedFile])}
                />
              </ErrorBoundary>
            )}
            
            {state === AppState.VIDEO_CONVERTER && (
              <VideoConverter 
                currentUser={currentUser} 
                onCancel={handleReset} 
                onLoginRequired={() => {}}
                onSubscriptionRequired={() => setShowSubscriptionModal(true)}
                globalQuality={globalQuality}
                initialFiles={initialVideoFiles}
                onOpenLayerEditor={(params) => {
                  setLayerEditorInitialFile(params.file || null);
                  setLayerEditorInitialProject(params.project || null);
                  setLayerEditorInitialLayers(params.layers || null);
                  handleFeatureAccess(AppState.SVGA_LAYER_EDITOR, 'SVGA Layer Editor');
                }}
              />
            )}
            {state === AppState.UNIVERSAL_CONVERTER && (
              <ErrorBoundary fallbackTitle="حدث خطأ في محول الحركة الشامل" onReset={handleReset}>
                <UniversalMotionTools 
                  currentUser={currentUser} 
                  onCancel={handleReset} 
                  onLoginRequired={() => {}}
                  onSubscriptionRequired={() => setShowSubscriptionModal(true)}
                  initialFile={initialVapFile}
                  onOpenInWorkspace={(meta) => {
                    setFileMetadata(meta);
                    setState(AppState.PROCESSING);
                  }}
                />
              </ErrorBoundary>
            )}
            {state === AppState.IMAGE_CONVERTER && (
              <ImageToSvga 
                currentUser={currentUser} 
                onCancel={handleReset} 
                onLoginRequired={() => {}}
                onSubscriptionRequired={() => setShowSubscriptionModal(true)}
                globalQuality={globalQuality}
                initialFile={initialLottieFile}
              />
            )}
            {state === AppState.IMAGE_PROCESSOR && (
              <ImageProcessor 
                currentUser={currentUser} 
                onCancel={handleReset} 
                onSubscriptionRequired={() => setShowSubscriptionModal(true)}
              />
            )}
            {state === AppState.IMAGE_ENHANCER && (
              <ImageEnhancer 
                currentUser={currentUser} 
                onCancel={handleReset} 
                onSubscriptionRequired={() => setShowSubscriptionModal(true)}
              />
            )}
            {state === AppState.BATCH_IMAGE_PROCESSOR && (
              <BatchImageProcessor 
                onCancel={handleReset} 
                onSubscriptionRequired={() => setShowSubscriptionModal(true)}
              />
            )}
            {state === AppState.IMAGE_EDITOR && (
              <ImageEditor 
                currentUser={currentUser} 
                onCancel={handleReset} 
                onLoginRequired={() => {}}
                onSubscriptionRequired={() => setShowSubscriptionModal(true)}
              />
            )}
            {state === AppState.IMAGE_MATCHER && (
              <ImageMatcher 
                currentUser={currentUser} 
                onCancel={handleReset} 
                onLoginRequired={() => {}}
                onSubscriptionRequired={() => setShowSubscriptionModal(true)}
              />
            )}
            {state === AppState.BATCH_CROPPER && (
              <BatchCropper 
                currentUser={currentUser} 
                onCancel={handleReset} 
                onLoginRequired={() => {}}
                onSubscriptionRequired={() => setShowSubscriptionModal(true)}
              />
            )}
            {state === AppState.NAME_3D_EDITOR && (
              <Name3DEditor 
                onCancel={handleReset} 
                currentUser={currentUser}
                onSubscriptionRequired={() => setShowSubscriptionModal(true)}
              />
            )}
            {state === AppState.MULTI_SVGA_VIEWER && (
              <ErrorBoundary fallbackTitle="حدث خطأ في عارض ومقارن SVGA المتعدد" onReset={handleReset}>
                <MultiSvgaViewer 
                  onCancel={handleReset} 
                  currentUser={currentUser}
                  onSubscriptionRequired={() => setShowSubscriptionModal(true)}
                  initialFiles={initialSvgaFiles}
                />
              </ErrorBoundary>
            )}
            {state === AppState.AUDIO_EXTRACTOR && (
              <AudioExtractor 
                currentUser={currentUser}
                onCancel={handleReset}
                onSubscriptionRequired={() => setShowSubscriptionModal(true)}
              />
            )}
            {state === AppState.AI_VIDEO_MATTING && (
              <AIVideoMattingStudio 
                currentUser={currentUser}
                onCancel={handleReset}
                onSubscriptionRequired={() => setShowSubscriptionModal(true)}
                initialVideoFile={fileMetadata?.originalFile || null}
              />
            )}
            {state === AppState.IMAGE_COLLAGE_STUDIO && (
              <ImageCollageStudio 
                onBack={handleReset} 
                initialFiles={fileMetadata?.originalFile ? [fileMetadata.originalFile] : null}
              />
            )}
            {state === AppState.ANIMATION_MANAGER && (
              <AnimationManager onBack={handleReset} />
            )}
            {state === AppState.STORE && (
              <Store 
                currentUser={currentUser} 
                onLoginRequired={() => {}} 
              />
            )}
            {state === AppState.EMBEDDED_PORTAL && (
              <EmbeddedPortalViewer 
                settings={settings || undefined}
                initialTab={embeddedPortalTab}
                onClose={handleReset}
              />
            )}
            {state === AppState.VAP_HUB && (
              <VapHub />
            )}
            {state === AppState.AFTER_EFFECTS_STUDIO && (
              <ErrorBoundary fallbackTitle="حدث خطأ في تحميل استوديو ومحرر After Effects" onReset={handleReset}>
                <AfterEffectsStudio 
                  initialFile={aeStudioInitialFile || fileMetadata?.originalFile || null}
                  initialMetadata={fileMetadata || null}
                  initialDimensions={aeStudioInitialDimensions}
                  onCancel={handleReset}
                  onClose={handleReset}
                  onOpenInViewer={(file) => {
                    if (file?.originalFile) {
                      handleFileUpload([file.originalFile]);
                    }
                  }}
                />
              </ErrorBoundary>
            )}
            {state === AppState.APK_EXTRACTOR && (
              <ErrorBoundary fallbackTitle="حدث خطأ في تحميل مستخرج أصول التطبيقات ومشاريع السيارات" onReset={handleReset}>
                <Suspense fallback={<Loading message="جارٍ تجهيز مستخرج أصول التطبيقات ومشاريع السيارات..." />}>
                  <ApkAssetExtractor onClose={handleReset} />
                </Suspense>
              </ErrorBoundary>
            )}
            {state === AppState.ADMIN_PANEL && (currentUser?.role === 'admin' || currentUser?.role === 'moderator') && (
              <AdminPanel 
                currentUser={currentUser} 
                onCancel={handleReset} 
                onOpenFeature={(actionKey) => {
                  const keyToState: Record<string, AppState> = {
                    onAfterEffectsStudioOpen: AppState.AFTER_EFFECTS_STUDIO,
                    afterEffectsStudio: AppState.AFTER_EFFECTS_STUDIO,
                    'after-effects-studio': AppState.AFTER_EFFECTS_STUDIO,

                    onApkExtractorOpen: AppState.APK_EXTRACTOR,
                    apkExtractor: AppState.APK_EXTRACTOR,
                    'apk-extractor': AppState.APK_EXTRACTOR,

                    onVideoDurationSpeedOpen: AppState.VIDEO_DURATION_SPEED,
                    videoDurationSpeed: AppState.VIDEO_DURATION_SPEED,
                    'video-duration-speed': AppState.VIDEO_DURATION_SPEED,

                    onSvgaLayerEditorOpen: AppState.SVGA_LAYER_EDITOR,
                    svgaLayerEditor: AppState.SVGA_LAYER_EDITOR,
                    'svga-layer-editor': AppState.SVGA_LAYER_EDITOR,

                    onUniversalConverterOpen: AppState.UNIVERSAL_CONVERTER,
                    universalConverter: AppState.UNIVERSAL_CONVERTER,
                    universal: AppState.UNIVERSAL_CONVERTER,

                    onSvgaBatchCompressorOpen: AppState.SVGA_BATCH_COMPRESSOR,
                    svgaBatchCompressor: AppState.SVGA_BATCH_COMPRESSOR,
                    'svga-compressor': AppState.SVGA_BATCH_COMPRESSOR,

                    onBatchSvgaConverterOpen: AppState.BATCH_SVGA_CONVERTER,
                    batchSvgaConverter: AppState.BATCH_SVGA_CONVERTER,
                    'batch-svga': AppState.BATCH_SVGA_CONVERTER,

                    onSvgaExOpen: AppState.SVGA_EDITOR_EX,
                    svgaEx: AppState.SVGA_EDITOR_EX,
                    'svga-ex': AppState.SVGA_EDITOR_EX,

                    onMultiSvgaOpen: AppState.MULTI_SVGA_VIEWER,
                    multiSvga: AppState.MULTI_SVGA_VIEWER,
                    'multi-svga': AppState.MULTI_SVGA_VIEWER,

                    onImageConverterOpen: AppState.IMAGE_CONVERTER,
                    imageConverter: AppState.IMAGE_CONVERTER,
                    'image-converter': AppState.IMAGE_CONVERTER,

                    onImageProcessorOpen: AppState.IMAGE_PROCESSOR,
                    imageProcessor: AppState.IMAGE_PROCESSOR,
                    'image-processor': AppState.IMAGE_PROCESSOR,

                    onImageEnhancerOpen: AppState.IMAGE_ENHANCER,
                    imageEnhancer: AppState.IMAGE_ENHANCER,
                    'image-enhancer': AppState.IMAGE_ENHANCER,

                    onBatchImageProcessorOpen: AppState.BATCH_IMAGE_PROCESSOR,
                    batchImageProcessor: AppState.BATCH_IMAGE_PROCESSOR,
                    'batch-image-processor': AppState.BATCH_IMAGE_PROCESSOR,

                    onImageEditorOpen: AppState.IMAGE_EDITOR,
                    imageEditor: AppState.IMAGE_EDITOR,
                    'image-editor': AppState.IMAGE_EDITOR,

                    onImageMatcherOpen: AppState.IMAGE_MATCHER,
                    imageMatcher: AppState.IMAGE_MATCHER,
                    'image-matcher': AppState.IMAGE_MATCHER,

                    onCropperOpen: AppState.BATCH_CROPPER,
                    batchCropper: AppState.BATCH_CROPPER,
                    cropper: AppState.BATCH_CROPPER,

                    onName3DEditorOpen: AppState.NAME_3D_EDITOR,
                    name3DEditor: AppState.NAME_3D_EDITOR,
                    'name-3d-editor': AppState.NAME_3D_EDITOR,

                    onAudioExtractorOpen: AppState.AUDIO_EXTRACTOR,
                    audioExtractor: AppState.AUDIO_EXTRACTOR,
                    'audio-extractor': AppState.AUDIO_EXTRACTOR,

                    onAiVideoMattingOpen: AppState.AI_VIDEO_MATTING,
                    aiVideoMatting: AppState.AI_VIDEO_MATTING,
                    'ai-video-matting': AppState.AI_VIDEO_MATTING,

                    onImageCollageStudioOpen: AppState.IMAGE_COLLAGE_STUDIO,
                    imageCollageStudio: AppState.IMAGE_COLLAGE_STUDIO,
                    'image-collage-studio': AppState.IMAGE_COLLAGE_STUDIO,

                    onStoreOpen: AppState.STORE,
                    store: AppState.STORE,

                    onVapHubOpen: AppState.VAP_HUB,
                    vapHub: AppState.VAP_HUB,
                    'vap-hub': AppState.VAP_HUB,

                    onAnimationManagerOpen: AppState.ANIMATION_MANAGER,
                    animationManager: AppState.ANIMATION_MANAGER,
                    'animation-manager': AppState.ANIMATION_MANAGER,

                    onConverterOpen: AppState.VIDEO_CONVERTER,
                    videoConverter: AppState.VIDEO_CONVERTER,
                    converter: AppState.VIDEO_CONVERTER,
                  };
                  const targetState = keyToState[actionKey];
                  if (targetState !== undefined) {
                    setState(targetState);
                  }
                }}
              />
            )}
            </Suspense>
          </div>
        </main>
      </div>

      <div className="fixed bottom-6 left-6 z-[100] flex flex-col-reverse gap-3">
        {state !== AppState.SVGA_LAYER_EDITOR && state !== AppState.AFTER_EFFECTS_STUDIO && (
          <>
            {/* Language Translator Globe Widget */}
            <LanguageTranslatorWidget />

            {/* WhatsApp Floating Button */}
            {settings?.whatsappNumber && (
              <a 
                href={`https://wa.me/${settings.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#25D366]/25 transition-all hover:scale-105 active:scale-95 group"
                title="تواصل معنا عبر واتساب"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              </a>
            )}

            {/* Help Button */}
            <button 
              onClick={() => setShowOnboarding(true)}
              className="w-12 h-12 bg-[#0e172a] hover:bg-[#1e293b] text-sky-400 border border-white/10 rounded-2xl flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 group cursor-pointer"
              title="شرح الموقع"
            >
              <HelpCircle className="w-6 h-6" />
            </button>

            {/* SVGA Store & Asset Library Floating Button */}
            <button 
              onClick={() => {
                if (settings?.externalLinks?.storeLink?.enabled && settings?.externalLinks?.storeLink?.url) {
                  handleOpenEmbeddedPortal('first');
                } else {
                  setState(AppState.STORE);
                }
              }}
              className="w-12 h-12 bg-[#0e172a] hover:bg-[#1e293b] text-fuchsia-400 border border-white/10 rounded-2xl flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 group cursor-pointer"
              title="مكتبة ومتجر الأصول والقوالب"
            >
              <ShoppingBag className="w-6 h-6" />
            </button>

            {/* Features Guide Button */}
            <button 
              onClick={() => setShowFeaturesGuide(true)}
              className="w-12 h-12 bg-[#0e172a] hover:bg-[#1e293b] text-indigo-400 border border-white/10 rounded-2xl flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 group cursor-pointer"
              title="دليل الميزات"
            >
              <BookOpen className="w-6 h-6" />
            </button>

            {/* PWA Phone Install Floating Button (Directly above Features Guide / Book icon) */}
            <PWAFloatingInstallButton />
          </>
        )}
      </div>

      {showBatchImage && (
        <BatchImageConverter
          onClose={() => setShowBatchImage(false)}
        />
      )}

      {/* Universal Multi-Format Player Modal (مشغل الصيغ الشامل 15 صيغة) */}
      {universalPlayerFile && (
        <Suspense fallback={<Loading />}>
          <UniversalMultiFormatPlayerModal
            file={universalPlayerFile}
            onClose={() => setUniversalPlayerFile(null)}
            onOpenInEditor={(f) => {
              setUniversalPlayerFile(null);
              if (f.name.toLowerCase().endsWith('.svga')) {
                setLayerEditorInitialFile(f);
                handleFeatureAccess(AppState.SVGA_LAYER_EDITOR, 'SVGA Layer Editor');
              } else {
                handleFileUpload([f]);
              }
            }}
            onConvertToSvga={(f) => {
              setUniversalPlayerFile(null);
              const name = f.name.toLowerCase();
              if (name.endsWith('.pag')) {
                setUploadedPagFile(f);
                handleFeatureAccess(AppState.PAG_TO_SVGA, 'PAG to SVGA');
              } else if (name.endsWith('.mp4') || name.endsWith('.vap') || name.endsWith('.mov') || name.endsWith('.webm')) {
                setInitialVideoFiles([f]);
                handleFeatureAccess(AppState.VIDEO_CONVERTER, 'Video Converter');
              } else {
                handleFileUpload([f]);
              }
            }}
          />
        </Suspense>
      )}

        

      {/* Onboarding Modal */}
      <OnboardingModal 
        isOpen={showOnboarding} 
        onClose={handleCloseOnboarding} 
      />

      {/* User Profile & Subscription Details Modal */}
      {showProfileModal && currentUser && (
        <UserProfileModal
          currentUser={currentUser}
          onClose={() => setShowProfileModal(false)}
          onOpenStore={() => {
            setShowProfileModal(false);
            handleFeatureAccess(AppState.STORE, 'SVGA Store & Library');
          }}
        />
      )}

      {/* Subscription Modal */}
      <SubscriptionModal 
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        settings={settings}
      />

      {/* Video Duration & Speed VIP Modal */}
      <VideoDurationSpeedModal
        isOpen={showDurationSpeedModal}
        onClose={() => setShowDurationSpeedModal(false)}
      />

      {/* VIP Upgrade & Purchase Modal (رفع مركز الفي اي بي) */}
      <VipSubscriptionModal
        isOpen={showVipModal}
        onClose={() => setShowVipModal(false)}
        settings={settings}
        currentUser={currentUser}
        initialFeatureName={vipFeatureName}
      />

      {/* Global Background App Update Notification */}
      <AppUpdateToast />

      {/* Version Blocked Modal */}
      {versionBlockedState.isBlocked && (
        <VersionBlockedModal
          requiredVersion={versionBlockedState.requiredVersion}
          installedVersion={versionBlockedState.installedVersion}
          userEmail={currentUser?.email}
          userId={currentUser?.id}
          onRetry={() => {
            const clientVer = getActiveClientVersion();
            const allowedVer = currentUser?.allowedVersion || settings?.defaultAllowedVersion || 'v3.0.0';
            const localCheck = checkVersionCompatibility(allowedVer, clientVer);
            if (localCheck.isAllowed) {
              setVersionBlockedState(prev => ({ ...prev, isBlocked: false }));
            }
          }}
        />
      )}

      {/* Auth Modal Overlay */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl">
            <button 
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            {authMode === 'login' ? (
              <Login onToggle={() => setAuthMode('signup')} />
            ) : (
              <Signup onToggle={() => setAuthMode('login')} />
            )}
          </div>
        </div>
      )}

      {/* Image Dimension Setup Modal */}
      {showImageDimensionModal && pendingImageFile && (
        <ImageDimensionModal
          isOpen={showImageDimensionModal}
          file={pendingImageFile}
          onClose={() => {
            setShowImageDimensionModal(false);
            setPendingImageFile(null);
          }}
          onConfirm={handleImageDimensionsConfirm}
        />
      )}

      {/* Persistent Background Continuous Export Center */}
      <GlobalExportWidget />
    </div>
  );
};

export default App;
