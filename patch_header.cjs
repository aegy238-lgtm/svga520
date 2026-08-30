const fs = require('fs');

let headerTsx = fs.readFileSync('src/components/Header.tsx', 'utf8');

if (!headerTsx.includes('onOpenGuide?: () => void;')) {
  headerTsx = headerTsx.replace(
    /interface HeaderProps \{/,
    `interface HeaderProps {\n  onOpenGuide?: () => void;`
  );
}

if (!headerTsx.includes('onOpenGuide')) {
  headerTsx = headerTsx.replace(
    /export function Header\(\{([^}]+)\}: HeaderProps\) \{/,
    `export function Header({$1, onOpenGuide}: HeaderProps) {`
  );
}

if (!headerTsx.includes('دليل الاستخدام')) {
  headerTsx = headerTsx.replace(
    /(<button[^>]*onClick=\{onToggleTheme\}[^>]*>)/,
    `<button
            onClick={onOpenGuide}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 hover:scale-105 transition-all"
            title="دليل الاستخدام"
          >
            <BookOpen className="w-4 h-4" />
            <span className="text-sm font-medium">دليل الاستخدام</span>
          </button>\n          $1`
  );
  
  if (!headerTsx.includes('BookOpen')) {
      headerTsx = headerTsx.replace(/import \{([^}]+)\} from 'lucide-react';/, `import { $1, BookOpen } from 'lucide-react';`);
  }
}

fs.writeFileSync('src/components/Header.tsx', headerTsx);
console.log('Header.tsx patched successfully');
