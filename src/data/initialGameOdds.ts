import { GameOddsConfig } from '../types';

export const INITIAL_GAME_ODDS: GameOddsConfig = {
  globalWinRate: 35, // 35% win rate default
  globalLossRate: 65, // 65% loss rate default
  disallowGuestWins: true, // حظر أي وينزات وهمية للمستخدم قبل إنشاء الحساب
  requireAccountToPlay: true, // إلزام تسجيل حساب حقيقي
  jackpotEnabled: true,
  jackpotOdds: 1.5,
  games: [
    {
      id: 'game-spin-wheel',
      name: 'Lucky Spin Wheel',
      nameAr: 'عجلة الحظ الدوارة',
      winRate: 35,
      lossRate: 65,
      maxMultiplier: 10,
      houseEdge: 8,
      status: 'active',
      icon: 'circle-dot',
      descriptionAr: 'عجلة الحظ للجوائز والهدايا والمكافآت السريعة',
      minBetCoins: 10
    },
    {
      id: 'game-mystery-crates',
      name: 'Mystery Loot Boxes',
      nameAr: 'صناديق الحظ والمفاجآت',
      winRate: 30,
      lossRate: 70,
      maxMultiplier: 25,
      houseEdge: 12,
      status: 'active',
      icon: 'package',
      descriptionAr: 'فتح صناديق عشوائية تحتوي على هدايا ومؤثرات حصرية',
      minBetCoins: 25
    },
    {
      id: 'game-roulette',
      name: 'Royal VIP Roulette',
      nameAr: 'روليت كازينو الألعاب الملكي',
      winRate: 40,
      lossRate: 60,
      maxMultiplier: 36,
      houseEdge: 5,
      status: 'active',
      icon: 'sparkles',
      descriptionAr: 'توقع الأرقام والألوان وسحب الأرباح الفورية',
      minBetCoins: 50
    },
    {
      id: 'game-dice-roll',
      name: 'Speed Dice',
      nameAr: 'نرد الحظ السريع',
      winRate: 45,
      lossRate: 55,
      maxMultiplier: 6,
      houseEdge: 4,
      status: 'active',
      icon: 'dices',
      descriptionAr: 'لعبة رمي النرد الفوري مع تحديد نسب الفوز والخسارة',
      minBetCoins: 15
    },
    {
      id: 'game-scratch-card',
      name: 'Instant Scratch Cards',
      nameAr: 'بطاقات الكشط الفوري',
      winRate: 28,
      lossRate: 72,
      maxMultiplier: 50,
      houseEdge: 15,
      status: 'active',
      icon: 'ticket',
      descriptionAr: 'كشط ثلاث خانات متطابقة للحصول على جائزة كبرى',
      minBetCoins: 20
    },
    {
      id: 'game-slots',
      name: 'Cyber Slots Machine',
      nameAr: 'ماكينة السلوتس الإلكترونية',
      winRate: 32,
      lossRate: 68,
      maxMultiplier: 100,
      houseEdge: 10,
      status: 'active',
      icon: 'flame',
      descriptionAr: 'ماكينة السلوتس ذات الجوائز التراكمية ونسبة الاسترداد RTP',
      minBetCoins: 30
    }
  ],
  updatedAt: new Date().toISOString()
};
