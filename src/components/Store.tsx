import React, { useState, useEffect } from 'react';
import { UserRecord, StoreProduct, PRODUCT_CATEGORIES, AppSettings } from '../types';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy, getDoc, doc } from 'firebase/firestore';
import { ProductModal } from './ProductModal';

interface StoreProps {
  currentUser: UserRecord | null;
  onLoginRequired: () => void;
}

export const Store: React.FC<StoreProps> = ({ currentUser, onLoginRequired }) => {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>(PRODUCT_CATEGORIES[0]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [productsSnap, settingsSnap] = await Promise.all([
          getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc'))),
          getDoc(doc(db, 'settings', 'global'))
        ]);
        setProducts(productsSnap.docs.map(d => ({ id: d.id, ...d.data() } as StoreProduct)));
        if (settingsSnap.exists()) setSettings(settingsSnap.data() as AppSettings);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredProducts = activeCategory === 'القسم الرئيسي' 
    ? products 
    : products.filter(p => p.category === activeCategory);

  return (
    <div className="w-full h-full flex flex-col text-white">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-black tracking-tight mb-2">المتجر</h2>
          <p className="text-slate-400">تصفح أحدث القوالب والإضافات</p>
        </div>
      </div>
      
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {PRODUCT_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center p-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-slate-900/60 border border-white/10 rounded-2xl overflow-hidden group hover:border-indigo-500/40 transition-all duration-300 flex flex-col shadow-xl">
              {/* Square, eye-friendly, spacious gift display container matching gift dimensions */}
              <div 
                className="aspect-square w-full bg-slate-950 relative overflow-hidden cursor-pointer flex items-center justify-center p-3" 
                onClick={() => setSelectedProduct(product)}
              >
                <img 
                  src={product.imageUrl} 
                  alt={product.name} 
                  className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" 
                />
                
                {/* Format Badges in top-start */}
                <div className="absolute top-2.5 start-2.5 z-10 flex flex-wrap gap-1 pointer-events-none">
                  {product.supportedFormats?.slice(0, 2).map(format => (
                    <span key={format} className="px-2 py-0.5 bg-indigo-500/80 backdrop-blur-sm text-white rounded-md text-[10px] font-bold border border-indigo-400/40 shadow-sm">
                      {format}
                    </span>
                  ))}
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <span className="px-4 py-1.5 rounded-xl bg-indigo-600/90 text-white font-bold text-sm shadow-lg backdrop-blur-sm">
                    معاينة الهدية 👁️
                  </span>
                </div>
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-base text-white mb-2 line-clamp-1">{product.name}</h3>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <span className="text-emerald-400 font-extrabold text-base">${product.price}</span>
                  <button 
                    onClick={() => setSelectedProduct(product)}
                    className="px-3.5 py-1.5 bg-indigo-600/80 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                  >
                    تفاصيل وشراء
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-full text-center py-20 text-slate-500">لا توجد منتجات في هذا التصنيف</div>
          )}
        </div>
      )}

      {selectedProduct && (
        <ProductModal 
          product={selectedProduct} 
          whatsappNumber={settings?.whatsappNumber || ''} 
          onClose={() => setSelectedProduct(null)} 
        />
      )}
    </div>
  );
};
