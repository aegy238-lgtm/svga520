import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import { ImageItem } from '@/types';
import { cn } from '@/lib/utils';

interface SortableItemProps {
  key?: React.Key;
  image: ImageItem;
  onRemove: (id: string) => void;
}

export function SortableItem({ image, onRemove }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative flex items-center gap-3 p-2 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm group",
        isDragging && "opacity-50 scale-105 shadow-md z-10"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-5 h-5" />
      </button>
      
      <div className="w-16 h-16 rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-900 shrink-0">
        <img 
          src={image.url} 
          alt="thumbnail" 
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex-1 min-w-0">
        {/* We can add caption input here later if needed */}
        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
          {image.file?.name || 'Image'}
        </p>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(image.id);
        }}
        className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md opacity-0 group-hover:opacity-100 transition-all"
        title="Remove"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
