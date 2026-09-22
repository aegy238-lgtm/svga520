import React, { useEffect, useRef, useState } from 'react';
import { 
  Play, Pause, Edit3, Download, Copy, Trash2, Plus, 
  Layers, Sparkles, Film, Image as ImageIcon, CheckCircle2 
} from 'lucide-react';
import { motion } from 'motion/react';
import { ProjectSession } from './types';
import { renderProjectFrameToCanvas } from './svgaProjectRenderer';

interface SvgaMultiProjectOverviewProps {
  projects: ProjectSession[];
  activeProjectId: string | null;
  onSelectAndEditProject: (id: string) => void;
  onCloseProject: (id: string) => void;
  onDuplicateProject: (id: string) => void;
  onOpenFiles: () => void;
  onBatchExport: () => void;
  onSingleProjectExport: (project: ProjectSession) => void;
}

export const SvgaMultiProjectOverview: React.FC<SvgaMultiProjectOverviewProps> = ({
  projects,
  activeProjectId,
  onSelectAndEditProject,
  onCloseProject,
  onDuplicateProject,
  onOpenFiles,
  onBatchExport,
  onSingleProjectExport
}) => {
  const [isPlayingAll, setIsPlayingAll] = useState<boolean>(true);
  const [frameMap, setFrameMap] = useState<Record<string, number>>({});
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

  // Animation playback loop for all visible project cards
  useEffect(() => {
    if (!isPlayingAll || projects.length === 0) return;

    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const delta = time - lastTime;
      if (delta >= 1000 / 30) {
        lastTime = time;
        setFrameMap(prev => {
          const next: Record<string, number> = {};
          projects.forEach(p => {
            const tot = p.project.totalFrames || 1;
            const cur = prev[p.id] ?? 0;
            next[p.id] = (cur + 1) % tot;
          });
          return next;
        });
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlayingAll, projects]);

  // Render current frame for each project canvas
  useEffect(() => {
    projects.forEach(p => {
      const canvas = canvasRefs.current[p.id];
      if (!canvas) return;

      const f = frameMap[p.id] ?? 0;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = p.project.width || 750;
      canvas.height = p.project.height || 1334;

      renderProjectFrameToCanvas(
        canvas,
        p.project,
        p.layers,
        f,
        {
          fadeConfig: p.fadeConfig,
          cropConfig: p.cropConfig,
          cropFeather: p.cropFeather,
          bgColor: p.bgColor
        }
      );
    });
  }, [projects, frameMap]);

  return (
    <div className="flex-1 bg-[#060913] p-6 overflow-y-auto flex flex-col" dir="rtl">
      {/* Top Banner & Multi-Project Controls */}
      <div className="max-w-7xl mx-auto w-full mb-6 flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 border border-white/10 rounded-2xl p-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-glow-indigo">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white">نظرة عامة على المشاريع المفتوحة (Compositions Overview)</h2>
              <span className="text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                {projects.length} مشاريع نشطة
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              اضغط على أي مشروع للبدء بالعمل عليه وتعديل طبقاته فوراً، أو قم بتصدير كل المشاريع دفعة واحدة بالأسفل.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Play/Pause All Previews */}
          <button
            type="button"
            onClick={() => setIsPlayingAll(!isPlayingAll)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            {isPlayingAll ? <Pause size={14} className="text-amber-400" /> : <Play size={14} className="text-emerald-400" />}
            <span>{isPlayingAll ? 'إيقاف الحركة مؤقتاً' : 'تشغيل الحركة'}</span>
          </button>

          {/* Add more files */}
          <button
            type="button"
            onClick={onOpenFiles}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 rounded-xl text-xs font-bold text-indigo-200 hover:text-white transition-all cursor-pointer shadow-sm hover:scale-105"
          >
            <Plus size={14} className="text-indigo-400" />
            <span>فتح ملفات إضافية</span>
          </button>

          {/* Batch Export */}
          <button
            type="button"
            onClick={onBatchExport}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-900/40 transition-all cursor-pointer hover:scale-105 border border-emerald-400/30"
          >
            <Download size={14} />
            <span>تصدير جماعي لكافة المشاريع ({projects.length})</span>
          </button>
        </div>
      </div>

      {/* Projects Grid / Side-by-Side Columns (Matches user sketch in s.png) */}
      <div className={`max-w-7xl mx-auto w-full grid gap-6 flex-1 items-start ${
        projects.length === 1 
          ? 'grid-cols-1 max-w-xl' 
          : projects.length === 2 
          ? 'grid-cols-1 md:grid-cols-2' 
          : projects.length === 3 
          ? 'grid-cols-1 md:grid-cols-3' 
          : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
      }`}>
        {projects.map((proj, idx) => {
          const isSelected = proj.id === activeProjectId;
          const currentF = frameMap[proj.id] ?? 0;
          const totalF = proj.project.totalFrames || 1;
          const width = proj.project.width || 750;
          const height = proj.project.height || 1334;
          const layersCount = proj.layers.length;

          return (
            <motion.div
              key={proj.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              className={`flex flex-col bg-slate-900/80 border rounded-3xl overflow-hidden transition-all shadow-xl group ${
                isSelected
                  ? 'border-indigo-500 ring-2 ring-indigo-500/40 shadow-indigo-900/30'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              {/* Card Header */}
              <div className="p-3.5 border-b border-white/10 bg-black/30 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 truncate">
                  <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black ${
                    isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="truncate">
                    <h3 className="text-xs font-black text-white truncate" title={proj.name}>
                      {proj.name}
                    </h3>
                    <p className="text-[10px] font-mono text-slate-400">
                      {width}×{height} • {proj.project.fps} FPS
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onDuplicateProject(proj.id)}
                    className="p-1.5 text-slate-400 hover:text-indigo-300 rounded-lg hover:bg-white/10 transition-colors"
                    title="تكرار المشروع"
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onCloseProject(proj.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-white/10 transition-colors"
                    title="إغلاق المشروع"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Canvas Preview Area */}
              <div 
                onClick={() => onSelectAndEditProject(proj.id)}
                className="relative aspect-square bg-[#070a14] flex items-center justify-center p-3 cursor-pointer group-hover:bg-[#0a0f1f] transition-colors overflow-hidden"
              >
                {/* Checkerboard Pattern */}
                <div 
                  className="absolute inset-0 opacity-15 pointer-events-none"
                  style={{
                    backgroundImage: 'radial-gradient(circle, #475569 20%, transparent 20%)',
                    backgroundSize: '8px 8px'
                  }}
                />

                <canvas
                  ref={(el) => { canvasRefs.current[proj.id] = el; }}
                  className="max-w-full max-h-full object-contain rounded-xl shadow-2xl transition-transform duration-300 group-hover:scale-[1.02]"
                />

                {/* Hover Quick Edit Overlay */}
                <div className="absolute inset-0 bg-indigo-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 text-white backdrop-blur-[2px]">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/50 scale-90 group-hover:scale-100 transition-transform">
                    <Edit3 size={20} />
                  </div>
                  <span className="text-xs font-black">اضغط لتعديل هذا المشروع</span>
                  <span className="text-[10px] text-indigo-200">التحكم في الطبقات ومسارات الحركة</span>
                </div>

                {/* Frame Counter Pill */}
                <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md border border-white/10 px-2 py-0.5 rounded-md text-[10px] font-mono text-slate-300">
                  {currentF + 1} / {totalF} F
                </div>

                {/* Layer Count Pill */}
                <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-md border border-white/10 px-2 py-0.5 rounded-md text-[10px] font-mono text-slate-300 flex items-center gap-1">
                  <Layers size={10} className="text-indigo-400" />
                  <span>{layersCount} طبقات</span>
                </div>
              </div>

              {/* Action Buttons Bar */}
              <div className="p-3 bg-slate-900 border-t border-white/10 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelectAndEditProject(proj.id)}
                  className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-900/30"
                >
                  <Edit3 size={13} />
                  <span>فتح للتعديل</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSingleProjectExport(proj)}
                  className="py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                  title="تصدير هذا المشروع وحده"
                >
                  <Download size={13} />
                </button>
              </div>
            </motion.div>
          );
        })}

        {/* Add New Project Card Slot */}
        <div
          onClick={onOpenFiles}
          className="border-2 border-dashed border-white/15 hover:border-indigo-400/50 bg-white/[0.02] hover:bg-white/[0.05] rounded-3xl p-8 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer min-h-[300px] text-center group"
        >
          <div className="w-14 h-14 rounded-2xl bg-white/5 group-hover:bg-indigo-600/20 border border-white/10 group-hover:border-indigo-500/40 flex items-center justify-center text-slate-400 group-hover:text-indigo-300 transition-all">
            <Plus size={24} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">
              إضافة مشروع جديد (3 أو 4 ملفات)
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-[200px] leading-relaxed">
              اختر ملفات SVGA أو MP4 أو صور ليتم فتحها في تكوين جديد
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
