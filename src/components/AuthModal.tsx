import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  Lock, 
  User, 
  Sparkles, 
  CheckCircle2, 
  ShieldCheck, 
  KeyRound, 
  Briefcase, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Zap, 
  AlertCircle,
  Building2,
  ShoppingBag
} from 'lucide-react';
import { AuthUser, EmployeeUser, Language, GiftItem } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onAuthSuccess: (user: AuthUser) => void;
  employees: EmployeeUser[];
  pendingGift?: GiftItem | null;
  initialTab?: 'buyer' | 'staff';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  lang,
  onAuthSuccess,
  employees,
  pendingGift,
  initialTab = 'buyer'
}) => {
  // Main context: 'buyer' (عميل / مشتري) or 'staff' (موظف / مصمم المنصة)
  const [mainRole, setMainRole] = useState<'buyer' | 'staff'>(initialTab);

  // For buyer: 'login' or 'register'
  const [buyerMode, setBuyerMode] = useState<'login' | 'register'>('register');

  // Buyer Form fields
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPassword, setBuyerPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Staff Form fields
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);

  if (!isOpen) return null;

  // 1. One-Click Instant Trial Account (إنشاء حساب تجربة فوري بنقرة واحدة للمشتري)
  const handleCreateTrialAccount = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const trialUser: AuthUser = {
      id: `TRIAL-BUYER-${randomNum}`,
      name: lang === 'ar' ? `مشتري تجريبي (${randomNum})` : `Demo Buyer (${randomNum})`,
      email: `demo.buyer.${randomNum}@streamgifts.com`,
      role: 'buyer',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160&auto=format&fit=crop&q=80',
      isTrial: true
    };

    onAuthSuccess(trialUser);
    onClose();
  };

  // 2. Buyer Regular Sign Up / Login Submit
  const handleBuyerSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (buyerMode === 'register') {
      if (!buyerName.trim()) {
        alert(lang === 'ar' ? 'يرجى إدخال اسمك' : 'Please enter your name');
        return;
      }
      if (!buyerEmail.trim()) {
        alert(lang === 'ar' ? 'يرجى إدخال البريد الإلكتروني' : 'Please enter your email');
        return;
      }
      if (buyerPassword.length < 4) {
        alert(lang === 'ar' ? 'كلمة المرور يجب أن تكون 4 أحرف على الأقل' : 'Password must be at least 4 characters');
        return;
      }

      const newUser: AuthUser = {
        id: `BUYER-${Date.now().toString().slice(-6)}`,
        name: buyerName.trim(),
        email: buyerEmail.trim(),
        role: 'buyer',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80',
        isTrial: false
      };

      onAuthSuccess(newUser);
      onClose();
    } else {
      // Buyer Login
      if (!buyerEmail.trim()) {
        alert(lang === 'ar' ? 'يرجى إدخال البريد الإلكتروني' : 'Please enter your email');
        return;
      }
      const existingUser: AuthUser = {
        id: `BUYER-${Math.floor(1000 + Math.random() * 9000)}`,
        name: buyerEmail.split('@')[0] || 'عميل المتجر',
        email: buyerEmail.trim(),
        role: 'buyer',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80',
        isTrial: false
      };

      onAuthSuccess(existingUser);
      onClose();
    }
  };

  // 3. Staff Member Login Submit (تحقق من البريد وكلمة السر المعتمدة)
  const handleStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError(null);

    const emailQuery = staffEmail.trim().toLowerCase();
    const passQuery = staffPassword.trim();

    // Check in employees list
    const matchedEmployee = employees.find(
      (emp) => emp.email.toLowerCase() === emailQuery
    );

    if (!matchedEmployee) {
      setStaffError(
        lang === 'ar'
          ? 'لم يتم العثور على حساب موظف مسجل بهذا البريد الإلكتروني. يرجى مراجعة إدارة المنصة أو استخدام أحد الحسابات التجريبية بالأسفل.'
          : '未找到该邮箱对应的员工账号，请核对或使用下方快捷测试账号。'
      );
      return;
    }

    // Verify password if assigned
    const expectedPassword = matchedEmployee.password || '123456';
    if (expectedPassword !== passQuery) {
      setStaffError(
        lang === 'ar'
          ? `كلمة المرور غير صحيحة لحساب [${matchedEmployee.name}]. يرجى التأكد من كلمة المرور.`
          : '密码错误，请核对后重试。'
      );
      return;
    }

    // Success! Log in as staff
    const staffUser: AuthUser = {
      id: matchedEmployee.id,
      name: matchedEmployee.name,
      email: matchedEmployee.email,
      role: matchedEmployee.role,
      avatar: matchedEmployee.avatar,
      whatsapp: matchedEmployee.whatsapp,
      employeeId: matchedEmployee.id
    };

    onAuthSuccess(staffUser);
    onClose();
  };

  // Quick fill staff demo credentials
  const fillStaffCredentials = (emp: EmployeeUser) => {
    setStaffEmail(emp.email);
    setStaffPassword(emp.password || '123456');
    setStaffError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-lg rounded-3xl bg-[#0f131c] border border-slate-700/80 shadow-2xl overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors border border-slate-700/50"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Purchase Intent Notice Banner */}
        {pendingGift && (
          <div className="bg-gradient-to-r from-cyan-950/90 via-blue-950/90 to-slate-900 border-b border-cyan-500/40 p-3.5 px-5 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div className="text-xs">
              <p className="font-bold text-white">
                {lang === 'ar' ? 'متابعة شراء واستلام ترخيص:' : 'Continuing Purchase:'}
              </p>
              <p className="text-cyan-300 truncate max-w-xs sm:max-w-sm">
                {pendingGift.title} • <span className="font-mono font-bold">${pendingGift.price}</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {lang === 'ar'
                  ? 'سجّل دخولك أو أنشئ حساباً تجريبياً فورياً بنقرة واحدة لتصلك روابط التحميل والشهادة.'
                  : '请登录或使用一键免密试用账号以继续订单并获取下载包。'}
              </p>
            </div>
          </div>
        )}

        {/* Top Header */}
        <div className="p-6 pt-7 text-center border-b border-slate-800/80">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 flex items-center justify-center text-white mb-3 shadow-lg shadow-cyan-500/20">
            <KeyRound className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-black text-white tracking-tight">
            {lang === 'ar' ? 'بوابة الحسابات والدخول' : '平台统一登录与账户中心'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {lang === 'ar' 
              ? 'اختر نوع الحساب: عميل مشتري للهدايا، أو حساب موظف/مصمم معتمد'
              : '请选择您的身份角色：买家客户或平台设计师与员工'}
          </p>
        </div>

        {/* Role Selection Tabs (Buyer vs Staff) */}
        <div className="grid grid-cols-2 p-1.5 mx-6 mt-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setMainRole('buyer');
              setStaffError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all ${
              mainRole === 'buyer'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'مشتري / عميل هدايا' : '买家 / 主播客户'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMainRole('staff');
              setStaffError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all ${
              mainRole === 'staff'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'موظف / مصمم المنصة' : '平台设计师 / 员工'}</span>
          </button>
        </div>

        {/* Main Body */}
        <div className="p-6">
          {/* ============================================================ */}
          {/* TAB 1: BUYER (عميل هدايا) */}
          {/* ============================================================ */}
          {mainRole === 'buyer' && (
            <div className="space-y-5">
              {/* Special One-Click Trial Account Button (Requested explicitly by user!) */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-cyan-500/15 to-blue-500/15 border border-cyan-500/50 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl pointer-events-none"></div>
                
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-cyan-500 flex items-center justify-center text-slate-950 font-black shrink-0 shadow-md">
                    <Zap className="w-5 h-5 fill-current" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-white">
                        {lang === 'ar' ? 'حساب تجريبي فوري بنقرة واحدة (بدون تسجيل)' : '一键极速体验账号 (无需注册)'}
                      </h4>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-400/20 text-cyan-300 font-bold border border-cyan-400/30">
                        {lang === 'ar' ? 'فوري' : 'HOT'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {lang === 'ar'
                        ? 'جرّب المتجر، تصفح براحتك، وجرب إتمام الشراء الفوري واستلام شهادة الترخيص بضغطة زر واحدة!'
                        : '一键生成免密测试账号，立即体验完整商城浏览、下单交付与证书生成流程！'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCreateTrialAccount}
                  className="mt-3 w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 text-xs font-black shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  <span>{lang === 'ar' ? '🚀 إنشاء حساب تجربة فوري والدخول مباشرة' : '🚀 一键生成体验账号并立即进入'}</span>
                </button>
              </div>

              {/* Divider */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-3 text-[11px] text-slate-400 font-medium">
                  {lang === 'ar' ? 'أو سجل بحسابك الدائم' : '或使用常规账号'}
                </span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              {/* Toggle Login / Register */}
              <div className="flex justify-center gap-4 text-xs">
                <button
                  type="button"
                  onClick={() => setBuyerMode('register')}
                  className={`pb-1 font-bold border-b-2 transition-all ${
                    buyerMode === 'register'
                      ? 'border-cyan-400 text-cyan-300'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  {lang === 'ar' ? 'إنشاء حساب جديد' : '注册新账号'}
                </button>
                <button
                  type="button"
                  onClick={() => setBuyerMode('login')}
                  className={`pb-1 font-bold border-b-2 transition-all ${
                    buyerMode === 'login'
                      ? 'border-cyan-400 text-cyan-300'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  {lang === 'ar' ? 'تسجيل الدخول' : '已有账号登录'}
                </button>
              </div>

              {/* Buyer Form */}
              <form onSubmit={handleBuyerSubmit} className="space-y-3.5 text-xs">
                {buyerMode === 'register' && (
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      {lang === 'ar' ? 'اسمك أو اسم القناة / الوكالة *' : '您的昵称 / 主播频道名 *'}
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        placeholder="مثال: يوسف ستريمر / وكالة النجوم"
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    {lang === 'ar' ? 'البريد الإلكتروني *' : '电子邮箱 *'}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={buyerEmail}
                      onChange={(e) => setBuyerEmail(e.target.value)}
                      placeholder="buyer@domain.com"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    {lang === 'ar' ? 'كلمة المرور *' : '密码 *'}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={buyerPassword}
                      onChange={(e) => setBuyerPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {buyerMode === 'register'
                      ? (lang === 'ar' ? 'إنشاء الحساب ومتابعة الاستكشاف والشراء' : '完成注册并进入商城')
                      : (lang === 'ar' ? 'تسجيل الدخول' : '立即登录')}
                  </span>
                </button>
              </form>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 2: STAFF & DESIGNERS (موظف ومصمم المنصة) */}
          {/* ============================================================ */}
          {mainRole === 'staff' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-slate-300 space-y-1">
                <p className="text-emerald-300 font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>{lang === 'ar' ? 'دخول المصممين وموظفي وإدارة المنصة' : '平台创作者与员工专属通道'}</span>
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {lang === 'ar' 
                    ? 'أدخل البريد الإلكتروني وكلمة المرور التي تم تحديدها لك من قبل إدارة المنصة في لوحة التحكم للوصول ورفع الهدايا باسمك.' 
                    : '请输入管理员在后台为您创建的员工邮箱与密码，登录后可管理素材并自动绑定您的WhatsApp。'}
                </p>
              </div>

              {/* Error Message */}
              {staffError && (
                <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs flex items-start gap-2 animate-shake">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{staffError}</span>
                </div>
              )}

              {/* Staff Form */}
              <form onSubmit={handleStaffSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    {lang === 'ar' ? 'بريد الموظف / المصمم المسجل *' : '员工登录邮箱 *'}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      placeholder="sarah.vfx@streamgifts.com"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    {lang === 'ar' ? 'كلمة المرور *' : '登录密码 *'}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showStaffPassword ? 'text' : 'password'}
                      required
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStaffPassword(!showStaffPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showStaffPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <Briefcase className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'دخول لوحة تحكم المنصة' : '登录并进入后台'}</span>
                </button>
              </form>

              {/* Quick-fill Demo Staff Accounts for effortless test */}
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <p className="text-[11px] text-slate-400 font-semibold">
                  {lang === 'ar' ? '⚡ حسابات تجريبية سريعة للموظفين (نقرة واحدة للملء):' : '⚡ 预置测试员工账号 (点击一键填入):'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {employees.slice(0, 4).map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => fillStaffCredentials(emp)}
                      className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-left transition-all flex items-center gap-2.5 group"
                    >
                      <img
                        src={emp.avatar}
                        alt={emp.name}
                        className="w-7 h-7 rounded-lg object-cover border border-slate-700 shrink-0"
                      />
                      <div className="overflow-hidden">
                        <div className="text-[11px] font-bold text-white truncate group-hover:text-emerald-300">
                          {emp.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          {emp.email}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
