import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from './components/Header';
import { Uploader } from './components/Uploader';
import { Dashboard } from './components/Dashboard';
import { Workspace } from './components/Workspace';
import { BatchCompressor } from './components/BatchCompressor';
import { BatchCropper } from './components/BatchCropper';
import { VideoConverter } from './components/VideoConverter';
import { UniversalMotionTools } from './components/UniversalMotionTools';
import { MultiSvgaViewer } from './components/MultiSvgaViewer';
import { ImageToSvga } from './components/ImageToSvga';
import { ImageProcessor } from './components/ImageProcessor';
import { ImageEnhancer } from './components/ImageEnhancer';
import { BatchImageProcessor } from './components/BatchImageProcessor';
import { BatchImageConverter } from './components/BatchImageConverter';
import { PagConverter } from './components/PagConverter';
import { ImageEditor } from './components/ImageEditor';
import { ImageMatcher } from './components/ImageMatcher';
import { Store } from './components/Store';
import { AdminPanel } from './components/AdminPanel';
import { Login } from './components/Auth/Login';
import { Signup } from './components/Auth/Signup';
import { Loading } from './components/Auth/Loading';
import { UserProfileModal } from './components/UserProfileModal';
import { SubscriptionModal } from './components/SubscriptionModal';
import { useAuth } from './contexts/AuthContext';
import { AppState, FileMetadata, AppSettings } from './types';
import { useAccessControl } from './hooks/useAccessControl';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { logActivity } from './utils/logger';

declare var SVGA: any;

import { OnboardingModal } from './components/OnboardingModal';
import { HelpCircle } from 'lucide-react';

const videoWidth = 1334;
const videoHeight = 750;

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
  const [showBatchImage, setShowBatchImage] = useState(false);
  const [showPagConverter, setShowPagConverter] = useState(false);
  const [globalQuality, setGlobalQuality] = useState<'low' | 'medium' | 'high'>('high');
  const [initialLottieFile, setInitialLottieFile] = useState<File | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Hide splash screen after 2.5 seconds
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Check if user has seen onboarding
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }
  }, []);

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('hasSeenOnboarding', 'true');
  };

  useEffect(() => {
    // Load Global Settings - Use cache immediately on failure
    const loadSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'global');
        // Use getDoc instead of getDocFromServer to allow cached data if offline
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as AppSettings;
          setSettings(data);
          localStorage.setItem('appSettings', JSON.stringify(data));
        }
      } catch (e: any) { 
        console.warn("Settings Load Notice:", e.message);
        if (e.message && e.message.includes('offline')) {
          console.error("Firestore is unreachable. Please ensure Firestore is enabled in your Firebase Console.");
        }
        
        // Try to load from cache if Firestore fails
        const cached = localStorage.getItem('appSettings');
        if (cached) {
          try {
            setSettings(JSON.parse(cached));
          } catch (parseError) {
            console.error("Failed to parse cached settings");
          }
        }
      }
    };
    loadSettings();
  }, []);

  const handleFeatureAccess = async (targetState: AppState, featureName: string) => {
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

  const handleFileUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    if (files.length > 1) {
      const svgaFiles = files.filter(f => (f?.name || '').toLowerCase().endsWith('.svga'));
      if (svgaFiles.length > 0) {
        // Multiple SVGA files uploaded - we'll just process the first one for now
        // since Batch SVGA Converter was removed.
        const file = svgaFiles[0];
        const fileUrl = URL.createObjectURL(file);
        
        if (currentUser) {
          logActivity(currentUser, 'upload', `Uploaded file: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
        }

        const parser = new SVGA.Parser();
        parser.load(fileUrl, (videoItem: any) => {
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
        return;
      }
    }

    const file = files[0];
    const fileUrl = URL.createObjectURL(file);

    // Check for Lottie JSON
    if ((file?.name || '').toLowerCase().endsWith('.json') || file?.type === 'application/json') {
        try {
            const text = await file.text();
            const json = JSON.parse(text);
            if (json.v && json.layers && json.fr) {
                // It's a Lottie file - redirect to Image Converter
                setInitialLottieFile(file);
                setState(AppState.IMAGE_CONVERTER);
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

    const isVideo = file?.type?.startsWith('video/') || (file?.name || '').toLowerCase().endsWith('.mp4') || (file?.name || '').toLowerCase().endsWith('.webm') || (file?.name || '').toLowerCase().endsWith('.mov');
    const isImage = false; // Disabled image support

    if (isVideo || isImage) {
        // For simple MP4/WebM, try to extract frames immediately
        if ((file?.name || '').toLowerCase().endsWith('.mp4') || (file?.name || '').toLowerCase().endsWith('.webm')) {
            try {
               const video = document.createElement('video');
               video.src = fileUrl;
               video.muted = true;
               video.playsInline = true;
               await video.play();
               video.pause();
               
               const duration = video.duration;
               
               if (duration > 15) {
                  alert("عذراً، يجب أن يكون الفيديو أقل من 15 ثانية لتجنب انهيار المتصفح.");
                  URL.revokeObjectURL(fileUrl);
                  return;
               }

               const vw = video.videoWidth;
               const vh = video.videoHeight;
               const fps = 30; 
               const totalFrames = Math.floor(duration * fps);

               const canvas = document.createElement('canvas');
               canvas.width = vw;
               canvas.height = vh;
               const ctx = canvas.getContext('2d');
               
               const newLayerImages: Record<string, string> = {};
               const newSprites: any[] = [];
               
               for (let i = 0; i < totalFrames; i++) {
                   const time = i / fps;
                   video.currentTime = time;
                   await new Promise(r => {
                       const onSeek = () => {
                           video.removeEventListener('seeked', onSeek);
                           r(null);
                       };
                       video.addEventListener('seeked', onSeek);
                   });
                   
                   if (ctx) {
                       ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                       const quality = 0.8;
                       const dataUrl = canvas.toDataURL('image/png', quality);
                       const key = `v_frame_${i}`;
                       newLayerImages[key] = dataUrl;
                       
                       const frames = [];
                       for (let f = 0; f < totalFrames; f++) {
                           frames.push({
                               alpha: f === i ? 1.0 : 0.0,
                               layout: { x: (videoWidth - canvas.width) / 2, y: (videoHeight - canvas.height) / 2, width: canvas.width, height: canvas.height },
                               transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
                           });
                       }
                       
                       newSprites.push({
                           imageKey: key,
                           frames: frames,
                           matteKey: ""
                       });
                   }
               }

               const meta: FileMetadata = {
                   name: file.name, size: file.size, type: 'MP4',
                   dimensions: { width: videoWidth, height: videoHeight },
                   fps: fps, frames: totalFrames, assets: [], 
                   videoItem: {
                       version: "2.0",
                       videoSize: { width: videoWidth, height: videoHeight },
                       FPS: fps,
                       frames: totalFrames,
                       images: newLayerImages,
                       sprites: newSprites,
                       audios: [] 
                   },
                   fileUrl: fileUrl 
               };
               
               setFileMetadata(meta);
               setState(AppState.PROCESSING);

            } catch (e) {
                console.error(e);
                // Fallback to Workspace processing if simple extraction fails
                const meta: FileMetadata = {
                    name: file.name, size: file.size, type: 'VIDEO_COMPLEX',
                    dimensions: { width: 0, height: 0 },
                    fps: 30, frames: 0, assets: [], 
                    videoItem: null,
                    fileUrl: fileUrl 
                };
                setFileMetadata(meta);
                setState(AppState.PROCESSING);
            }
            return;
        }

        // For GIF/WebP/MOV (complex formats), pass to Workspace for FFmpeg processing
        const meta: FileMetadata = {
            name: file.name, 
            size: file.size, 
            type: isImage ? 'IMAGE_ANIM' : 'VIDEO_COMPLEX',
            dimensions: { width: 0, height: 0 },
            fps: 30, 
            frames: 0, 
            assets: [], 
            videoItem: null,
            fileUrl: fileUrl 
        };
        setFileMetadata(meta);
        setState(AppState.PROCESSING);
        return;
    }

    if (!file || !(file?.name || '').toLowerCase().endsWith('.svga')) return;
    
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

  const handleReset = useCallback(() => {
    if (fileMetadata?.fileUrl) {
      URL.revokeObjectURL(fileMetadata.fileUrl);
    }
    setState(AppState.IDLE);
    setFileMetadata(null);
    setBatchFiles([]);
    setInitialLottieFile(null);
  }, [fileMetadata]);

  if (loading) {
    return <Loading />;
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
          <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full"></div>
        </div>
        <div className="relative z-10 w-full max-w-md">
          {authMode === 'login' ? (
            <Login onToggle={() => setAuthMode('signup')} />
          ) : (
            <Signup onToggle={() => setAuthMode('login')} />
          )}
        </div>
      </div>
    );
  }

  const defaultBgUrl = 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?q=80&w=2070&auto=format&fit=crop';
  const bgUrl = settings?.backgroundUrl || defaultBgUrl;

  const dynamicBgStyle: React.CSSProperties = {
    backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.8), rgba(2, 6, 23, 0.9)), url(${bgUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed'
  };

  return (
    <div className="min-h-screen text-slate-200 overflow-x-hidden relative" style={dynamicBgStyle}>
      <div className="fixed inset-0 bg-[#020617]/30 backdrop-blur-[4px] -z-10 pointer-events-none" />
      
      {/* 3D Splash Screen */}
      <AnimatePresence>
        {showSplash && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
            className="fixed inset-0 z-[2000] bg-[#020617] flex flex-col items-center justify-center pointer-events-none"
          >
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay"></div>
            
            <motion.div
              initial={{ scale: 0.5, y: 50, rotateX: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, rotateX: 0, opacity: 1 }}
              exit={{ scale: 1.1, opacity: 0, filter: 'blur(10px)' }}
              transition={{ duration: 1, type: "spring", bounce: 0.5 }}
              className="relative z-10 flex flex-col items-center"
            >
               {settings?.logoUrl ? (
                 <motion.img 
                   src={settings.logoUrl} 
                   alt="Logo" 
                   initial={{ filter: 'drop-shadow(0 0 0 rgba(99,102,241,0))' }}
                   animate={{ filter: ['drop-shadow(0 0 20px rgba(99,102,241,0.8))', 'drop-shadow(0 0 40px rgba(168,85,247,0.8))', 'drop-shadow(0 0 20px rgba(99,102,241,0.8))'] }}
                   transition={{ duration: 2, repeat: Infinity }}
                   className="w-32 h-32 md:w-48 md:h-48 object-cover rounded-3xl mb-6 shadow-2xl" 
                 />
               ) : (
                 <motion.div 
                   initial={{ filter: 'drop-shadow(0 0 0 rgba(99,102,241,0))' }}
                   animate={{ filter: ['drop-shadow(0 0 20px rgba(99,102,241,0.8))', 'drop-shadow(0 0 40px rgba(168,85,247,0.8))', 'drop-shadow(0 0 20px rgba(99,102,241,0.8))'] }}
                   transition={{ duration: 2, repeat: Infinity }}
                   className="w-32 h-32 md:w-48 md:h-48 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-900 rounded-3xl flex items-center justify-center shadow-lg border-2 border-white/20 mb-6"
                 >
                   <span className="text-white font-black text-6xl md:text-8xl drop-shadow-lg">S</span>
                 </motion.div>
               )}
               
               <h1 className="text-4xl md:text-6xl font-black animated-brand-text tracking-tight uppercase">
                 {settings?.appName?.trim() ? settings.appName : 'SVGA Studio'}
               </h1>
               <motion.span 
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ delay: 0.5, duration: 0.5 }}
                 className="text-xs md:text-sm text-indigo-400 font-bold tracking-[0.4em] uppercase mt-4"
               >
                 Professional Platform
               </motion.span>
               
               {/* 3D Core Loader Ring */}
               <div className="absolute inset-0 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] border-2 border-dashed border-indigo-500/30 rounded-full animate-[spin_10s_linear_infinite] -z-10"></div>
               <div className="absolute inset-0 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] border border-purple-500/20 rounded-full animate-[spin_15s_linear_infinite_reverse] -z-10"></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {isQuotaExceeded && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500/90 backdrop-blur-sm text-black py-1 px-4 text-center text-[10px] font-bold z-[300] flex items-center justify-center gap-2">
          <span>⚠️ تم تجاوز حصة الاستخدام اليومية للسيرفر. الموقع يعمل الآن بالوضع الاحتياطي (Offline Mode).</span>
        </div>
      )}

      <Header 
        onLogoClick={handleReset} 
        isAdmin={currentUser?.role === 'admin' || currentUser?.role === 'moderator'} 
        currentUser={currentUser}
        settings={settings}
        onAdminToggle={() => setState(AppState.ADMIN_PANEL)}
        onLogout={logout}
        isAdminOpen={state === AppState.ADMIN_PANEL}
        onBatchOpen={() => handleFeatureAccess(AppState.BATCH_COMPRESSOR, 'Batch Compressor')}
        onStoreOpen={() => setState(AppState.STORE)}
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
        onLoginClick={() => {}}
        onProfileClick={() => {}}
        currentTab={
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
          'svga'
        }
      />
      
      <div className="flex pt-20 h-screen overflow-hidden relative">
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
            {state === AppState.IDLE && (
              <div className="py-10 animate-in fade-in zoom-in duration-700 w-[100vw] relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
                <Dashboard 
                  onUpload={handleFileUpload} 
                  onAction={(actionKey: string) => {
                     switch(actionKey) {
                        case 'videoConverter': handleFeatureAccess(AppState.VIDEO_CONVERTER, 'Video Converter'); break;
                        case 'universalConverter': handleFeatureAccess(AppState.UNIVERSAL_CONVERTER, 'Universal Motion Tools'); break;
                        case 'multiSvga': handleFeatureAccess(AppState.MULTI_SVGA_VIEWER, 'Multi SVGA Preview'); break;
                        case 'batchImageProcessor': handleFeatureAccess(AppState.BATCH_IMAGE_PROCESSOR, 'Batch Image Processor'); break;
                        case 'batchCompress': handleFeatureAccess(AppState.BATCH_COMPRESSOR, 'Batch Compressor'); break;
                        case 'batchCropper': handleFeatureAccess(AppState.BATCH_CROPPER, 'Batch Cropper'); break;
                        case 'imageConverter': handleImageConverterOpen(); break;
                        case 'svgaEx': handleFeatureAccess(AppState.SVGA_EDITOR_EX, 'SVGA Editor EX'); break;
                        case 'store': setState(AppState.STORE); break;
                        case 'imageProcessor': handleFeatureAccess(AppState.IMAGE_PROCESSOR, 'Image Processor'); break;
                        case 'imageMatcher': handleFeatureAccess(AppState.IMAGE_MATCHER, 'Image Matcher'); break;
                        case 'imageEditor': handleFeatureAccess(AppState.IMAGE_EDITOR, 'Image Editor'); break;
                        case 'imageEnhancer': handleFeatureAccess(AppState.IMAGE_ENHANCER, 'AI Image Enhancer'); break;
                        case 'batchImageOpen': setShowBatchImage(true); break;
                        case 'pagConverterOpen': setShowPagConverter(true); break;
                     }
                  }}
                />
              </div>
            )}
            {(state === AppState.PROCESSING || state === AppState.SVGA_EDITOR_EX) && fileMetadata && (
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
              />
            )}
            {state === AppState.BATCH_COMPRESSOR && (
              <BatchCompressor 
                onCancel={handleReset} 
                currentUser={currentUser} 
                onLoginRequired={() => {}}
                onSubscriptionRequired={() => setShowSubscriptionModal(true)}
              />
            )}
            {state === AppState.STORE && (
              <Store currentUser={currentUser} onLoginRequired={() => {}} />
            )}
            {state === AppState.VIDEO_CONVERTER && (
              <VideoConverter 
                currentUser={currentUser} 
                onCancel={handleReset} 
                onLoginRequired={() => {}}
                onSubscriptionRequired={() => setShowSubscriptionModal(true)}
                globalQuality={globalQuality}
              />
            )}
            {state === AppState.UNIVERSAL_CONVERTER && (
              <UniversalMotionTools 
                currentUser={currentUser} 
                onCancel={handleReset} 
                onLoginRequired={() => {}}
                onSubscriptionRequired={() => setShowSubscriptionModal(true)}
              />
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
            {state === AppState.MULTI_SVGA_VIEWER && (
              <MultiSvgaViewer 
                onCancel={handleReset} 
                currentUser={currentUser}
                onSubscriptionRequired={() => setShowSubscriptionModal(true)}
              />
            )}
            {state === AppState.ADMIN_PANEL && (currentUser?.role === 'admin' || currentUser?.role === 'moderator') && (
              <AdminPanel currentUser={currentUser} onCancel={handleReset} />
            )}
          </div>
        </main>
      </div>

      {/* WhatsApp Floating Button */}
      {settings?.whatsappNumber && (
        <a 
          href={`https://wa.me/${settings.whatsappNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 left-6 z-[100] w-14 h-14 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-full flex items-center justify-center shadow-lg shadow-[#25D366]/30 transition-all hover:scale-110 hover:-translate-y-1 group"
          title="تواصل معنا عبر واتساب"
        >
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
        </a>
      )}

      {/* Help Button */}
      <button 
        onClick={() => setShowOnboarding(true)}
        className={`fixed ${settings?.whatsappNumber ? 'bottom-24' : 'bottom-6'} left-6 z-[100] w-14 h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-600/30 transition-all hover:scale-110 hover:-translate-y-1 group`}
        title="شرح الموقع"
      >
        <HelpCircle className="w-8 h-8" />
      </button>

      {showBatchImage && (
        <BatchImageConverter
          onClose={() => setShowBatchImage(false)}
        />
      )}

      {showPagConverter && (
        <PagConverter
          onClose={() => setShowPagConverter(false)}
        />
      )}

      {/* Onboarding Modal */}
      <OnboardingModal 
        isOpen={showOnboarding} 
        onClose={handleCloseOnboarding} 
      />

      {/* Subscription Modal */}
      <SubscriptionModal 
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        settings={settings}
      />
    </div>
  );
};

export default App;
