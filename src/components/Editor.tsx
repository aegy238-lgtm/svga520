import React from 'react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ImageItem, LayoutType } from '@/types';
import { SortableItem } from './SortableItem';
import { Uploader } from './Uploader';
import { LayoutStage } from './LayoutStage';
import { Settings2, Share, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditorProps {
  images: ImageItem[];
  layout: LayoutType;
  setImages: React.Dispatch<React.SetStateAction<ImageItem[]>>;
  setLayout: (layout: LayoutType) => void;
  onPublish: () => void;
}

export function Editor({ images, layout, setImages, setLayout, onPublish }: EditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setImages((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const removeImage = (id: string) => {
    setImages(images.filter(img => img.id !== id));
  };

  const clearAll = () => {
    if (confirm('Are you sure you want to remove all images?')) {
      setImages([]);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] w-full overflow-hidden bg-white dark:bg-zinc-950">
      
      {/* Sidebar: Reorder & Upload */}
      <div className="w-full lg:w-80 border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-[40vh] lg:h-full bg-zinc-50/50 dark:bg-zinc-900/30">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-950">
          <h2 className="font-semibold text-zinc-800 dark:text-zinc-200">Reorder & Edit</h2>
          {images.length > 0 && (
            <button 
              onClick={clearAll}
              className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={images.map(img => img.id)}
              strategy={verticalListSortingStrategy}
            >
              {images.map((image) => (
                <SortableItem 
                  key={image.id} 
                  image={image} 
                  onRemove={removeImage} 
                />
              ))}
            </SortableContext>
          </DndContext>

          <div className="pt-2">
            <Uploader onImagesAdded={(newImgs) => setImages(prev => [...prev, ...newImgs])} />
          </div>
        </div>
      </div>

      {/* Main Area: Preview & Tools */}
      <div className="flex-1 flex flex-col h-[60vh] lg:h-full bg-zinc-100 dark:bg-zinc-900">
        
        {/* Toolbar */}
        <div className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between px-4 sm:px-6 shadow-sm z-10">
          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
            <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 font-medium text-sm mr-2 shrink-0">
              <Settings2 className="w-4 h-4" /> Layout:
            </div>
            
            {(['grid', 'full-width', 'row-height', 'original'] as LayoutType[]).map((type) => (
              <button
                key={type}
                onClick={() => setLayout(type)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors shrink-0",
                  layout === type 
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" 
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                )}
              >
                {type === 'grid' && 'Grid'}
                {type === 'full-width' && 'Full Column'}
                {type === 'row-height' && 'Row Match'}
                {type === 'original' && 'Original'}
              </button>
            ))}
          </div>

          <button
            onClick={onPublish}
            disabled={images.length === 0}
            className="shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Share className="w-4 h-4" />
            <span className="hidden sm:inline">Create Link</span>
          </button>
        </div>

        {/* Live Preview Canvas */}
        <div className="flex-1 overflow-hidden p-4 sm:p-6 lg:p-8">
          <LayoutStage images={images} layout={layout} />
        </div>
      </div>
    </div>
  );
}
