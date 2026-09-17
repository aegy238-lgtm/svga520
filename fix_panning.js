import fs from 'fs';

const file = 'src/components/Workspace.tsx';
let content = fs.readFileSync(file, 'utf8');

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

content = content.replace(/setPanPos\(\{x:0, y:0\}\);/g, "panPosRef.current = {x: 0, y: 0}; updatePanTransform();");
content = content.replace(/setPanPos\(\{ x: 0, y: 0 \}\);/g, "panPosRef.current = {x: 0, y: 0}; updatePanTransform();");

const oldJSXPanDivRegex = /className=\{\`absolute inset-0 flex items-center justify-center origin-center pointer-events-none \$\{isPanning \? '' : 'transition-transform duration-200 ease-out'\}\`\}\s*style=\{\{ transform: \`translate\(\$\{panPos\.x\}px, \$\{panPos\.y\}px\) scale\(\$\{zoomLevel === 'fit' \? scale : zoomLevel\}\)\` \}\}\s*>/g;
const newJSXPanDiv = 'ref={panContainerRef}\n              className="absolute inset-0 flex items-center justify-center origin-center pointer-events-none transition-transform duration-200 ease-out"\n              style={{ transform: `translate(${panPosRef.current.x}px, ${panPosRef.current.y}px) scale(${zoomLevel === \'fit\' ? scale : zoomLevel})` }}\n            >';
content = content.replace(oldJSXPanDivRegex, newJSXPanDiv);

content = content.replace(/cursor: isPanning \? 'grabbing' : \(zoomLevel !== 'fit' \? 'grab' : 'default'\)/g, "cursor: zoomLevel !== 'fit' ? 'grab' : 'default'");

fs.writeFileSync(file, content);
console.log("Updated!");
