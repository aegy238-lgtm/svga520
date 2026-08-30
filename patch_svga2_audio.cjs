const fs = require('fs');
const content = fs.readFileSync('src/components/Workspace.tsx', 'utf8');

const regex = /if \(audioUrl && audioUrl !== originalAudioUrl\) \{[\s\S]*?\} else if \(\!audioUrl\) \{/g;
const replacement = `if (audioUrl && audioUrl !== originalAudioUrl) {
            const audioKey = "quantum_audio_track_" + Date.now() + ".mp3"; // Force .mp3 for compatibility
            let bytes: Uint8Array | null = null;
            try {
              if (audioFile) {
                const arrayBuffer = await audioFile.arrayBuffer();
                bytes = new Uint8Array(arrayBuffer);
              } else {
                const response = await fetch(audioUrl);
                if (!response.ok) throw new Error("Fetch failed");
                const arrayBuffer = await response.arrayBuffer();
                bytes = new Uint8Array(arrayBuffer);
              }
            } catch (e) {
              console.error("Failed to fetch audio", e);
              alert(
                "فشل تضمين الصوت داخل ملف SVGA. يرجى التحقق من الملف وإعادة المحاولة.",
              );
            }
            if (bytes) {
              const taggedBytes = ensureMp3WithId3(bytes);
              message.images[audioKey] = taggedBytes;
              message.audios = [
                {
                  audioKey: audioKey,
                  startFrame: 0,
                  endFrame: message.params.frames || 0,
                  startTime: 0,
                  totalTime: Math.floor(
                    ((message.params.frames || 0) /
                      (message.params.fps || 30)) *
                      1000,
                  ),
                },
              ];
            }
          } else if (!audioUrl) {`;

const newContent = content.replace(regex, replacement);
fs.writeFileSync('src/components/Workspace.tsx', newContent);
