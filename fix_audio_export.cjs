const fs = require('fs');
let content = fs.readFileSync('src/components/UniversalMotionTools.tsx', 'utf8');

// Fix shouldIncludeAudio in handleExportVAP
const oldIncludeAudioVap = `      let audioDataChunks: any[] = [];
      let customAudioDataChunks: any[] = [];
      const shouldIncludeAudio = !isAudioMuted && (audioFile || audioUrl);

      if (shouldIncludeAudio) {
        setExportStatusText('جاري معالجة وتشفير المسار الصوتي (AAC)...');
        audioDataChunks = await prepareAudioDataChunks(audioFile || audioUrl!, duration);
      }`;

const newIncludeAudioVap = `      let audioDataChunks: any[] = [];
      const hasCustomAudio = (audioFile || audioUrl) && !isAudioMuted;
      const shouldIncludeAudio = hasCustomAudio || !muteOriginalAudio;

      if (shouldIncludeAudio) {
        setExportStatusText('جاري معالجة وتشفير المسار الصوتي (AAC)...');
        const audioSourceToExtract = hasCustomAudio ? (audioFile || audioUrl!) : (sourceFile || fileUrl!);
        try {
           audioDataChunks = await prepareAudioDataChunks(audioSourceToExtract, duration);
        } catch(e) {
           console.warn("No audio track found to extract");
        }
      }`;
content = content.replace(oldIncludeAudioVap, newIncludeAudioVap);

// Ensure audio encoder config works if length is 0
content = content.replace(
  `audio: shouldIncludeAudio && audioDataChunks.length > 0 ? {`,
  `audio: shouldIncludeAudio && audioDataChunks.length > 0 ? {`
); // already safe because of length > 0

// Now fix SVGA audio export
const oldIncludeAudioSVGA = `      // Process Audio Track & Embedding
      const audios: any[] = [];
      if (!isAudioMuted && (audioFile || audioUrl)) {
        setExportStatusText('جاري دمج ومعالجة المسار الصوتي داخل ملف SVGA...');
        setExportProgress(85);

        try {
          let audioBytes: Uint8Array;
          if (audioFile) {
            const buffer = await audioFile.arrayBuffer();
            audioBytes = new Uint8Array(buffer);
          } else {
            const resp = await fetch(audioUrl!);
            const buffer = await resp.arrayBuffer();
            audioBytes = new Uint8Array(buffer);
          }`;

const newIncludeAudioSVGA = `      // Process Audio Track & Embedding
      const audios: any[] = [];
      const hasCustomAudio = (audioFile || audioUrl) && !isAudioMuted;
      const shouldIncludeAudio = hasCustomAudio || !muteOriginalAudio;

      if (shouldIncludeAudio) {
        setExportStatusText('جاري دمج ومعالجة المسار الصوتي داخل ملف SVGA...');
        setExportProgress(85);

        try {
          let audioBytes: Uint8Array | null = null;
          
          if (hasCustomAudio) {
              if (audioFile) {
                const buffer = await audioFile.arrayBuffer();
                audioBytes = new Uint8Array(buffer);
              } else {
                const resp = await fetch(audioUrl!);
                const buffer = await resp.arrayBuffer();
                audioBytes = new Uint8Array(buffer);
              }
          } else {
              // We need to extract the audio from the original source file.
              // We can't just pass MP4 bytes to SVGA audio player, it expects MP3/WAV/AAC.
              // So we will use the backend extraction route if available, or just fallback.
              // The user already has "Download Original Audio" feature which uses backend.
              // We can fetch it from there silently.
              if (sourceFile) {
                  const formData = new FormData();
                  formData.append('video', sourceFile);
                  formData.append('format', 'mp3');
                  formData.append('quality', '128k');

                  const res = await fetch('/api/audio/extract', {
                    method: 'POST',
                    body: formData,
                  });
                  const data = await res.json();
                  const jobId = data.jobId;

                  if (jobId) {
                      // Poll until ready
                      for (let i = 0; i < 30; i++) {
                         const statusRes = await fetch(\`/api/audio/status/\${jobId}\`);
                         const statusData = await statusRes.json();
                         if (statusData.status === 'completed') {
                            const audioResp = await fetch(\`/api/audio/download/\${jobId}\`);
                            const buffer = await audioResp.arrayBuffer();
                            audioBytes = new Uint8Array(buffer);
                            break;
                         } else if (statusData.status === 'failed') {
                            break;
                         }
                         await new Promise(r => setTimeout(r, 1000));
                      }
                  }
              }
          }

          if (audioBytes) {`;
content = content.replace(oldIncludeAudioSVGA, newIncludeAudioSVGA);

// Fix curly brace matching for the new SVGA block
content = content.replace(
  `          const base64Audio = Buffer.from(audioBytes).toString('base64');
          
          audios.push({
            audioKey: 'bg_audio',
            frames: [{
              alpha: 1,
              layout: { x: 0, y: 0, width: 0, height: 0 },
              transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
            }]
          });`,
  `          const base64Audio = Buffer.from(audioBytes).toString('base64');
          
          audios.push({
            audioKey: 'bg_audio',
            frames: [{
              alpha: 1,
              layout: { x: 0, y: 0, width: 0, height: 0 },
              transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
            }]
          });
          } // close if(audioBytes)`
);


fs.writeFileSync('src/components/UniversalMotionTools.tsx', content);
console.log("Audio export updated");
