const fs = require('fs');

let content = fs.readFileSync('src/components/UniversalMotionTools.tsx', 'utf8');

// 1. Fix the Play/Pause logic for VAP
const playHandlerOld = `  const handleTogglePlay = () => {
    setIsPlaying(prev => !prev);
    
    // Handle SVGA Player Toggle directly (video and audio are handled by useEffects)
    if (activeViewMode === 'svga' && svgaPlayerRef.current) {
       if (isPlaying) {
         svgaPlayerRef.current.pause();
       } else {
         svgaPlayerRef.current.start();
       }
    }
  };`;

const playHandlerNew = `  const handleTogglePlay = () => {
    setIsPlaying(prev => !prev);
    
    // Handle VAP Player Toggle
    if (activeViewMode === 'vap' && vapInstanceRef.current) {
      if (isPlaying) {
        try { vapInstanceRef.current.pause(); } catch(e){}
      } else {
        try { vapInstanceRef.current.play(); } catch(e){}
      }
    }
    
    // Handle SVGA Player Toggle
    if (activeViewMode === 'svga' && svgaPlayerRef.current) {
       if (isPlaying) {
         svgaPlayerRef.current.pause();
       } else {
         svgaPlayerRef.current.start();
       }
    }
  };`;

content = content.replace(playHandlerOld, playHandlerNew);

// 2. Fix the Mute logic in useEffect
const useEffectOld = `  useEffect(() => {
    if (containerRef.current) {
      const videoEl = containerRef.current.querySelector('video');
      if (videoEl) {
        videoEl.muted = isPlaybackMuted || muteOriginalAudio;
        if (isPlaying) {
          videoEl.play().catch(e => console.warn("Auto-play prevented", e));
        } else {
          videoEl.pause();
        }
      }
    }
  }, [muteOriginalAudio, fileUrl, isPlaybackMuted, isPlaying]);`;

const useEffectNew = `  useEffect(() => {
    // Attempt to mute the VAP video element
    const attemptMute = () => {
      let videoEl = containerRef.current?.querySelector('video');
      // If VAP keeps the video on the instance
      if (!videoEl && vapInstanceRef.current && vapInstanceRef.current.video) {
        videoEl = vapInstanceRef.current.video;
      }
      if (videoEl) {
        videoEl.muted = isPlaybackMuted || muteOriginalAudio;
      }
    };
    
    attemptMute();
    // Try again after a short delay in case VAP hasn't mounted it yet
    setTimeout(attemptMute, 500);
    setTimeout(attemptMute, 1500);
    
  }, [muteOriginalAudio, fileUrl, isPlaybackMuted]);`;

content = content.replace(useEffectOld, useEffectNew);

fs.writeFileSync('src/components/UniversalMotionTools.tsx', content);
console.log("Handlers updated");
