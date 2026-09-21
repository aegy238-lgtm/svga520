import { useStore } from '../store/useStore';
import { Search, Filter } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ProductCard from '../components/ProductCard';

export default function Store() {
  const { products } = useStore();
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories: string[] = Array.from(new Set(products.map(p => p.category)));

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory ? p.category === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col gap-8 mb-12">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-black text-slate-900 mb-2 tracking-tight">{t('store.title')}</h1>
          <p className="text-sm sm:text-base text-slate-500 max-w-2xl font-medium">{t('store.desc')}</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder={t('store.search')} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white bg-white/50 outline-none transition-all shadow-sm font-medium"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
            {['', ...categories].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat || null)}
                className={`flex-shrink-0 px-5 py-3 rounded-2xl text-xs sm:text-sm font-black transition-all border-2 ${
                  (selectedCategory === cat || (cat === '' && !selectedCategory))
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' 
                    : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'
                }`}
              >
                {cat || t('store.allProducts')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-12">
        {filteredProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      
      {filteredProducts.length === 0 && (
        <div className="text-center py-24 bg-slate-50 rounded-3xl border border-slate-200 border-dashed">
          <Search className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">{t('store.noProducts')}</h3>
          <p className="text-slate-500">{t('store.noProducts')}</p>
          <button 
            onClick={() => { setSearchTerm(''); setSelectedCategory(null); }}
            className="mt-6 px-6 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            {t('store.allProducts')}
          </button>
        </div>
      )}
    </div>
  );
}
