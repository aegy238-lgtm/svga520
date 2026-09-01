import re

with open('src/components/MultiSvgaViewer.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add selectedItemIds
content = content.replace(
    '  const [items, setItems] = useState<MultiSvgaItem[]>([]);\n  const [isDragging, setIsDragging] = useState(false);',
    '  const [items, setItems] = useState<MultiSvgaItem[]>([]);\n  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());\n  const [isDragging, setIsDragging] = useState(false);'
)

# 2. Add selection handlers
content = content.replace(
    '  const removeItem = (id: string) => {\n    setItems(prev => {\n      const item = prev.find(i => i.id === id);\n      if (item) URL.revokeObjectURL(item.url);\n      return prev.filter(i => i.id !== id);\n    });\n  };',
    '''  const removeItem = (id: string) => {
    setItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter(i => i.id !== id);
    });
    setSelectedItemIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const handleToggleSelect = (id: string) => {
    setSelectedItemIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedItemIds.size === items.length && items.length > 0) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(items.map(i => i.id)));
    }
  };'''
)

# 3. Add getActiveItems
content = content.replace(
    '  const clearAll = () => {\n    items.forEach(item => URL.revokeObjectURL(item.url));\n    setItems([]);\n  };',
    '''  const clearAll = () => {
    items.forEach(item => URL.revokeObjectURL(item.url));
    setItems([]);
    setSelectedItemIds(new Set());
  };

  const getActiveItems = () => selectedItemIds.size > 0 ? items.filter(i => selectedItemIds.has(i.id)) : items;'''
)

with open('src/components/MultiSvgaViewer.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done phase 1")
