with open('src/components/MultiSvgaViewer.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(
    '''              <button 
                onClick={clearAll}
                className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl border border-red-500/20 font-black text-sm transition-all flex items-center gap-2"
              >''',
    '''              <button 
                onClick={handleSelectAll}
                className="px-6 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/20 font-black text-sm transition-all flex items-center gap-2"
              >
                <CheckSquare className="w-4 h-4" />
                {selectedItemIds.size === (items as any[]).length && (items as any[]).length > 0 ? 'إلغاء التحديد' : 'تحديد الكل'}
              </button>
              <button 
                onClick={clearAll}
                className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl border border-red-500/20 font-black text-sm transition-all flex items-center gap-2"
              >'''
)

# And add the import for CheckSquare at the top
code = code.replace(
    'import { X, Maximize2, Trash2, Upload, Download, Film, Video, Loader2, Play, Pause, Image as ImageIcon, Camera, FolderOpen, AlertCircle, ChevronDown, Monitor, Smartphone, Volume2, Shield, RotateCcw } from "lucide-react";',
    'import { X, Maximize2, Trash2, Upload, Download, Film, Video, Loader2, Play, Pause, Image as ImageIcon, Camera, FolderOpen, AlertCircle, ChevronDown, Monitor, Smartphone, Volume2, Shield, RotateCcw, CheckSquare } from "lucide-react";'
)

with open('src/components/MultiSvgaViewer.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Done phase 4")
