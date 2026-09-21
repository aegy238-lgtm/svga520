import React, { useState } from 'react';
import { ImageItem, LayoutType } from '@/types';
import { cn } from '@/lib/utils';
import { X, ZoomIn } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface LayoutStageProps {
  images: ImageItem[];
  layout: LayoutType;
  isViewer?: boolean;
}

export function LayoutStage({ images, layout, isViewer = false }: LayoutStageProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-400">
        <p>Add some images to see the preview</p>
      </div>
    );
  }

  const handleImageClick = (url: string) => {
    setSelectedImage(url);
  };

  return (
    <>
      <div className={cn(
        "w-full h-full overflow-y-auto overflow-x-hidden",
        isViewer ? "bg-white dark:bg-zinc-950 min-h-screen" : "bg-zinc-50 dark:bg-zinc-900 rounded-xl"
      )}>
        <div className={cn(
          "mx-auto w-full",
          layout === 'full-width' ? "max-w-4xl" : "max-w-5xl p-4 sm:p-6 lg:p-8"
        )}>
          {layout === 'grid' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
              {images.map((img) => (
                <div 
                  key={img.id} 
                  className="aspect-square cursor-pointer group relative overflow-hidden bg-zinc-100 dark:bg-zinc-800"
                  onClick={() => handleImageClick(img.url)}
                >
                  <img 
                    src={img.url} 
                    alt="Grid item" 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <ZoomIn className="text-white w-6 h-6 drop-shadow-md" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {layout === 'full-width' && (
            <div className="flex flex-col">
              {images.map((img) => (
                <div 
                  key={img.id} 
                  className="w-full cursor-pointer relative group bg-zinc-100 dark:bg-zinc-800"
                  onClick={() => handleImageClick(img.url)}
                >
                  <img 
                    src={img.url} 
                    alt="Full width item" 
                    className="w-full h-auto block"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <ZoomIn className="text-white w-8 h-8 drop-shadow-md" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {layout === 'row-height' && (
            <div className="flex flex-wrap gap-2 md:gap-4">
              {images.map((img) => (
                <div 
                  key={img.id} 
                  className="flex-grow h-48 sm:h-64 cursor-pointer group relative overflow-hidden bg-zinc-100 dark:bg-zinc-800"
                  onClick={() => handleImageClick(img.url)}
                >
                  <img 
                    src={img.url} 
                    alt="Row match item" 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 min-w-[150px]"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <ZoomIn className="text-white w-6 h-6 drop-shadow-md" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {layout === 'original' && (
            <div className="flex flex-col gap-8 items-center py-8">
              {images.map((img) => (
                <div 
                  key={img.id} 
                  className="w-full max-w-4xl cursor-pointer group relative rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-zinc-100 dark:bg-zinc-800"
                  onClick={() => handleImageClick(img.url)}
                >
                  <img 
                    src={img.url} 
                    alt="Original item" 
                    className="w-full h-auto block"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <ZoomIn className="text-white w-8 h-8 drop-shadow-md" />
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {isViewer && images.length > 0 && (
            <div className="py-12 text-center text-sm text-zinc-400 dark:text-zinc-500 font-medium">
              Created via ImageLink Pro
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
            onClick={() => setSelectedImage(null)}
          >
            <button 
              className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImage(null);
              }}
            >
              <X className="w-6 h-6" />
            </button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              src={selectedImage}
              alt="Enlarged"
              className="max-w-full max-h-full object-contain drop-shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
