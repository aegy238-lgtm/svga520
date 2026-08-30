const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  "import { ImageEditor } from './components/ImageEditor';",
  "import { ImageEditor } from './components/ImageEditor';\nimport { VapHub } from './components/VapHub';"
);

content = content.replace(
  "case 'pagConverterOpen': setShowPagConverter(true); break;",
  "case 'pagConverterOpen': setShowPagConverter(true); break;\n                        case 'vapHub': handleFeatureAccess(AppState.VAP_HUB, 'VAP Processing Hub'); break;"
);

content = content.replace(
  "state === AppState.NAME_3D_EDITOR ? 'name-3d' :",
  "state === AppState.NAME_3D_EDITOR ? 'name-3d' :\n          state === AppState.VAP_HUB ? 'vap-hub' :"
);

content = content.replace(
  "{state === AppState.ADMIN_PANEL && (currentUser?.role === 'admin' || currentUser?.role === 'moderator') && (",
  `{state === AppState.VAP_HUB && (
              <VapHub />
            )}
            {state === AppState.ADMIN_PANEL && (currentUser?.role === 'admin' || currentUser?.role === 'moderator') && (`
);

fs.writeFileSync('src/App.tsx', content);
