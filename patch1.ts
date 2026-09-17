import { readFileSync, writeFileSync } from 'fs';

const file = 'src/components/Workspace.tsx';
let content = readFileSync(file, 'utf8');

const replacement1 = `  const layerInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number | 'fit'>('fit');
  const [panPos, setPanPos] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const lastPanPos = useRef({ x: 0, y: 0 });

  const handleZoomPointerDown = (e: React.PointerEvent) => {
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
  };

  const handleZoomChange = (delta: number) => {
    setZoomLevel(prev => {
      const current = prev === 'fit' ? scale : prev as number;
      return Number(Math.max(0.1, Math.min(current + delta, 5)).toFixed(2));
    });
  };

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoomLevel(prev => {
          const currentZoom = prev === 'fit' ? scale : prev as number;
          let nextZoom = currentZoom + delta;
          nextZoom = Math.max(0.1, Math.min(nextZoom, 5));
          return Number(nextZoom.toFixed(2));
        });
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [scale]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey)) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          handleZoomChange(0.1);
        } else if (e.key === '-') {
          e.preventDefault();
          handleZoomChange(-0.1);
        } else if (e.key === '0') {
          e.preventDefault();
          setZoomLevel(1);
          setPanPos({ x: 0, y: 0 });
        }
      } else if (e.shiftKey && e.key === '1' || e.shiftKey && e.key === '!') {
         e.preventDefault();
         setZoomLevel('fit');
         setPanPos({ x: 0, y: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scale]);

  const [isPlaying, setIsPlaying] = useState(true);`;

const regex = /  const layerInputRef = useRef<HTMLInputElement>\(null\);[\r\n\s]*const containerRef = useRef<HTMLDivElement>\(null\);[\r\n\s]*const \[isPlaying, setIsPlaying\] = useState\(true\);/;

if(regex.test(content)) {
   content = content.replace(regex, replacement1);
   writeFileSync(file, content);
   console.log("Success");
} else {
   console.log("Target not found");
}
