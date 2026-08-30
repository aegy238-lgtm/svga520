import { readFileSync, writeFileSync } from 'fs';

const file = 'src/components/Workspace.tsx';
let content = readFileSync(file, 'utf8');

// 1. Replace the state hooks with refs
content = content.replace(
  "  const [panPos, setPanPos] = useState({ x: 0, y: 0 });\n  const [isPanning, setIsPanning] = useState(false);",
  "  const panPosRef = useRef({ x: 0, y: 0 });\n  const isPanningRef = useRef(false);\n  const panContainerRef = useRef<HTMLDivElement>(null);"
);

// 2. Update the pointer handlers
const oldPointerHandlers = `  const handleZoomPointerDown = (e: React.PointerEvent) => {
    if (zoomLevel !== 'fit') {
      setIsPanning(true);
      lastPanPos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleZoomPointerMove = (e: React.PointerEvent) => {
    if (isPanning && zoomLevel !== 'fit') {
      const dx = e.clientX - lastPanPos.current.x;
      const dy = e.clientY - lastPanPos.current.y;
      setPanPos(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastPanPos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleZoomPointerUp = () => {
    setIsPanning(false);
  };`;

const newPointerHandlers = `  const updatePanTransform = () => {
    if (panContainerRef.current) {
      const currentZoom = zoomLevel === 'fit' ? scale : (zoomLevel as number);
      panContainerRef.current.style.transform = \`translate(\${panPosRef.current.x}px, \${panPosRef.current.y}px) scale(\${currentZoom})\`;
    }
  };

  const handleZoomPointerDown = (e: React.PointerEvent) => {
    if (zoomLevel !== 'fit') {
      isPanningRef.current = true;
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      if (wrapperRef.current) wrapperRef.current.style.cursor = 'grabbing';
      if (panContainerRef.current) panContainerRef.current.style.transition = 'none';
    }
  };

  const handleZoomPointerMove = (e: React.PointerEvent) => {
    if (isPanningRef.current && zoomLevel !== 'fit') {
      const dx = e.clientX - lastPanPos.current.x;
      const dy = e.clientY - lastPanPos.current.y;
      panPosRef.current.x += dx;
      panPosRef.current.y += dy;
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      updatePanTransform();
    }
  };

  const handleZoomPointerUp = () => {
    isPanningRef.current = false;
    if (wrapperRef.current) wrapperRef.current.style.cursor = zoomLevel !== 'fit' ? 'grab' : 'default';
    if (panContainerRef.current) panContainerRef.current.style.transition = 'transform 0.2s ease-out';
  };`;

content = content.replace(oldPointerHandlers, newPointerHandlers);

// 3. Update setPanPos occurrences
const panResetRegex = /setPanPos\(\{x:0, y:0\}\);/g;
content = content.replace(panResetRegex, "panPosRef.current = {x: 0, y: 0}; updatePanTransform();");

const panResetRegex2 = /setPanPos\(\{ x: 0, y: 0 \}\);/g;
content = content.replace(panResetRegex2, "panPosRef.current = {x: 0, y: 0}; updatePanTransform();");

// 4. Update JSX classes and style
const oldJSXPanDiv = \`            <div
              className={\\\`absolute inset-0 flex items-center justify-center origin-center pointer-events-none \\\${isPanning ? '' : 'transition-transform duration-200 ease-out'}\\\`}
              style={{ transform: \\\`translate(\\\${panPos.x}px, \\\${panPos.y}px) scale(\\\${zoomLevel === 'fit' ? scale : zoomLevel})\\\` }}
            >\`;
            
const newJSXPanDiv = \`            <div
              ref={panContainerRef}
              className="absolute inset-0 flex items-center justify-center origin-center pointer-events-none transition-transform duration-200 ease-out"
              style={{ transform: \\\`translate(\\\${panPosRef.current.x}px, \\\${panPosRef.current.y}px) scale(\\\${zoomLevel === 'fit' ? scale : zoomLevel})\\\` }}
            >\`;

if (content.includes(oldJSXPanDiv)) {
  content = content.replace(oldJSXPanDiv, newJSXPanDiv);
} else {
  console.log("Could not find old JSX Pan Div. Trying a more robust regex.");
  // Try regex if exact match fails
  const jsxRegex = /<div\\s+className=\{[\`'"]absolute inset-0 flex items-center justify-center origin-center pointer-events-none[^>]+>\\s*/m;
  const match = content.match(jsxRegex);
  if (match) {
    console.log("Found with regex, but it's risky to replace. Proceeding with caution.");
  }
}

// Update the wrapper cursor logic in the JSX
const oldWrapperCursor = /cursor: isPanning \? 'grabbing' : \(zoomLevel !== 'fit' \? 'grab' : 'default'\)/g;
content = content.replace(oldWrapperCursor, "cursor: zoomLevel !== 'fit' ? 'grab' : 'default'");

writeFileSync(file, content);
console.log("Panning logic updated.");
