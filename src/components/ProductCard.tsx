import React, { useState } from 'react';
import { Link } from 'react-router';
import { Star, Heart, ShoppingCart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Product } from '../data/mockData';
import { useStore } from '../store/useStore';
import { motion } from 'motion/react';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { t } = useTranslation();
  const { addToCart, wishlist, toggleWishlist } = useStore();
  const isWishlisted = wishlist.includes(product.id);
  const [isActive, setIsActive] = useState(false);

  const discountedPrice = product.discountPercentage 
    ? product.price * (1 - product.discountPercentage / 100)
    : product.price;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      onMouseEnter={() => setIsActive(true)}
      onMouseLeave={() => setIsActive(false)}
      onTouchStart={() => setIsActive(true)}
      className="group flex flex-col items-center text-center w-full relative"
    >
      <Link 
        to={`/product/${product.id}`} 
        className="block w-full mb-4 relative"
        onClick={(e) => {
          // If action buttons are visible and it's a mobile device, 
          // let the user tap buttons. If they tap the image itself, go to product.
          if (isActive && window.innerWidth < 768) {
             // We can let the link happen or prioritize buttons.
             // Usually on mobile, first tap shows overlay, second tap goes to link.
          }
        }}
      >
        {/* Product Image Container */}
        <div className="aspect-square bg-white rounded-[2.5rem] overflow-hidden relative shadow-sm transition-all duration-500 group-hover:shadow-md group-hover:-translate-y-1 sm:group-hover:-translate-y-1.5 flex items-center justify-center border border-slate-100">
          <img 
            src={product.imageUrl} 
            alt={product.name} 
            className="w-full h-full object-contain p-4 transition-transform duration-700 group-hover:scale-105" 
          />
          
          {/* Action Buttons Overlay - Centered at bottom */}
          <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center justify-center w-full px-4 transition-all duration-500 ease-out z-20 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="bg-white rounded-full p-2 flex items-center gap-1 shadow-2xl border border-slate-100/50">
              <button 
                className={`w-11 h-11 rounded-full flex items-center justify-center hover:bg-slate-50 transition-colors active:scale-90 ${isWishlisted ? 'text-red-500' : 'text-slate-700'}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleWishlist(product.id);
                }}
              >
                <Heart className={`w-5.5 h-5.5 ${isWishlisted ? 'fill-current' : ''}`} />
              </button>
              <div className="w-[1.5px] h-7 bg-slate-100 mx-1"></div>
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  addToCart(product);
                }}
                className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-700 active:scale-90"
              >
                <ShoppingCart className="w-5.5 h-5.5" />
              </button>
            </div>
          </div>

          {/* Discount Badge */}
          {product.discountPercentage && (
            <div className="absolute bottom-4 left-4 sm:bottom-5 sm:left-5 bg-indigo-600 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight shadow-lg shadow-indigo-200/50 z-10">
              {product.discountPercentage}% OFF
            </div>
          )}

          {/* Offer Badge */}
          {product.isOffer && (
            <div className="absolute top-4 left-4 sm:top-5 sm:left-5 bg-emerald-500 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200/50 z-10 animate-pulse">
              HOT OFFER
            </div>
          )}
        </div>
      </Link>

      {/* Product Info */}
      <div className="space-y-1.5 w-full px-1">
        <Link to={`/product/${product.id}`} className="block">
          <h3 className="font-bold text-slate-900 text-base sm:text-lg line-clamp-1 group-hover:text-indigo-600 transition-colors duration-300">
            {product.name}
          </h3>
        </Link>
        
        <p className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
          {product.category}
        </p>

        {/* Stars */}
        <div className="flex justify-center gap-0.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star key={s} className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-amber-400 text-amber-400 drop-shadow-sm" />
          ))}
        </div>

        {/* Price Section */}
        <div className="pt-2 flex flex-col items-center">
          <div className="flex items-center gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {(discountedPrice || 0).toLocaleString()} <span className="text-xs sm:text-sm font-bold text-indigo-600">{t('common.currency')}</span>
            </span>
          </div>
          {product.discountPercentage && (
            <span className="text-[10px] sm:text-xs font-bold text-slate-300 line-through">
              {(product.price || 0).toLocaleString()} {t('common.currency')}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
