import { useParams, Link, useNavigate } from 'react-router';
import { useStore } from '../store/useStore';
import { ShoppingCart, Star, CheckCircle, ShieldCheck, Zap, ArrowLeft, Share2, Gift, Copy, Check, MessageCircle } from 'lucide-react';
import { useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';

export default function ProductDetails() {
  const { id } = useParams();
  const { products, addToCart, reviews, addReview, user, promoCodes } = useStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const product = products.find(p => p.id === id);
  const productReviews = reviews.filter(r => r.productId === id);
  
  // Find a specific promo code for this product to show as a "referral reward"
  const referralPromo = promoCodes.find(p => p.isActive && p.targetProductId === id);
  
  const [selectedDuration, setSelectedDuration] = useState(product?.durationOptions?.[0] || null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [hasShared, setHasShared] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!product) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Product Not Found</h2>
        <Link to="/store" className="text-indigo-600 hover:underline">Return to Store</Link>
      </div>
    );
  }

  const handleShare = async () => {
    const shareUrl = referralPromo 
      ? `${window.location.origin}${window.location.pathname}?ref=${referralPromo.code}`
      : window.location.href;

    const shareData = {
      title: product.name,
      text: `Check out this amazing product: ${product.name}!`,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setHasShared(true);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setHasShared(true);
        setTimeout(() => setHasShared(false), 5000);
      }
    } catch (err) {
      console.log('Error sharing:', err);
    }
  };

  const handleWhatsAppShare = () => {
    const shareUrl = referralPromo 
      ? `${window.location.origin}${window.location.pathname}?ref=${referralPromo.code}`
      : window.location.href;
    
    const text = `🔥 فـرصـة لا تـفـوت! خصم خـاص لـك عـلى: ${product.name}\n\nتفضل بزيارة الرابط واحصل على كود خصم ترحيبي عـند الـدخـول 🎁\n\n${shareUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
    setHasShared(true);
  };

  const copyPromo = () => {
    if (referralPromo) {
      navigator.clipboard.writeText(referralPromo.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAddToCart = () => {
    addToCart(product, selectedDuration || undefined);
    navigate('/cart');
  };

  const submitReview = (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    addReview({
      productId: product.id,
      userId: user.id,
      userName: user.name,
      rating: reviewRating,
      comment: reviewComment
    });
    setReviewComment('');
  };

  const basePrice = selectedDuration ? selectedDuration.price : product.price;
  const discountedPrice = product.discountPercentage 
    ? basePrice * (1 - product.discountPercentage / 100)
    : basePrice;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Link to="/store" className="inline-flex items-center text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-8">
        <ArrowLeft className="w-4 h-4 mr-1 rtl:ml-1 rtl:rotate-180" /> Back to Store
      </Link>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
        {/* Left Column: Image & Details */}
        <div>
          <div className="aspect-[4/3] rounded-3xl overflow-hidden bg-slate-100 mb-8 border border-slate-200 relative">
            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
            {product.discountPercentage && (
              <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1.5 rounded-xl font-bold text-sm shadow-lg shadow-red-500/30">
                {product.discountPercentage}% OFF
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Features</h3>
            <ul className="space-y-3">
              {product.features?.map((feature, idx) => (
                <li key={idx} className="flex items-start text-slate-600">
                  <CheckCircle className="w-5 h-5 text-indigo-500 mr-3 shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
              {(!product.features || product.features.length === 0) && (
                <li className="text-slate-500 italic">No specific features listed.</li>
              )}
            </ul>
          </div>
        </div>

        {/* Right Column: Buy Actions */}
        <div className="flex flex-col">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] sm:text-xs font-black rounded-full uppercase tracking-widest">{product.category}</span>
              <span className="px-3 py-1 bg-slate-100 text-slate-700 text-[10px] sm:text-xs font-black rounded-full uppercase tracking-widest">{product.type}</span>
            </div>
            <h1 className="font-display text-3xl sm:text-5xl font-black text-slate-900 leading-tight mb-4 tracking-tight">{product.name}</h1>
            <p className="text-base sm:text-lg text-slate-500 leading-relaxed mb-8 font-medium">{product.description}</p>
            
            <div className="flex items-baseline gap-3 mb-10 flex-wrap">
                <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tighter">
                  {(discountedPrice || 0).toLocaleString()} <span className="text-xl sm:text-2xl font-bold text-indigo-600">{t('common.currency')}</span>
                </span>
                {product.discountPercentage && (
                  <span className="text-xl sm:text-2xl font-bold text-slate-300 line-through decoration-slate-300/50">
                    {(basePrice || 0).toLocaleString()}
                  </span>
                )}
            </div>

            {product.durationOptions && product.durationOptions.length > 0 && (
              <div className="mb-10 space-y-4">
                <h3 className="font-display font-bold text-slate-900 tracking-tight">{t('product.selectPlan')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {product.durationOptions.map(duration => {
                    const durationDiscounted = product.discountPercentage 
                      ? duration.price * (1 - product.discountPercentage / 100)
                      : duration.price;
                      
                    return (
                      <button
                        key={duration.id}
                        onClick={() => setSelectedDuration(duration)}
                        className={`p-4 rounded-3xl border-2 transition-all text-left flex flex-col justify-center items-start group ${
                          selectedDuration?.id === duration.id 
                            ? 'border-indigo-600 bg-indigo-50/50 shadow-lg shadow-indigo-200/50' 
                            : 'border-slate-100 hover:border-slate-200 bg-white'
                        }`}
                      >
                        <span className={`text-sm font-black ${selectedDuration?.id === duration.id ? 'text-indigo-700' : 'text-slate-900'}`}>
                          {duration.label}
                        </span>
                        <span className={`text-xs mt-1 font-bold ${selectedDuration?.id === duration.id ? 'text-indigo-600' : 'text-slate-400'}`}>
                          {(durationDiscounted || 0).toLocaleString()} {t('common.currency')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-6">
            <button 
              onClick={handleAddToCart}
              className="w-full flex justify-center items-center gap-3 py-5 px-8 bg-indigo-600 hover:bg-slate-900 text-white rounded-[2rem] font-black text-lg transition-all shadow-xl shadow-indigo-200 active:scale-95"
            >
              <ShoppingCart className="w-6 h-6" />
              {t('product.addToCart')}
            </button>
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
               <div className="flex flex-col items-center text-center p-3">
                  <ShieldCheck className="w-6 h-6 text-emerald-500 mb-2" />
                  <span className="text-xs font-semibold text-slate-700">{t('product.secure')}</span>
               </div>
               <div className="flex flex-col items-center text-center p-3">
                  <Zap className="w-6 h-6 text-amber-500 mb-2" />
                  <span className="text-xs font-semibold text-slate-700">{t('product.instantDelivery')}</span>
               </div>
            </div>
          </div>

          {/* Referral Reward Section */}
          {referralPromo && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-600/20"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <Gift className="w-32 h-32" />
              </div>
              
              <div className="relative z-10">
                <h3 className="text-xl font-black mb-2 flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-indigo-300" />
                  ادعُ صديق واحصل على خصم مكافأة!
                </h3>
                <p className="text-indigo-100 text-sm mb-6 leading-relaxed">
                  شارك هذا المنتج مع أصدقائك، وبمجرد المشاركة ستظهر لك مكافأة خاصة لهذا المنتج.
                </p>

                {!hasShared ? (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button 
                      onClick={handleWhatsAppShare}
                      className="flex-1 bg-[#25D366] text-white py-3 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-[#1da851] transition-colors shadow-lg active:scale-[0.98]"
                    >
                      <MessageCircle className="w-5 h-5 fill-white" />
                      مشاركة عبر واتساب
                    </button>
                    <button 
                      onClick={handleShare}
                      className="flex-1 bg-white text-indigo-600 py-3 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors shadow-lg active:scale-[0.98]"
                    >
                      <Share2 className="w-4 h-4" />
                      مشاركة الرابط
                    </button>
                  </div>
                ) : (
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-indigo-200 uppercase mb-1">كود الخصم الخاص بك:</p>
                        <p className="text-2xl font-black tracking-widest">{referralPromo.code}</p>
                      </div>
                      <button 
                        onClick={copyPromo}
                        className="bg-white text-indigo-600 p-3 rounded-xl shadow-lg active:scale-90 transition-all"
                      >
                        {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Gift className="w-3 h-3 text-emerald-400" />
                      <span className="text-[10px] font-bold text-emerald-400 uppercase">
                        مبارك! تم تفعيل المكافأة لهذا المنتج
                      </span>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Reviews Section */}
      <div className="mt-24">
         <h2 className="text-2xl font-bold text-slate-900 mb-8 border-b border-slate-200 pb-4">{t('product.reviews')}</h2>
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-6">
               {productReviews.length === 0 ? (
                 <p className="text-slate-500 italic">{t('product.noReviews')}</p>
               ) : (
                 productReviews.map(review => (
                   <div key={review.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold">
                             {review.userName.charAt(0)}
                           </div>
                           <div>
                             <p className="font-bold text-slate-900 leading-snug">{review.userName}</p>
                             <p className="text-xs text-slate-500">{new Date(review.date).toLocaleDateString()}</p>
                           </div>
                        </div>
                        <div className="flex gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                          ))}
                        </div>
                      </div>
                      <p className="text-slate-600">{review.comment}</p>
                   </div>
                 ))
               )}
            </div>
            
            <div className="lg:col-span-1">
               <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200 sticky top-24">
                 <h3 className="font-bold text-slate-900 mb-4">{t('product.writeReview')}</h3>
                 {user ? (
                   <form onSubmit={submitReview} className="space-y-4">
                     <div>
                       <label className="block text-sm font-semibold text-slate-700 mb-2">{t('product.rating')}</label>
                       <div className="flex gap-2">
                          {[1,2,3,4,5].map(num => (
                            <button 
                              key={num} 
                              type="button" 
                              onClick={() => setReviewRating(num)}
                              className="focus:outline-none"
                            >
                               <Star className={`w-6 h-6 ${num <= reviewRating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
                            </button>
                          ))}
                       </div>
                     </div>
                     <div>
                       <label className="block text-sm font-semibold text-slate-700 mb-2">{t('product.experience')}</label>
                       <textarea 
                         required
                         rows={4}
                         value={reviewComment}
                         onChange={(e) => setReviewComment(e.target.value)}
                         className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                         placeholder={t('product.reviewPlaceholder')}
                       />
                     </div>
                     <button type="submit" className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors">
                       {t('product.submit')}
                     </button>
                   </form>
                 ) : (
                   <div className="text-center py-6">
                      <p className="text-slate-600 text-sm mb-4">{t('product.loginToReview')}</p>
                      <Link to="/login" className="inline-block bg-white border border-slate-200 px-6 py-2 rounded-xl text-sm font-bold text-slate-900 hover:bg-slate-50">{t('common.login')}</Link>
                   </div>
                 )}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
