import React from 'react';

interface RoyalChairProps {
  color: 'blue' | 'magenta' | 'red';
  isWinner?: boolean;
  className?: string;
}

export const RoyalChair: React.FC<RoyalChairProps> = ({
  color,
  isWinner = false,
  className = '',
}) => {
  // Theme color maps for tufted velvet & ornate frame
  const themes = {
    blue: {
      velvetMain: 'url(#blueVelvetGrad)',
      velvetShadow: '#1e3a8a',
      velvetHighlight: '#60a5fa',
      frameGold: 'url(#goldFrameGrad)',
      accent: '#93c5fd',
      glow: 'shadow-[0_0_30px_rgba(59,130,246,0.6)]',
    },
    magenta: {
      velvetMain: 'url(#magentaVelvetGrad)',
      velvetShadow: '#86198f',
      velvetHighlight: '#f472b6',
      frameGold: 'url(#goldFrameGrad)',
      accent: '#fbcfe8',
      glow: 'shadow-[0_0_30px_rgba(217,70,239,0.6)]',
    },
    red: {
      velvetMain: 'url(#redVelvetGrad)',
      velvetShadow: '#881337',
      velvetHighlight: '#fb7185',
      frameGold: 'url(#goldFrameGrad)',
      accent: '#fecdd3',
      glow: 'shadow-[0_0_30px_rgba(225,29,72,0.6)]',
    },
  };

  const theme = themes[color];

  return (
    <div
      className={`relative flex items-center justify-center transition-all duration-300 ${
        isWinner ? `scale-110 ${theme.glow}` : 'hover:scale-105'
      } ${className}`}
    >
      <svg
        viewBox="0 0 160 200"
        className="w-16 h-20 xs:w-20 xs:h-24 sm:w-24 sm:h-30 md:w-28 md:h-36 drop-shadow-xl select-none max-w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Gold Baroque Frame Gradient */}
          <linearGradient id="goldFrameGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="25%" stopColor="#eab308" />
            <stop offset="50%" stopColor="#ca8a04" />
            <stop offset="75%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#a16207" />
          </linearGradient>

          {/* Blue Velvet */}
          <radialGradient id="blueVelvetGrad" cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="60%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#172554" />
          </radialGradient>

          {/* Magenta Velvet */}
          <radialGradient id="magentaVelvetGrad" cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor="#e879f9" />
            <stop offset="50%" stopColor="#c026d3" />
            <stop offset="85%" stopColor="#86198f" />
            <stop offset="100%" stopColor="#4a044e" />
          </radialGradient>

          {/* Red Velvet */}
          <radialGradient id="redVelvetGrad" cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="45%" stopColor="#e11d48" />
            <stop offset="80%" stopColor="#9f1239" />
            <stop offset="100%" stopColor="#4c0519" />
          </radialGradient>

          {/* Tufted Button Shadow Filter */}
          <filter id="tuftShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.6" />
          </filter>
        </defs>

        {/* Chair Legs (Carved Baroque Legs) */}
        <g stroke="url(#goldFrameGrad)" strokeWidth="3" strokeLinecap="round">
          {/* Front Left Leg */}
          <path d="M45 155 Q35 175 40 190 Q48 185 52 165" fill="url(#goldFrameGrad)" />
          {/* Front Right Leg */}
          <path d="M115 155 Q125 175 120 190 Q112 185 108 165" fill="url(#goldFrameGrad)" />
          {/* Center Ornate Carving below seat */}
          <path d="M50 160 Q80 172 110 160 Q80 166 50 160" fill="url(#goldFrameGrad)" />
        </g>

        {/* Outer Baroque Crown / Backrest Frame */}
        <path
          d="M80 12 C95 12 105 16 116 26 C128 38 132 58 130 80 C128 100 125 118 126 130 C120 134 110 138 80 138 C50 138 40 134 34 130 C35 118 32 100 30 80 C28 58 32 38 44 26 C55 16 65 12 80 12 Z"
          fill="url(#goldFrameGrad)"
          stroke="#ca8a04"
          strokeWidth="1.5"
        />

        {/* Backrest Top Crown Crest */}
        <path
          d="M74 8 Q80 2 86 8 Q92 14 80 16 Q68 14 74 8 Z"
          fill="#fef08a"
          stroke="#ca8a04"
          strokeWidth="1"
        />

        {/* Tufted Velvet Backrest Padding */}
        <path
          d="M80 22 C92 22 102 26 110 35 C118 45 121 62 120 80 C119 96 116 114 114 126 C105 129 95 131 80 131 C65 131 55 129 46 126 C44 114 41 96 40 80 C39 62 42 45 50 35 C58 26 68 22 80 22 Z"
          fill={theme.velvetMain}
          stroke="#000"
          strokeOpacity="0.2"
          strokeWidth="1"
        />

        {/* Tufting Creases & Diamond Indentations */}
        <g stroke={theme.velvetShadow} strokeWidth="1.2" opacity="0.75">
          {/* Row 1 to Row 2 folds */}
          <line x1="80" y1="42" x2="60" y2="60" />
          <line x1="80" y1="42" x2="100" y2="60" />
          {/* Row 2 to Row 3 folds */}
          <line x1="60" y1="60" x2="80" y2="82" />
          <line x1="100" y1="60" x2="80" y2="82" />
          <line x1="60" y1="60" x2="52" y2="85" />
          <line x1="100" y1="60" x2="108" y2="85" />
          {/* Row 3 to Row 4 folds */}
          <line x1="80" y1="82" x2="65" y2="108" />
          <line x1="80" y1="82" x2="95" y2="108" />
          <line x1="52" y1="85" x2="65" y2="108" />
          <line x1="108" y1="85" x2="95" y2="108" />
        </g>

        {/* Tufted Button Dimples with Highlights */}
        {[
          { cx: 80, cy: 42 },
          { cx: 60, cy: 60 },
          { cx: 100, cy: 60 },
          { cx: 52, cy: 85 },
          { cx: 80, cy: 82 },
          { cx: 108, cy: 85 },
          { cx: 65, cy: 108 },
          { cx: 95, cy: 108 },
        ].map((btn, idx) => (
          <g key={idx} filter="url(#tuftShadow)">
            <circle cx={btn.cx} cy={btn.cy} r="3" fill={theme.velvetShadow} />
            <circle cx={btn.cx} cy={btn.cy} r="2.2" fill={theme.velvetMain} />
            <circle cx={btn.cx - 0.7} cy={btn.cy - 0.7} r="0.8" fill="#fff" opacity="0.85" />
          </g>
        ))}

        {/* Armrests (Left & Right Baroque Padded Armrests) */}
        {/* Left Armrest */}
        <path
          d="M25 105 C20 100 24 90 32 94 C38 98 42 108 38 122 C34 135 22 135 25 120 Z"
          fill="url(#goldFrameGrad)"
          stroke="#ca8a04"
          strokeWidth="1"
        />
        <path
          d="M26 100 C24 95 28 92 34 96 C36 102 38 112 34 122 C30 128 26 122 26 112 Z"
          fill={theme.velvetMain}
        />

        {/* Right Armrest */}
        <path
          d="M135 105 C140 100 136 90 128 94 C122 98 118 108 122 122 C126 135 138 135 135 120 Z"
          fill="url(#goldFrameGrad)"
          stroke="#ca8a04"
          strokeWidth="1"
        />
        <path
          d="M134 100 C136 95 132 92 126 96 C124 102 122 112 126 122 C130 128 134 122 134 112 Z"
          fill={theme.velvetMain}
        />

        {/* Plush Velvet Seat Cushion */}
        <path
          d="M32 128 C32 128 45 125 80 125 C115 125 128 128 128 128 C136 132 138 148 132 155 C124 163 105 166 80 166 C55 166 36 163 28 155 C22 148 24 132 32 128 Z"
          fill={theme.velvetMain}
          stroke="url(#goldFrameGrad)"
          strokeWidth="3"
        />

        {/* Cushion Highlight Sheen */}
        <ellipse cx="80" cy="142" rx="35" ry="8" fill="#fff" opacity="0.18" />
      </svg>
    </div>
  );
};
