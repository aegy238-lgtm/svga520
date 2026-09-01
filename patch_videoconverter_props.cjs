const fs = require('fs');
let content = fs.readFileSync('src/components/VideoConverter.tsx', 'utf8');

content = content.replace(
    '  globalQuality?: "low" | "medium" | "high";',
    '  globalQuality?: "low" | "medium" | "high";\n  initialFiles?: File[];'
);

content = content.replace(
    '  globalQuality: initialGlobalQuality = "high",\n}) => {',
    '  globalQuality: initialGlobalQuality = "high",\n  initialFiles = [],\n}) => {'
);

content = content.replace(
    '  const [files, setFiles] = useState<File[]>([]);',
    '  const [files, setFiles] = useState<File[]>(initialFiles);'
);

fs.writeFileSync('src/components/VideoConverter.tsx', content);
