import { useStore } from '../store/useStore';
import { useTranslation } from 'react-i18next';
import { Heart, ShoppingBag, ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import ProductCard from '../components/ProductCard';
import { motion } from 'motion/react';

export default function Wishlist() {
  const { wishlist, products } = useStore();
  const { t } = useTranslation();

  const wishlistedProducts = products.filter((p) => wishlist.includes(p.id));

  return (
    <div className="bg-slate-50 min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <Heart className="w-8 h-8 text-red-500 fill-red-500" />
              {t('wishlist.title') || 'Your Wishlist'}
            </h1>
            <p className="text-slate-500 mt-2 font-medium">
              {wishlistedProducts.length} {t('wishlist.itemsFound') || 'items found in your wishlist'}
            </p>
          </div>
          <Link 
            to="/store"
            className="flex items-center gap-2 text-indigo-600 font-bold hover:text-indigo-800 transition-colors"
          >
            {t('wishlist.continueShopping') || 'Continue Shopping'}
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </Link>
        </header>

        {wishlistedProducts.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
            {wishlistedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[3rem] p-12 text-center border border-slate-100 shadow-sm"
          >
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Heart className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              {t('wishlist.emptyTitle') || 'Your wishlist is empty'}
            </h2>
            <p className="text-slate-500 mb-8 max-w-sm mx-auto">
              {t('wishlist.emptyDesc') || 'Explore our collection and add products you love to your wishlist!'}
            </p>
            <Link 
              to="/store"
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-slate-900 transition-all shadow-xl shadow-indigo-200 active:scale-95"
            >
              <ShoppingBag className="w-5 h-5" />
              {t('wishlist.browseStore') || 'Browse Store'}
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}
