import { readFileSync, writeFileSync } from 'fs';

const file = 'src/components/Workspace.tsx';
let content = readFileSync(file, 'utf8');

// I will extract the zoom hooks and place them after `scale`
// Wait, actually I can just move them to right after scale definition!

const oldHooks = `  const handleZoomChange = (delta: number) => {
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
  }, [scale]);`;

const scaleDef = `  const [scale, setScale] = useState(1);`;

content = content.replace(oldHooks, "");
content = content.replace(scaleDef, scaleDef + "\n\n" + oldHooks);

writeFileSync(file, content);
console.log("Hooks moved");
