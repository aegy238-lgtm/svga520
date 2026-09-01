export const MAX_AMOUNT = 20000000000; // 20 Billion
export const MAX_LEVEL = 1000;

/**
 * Calculates level based on total amount.
 * Uses cubic root for better progression (early levels are easier).
 */
export function calculateLevel(amount: number = 0): number {
  if (amount <= 0) return 1;
  if (amount >= MAX_AMOUNT) return MAX_LEVEL;
  
  // Formula: Level = floor(pow(amount / MAX_AMOUNT, 1/3) * (MAX_LEVEL - 1)) + 1
  const level = Math.floor(Math.pow(amount / MAX_AMOUNT, 1/3) * (MAX_LEVEL - 1)) + 1;
  return Math.min(MAX_LEVEL, Math.max(1, level));
}

/**
 * Gets the progress percentage to the next level.
 */
export function getProgressToNextLevel(amount: number = 0): number {
  const currentLevel = calculateLevel(amount);
  if (currentLevel >= MAX_LEVEL) return 100;
  
  const currentLevelAmount = getAmountForLevel(currentLevel);
  const nextLevelAmount = getAmountForLevel(currentLevel + 1);
  
  const progress = ((amount - currentLevelAmount) / (nextLevelAmount - currentLevelAmount)) * 100;
  return Math.min(100, Math.max(0, progress));
}

/**
 * Gets the amount required for a specific level.
 */
export function getAmountForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level >= MAX_LEVEL) return MAX_AMOUNT;
  
  // Inverse of the level formula
  return Math.pow((level - 1) / (MAX_LEVEL - 1), 3) * MAX_AMOUNT;
}

/**
 * Gets the color associated with a level range.
 */
export function getLevelColor(level: number): { from: string, to: string, text: string, border: string } {
  if (level >= 900) return { from: 'from-red-600', to: 'to-rose-900', text: 'text-red-100', border: 'border-red-500' };
  if (level >= 800) return { from: 'from-purple-600', to: 'to-fuchsia-900', text: 'text-purple-100', border: 'border-purple-500' };
  if (level >= 700) return { from: 'from-pink-500', to: 'to-rose-600', text: 'text-pink-100', border: 'border-pink-400' };
  if (level >= 600) return { from: 'from-orange-500', to: 'to-red-600', text: 'text-orange-100', border: 'border-orange-400' };
  if (level >= 500) return { from: 'from-yellow-400', to: 'to-orange-500', text: 'text-yellow-900', border: 'border-yellow-300' };
  if (level >= 400) return { from: 'from-emerald-500', to: 'to-teal-700', text: 'text-emerald-100', border: 'border-emerald-400' };
  if (level >= 300) return { from: 'from-cyan-500', to: 'to-blue-600', text: 'text-cyan-100', border: 'border-cyan-400' };
  if (level >= 200) return { from: 'from-blue-500', to: 'to-indigo-700', text: 'text-blue-100', border: 'border-blue-400' };
  if (level >= 100) return { from: 'from-indigo-500', to: 'to-purple-700', text: 'text-indigo-100', border: 'border-indigo-400' };
  if (level >= 50) return { from: 'from-slate-600', to: 'to-slate-800', text: 'text-slate-100', border: 'border-slate-500' };
  return { from: 'from-gray-400', to: 'to-gray-600', text: 'text-white', border: 'border-gray-300' };
}
