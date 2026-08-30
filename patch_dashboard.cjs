const fs = require('fs');
let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const newTool = `{ id: 'vap-hub', label: 'VAP Processing Hub', icon: <Video className="w-8 h-8" />, actionKey: 'vapHub', descAr: 'نظام متكامل لمعالجة وتحويل وتشغيل ملفات VAP الشفافة.', descEn: 'Comprehensive hub for processing, converting, and playing transparent VAP files.', highlight: true },`;

content = content.replace(
  "{ id: 'pag-to-svga', label: 'PAG to SVGA Converter',",
  `${newTool}\n      { id: 'pag-to-svga', label: 'PAG to SVGA Converter',`
);

fs.writeFileSync('src/components/Dashboard.tsx', content);
