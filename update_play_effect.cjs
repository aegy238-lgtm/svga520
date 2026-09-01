const fs = require('fs');

let content = fs.readFileSync('src/components/UniversalMotionTools.tsx', 'utf8');

const targetStr = `  useEffect(() => {
    if (containerRef.current) {
      const videoEl = containerRef.current.querySelector('video');
      if (videoEl) {
        videoEl.muted = isPlaybackMuted || muteOriginalAudio;
      }
    }
  }, [muteOriginalAudio, fileUrl, isPlaybackMuted]);`;

const replacement = `  useEffect(() => {
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

content = content.replace(targetStr, replacement);
fs.writeFileSync('src/components/UniversalMotionTools.tsx', content);
