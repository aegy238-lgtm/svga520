const fs = require('fs');

let content = fs.readFileSync('src/components/UniversalMotionTools.tsx', 'utf8');

const oldHandler = `  const handleTogglePlaybackMute = () => {
    setIsPlaybackMuted(prev => !prev);
    const videoEl = containerRef.current?.querySelector('video');
    if (videoEl) {
      videoEl.muted = !isPlaybackMuted || muteOriginalAudio;
    }
    if (audioElementRef.current) {
      audioElementRef.current.muted = !isPlaybackMuted;
    }
  };`;

const newHandler = `  const handleTogglePlaybackMute = () => {
    setIsPlaybackMuted(prev => !prev);
  };`;

content = content.replace(oldHandler, newHandler);

fs.writeFileSync('src/components/UniversalMotionTools.tsx', content);
