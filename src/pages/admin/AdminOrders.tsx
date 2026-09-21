import { useStore } from '../../store/useStore';
import { ShoppingBag, Eye, CheckCircle, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Order } from '../../store/useStore';

export default function AdminOrders() {
  const { allOrders, updateOrderStatus } = useStore();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const handleStatusChange = (orderId: string, newStatus: Order['status']) => {
    updateOrderStatus(orderId, newStatus);
    if (selectedOrder?.id === orderId) {
      setSelectedOrder({ ...selectedOrder, status: newStatus });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
             <ShoppingBag className="w-6 h-6 text-indigo-500" />
             Orders Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">View and handle customer orders.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Order ID</th>
                <th className="px-6 py-4 font-semibold">Customer</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Total</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4 font-medium text-slate-900">{order.id}</td>
                  <td className="px-6 py-4 text-slate-600">{order.userEmail}</td>
                  <td className="px-6 py-4 text-slate-500">{new Date(order.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-bold text-slate-900">{(order.total || 0).toLocaleString()} EGP</td>
                  <td className="px-6 py-4">
                    <select 
                      value={order.status}
                      onChange={(e) => handleStatusChange(order.id, e.target.value as Order['status'])}
                      className={`text-xs font-bold rounded-full px-2 py-1 border-0 focus:ring-0 ${
                        order.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                        order.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Completed">Completed</option>
                      <option value="Failed">Failed</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setSelectedOrder(order)}
                      className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors font-medium text-xs flex items-center gap-1 ml-auto"
                    >
                      <Eye className="w-4 h-4" /> View
                    </button>
                  </td>
                </tr>
              ))}
              {allOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No orders have been placed yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/90 backdrop-blur z-10">
              <h2 className="text-xl font-bold text-slate-900">Order Details - {selectedOrder.id}</h2>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-2 gap-4 text-sm">
                <div>
                   <p className="text-slate-500 font-semibold mb-1">Customer Email</p>
                   <p className="text-slate-900 font-medium">{selectedOrder.userEmail}</p>
                </div>
                <div>
                   <p className="text-slate-500 font-semibold mb-1">Order Date</p>
                   <p className="text-slate-900 font-medium">{new Date(selectedOrder.date).toLocaleString()}</p>
                </div>
                <div>
                   <p className="text-slate-500 font-semibold mb-1">Payment Method</p>
                   <p className="text-slate-900 font-medium">{selectedOrder.method}</p>
                </div>
                <div>
                   <p className="text-slate-500 font-semibold mb-1">Status</p>
                   <p className="text-slate-900 font-medium">{selectedOrder.status}</p>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 mb-3 block">Ordered Items</h3>
                <div className="space-y-3">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl">
                       <div className="flex items-center gap-3">
                          <img src={item.product.imageUrl} className="w-10 h-10 rounded object-cover" />
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{item.product.name}</p>
                            <p className="text-xs text-slate-500">Qty: {item.quantity} {item.selectedDuration && ` | ${item.selectedDuration.label}`}</p>
                          </div>
                       </div>
                       <p className="font-bold text-slate-900">{(((item.selectedDuration?.price || item.product.price) || 0) * item.quantity).toLocaleString()} EGP</p>
                    </div>
                  ))}
                </div>
              </div>

              {selectedOrder.keys && selectedOrder.keys.length > 0 && (
                <div>
                  <h3 className="font-bold text-slate-900 mb-3 block">Delivered Keys/Accounts</h3>
                  <div className="space-y-2">
                    {selectedOrder.keys.map((key, idx) => (
                      <div key={idx} className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl font-mono text-sm text-indigo-800 break-all">
                         <span className="font-bold block text-xs text-indigo-400 mb-1">{key.productName}</span>
                         {key.value}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-between items-center">
              <p className="font-bold text-lg text-slate-900">Total: {(selectedOrder.total || 0).toLocaleString()} EGP</p>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleStatusChange(selectedOrder.id, 'Completed')} 
                  className="px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-xl flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" /> Mark Completed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
