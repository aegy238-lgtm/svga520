import React, { useState } from 'react';
import { 
  Layers, Plus, X, Copy, Edit2, Film, Image as ImageIcon, 
  Sparkles, Download, LayoutGrid, Check, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ProjectSession } from './types';

interface SvgaProjectsTabBarProps {
  projects: ProjectSession[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onCloseProject: (id: string) => void;
  onDuplicateProject: (id: string) => void;
  onRenameProject: (id: string, newName: string) => void;
  onAddNewProject: () => void;
  onOpenFiles: () => void;
  onBatchExport: () => void;
  isOverviewMode: boolean;
  onToggleOverviewMode: () => void;
}

export const SvgaProjectsTabBar: React.FC<SvgaProjectsTabBarProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onCloseProject,
  onDuplicateProject,
  onRenameProject,
  onAddNewProject,
  onOpenFiles,
  onBatchExport,
  isOverviewMode,
  onToggleOverviewMode
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  const handleStartRename = (project: ProjectSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(project.id);
    setEditingName(project.name || project.project.fileName);
  };

  const handleSaveRename = (id: string) => {
    if (editingName.trim()) {
      onRenameProject(id, editingName.trim());
    }
    setEditingId(null);
  };

  if (projects.length === 0) return null;

  return (
    <div 
      className="bg-[#0b101f] border-b border-white/10 px-3 py-1 flex items-center justify-between gap-2 overflow-x-auto select-none shrink-0 z-20 scrollbar-none"
      dir="rtl"
    >
      {/* Right / Start: Projects Tabs List */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
        {projects.map((proj, idx) => {
          const isActive = proj.id === activeProjectId && !isOverviewMode;
          const totalLayers = proj.layers.length;
          const fps = proj.project.fps || 30;
          const totalFrames = proj.project.totalFrames || 1;
          const width = proj.project.width || 750;
          const height = proj.project.height || 1334;

          const isVideo = proj.fileType === 'mp4';
          const isImg = proj.fileType === 'image';

          return (
            <div
              key={proj.id}
              onClick={() => onSelectProject(proj.id)}
              className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer text-xs font-bold shrink-0 ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-950/80 via-purple-950/70 to-slate-900 border-indigo-400/80 text-white shadow-md shadow-indigo-900/30 ring-1 ring-indigo-400/50'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white'
              }`}
              title={`المشروع ${idx + 1}: ${proj.name} (${width}×${height} | ${totalFrames} إطار | ${totalLayers} طبقة)`}
            >
              {/* Comp Icon & Index Badge */}
              <div className="flex items-center gap-1.5">
                <span className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] font-black ${
                  isActive ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'
                }`}>
                  {idx + 1}
                </span>

                {isVideo ? (
                  <Film size={13} className={isActive ? 'text-pink-400' : 'text-slate-400'} />
                ) : isImg ? (
                  <ImageIcon size={13} className={isActive ? 'text-emerald-400' : 'text-slate-400'} />
                ) : (
                  <Layers size={13} className={isActive ? 'text-indigo-400' : 'text-slate-400'} />
                )}
              </div>

              {/* Title / Inline Rename */}
              {editingId === proj.id ? (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename(proj.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    autoFocus
                    className="bg-black/60 border border-indigo-500 rounded px-1.5 py-0.5 text-xs text-white outline-none w-28 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveRename(proj.id)}
                    className="p-1 text-emerald-400 hover:text-emerald-300"
                  >
                    <Check size={12} />
                  </button>
                </div>
              ) : (
                <span 
                  onDoubleClick={(e) => handleStartRename(proj, e)}
                  className="truncate max-w-[130px] font-medium"
                >
                  {proj.name || `مشروع ${idx + 1}`}
                </span>
              )}

              {/* Specs Badge */}
              <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded-md ${
                isActive ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-500/40' : 'bg-black/30 text-slate-400'
              }`}>
                {width}×{height}
              </span>

              {/* Tab Quick Actions (Duplicate / Close) */}
              <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity mr-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicateProject(proj.id);
                  }}
                  className="p-1 text-slate-400 hover:text-indigo-300 rounded hover:bg-white/10 transition-colors"
                  title="تكرار هذا المشروع (Duplicate Comp)"
                >
                  <Copy size={11} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseProject(proj.id);
                  }}
                  className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-white/10 transition-colors"
                  title="إغلاق هذا المشروع (Close Comp)"
                >
                  <X size={11} />
                </button>
              </div>

              {/* Active Bottom Glow Line */}
              {isActive && (
                <div className="absolute -bottom-1 left-2 right-2 h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full" />
              )}
            </div>
          );
        })}

        {/* Add Project / Comp Buttons */}
        <div className="flex items-center gap-1 pr-1 border-r border-white/10">
          <button
            type="button"
            onClick={onOpenFiles}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm hover:scale-105"
            title="فتح ملفات ومشاريع إضافية (SVGA / MP4 / صور)"
          >
            <Plus size={13} className="text-indigo-400" />
            <span>فتح ملفات إضافية</span>
          </button>

          <button
            type="button"
            onClick={onAddNewProject}
            className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-xl transition-all cursor-pointer"
            title="مشروع جديد فارغ بمقاسات مخصصة"
          >
            <Sparkles size={13} className="text-purple-400" />
          </button>
        </div>
      </div>

      {/* Left / End: Multi-View Toggle & Batch Export Button */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Multi-Project Split View (Overview Mode - as drawn in s.png) */}
        <button
          type="button"
          onClick={onToggleOverviewMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
            isOverviewMode
              ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md ring-1 ring-amber-400/50'
              : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white'
          }`}
          title="عرض المشاريع جنباً إلى جنب (نظرة عامة ومقارنة فورية كما في الرسم)"
        >
          <LayoutGrid size={13} className={isOverviewMode ? 'text-amber-400' : 'text-slate-400'} />
          <span>{isOverviewMode ? 'العودة للتحرير الفردي' : 'عرض المشاريع جنباً إلى جنب'}</span>
          <span className="text-[10px] font-mono bg-white/10 px-1.5 py-0.2 rounded-full">
            {projects.length}
          </span>
        </button>

        {/* Batch Export Button (تصدير مجمع لكافة المشاريع دفعة واحدة) */}
        <button
          type="button"
          onClick={onBatchExport}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer hover:scale-105 border border-emerald-400/40"
          title="تصدير كافة المشاريع المفتوحة دفعة واحدة لأي صيغة تختارها (SVGA / MP4 / WebP / ZIP)"
        >
          <Download size={13} />
          <span>تصدير جماعي لكافة المشاريع ({projects.length})</span>
        </button>
      </div>
    </div>
  );
};
