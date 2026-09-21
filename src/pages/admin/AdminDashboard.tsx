import { BarChart3, ShoppingBag, Users, DollarSign, Activity, Settings, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';

export default function AdminDashboard() {
  const { allOrders, products, paymentMethods, clearStatistics } = useStore();
  const { t } = useTranslation();
  const [isClearing, setIsClearing] = useState(false);

  const handleClearStatistics = async () => {
    if (window.confirm('هل أنت متأكد من حذف جميع الإحصائيات ومعلومات الشراء بشكل نهائي؟')) {
      setIsClearing(true);
      try {
        await clearStatistics();
      } catch (err) {
        console.error(err);
      } finally {
        setIsClearing(false);
      }
    }
  };

  const totalRevenue = allOrders.reduce((sum, o) => sum + o.total, 0);
  const totalOrders = allOrders.length;
  const activeProducts = products.length;

  const stats = [
    { name: t('admin.totalRevenue'), value: `${(totalRevenue || 0).toLocaleString()} ${t('common.currency')}`, icon: DollarSign, color: 'bg-emerald-500' },
    { name: t('admin.totalOrders'), value: (totalOrders || 0).toString(), icon: ShoppingBag, color: 'bg-blue-500' },
    { name: t('admin.activeProducts'), value: (activeProducts || 0).toString(), icon: Activity, color: 'bg-indigo-500' },
    { name: t('admin.paymentMethods'), value: (paymentMethods?.length || 0).toString(), icon: Settings, color: 'bg-purple-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('admin.dashboard')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('admin.welcome')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleClearStatistics}
            disabled={isClearing}
            className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-xl text-sm font-semibold transition-colors border border-red-200"
          >
            <Trash2 className="w-4 h-4" />
            {isClearing ? 'جاري الحذف...' : 'حذف الإحصائيات'}
          </button>
          <Link 
            to="/admin/products" 
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            {t('admin.addProduct')}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 ${stat.color} shadow-lg shadow-${stat.color.split('-')[1]}-500/30`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-500 tracking-wide uppercase truncate">{stat.name}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1 truncate">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            {t('admin.recentOrders')}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="pb-3 font-semibold">{t('admin.orderId')}</th>
                  <th className="pb-3 font-semibold">{t('common.total')}</th>
                  <th className="pb-3 font-semibold">{t('admin.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {allOrders.slice(0, 5).map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="py-3 font-medium text-slate-900">{order.id}</td>
                    <td className="py-3 text-slate-600">{(order.total || 0).toLocaleString()} {t('common.currency')}</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                        order.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                        order.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {order.status === 'Completed' ? t('dashboard.completed') : 
                         order.status === 'Pending' ? t('dashboard.pending') : t('dashboard.cancelled')}
                      </span>
                    </td>
                  </tr>
                ))}
                {allOrders.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-500 italic">{t('admin.noOrders')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
           <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-indigo-500" />
            {t('admin.productInventory')}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="pb-3 font-semibold">{t('admin.product')}</th>
                  <th className="pb-3 font-semibold">{t('admin.type')}</th>
                  <th className="pb-3 font-semibold">{t('admin.stock')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {products.slice(0, 5).map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50">
                    <td className="py-3 font-medium text-slate-900">{product.name}</td>
                    <td className="py-3 text-slate-600">{product.type}</td>
                    <td className="py-3 text-slate-600">{product.stock}</td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-500 italic">{t('admin.noProducts')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
