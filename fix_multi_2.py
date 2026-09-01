import re

with open('src/components/MultiSvgaViewer.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

def replace_in_func(func_name, code):
    # Find the function definition
    pattern = re.compile(r'  const ' + func_name + r' = async \([^)]*\) => \{')
    match = pattern.search(code)
    if not match: return code
    
    start_idx = match.end()
    
    # find the matching closing brace
    brace_count = 1
    i = start_idx
    while i < len(code) and brace_count > 0:
        if code[i] == '{': brace_count += 1
        elif code[i] == '}': brace_count -= 1
        i += 1
        
    end_idx = i - 1
    
    func_body = code[start_idx:end_idx]
    
    # We want to insert `const activeItems = getActiveItems();` at the beginning
    # and replace `items` with `activeItems` inside the body, except for `setItems` or `itemsToExport || items`
    
    if func_name == 'handleExportIndividualVideos':
        func_body = func_body.replace('const list = itemsToExport || items;', 'const list = itemsToExport || getActiveItems();')
    else:
        # replace `(items as any[])` with `activeItems`
        func_body = func_body.replace('(items as any[])', 'activeItems')
        # replace `items.forEach` with `activeItems.forEach`
        func_body = func_body.replace('items.forEach', 'activeItems.forEach')
        # replace `const item = items[` with `const item = activeItems[`
        func_body = func_body.replace('const item = items[', 'const item = activeItems[')
        
        # Insert activeItems def
        func_body = '\n    const activeItems = getActiveItems();' + func_body
    
    return code[:start_idx] + func_body + code[end_idx:]

code = replace_in_func('handleExportGrid', code)
code = replace_in_func('handleDownloadAllCombined', code)
code = replace_in_func('handleDownloadAllSvga', code)
code = replace_in_func('handleDownloadAllImages', code)
code = replace_in_func('handleExportIndividualVideos', code)

with open('src/components/MultiSvgaViewer.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Done phase 2")
