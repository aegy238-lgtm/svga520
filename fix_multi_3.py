with open('src/components/MultiSvgaViewer.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Pass props to SvgaCard
code = code.replace(
    '                        onUpdatePreset={(presetId) => setItems(prev => prev.map(i => i.id === item.id ? { ...i, presetId } : i))}',
    '''                        onUpdatePreset={(presetId) => setItems(prev => prev.map(i => i.id === item.id ? { ...i, presetId } : i))}
                        isSelected={selectedItemIds.has(item.id)}
                        onToggleSelect={() => handleToggleSelect(item.id)}'''
)

# Add props definition in SvgaCard
code = code.replace(
    '  onUpdatePreset: (presetId: string) => void;\n}> = ({ item, onRemove, onMaximize, onDownload, onDownloadSvga, onExportVideo, previewBg, watermark, wmSettings, onUpdatePreset }) => {',
    '''  onUpdatePreset: (presetId: string) => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}> = ({ item, onRemove, onMaximize, onDownload, onDownloadSvga, onExportVideo, previewBg, watermark, wmSettings, onUpdatePreset, isSelected, onToggleSelect }) => {'''
)

# Add checkbox inside SvgaCard
code = code.replace(
    '        {/* Audio Badge */}\n        {hasAudio && (\n          <div className="absolute top-4 left-4 z-20 px-3 py-1.5 bg-indigo-500/80 backdrop-blur-md border border-indigo-400/50 rounded-xl flex items-center gap-2 shadow-lg">\n            <Volume2 className="w-4 h-4 text-white" />',
    '''        {/* Selection Checkbox */}
        {onToggleSelect && (
          <div className={`absolute top-4 left-4 z-30 transition-opacity duration-300 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <button
              onClick={onToggleSelect}
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                isSelected ? "bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "bg-black/40 backdrop-blur-md border-white/50 hover:border-white hover:bg-black/60 text-transparent"
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </button>
          </div>
        )}
        
        {/* Audio Badge */}
        {hasAudio && (
          <div className={`absolute ${onToggleSelect ? 'top-14' : 'top-4'} left-4 z-20 px-3 py-1.5 bg-indigo-500/80 backdrop-blur-md border border-indigo-400/50 rounded-xl flex items-center gap-2 shadow-lg`}>
            <Volume2 className="w-4 h-4 text-white" />'''
)

with open('src/components/MultiSvgaViewer.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Done phase 3")
