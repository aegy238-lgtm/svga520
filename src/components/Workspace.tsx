import React from 'react';
import { FileMetadata, AppSettings, UserRecord } from '../types';
import { SVGAViewer } from './SVGAViewer';
import { motion } from 'motion/react';
import { ArrowLeft, Sparkles, Layers, Sliders, X } from 'lucide-react';

export interface WorkspaceProps {
  metadata: FileMetadata;
  onCancel: () => void;
  settings?: AppSettings | null;
  currentUser?: UserRecord | null;
  onLoginRequired?: () => void;
  onSubscriptionRequired?: () => void;
  globalQuality?: 'low' | 'medium' | 'high';
  onFileReplace?: (meta: FileMetadata) => void;
  mode?: 'ex' | 'normal' | 'editor' | 'viewer';
  onImageConverterOpen?: () => void;
  onOpenLayerEditor?: (file?: File) => void;
}

export const Workspace: React.FC<WorkspaceProps> = ({
  metadata,
  onCancel,
  settings,
  currentUser,
  onLoginRequired,
  onSubscriptionRequired,
  globalQuality = 'high',
  onFileReplace,
  mode = 'normal',
  onImageConverterOpen,
  onOpenLayerEditor
}) => {
  const fileInfo = {
    url: metadata.fileUrl || '',
    name: metadata.name
  };

  const isExMode = mode === 'ex' || mode === 'editor';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="w-full flex flex-col min-h-[calc(100vh-8rem)]"
      id="svga-workspace"
    >
      {/* Workspace Quick Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 px-4 py-3 bg-slate-900/70 backdrop-blur-md rounded-2xl border border-slate-800/80 shadow-lg" id="workspace-top-bar">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white transition-all text-xs font-semibold border border-slate-700/60"
            id="workspace-back-btn"
            title="الرجوع للرئيسية"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>الرئيسية</span>
          </button>
          
          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              {isExMode ? 'SVGA 2.0 EX' : 'SVGA Studio'}
            </span>
            <span className="text-sm font-bold text-white max-w-[200px] sm:max-w-xs truncate" title={metadata.name}>
              {metadata.name}
            </span>
            <span className="text-xs text-slate-400 hidden sm:inline">
              ({(metadata.size / 1024 / 1024).toFixed(2)} MB)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenLayerEditor && (
            <button
              onClick={() => onOpenLayerEditor(metadata.originalFile)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600/30 to-indigo-600/30 hover:from-purple-600/50 hover:to-indigo-600/50 text-indigo-300 hover:text-white transition-all text-xs font-bold border border-indigo-500/30 shadow-sm"
              id="workspace-layer-editor-btn"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>محرر الطبقات (Layer Editor)</span>
            </button>
          )}

          <button
            onClick={onCancel}
            className="p-1.5 rounded-xl hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors"
            id="workspace-close-icon-btn"
            title="إغلاق مساحة العمل"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main SVGA Player & Studio Engine */}
      <div className="flex-1 w-full relative rounded-2xl overflow-hidden shadow-2xl border border-slate-800/80 bg-slate-950/60" id="workspace-viewer-area">
        <SVGAViewer 
          file={fileInfo} 
          onClear={onCancel} 
          originalFile={metadata.originalFile}
          onOpenLayerEditor={onOpenLayerEditor}
        />
      </div>
    </motion.div>
  );
};
