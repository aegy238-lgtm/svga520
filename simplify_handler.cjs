const fs = require('fs');
let content = fs.readFileSync('src/components/UniversalMotionTools.tsx', 'utf8');

const oldHandler = `  const handleTogglePlay = () => {
    setIsPlaying(prev => !prev);
    
    // Handle VAP Video
    if (activeViewMode === 'vap') {
      const videoEl = containerRef.current?.querySelector('video');
      if (videoEl) {
        if (isPlaying) {
          videoEl.pause();
        } else {
          videoEl.play();
        }
      }
    } else if (activeViewMode === 'svga') {
       if (svgaPlayerRef.current) {
         if (isPlaying) {
           svgaPlayerRef.current.pause();
         } else {
           svgaPlayerRef.current.start();
         }
       }
    }

    // Handle Custom Audio Sync
    if (audioElementRef.current && audioUrl && !isAudioMuted) {
      if (isPlaying) {
        audioElementRef.current.pause();
        setIsAudioPlaying(false);
      } else {
        audioElementRef.current.play().then(() => setIsAudioPlaying(true)).catch(() => {});
      }
    }
  };`;

const newHandler = `  const handleTogglePlay = () => {
    setIsPlaying(prev => !prev);
    
    // Handle SVGA Player Toggle directly (video and audio are handled by useEffects)
    if (activeViewMode === 'svga' && svgaPlayerRef.current) {
       if (isPlaying) {
         svgaPlayerRef.current.pause();
       } else {
         svgaPlayerRef.current.start();
       }
    }
  };

  // Sync custom audio with isPlaying
  useEffect(() => {
    if (audioElementRef.current && audioUrl && !isAudioMuted) {
       if (isPlaying) {
         audioElementRef.current.play().then(() => setIsAudioPlaying(true)).catch(() => {});
       } else {
         audioElementRef.current.pause();
         setIsAudioPlaying(false);
       }
    }
  }, [isPlaying, audioUrl, isAudioMuted]);`;

content = content.replace(oldHandler, newHandler);
fs.writeFileSync('src/components/UniversalMotionTools.tsx', content);
