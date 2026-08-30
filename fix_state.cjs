const fs = require('fs');

let code = fs.readFileSync('src/components/Name3DEditor/Name3DEditor.tsx', 'utf8');

// 1. Add useState for decorTab
if (!code.includes('const [decorTab, setDecorTab] = useState')) {
   code = code.replace(
      "const [activeTab, setActiveTab] = useState<'text' | 'colors' | '3d'>('text');",
      "const [activeTab, setActiveTab] = useState<'text' | 'colors' | '3d'>('text');\n  const [decorTab, setDecorTab] = useState<'text' | 'symbols'>('text');"
   );
}

// 2. Fix the state usage in the render
code = code.replace(/updateState\(\{\s*decorTab:\s*'text'\s*\}\)/g, "setDecorTab('text')");
code = code.replace(/updateState\(\{\s*decorTab:\s*'symbols'\s*\}\)/g, "setDecorTab('symbols')");
code = code.replace(/state\.decorTab/g, "decorTab");

fs.writeFileSync('src/components/Name3DEditor/Name3DEditor.tsx', code);
