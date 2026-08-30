import { readFileSync, writeFileSync } from 'fs';

const file = 'src/components/Workspace.tsx';
let content = readFileSync(file, 'utf8');

const targetHooks = `  useEffect(() => {
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

const newHooks = `  useEffect(() => {
    const handleGlobalWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault(); // يمنع تكبير المتصفح بالكامل
        
        // إذا كان الماوس فوق منطقة المعاينة، قم بتكبير التصميم
        if (wrapperRef.current && wrapperRef.current.contains(e.target as Node)) {
          const delta = e.deltaY > 0 ? -0.1 : 0.1;
          setZoomLevel(prev => {
            const currentZoom = prev === 'fit' ? scale : prev as number;
            let nextZoom = currentZoom + delta;
            nextZoom = Math.max(0.1, Math.min(nextZoom, 5));
            return Number(nextZoom.toFixed(2));
          });
        }
      }
    };

    window.addEventListener('wheel', handleGlobalWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleGlobalWheel);
  }, [scale]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey)) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault(); // يمنع اختصار المتصفح
          handleZoomChange(0.1);
        } else if (e.key === '-') {
          e.preventDefault(); // يمنع اختصار المتصفح
          handleZoomChange(-0.1);
        } else if (e.key === '0') {
          e.preventDefault(); // يمنع اختصار المتصفح
          setZoomLevel(1);
          setPanPos({ x: 0, y: 0 });
        }
      } else if (e.shiftKey && e.key === '1' || e.shiftKey && e.key === '!') {
         e.preventDefault();
         setZoomLevel('fit');
         setPanPos({ x: 0, y: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scale]);`;

if(content.includes(targetHooks)) {
   content = content.replace(targetHooks, newHooks);
   writeFileSync(file, content);
   console.log("Success");
} else {
   console.log("Target not found");
}
