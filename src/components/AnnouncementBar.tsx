import React from 'react';
import { useStore } from '../store/useStore';
import { Megaphone } from 'lucide-react';
import { motion } from 'motion/react';

export default function AnnouncementBar() {
  const { announcements } = useStore();
  const activeAnnouncements = announcements.filter(a => a.isActive);

  if (activeAnnouncements.length === 0) return null;

  // Combine all active announcements with a separator
  const textContent = activeAnnouncements.map(a => a.text).join('   •   ');

  return (
    <div className="bg-white border-b border-slate-100 overflow-hidden py-3 relative">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-4 relative z-10">
        <div className="bg-white pointer-events-none absolute inset-y-0 left-12 w-8 bg-gradient-to-r from-white to-transparent z-20" />
        <div className="bg-white pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent z-20" />
        
        <div className="bg-indigo-600 rounded-lg p-2 flex-shrink-0 shadow-lg shadow-indigo-200 z-30">
          <Megaphone className="w-3.5 h-3.5 sm:w-4 h-4 text-white" />
        </div>
        
        <div className="flex-1 overflow-hidden relative h-6">
          <motion.div
            initial={{ x: 0 }}
            animate={{ x: "-50%" }}
            transition={{
              duration: 40 + (textContent.length * 0.4), // Much slower speed
              repeat: Infinity,
              ease: "linear"
            }}
            className="whitespace-nowrap flex items-center gap-12 absolute"
          >
            <span className="font-display font-black text-slate-900 text-[11px] sm:text-xs uppercase tracking-widest flex items-center gap-12">
              {textContent}
            </span>
            {/* Duplicate for absolute seamless loop */}
            <span className="font-display font-black text-slate-900 text-[11px] sm:text-xs uppercase tracking-widest flex items-center gap-12">
              {textContent}
            </span>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
