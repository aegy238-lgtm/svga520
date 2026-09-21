import { useStore } from '../store/useStore';
import { ArrowRight, Star } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import ProductCard from '../components/ProductCard';
import AnnouncementBar from '../components/AnnouncementBar';

export default function Home() {
  const { products, banners, paymentMethods } = useStore();
  const { t } = useTranslation();
  const topBanners = banners.filter(b => b.isActive && (b.position === 'top' || !b.position));
  const middleBanners = banners.filter(b => b.isActive && b.position === 'middle');
  const gridBanners = middleBanners.filter(b => (b.afterProductCount ?? 0) > 0);
  const fixedMiddleBanners = middleBanners.filter(b => !(b.afterProductCount ?? 0));
  
  const middleSliderBanners = fixedMiddleBanners.filter(b => b.showAsSlider);
  const middleStaticBanners = fixedMiddleBanners.filter(b => !b.showAsSlider);

  const featuredProducts = products.slice(0, 12); // Show more products for better grid experience

  const renderGridItems = () => {
    const items: React.ReactNode[] = [];
    let productsCount = 0;

    // Filter and sort banners that belong in the grid
    const sortedGridBanners = [...gridBanners].sort((a, b) => (a.afterProductCount || 0) - (b.afterProductCount || 0));

    featuredProducts.forEach((product, idx) => {
      items.push(<ProductCard key={product.id} product={product} />);
      productsCount++;

      // Check if any banners should be injected after this product count
      const activeBanners = sortedGridBanners.filter(b => b.afterProductCount === productsCount);
      activeBanners.forEach(banner => {
        items.push(
          <div key={`banner-gap-${banner.id}`} className="col-span-2 lg:col-span-4 my-4">
            <div className="w-full rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/50 group">
              {banner.linkUrl ? (
                <Link to={banner.linkUrl} className="block w-full">
                  <img src={banner.imageUrl} alt="Promo" className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105" />
                </Link>
              ) : (
                <img src={banner.imageUrl} alt="Promo" className="w-full h-auto object-cover" />
              )}
            </div>
          </div>
        );
      });
    });

    return items;
  };

  const activeMethods = paymentMethods ? paymentMethods.filter(m => m.isActive) : [];
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentMiddleSlide, setCurrentMiddleSlide] = useState(0);

  useEffect(() => {
    if (topBanners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % topBanners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [topBanners.length]);

  useEffect(() => {
    if (middleSliderBanners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentMiddleSlide((prev) => (prev + 1) % middleSliderBanners.length);
    }, 2000); // 2 seconds cycle for middle slider
    return () => clearInterval(interval);
  }, [middleSliderBanners.length]);

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Hero Banner Carousel */}
      <section className="relative bg-slate-900 overflow-hidden h-[35vh] sm:h-[60vh] min-h-[250px]">
        {topBanners.length > 0 ? (
          <>
             {topBanners.map((banner, index) => (
                <motion.div
                  key={banner.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: currentSlide === index ? 1 : 0 }}
                  transition={{ duration: 0.8 }}
                  className="absolute inset-0"
                  style={{ pointerEvents: currentSlide === index ? 'auto' : 'none' }}
                >
                  {banner.linkUrl ? (
                    <Link to={banner.linkUrl} className="block w-full h-full">
                      <img src={banner.imageUrl} alt="Offer" className="w-full h-full object-cover lg:object-fill" />
                    </Link>
                  ) : (
                    <img src={banner.imageUrl} alt="Offer" className="w-full h-full object-cover lg:object-fill" />
                  )}
                </motion.div>
             ))}
             {topBanners.length > 1 && (
               <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2 z-20">
                 {topBanners.map((_, idx) => (
                   <button 
                     key={idx}
                     onClick={() => setCurrentSlide(idx)}
                     className={`w-2.5 h-2.5 rounded-full transition-all ${currentSlide === idx ? 'bg-indigo-500 w-6' : 'bg-white/50 hover:bg-white/80'}`}
                   />
                 ))}
               </div>
             )}
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-900 to-slate-900"></div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent z-10 pointer-events-none"></div>
      </section>

      {/* Announcement Ticker */}
      <AnnouncementBar />

      {/* Featured Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-right" dir="rtl">
        <div className="flex items-center justify-between mb-8 sm:mb-10">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <Star className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 fill-amber-500" />
              {t('home.dailyDiscounts')}
            </h2>
          </div>
          <Link to="/store" className="text-xs sm:text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 bg-indigo-50 sm:bg-transparent px-3 py-1.5 sm:p-0 rounded-full font-arabic">
            {t('home.viewAll')} <ArrowRight className="w-4 h-4 rotate-180" />
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
          {renderGridItems()}
        </div>
      </section>

      {/* Middle Banners Section */}
      {middleBanners.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col gap-6">
            {/* Slider Group */}
            {middleSliderBanners.length > 0 && (
              <div className="relative aspect-[21/9] sm:aspect-[25/9] overflow-hidden rounded-[2.5rem] shadow-xl shadow-slate-200">
                {middleSliderBanners.map((banner, index) => (
                  <motion.div
                    key={banner.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: currentMiddleSlide === index ? 1 : 0 }}
                    transition={{ duration: 0.8 }}
                    className="absolute inset-0"
                    style={{ pointerEvents: currentMiddleSlide === index ? 'auto' : 'none' }}
                  >
                    {banner.linkUrl ? (
                      <Link to={banner.linkUrl} className="block w-full h-full">
                        <img 
                          src={banner.imageUrl} 
                          alt="Special Offer" 
                          className="w-full h-full object-cover" 
                        />
                      </Link>
                    ) : (
                      <img 
                        src={banner.imageUrl} 
                        alt="Special Offer" 
                        className="w-full h-full object-cover" 
                      />
                    )}
                  </motion.div>
                ))}
                {/* Dots for middle slider */}
                {middleSliderBanners.length > 1 && (
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-10">
                    {middleSliderBanners.map((_, idx) => (
                      <button 
                        key={idx}
                        onClick={() => setCurrentMiddleSlide(idx)}
                        className={`w-1.5 h-1.5 rounded-full transition-all ${currentMiddleSlide === idx ? 'bg-indigo-500 w-4' : 'bg-white/40'}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Static Group */}
            {middleStaticBanners.map((banner) => (
              <div key={banner.id} className="w-full rounded-[2.5rem] overflow-hidden shadow-xl shadow-slate-200 group relative">
                {banner.linkUrl ? (
                  <Link to={banner.linkUrl} className="block w-full">
                    <img 
                      src={banner.imageUrl} 
                      alt="Special Offer" 
                      className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105" 
                    />
                  </Link>
                ) : (
                  <img 
                    src={banner.imageUrl} 
                    alt="Special Offer" 
                    className="w-full h-auto object-cover" 
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
