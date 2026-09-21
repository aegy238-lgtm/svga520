import React from 'react';

interface CasinoChipsBarProps {
  chips: number[];
  selectedChip: number;
  onSelectChip: (amount: number) => void;
  disabled?: boolean;
}

export const CasinoChipsBar: React.FC<CasinoChipsBarProps> = ({
  chips = [100, 1000, 10000, 100000],
  selectedChip,
  onSelectChip,
  disabled = false,
}) => {
  const getChipDetails = (val: number) => {
    switch (val) {
      case 100:
        return {
          clayColor: '#059669', // Emerald
          clayLight: '#34d399',
          clayDark: '#064e3b',
          stripeColor: '#ffffff',
          label: '100',
          accent: '#10b981',
        };
      case 1000:
        return {
          clayColor: '#2563eb', // Royal Blue
          clayLight: '#60a5fa',
          clayDark: '#1e3a8a',
          stripeColor: '#facc15',
          label: '1K',
          accent: '#3b82f6',
        };
      case 10000:
      case 2000:
        return {
          clayColor: '#7c3aed', // Purple VIP
          clayLight: '#a78bfa',
          clayDark: '#4c1d95',
          stripeColor: '#f43f5e',
          label: '10K',
          accent: '#8b5cf6',
        };
      case 100000:
      default:
        return {
          clayColor: '#18181b', // Obsidian Black & Gold
          clayLight: '#3f3f46',
          clayDark: '#09090b',
          stripeColor: '#fbbf24',
          label: '100K',
          accent: '#eab308',
        };
    }
  };

  return (
    <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 py-1">
      {chips.map((chipVal) => {
        const details = getChipDetails(chipVal);
        const isSelected = selectedChip === chipVal;

        return (
          <button
            key={chipVal}
            id={`btn-chip-${chipVal}`}
            disabled={disabled}
            onClick={() => onSelectChip(chipVal)}
            className={`group relative w-9 h-9 xs:w-11 xs:h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
              isSelected
                ? 'scale-110 -translate-y-2 z-20'
                : 'hover:scale-105 active:scale-95 opacity-95 hover:opacity-100'
            } ${disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
            title={`Select ${chipVal.toLocaleString()} Chip`}
          >
            {/* Realistic 3D SVG Casino Chip */}
            <svg
              viewBox="0 0 100 100"
              className={`w-full h-full select-none transition-transform duration-200 ${
                isSelected
                  ? 'filter drop-shadow-[0_12px_15px_rgba(0,0,0,0.85)] drop-shadow-[0_0_12px_rgba(250,204,21,0.7)]'
                  : 'filter drop-shadow-[0_5px_8px_rgba(0,0,0,0.6)]'
              }`}
            >
              <defs>
                {/* 3D Chip Rim Gradient */}
                <radialGradient id={`chipRim-${chipVal}`} cx="45%" cy="40%" r="55%">
                  <stop offset="0%" stopColor={details.clayLight} />
                  <stop offset="65%" stopColor={details.clayColor} />
                  <stop offset="100%" stopColor={details.clayDark} />
                </radialGradient>

                {/* 3D Inlay Recessed Shadow */}
                <radialGradient id={`chipCore-${chipVal}`} cx="50%" cy="45%" r="50%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="70%" stopColor="#f1f5f9" />
                  <stop offset="100%" stopColor="#cbd5e1" />
                </radialGradient>

                {/* Gold Bevel Ring */}
                <linearGradient id={`goldRing-${chipVal}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fef08a" />
                  <stop offset="50%" stopColor="#ca8a04" />
                  <stop offset="100%" stopColor="#78350f" />
                </linearGradient>
              </defs>

              {/* Base Clay Body */}
              <circle
                cx="50"
                cy="50"
                r="46"
                fill={`url(#chipRim-${chipVal})`}
                stroke="rgba(0,0,0,0.4)"
                strokeWidth="1.5"
              />

              {/* Edge Inserts / Notches (Realistic 6-Stripe Casino Chip) */}
              {[0, 60, 120, 180, 240, 300].map((angle, idx) => (
                <g key={idx} transform={`rotate(${angle} 50 50)`}>
                  <rect
                    x="46"
                    y="4"
                    width="8"
                    height="10"
                    rx="1.5"
                    fill={details.stripeColor}
                    stroke="rgba(0,0,0,0.25)"
                    strokeWidth="0.8"
                  />
                </g>
              ))}

              {/* Outer Molded Groove Line */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="rgba(0,0,0,0.3)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />

              {/* Inner Molded Groove Highlight */}
              <circle
                cx="50"
                cy="50"
                r="37"
                fill="none"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="0.8"
              />

              {/* Recessed Center Inlay Disc with Gold Rim */}
              <circle
                cx="50"
                cy="50"
                r="28"
                fill={`url(#goldRing-${chipVal})`}
                stroke="rgba(0,0,0,0.5)"
                strokeWidth="1"
              />
              <circle
                cx="50"
                cy="50"
                r="25.5"
                fill={`url(#chipCore-${chipVal})`}
                stroke="rgba(0,0,0,0.15)"
                strokeWidth="0.5"
              />

              {/* Top Specular Sheen (Gives Real 3D Ceramic/Clay Glaze) */}
              <path
                d="M 28 35 A 24 24 0 0 1 72 35 A 25 15 0 0 0 28 35 Z"
                fill="rgba(255,255,255,0.45)"
              />

              {/* Center Denomination Text with 3D Emboss */}
              <text
                x="50"
                y="54"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={details.label.length > 3 ? "14" : "16"}
                fontWeight="900"
                fontFamily="system-ui, -apple-system, sans-serif"
                fill="#0f172a"
              >
                {details.label}
              </text>

              {/* Tiny Crown Motif below Denomination */}
              <text
                x="50"
                y="67"
                textAnchor="middle"
                fontSize="7"
                fill="#ca8a04"
              >
                ★ ROYAL ★
              </text>
            </svg>

            {/* Glowing Selection Halo */}
            {isSelected && (
              <div className="absolute -top-1.5 w-3 h-3 rounded-full bg-yellow-400 shadow-[0_0_10px_#facc15] border border-white animate-bounce" />
            )}
          </button>
        );
      })}
    </div>
  );
};

