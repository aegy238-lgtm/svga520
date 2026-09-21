import { Link, Outlet, useLocation } from 'react-router';
import { useStore } from '../../store/useStore';
import { 
  ShoppingCart, Menu, UserCircle, Search, Key, LayoutDashboard, ShieldCheck, X, Globe, Heart
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import WhatsAppWidget from '../WhatsAppWidget';
import { useTranslation } from 'react-i18next';

export default function MainLayout() {
  const { cart, user, logout, siteName, siteLogo, wishlist } = useStore();
  const { t, i18n } = useTranslation();
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const wishlistCount = wishlist.length;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar');
  };

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      // Prevent scrolling on html element as well for some mobile browsers
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => { 
      document.body.style.overflow = ''; 
      document.documentElement.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const navLinks = [
    { name: t('nav.home'), path: '/' },
    { name: t('nav.store'), path: '/store' },
    { name: t('nav.categories'), path: '/store?categories=true' },
    { name: t('nav.contact'), path: '/contact' },
  ];

  return (
    <div className={`min-h-screen bg-slate-50 flex flex-col ${i18n.language === 'ar' ? 'font-arabic' : 'font-sans'} text-slate-900 selection:bg-indigo-100 selection:text-indigo-900`}>
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            <Link to="/" className="flex items-center gap-2 flex-shrink-0 z-50 relative">
              {siteLogo ? (
                <img src={siteLogo} alt={siteName} className="h-7 sm:h-8 w-auto object-contain" />
              ) : (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-sm shadow-indigo-600/20">
                  <Key className="w-4 h-4 sm:w-5 h-5" />
                </div>
              )}
              <span className="font-display font-black text-lg sm:text-xl tracking-tight text-slate-900">{siteName}</span>
            </Link>

            <nav className="hidden md:flex gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={cn(
                    "text-sm font-semibold transition-colors hover:text-indigo-600 block py-2",
                    location.pathname === link.path ? "text-indigo-600" : "text-slate-600"
                  )}
                >
                  {link.name}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-3 sm:gap-4 z-50 relative">
              <button onClick={toggleLanguage} className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors flex font-bold text-sm items-center gap-2">
                 <Globe className="w-5 h-5" />
                 <span className="hidden sm:inline">{i18n.language === 'ar' ? 'EN' : 'عربي'}</span>
              </button>
              
              <Link to="/wishlist" className="relative text-slate-600 hover:text-red-500 transition-colors flex items-center p-2 rounded-full hover:bg-slate-100">
                <Heart className={cn("w-5 h-5 sm:w-6 sm:h-6", wishlistCount > 0 && "fill-red-500 text-red-500")} />
                {wishlistCount > 0 && (
                  <span className="absolute top-0 right-0 sm:right-0.5 inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 text-[10px] sm:text-xs font-bold leading-none text-white transform bg-red-500 rounded-full border-2 border-white shadow-sm">
                    {wishlistCount}
                  </span>
                )}
              </Link>

              <Link to="/cart" className="relative text-slate-600 hover:text-indigo-600 transition-colors flex items-center p-2 rounded-full hover:bg-slate-100">
                <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" />
                {cartItemsCount > 0 && (
                  <span className="absolute top-0 right-0 sm:right-0.5 inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 text-[10px] sm:text-xs font-bold leading-none text-white transform bg-indigo-600 rounded-full border-2 border-white shadow-sm">
                    {cartItemsCount}
                  </span>
                )}
              </Link>
              
              <div className="hidden sm:block h-6 w-px bg-slate-200 mx-1"></div>

              {user ? (
                <div className="hidden sm:flex items-center gap-2">
                  <Link 
                    to={user.role === 'admin' ? "/admin" : "/dashboard"} 
                    className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-indigo-600 transition-colors py-2 px-3 rounded-xl hover:bg-indigo-50"
                  >
                    <UserCircle className="w-5 h-5 text-indigo-600" />
                    <span>{user.name}</span>
                  </Link>
                  <button 
                    onClick={() => logout()}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    title={t('nav.signOut')}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-3">
                  <Link to="/login" className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors">
                    {t('nav.login')}
                  </Link>
                  <Link 
                    to="/register" 
                    className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-xl hover:bg-indigo-600 transition duration-300 ease-in-out shadow-md shadow-slate-900/10"
                  >
                    {t('nav.register')}
                  </Link>
                </div>
              )}

              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors flex-shrink-0"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute top-[65px] left-0 right-0 bg-white border-b border-slate-200 shadow-2xl md:hidden z-40 max-h-[85vh] overflow-y-auto"
            >
              <div className="px-4 py-6 flex flex-col gap-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest pl-3 mb-2">Navigation</p>
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={cn(
                      "block px-4 py-3 rounded-xl text-base font-bold transition-colors",
                      location.pathname === link.path ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    {link.name}
                  </Link>
                ))}

                <Link
                  to="/wishlist"
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-base font-bold transition-colors",
                    location.pathname === '/wishlist' ? "bg-red-50 text-red-700" : "text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <Heart className={cn("w-5 h-5", wishlistCount > 0 && "fill-red-500 text-red-500")} />
                  <span>{t('wishlist.title') || 'Wishlist'}</span>
                  {wishlistCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{wishlistCount}</span>
                  )}
                </Link>
                
                <div className="h-px bg-slate-100 my-4 mx-2"></div>
                
                {!user ? (
                   <div className="flex flex-col gap-3 px-2">
                    <Link to="/login" className="flex items-center justify-center w-full py-3.5 rounded-xl text-base font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">{t('nav.login')}</Link>
                    <Link to="/register" className="flex items-center justify-center w-full py-3.5 rounded-xl text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20">{t('nav.register')}</Link>
                   </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest pl-3 mb-2 mt-2">My Account</p>
                    <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3 mb-2">
                       <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold shrink-0">{user.name.charAt(0)}</div>
                       <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{user.name}</p>
                          <p className="text-xs text-slate-500 truncate">{user.email}</p>
                       </div>
                    </div>
                    <Link to={user.role === 'admin' ? "/admin" : "/dashboard"} className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                      <LayoutDashboard className="w-5 h-5 shrink-0"/>
                      {user.role === 'admin' ? t('nav.adminLogin') : t('nav.dashboard')}
                    </Link>
                    <button onClick={() => { logout(); setIsMobileMenuOpen(false); }} className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-bold text-red-600 hover:bg-red-50 transition-colors text-left">
                      {t('nav.signOut')}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 top-[65px] bg-slate-900/20 backdrop-blur-sm z-30" onClick={() => setIsMobileMenuOpen(false)} />
        )}
      </header>

      <main className="flex-grow flex flex-col w-full relative z-0">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-slate-200 mt-20 relative z-10 w-full overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
            <div className="col-span-1 md:col-span-1">
              <Link to="/" className="flex items-center gap-2 mb-4 w-fit">
                {siteLogo ? (
                  <img src={siteLogo} alt={siteName} className="h-6 w-auto object-contain" />
                ) : (
                  <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center text-white font-bold">
                    <Key className="w-3 h-3" />
                  </div>
                )}
                <span className="font-bold text-lg tracking-tight text-slate-900">{siteName}</span>
              </Link>
              <p className="text-sm text-slate-500 mb-6 max-w-sm">
                {t('footer.desc')}
              </p>
              <div className="flex flex-wrap gap-2">
                <div className="h-8 px-3 rounded border border-slate-200 flex items-center text-xs font-semibold text-slate-500 bg-slate-50">{t('footer.stripe')}</div>
                <div className="h-8 px-3 rounded border border-slate-200 flex items-center text-xs font-semibold text-slate-500 bg-slate-50">{t('footer.paypal')}</div>
                <div className="h-8 px-3 rounded border border-slate-200 flex items-center text-xs font-semibold text-slate-500 bg-slate-50">{t('footer.secure')}</div>
              </div>
            </div>
            
            <div>
              <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wider">{t('footer.store')}</h3>
              <ul className="space-y-3 text-sm text-slate-500">
                <li><Link to="/store?cat=AI Tools" className="hover:text-indigo-600 transition font-medium">{t('home.aiTools')}</Link></li>
                <li><Link to="/store?cat=Design Tools" className="hover:text-indigo-600 transition font-medium">Design Software</Link></li>
                <li><Link to="/store?cat=Operating Systems" className="hover:text-indigo-600 transition font-medium">Operating Systems</Link></li>
                <li><Link to="/store?cat=Security" className="hover:text-indigo-600 transition font-medium">Security</Link></li>
                <li><Link to="/store?cat=Productivity" className="hover:text-indigo-600 transition font-medium">Productivity</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wider">{t('footer.support')}</h3>
              <ul className="space-y-3 text-sm text-slate-500">
                <li><Link to="/faq" className="hover:text-indigo-600 transition font-medium">{t('footer.faq')}</Link></li>
                <li><Link to="/contact" className="hover:text-indigo-600 transition font-medium">{t('nav.contact')}</Link></li>
                <li><Link to="/refund" className="hover:text-indigo-600 transition font-medium">{t('footer.refund')}</Link></li>
                <li><Link to="/terms" className="hover:text-indigo-600 transition font-medium">{t('footer.terms')}</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wider">{t('footer.members')}</h3>
              <ul className="space-y-3 text-sm text-slate-500">
                <li><Link to="/dashboard" className="hover:text-indigo-600 transition font-medium">{t('nav.myAccount')}</Link></li>
                <li><Link to="/dashboard" className="hover:text-indigo-600 transition font-medium">{t('footer.orderHistory')}</Link></li>
                <li><Link to="/affiliate" className="hover:text-indigo-600 transition font-medium">{t('footer.affiliate')}</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
            <p className="text-sm font-medium text-slate-400">
              © {new Date().getFullYear()} {siteName}. {t('footer.rights')}
            </p>
            <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
               <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-500"/> {t('footer.ssl')}</span>
            </div>
          </div>
        </div>
      </footer>
      
      <WhatsAppWidget />
    </div>
  );
}
