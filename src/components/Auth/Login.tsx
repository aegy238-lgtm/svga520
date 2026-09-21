import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Eye, EyeOff, Lock, Mail, ArrowRight } from 'lucide-react';

interface LoginProps {
  onToggle: () => void;
}

export const Login: React.FC<LoginProps> = ({ onToggle }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanPass = password.trim();

    if (!cleanEmail || !cleanPass) {
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await login(cleanEmail, cleanPass);
    } catch (err: any) {
      console.error("Login Error:", err);
      setError(err.message || 'فشل تسجيل الدخول. يرجى التحقق من البريد الإلكتروني وكلمة المرور.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl w-full">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-black text-white mb-2 tracking-tight">تسجيل الدخول</h2>
        <p className="text-slate-400 text-sm">مرحباً بعودتك إلى النظام</p>
      </div>

      {error && (
        <div className="bg-red-500/15 border border-red-500/30 text-red-300 p-4 rounded-xl mb-6 text-sm text-center leading-relaxed font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">
            البريد الإلكتروني
          </label>
          <div className="relative">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950/70 border border-white/10 rounded-xl pl-4 pr-11 py-3 text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-sans"
              placeholder="name@example.com"
              autoComplete="email"
              dir="ltr"
              required
            />
            <Mail className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="block text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">
            كلمة المرور
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950/70 border border-white/10 rounded-xl pl-11 pr-11 py-3 text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono"
              placeholder="••••••••"
              autoComplete="current-password"
              dir="ltr"
              required
            />
            <Lock className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute left-3.5 top-3.5 text-slate-400 hover:text-white transition-colors"
              title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            >
              {showPassword ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4 flex items-center justify-center gap-2"
        >
          {loading ? (
            <span>جاري التحقق والدخول...</span>
          ) : (
            <>
              <span>دخول</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 text-center">
        <p className="text-slate-400 text-sm">
          ليس لديك حساب؟{' '}
          <button
            onClick={onToggle}
            className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors underline-offset-4 hover:underline"
          >
            إنشاء حساب جديد
          </button>
        </p>
      </div>
    </div>
  );
};

