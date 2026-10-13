import React from 'react';

export const Loading: React.FC<{ message?: string }> = ({ message }) => {
  return (
    <div className="fixed inset-0 bg-[#020617] flex flex-col items-center justify-center z-50 gap-4">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
        </div>
      </div>
      {message && <p className="text-sm font-semibold text-slate-300 animate-pulse">{message}</p>}
    </div>
  );
};
