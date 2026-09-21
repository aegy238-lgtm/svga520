import React from 'react';

export const GamingAppBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      {/* 1. Deep Gaming Slate Gradient Base */}
      <div className="absolute inset-0 bg-[#070913] bg-gradient-to-b from-[#05070e] via-[#090d1f] to-[#04060c]" />

      {/* 2. Cyberpunk Gaming Neon Light Orbs */}
      <div 
        className="absolute -top-32 -left-32 w-[550px] h-[550px] rounded-full bg-cyan-600/10 blur-[120px] animate-pulseGlow" 
        style={{ animationDuration: '6s' }} 
      />
      <div 
        className="absolute top-1/3 -right-40 w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-[140px] animate-pulseGlow" 
        style={{ animationDuration: '8s' }} 
      />
      <div 
        className="absolute -bottom-40 left-1/4 w-[700px] h-[500px] rounded-full bg-amber-500/10 blur-[130px] animate-pulseGlow" 
        style={{ animationDuration: '7s' }} 
      />

      {/* 3. Futuristic Hexagonal Gaming Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.04] mix-blend-screen"
        style={{
          backgroundImage: `radial-gradient(circle, #38bdf8 1px, transparent 1px), radial-gradient(circle, #f59e0b 1px, transparent 1px)`,
          backgroundSize: '36px 36px',
          backgroundPosition: '0 0, 18px 18px',
        }}
      />

      {/* 4. Subtle Gaming Circuit & Geometric Lines */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.035]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="gaming-grid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#38bdf8" strokeWidth="0.75" />
            <circle cx="0" cy="0" r="2" fill="#f59e0b" />
            <circle cx="80" cy="0" r="1.5" fill="#38bdf8" />
            <path d="M 40 0 L 80 40 M 0 40 L 40 80" fill="none" stroke="#818cf8" strokeWidth="0.5" strokeDasharray="4,4" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#gaming-grid)" />
      </svg>

      {/* 5. Floating Gaming Emblems (Cards, Dice, Chips, Rocket, Controller, Gems) */}
      <div className="absolute top-[8%] left-[6%] text-cyan-400/20 text-3xl font-black animate-float3d select-none">
        🎮
      </div>
      <div className="absolute top-[18%] right-[8%] text-amber-400/25 text-3xl font-black animate-float3d select-none" style={{ animationDelay: '1.2s' }}>
        👑
      </div>
      <div className="absolute top-[42%] left-[4%] text-purple-400/20 text-2xl font-black animate-float3d select-none" style={{ animationDelay: '2.5s' }}>
        🎲
      </div>
      <div className="absolute top-[58%] right-[5%] text-rose-400/20 text-3xl font-black animate-float3d select-none" style={{ animationDelay: '0.8s' }}>
        🚀
      </div>
      <div className="absolute bottom-[22%] left-[8%] text-emerald-400/20 text-2xl font-black animate-float3d select-none" style={{ animationDelay: '1.8s' }}>
        💎
      </div>
      <div className="absolute bottom-[10%] right-[10%] text-amber-400/25 text-2xl font-black animate-float3d select-none" style={{ animationDelay: '3s' }}>
        🪙
      </div>
      <div className="absolute top-[75%] left-[20%] text-cyan-500/15 text-2xl select-none animate-float3d" style={{ animationDelay: '2.1s' }}>
        ♠
      </div>
      <div className="absolute top-[30%] right-[18%] text-rose-500/15 text-2xl select-none animate-float3d" style={{ animationDelay: '1.5s' }}>
        ♥
      </div>

      {/* 6. Subtle Cyber Scanlines & Vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 pointer-events-none" />
      <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.85)] pointer-events-none" />
    </div>
  );
};
