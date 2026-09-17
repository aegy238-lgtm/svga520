import React from 'react';

interface FoodIconProps {
  id: string;
  className?: string;
  size?: number;
}

export const FoodIcon: React.FC<FoodIconProps> = ({ id, className = '', size = 48 }) => {
  switch (id) {
    case 'chicken':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          className={`drop-shadow-md ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="chicken-glaze" cx="40%" cy="30%" r="60%">
              <stop offset="0%" stopColor="#fdba74" />
              <stop offset="50%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#9a3412" />
            </radialGradient>
            <linearGradient id="bone-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fef3c7" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>
            <filter id="chicken-shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#7c2d12" floodOpacity="0.5" />
            </filter>
          </defs>
          {/* Main crispy plump roast body */}
          <path
            d="M28 62 C15 50 16 28 36 20 C56 12 78 24 82 44 C85 58 76 74 60 76 C42 78 35 70 28 62 Z"
            fill="url(#chicken-glaze)"
            filter="url(#chicken-shadow)"
          />
          {/* Drumstick bone */}
          <path
            d="M32 64 L16 80 C13 83 9 82 7 79 C5 76 6 72 9 70 C7 67 8 62 12 61 L26 56 Z"
            fill="url(#bone-grad)"
            stroke="#cbd5e1"
            strokeWidth="1.5"
          />
          {/* Crispy glaze highlights & grill marks */}
          <path d="M42 26 Q56 22 66 32" stroke="#fed7aa" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
          <path d="M46 36 Q60 32 72 42" stroke="#7c2d12" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
          <path d="M52 48 Q64 44 74 54" stroke="#7c2d12" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
          {/* Little spark / steam */}
          <circle cx="70" cy="18" r="2.5" fill="#fef08a" opacity="0.8" />
          <circle cx="76" cy="14" r="1.5" fill="#fef08a" opacity="0.7" />
        </svg>
      );

    case 'fish':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          className={`drop-shadow-md ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="fish-body" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#0369a1" />
            </linearGradient>
            <linearGradient id="fish-belly" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e0f2fe" />
              <stop offset="100%" stopColor="#bae6fd" />
            </linearGradient>
          </defs>
          {/* Tail fin */}
          <path d="M18 50 L6 34 C12 44 12 56 6 66 Z" fill="#0284c7" />
          <path d="M18 50 L8 38 C14 46 14 54 8 62 Z" fill="#38bdf8" />
          {/* Main Fish Body */}
          <path
            d="M18 50 C24 30 52 24 82 46 C84 48 84 52 82 54 C52 76 24 70 18 50 Z"
            fill="url(#fish-body)"
          />
          {/* Belly */}
          <path
            d="M26 52 C36 65 58 66 76 52 C60 62 40 60 26 52 Z"
            fill="url(#fish-belly)"
          />
          {/* Dorsal Fin */}
          <path d="M40 30 Q54 18 64 28 Z" fill="#0369a1" />
          {/* Eye */}
          <circle cx="72" cy="44" r="6" fill="#ffffff" />
          <circle cx="73.5" cy="44" r="3.5" fill="#0f172a" />
          <circle cx="75" cy="42.5" r="1.5" fill="#ffffff" />
          {/* Cute smile */}
          <path d="M80 50 Q77 54 74 52" stroke="#0369a1" strokeWidth="2" strokeLinecap="round" />
          {/* Scale glints */}
          <path d="M46 42 Q50 38 54 42" stroke="#bae6fd" strokeWidth="2" strokeLinecap="round" />
          <path d="M38 48 Q42 44 46 48" stroke="#bae6fd" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'meat':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          className={`drop-shadow-md ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="steak-grad" cx="40%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="60%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#991b1b" />
            </radialGradient>
            <linearGradient id="tbone" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#f1f5f9" />
            </linearGradient>
          </defs>
          {/* Meat outer slab */}
          <path
            d="M20 35 C22 18 45 15 65 24 C82 32 88 52 82 72 C75 88 48 86 32 80 C18 74 16 50 20 35 Z"
            fill="url(#steak-grad)"
          />
          {/* Fat rim */}
          <path
            d="M62 23 C78 30 85 48 81 68"
            stroke="#fef08a"
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0.85"
          />
          {/* T-Bone */}
          <path d="M44 32 L44 68" stroke="url(#tbone)" strokeWidth="6" strokeLinecap="round" />
          <path d="M32 46 L58 46" stroke="url(#tbone)" strokeWidth="6" strokeLinecap="round" />
          {/* Grilled cross marks */}
          <line x1="30" y1="28" x2="48" y2="40" stroke="#7f1d1d" strokeWidth="3.5" strokeLinecap="round" opacity="0.6" />
          <line x1="56" y1="46" x2="74" y2="58" stroke="#7f1d1d" strokeWidth="3.5" strokeLinecap="round" opacity="0.6" />
        </svg>
      );

    case 'sausage':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          className={`drop-shadow-md ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="sausage-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fb7185" />
              <stop offset="60%" stopColor="#e11d48" />
              <stop offset="100%" stopColor="#9f1239" />
            </linearGradient>
          </defs>
          {/* Curved plump sausage */}
          <path
            d="M20 70 C12 55 18 32 38 22 C62 10 82 24 84 46 C86 64 68 84 46 84 C32 84 24 78 20 70 Z"
            fill="url(#sausage-grad)"
          />
          {/* Highlights */}
          <path
            d="M36 28 C52 20 68 28 72 40"
            stroke="#fecdd3"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.75"
          />
          {/* Grill marks */}
          <line x1="38" y1="36" x2="48" y2="48" stroke="#881337" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
          <line x1="52" y1="40" x2="62" y2="52" stroke="#881337" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
          <line x1="42" y1="56" x2="52" y2="68" stroke="#881337" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
          {/* Sausage tips */}
          <circle cx="18" cy="68" r="3" fill="#881337" />
          <circle cx="84" cy="44" r="3" fill="#881337" />
        </svg>
      );

    case 'eggplant':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          className={`drop-shadow-md ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="eggplant-grad" cx="45%" cy="40%" r="55%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="50%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#4c1d95" />
            </radialGradient>
            <linearGradient id="calyx-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4ade80" />
              <stop offset="100%" stopColor="#15803d" />
            </linearGradient>
          </defs>
          {/* Body */}
          <path
            d="M48 30 C35 34 24 50 24 66 C24 82 38 90 56 90 C74 90 84 78 84 62 C84 46 64 26 48 30 Z"
            fill="url(#eggplant-grad)"
          />
          {/* Specular high-gloss sheen */}
          <path
            d="M34 54 C32 64 36 76 46 80"
            stroke="#e9d5ff"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.8"
          />
          {/* Green Calyx & Stem */}
          <path d="M48 32 L46 14 C46 12 50 12 52 14 L50 32 Z" fill="#15803d" />
          <path
            d="M38 34 C42 42 46 36 50 44 C54 36 58 42 64 34 C60 28 42 26 38 34 Z"
            fill="url(#calyx-grad)"
          />
        </svg>
      );

    case 'bokchoy':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          className={`drop-shadow-md ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="leaf-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4ade80" />
              <stop offset="50%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#15803d" />
            </linearGradient>
            <linearGradient id="stem-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f0fdf4" />
              <stop offset="60%" stopColor="#dcfce7" />
              <stop offset="100%" stopColor="#bbf7d0" />
            </linearGradient>
          </defs>
          {/* Fan of leaves */}
          <path d="M25 40 C14 26 28 14 42 22 C34 32 30 46 32 58 Z" fill="url(#leaf-grad)" />
          <path d="M75 40 C86 26 72 14 58 22 C66 32 70 46 68 58 Z" fill="url(#leaf-grad)" />
          <path d="M35 32 C34 14 66 14 65 32 C65 48 55 58 50 62 C45 58 35 48 35 32 Z" fill="url(#leaf-grad)" />
          {/* Leaf veins */}
          <path d="M50 20 L50 50" stroke="#86efac" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M40 26 Q46 34 50 38" stroke="#86efac" strokeWidth="2" strokeLinecap="round" />
          <path d="M60 26 Q54 34 50 38" stroke="#86efac" strokeWidth="2" strokeLinecap="round" />
          {/* White crisp juicy bulb/stems */}
          <path
            d="M32 56 C28 68 32 86 46 88 C54 88 68 88 68 86 C74 72 70 58 66 54 C58 62 42 62 32 56 Z"
            fill="url(#stem-grad)"
            stroke="#86efac"
            strokeWidth="1.5"
          />
          {/* Stems lines */}
          <path d="M44 60 C42 68 44 80 46 86" stroke="#86efac" strokeWidth="2" strokeLinecap="round" />
          <path d="M56 60 C58 68 56 80 54 86" stroke="#86efac" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'pumpkin':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          className={`drop-shadow-md ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="pumpkin-grad" cx="50%" cy="40%" r="55%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="40%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#b45309" />
            </radialGradient>
          </defs>
          {/* Stem */}
          <path d="M47 34 Q44 18 58 14 Q54 22 53 34 Z" fill="#65a30d" stroke="#365314" strokeWidth="1" />
          {/* Back segments */}
          <ellipse cx="30" cy="56" rx="16" ry="24" fill="#d97706" />
          <ellipse cx="70" cy="56" rx="16" ry="24" fill="#d97706" />
          {/* Mid segments */}
          <ellipse cx="38" cy="58" rx="16" ry="26" fill="url(#pumpkin-grad)" />
          <ellipse cx="62" cy="58" rx="16" ry="26" fill="url(#pumpkin-grad)" />
          {/* Center segment */}
          <ellipse cx="50" cy="60" rx="16" ry="27" fill="url(#pumpkin-grad)" />
          {/* Highlights */}
          <path d="M48 40 Q50 36 52 40" stroke="#fef08a" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
          <path d="M36 44 Q40 40 42 46" stroke="#fef08a" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
        </svg>
      );

    case 'watermelon':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          className={`drop-shadow-md ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="melon-red" cx="50%" cy="30%" r="60%">
              <stop offset="0%" stopColor="#fda4af" />
              <stop offset="40%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#be123c" />
            </radialGradient>
          </defs>
          {/* Green outer rind */}
          <path
            d="M14 70 C24 84 76 84 86 70 L86 64 C76 80 24 80 14 64 Z"
            fill="#15803d"
          />
          {/* White inner rind */}
          <path
            d="M15 64 C26 78 74 78 85 64 L85 60 C74 74 26 74 15 60 Z"
            fill="#dcfce7"
          />
          {/* Red juicy flesh */}
          <path
            d="M17 60 C28 72 72 72 83 60 L50 16 Z"
            fill="url(#melon-red)"
          />
          {/* Gloss highlight */}
          <path d="M46 26 L28 50" stroke="#ffe4e6" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
          {/* Seeds */}
          <ellipse cx="44" cy="46" rx="2" ry="3.5" transform="rotate(-15 44 46)" fill="#1c1917" />
          <ellipse cx="56" cy="46" rx="2" ry="3.5" transform="rotate(15 56 46)" fill="#1c1917" />
          <ellipse cx="50" cy="34" rx="1.8" ry="3" fill="#1c1917" />
          <ellipse cx="36" cy="54" rx="1.8" ry="3" transform="rotate(-25 36 54)" fill="#1c1917" />
          <ellipse cx="64" cy="54" rx="1.8" ry="3" transform="rotate(25 64 54)" fill="#1c1917" />
        </svg>
      );

    case 'salad':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          className={`drop-shadow-md ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Salad bowl */}
          <path d="M15 45 C15 78 30 88 50 88 C70 88 85 78 85 45 Z" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="2" />
          <ellipse cx="50" cy="45" rx="35" ry="12" fill="#e2e8f0" />
          {/* Fresh greens */}
          <circle cx="38" cy="42" r="14" fill="#22c55e" />
          <circle cx="58" cy="38" r="15" fill="#4ade80" />
          <circle cx="48" cy="44" r="14" fill="#16a34a" />
          {/* Cherry tomatoes */}
          <circle cx="42" cy="38" r="6" fill="#ef4444" />
          <circle cx="43" cy="37" r="1.5" fill="#fca5a5" />
          <circle cx="62" cy="45" r="5" fill="#ef4444" />
          <circle cx="63" cy="44" r="1.2" fill="#fca5a5" />
          {/* Cucumber slices */}
          <circle cx="32" cy="48" r="5" fill="#86efac" stroke="#15803d" strokeWidth="1.5" />
          <circle cx="52" cy="32" r="5.5" fill="#86efac" stroke="#15803d" strokeWidth="1.5" />
        </svg>
      );

    case 'pizza':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          className={`drop-shadow-md ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Crust */}
          <path d="M18 28 C38 18 62 18 82 28 C74 34 26 34 18 28 Z" fill="#b45309" stroke="#78350f" strokeWidth="1.5" />
          {/* Cheese slice */}
          <path d="M20 31 C40 24 60 24 80 31 L50 86 Z" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
          {/* Pepperoni */}
          <circle cx="42" cy="45" r="7" fill="#dc2626" />
          <circle cx="44" cy="44" r="2" fill="#f87171" opacity="0.6" />
          <circle cx="60" cy="50" r="6.5" fill="#dc2626" />
          <circle cx="61" cy="49" r="1.8" fill="#f87171" opacity="0.6" />
          <circle cx="48" cy="66" r="5.5" fill="#dc2626" />
          {/* Basil herbs */}
          <ellipse cx="36" cy="38" rx="3" ry="1.5" fill="#15803d" transform="rotate(30 36 38)" />
          <ellipse cx="52" cy="54" rx="3" ry="1.5" fill="#15803d" transform="rotate(-40 52 54)" />
        </svg>
      );

    default:
      return <div className="w-8 h-8 rounded-full bg-amber-400" />;
  }
};
