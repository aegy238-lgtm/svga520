const fs = require('fs');
let content = fs.readFileSync('src/components/VapPlayer.tsx', 'utf8');
content = content.replace(
    `className="w-full h-full object-contain cursor-pointer"`,
    `className="w-full h-full object-contain cursor-pointer vap-player-canvas"`
);
fs.writeFileSync('src/components/VapPlayer.tsx', content);
