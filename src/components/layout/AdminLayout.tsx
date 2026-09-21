import { Outlet, Link, useLocation } from 'react-router';
import { 
  LayoutDashboard, ShoppingBag, Users, Key, Settings,
  LogOut, Home, BarChart3, Tag, Menu, X, Image, Megaphone
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useStore } from '../../store/useStore';
import { useState, useEffect } from 'react';

export default function AdminLayout() {
  const location = useLocation();
  const { logout, user, siteName, siteLogo } = useStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close sidebar on route change on mobile
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const links = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Products', path: '/admin/products', icon: ShoppingBag },
    { name: 'Orders', path: '/admin/orders', icon: BarChart3 },
    { name: 'Announcements', path: '/admin/announcements', icon: Megaphone },
    { name: 'Payment Methods', path: '/admin/payment-methods', icon: Key },
    { name: 'Banners', path: '/admin/banners', icon: Image },
    { name: 'Users', path: '/admin/users', icon: Users },
    { name: 'Promotions', path: '/admin/promos', icon: Tag },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 lg:w-64 bg-slate-900 text-slate-300 flex flex-col items-stretch shadow-2xl lg:shadow-none transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between px-6 py-8">
          <div className="flex items-center gap-3">
            {siteLogo ? (
              <img src={siteLogo} alt={siteName} className="h-8 w-auto object-contain" />
            ) : (
              <div className="w-8 h-8 rounded bg-indigo-500 flex items-center justify-center text-white shrink-0">
                <Key className="w-4 h-4" />
              </div>
            )}
            <span className="text-white font-bold text-xl tracking-wide">{siteName}</span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-1 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-4 overflow-y-auto">
          <div className="px-3 mb-4 mt-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest text-left">Admin Panel</p>
          </div>
          {links.map((link) => {
            const Icon = link.icon;
            const active = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group",
                  active 
                    ? "bg-indigo-500/10 text-indigo-400" 
                    : "hover:bg-slate-800 hover:text-white"
                )}
              >
                <Icon className={cn("w-5 h-5 shrink-0 transition-colors", active ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300")} />
                {link.name}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto p-4 border-t border-slate-800">
          <Link to="/" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-all group">
            <Home className="w-5 h-5 text-slate-500 shrink-0 group-hover:text-slate-300" />
            Back to Store
          </Link>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all text-left mt-1 group"
          >
            <LogOut className="w-5 h-5 text-slate-500 shrink-0 group-hover:text-red-400" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top header */}
        <header className="h-16 lg:h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 shadow-sm shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-indigo-600 transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-lg lg:text-xl font-bold text-slate-800 truncate">
              {links.find(l => l.path === location.pathname)?.name || 'Admin'}
            </h2>
          </div>
          <div className="flex items-center gap-3 lg:gap-4 shrink-0">
            <span className="hidden sm:inline-flex text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
              {user?.email}
            </span>
            <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm shadow-sm ring-2 ring-white">
              {user?.name.charAt(0)}
            </div>
          </div>
        </header>
        
        {/* Scrollable content area */}
        <div className="flex-1 overflow-x-hidden overflow-y-auto p-4 lg:p-8 relative">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
