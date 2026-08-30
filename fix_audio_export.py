import re

with open('src/components/MultiSvgaViewer.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Restore imports
code = code.replace(
    "import { ensureMp3WithId3 } from '../utils/svgaAudio';",
    "import { ensureMp3WithId3, extractAudioFromSvga } from '../utils/svgaAudio';"
)

# 2. Add audioBytesToMux declaration
code = code.replace(
    '''        let player: any = null;
        let internalCanvas: HTMLCanvasElement | null = null;

        if (item.type === "pag") {''',
    '''        let player: any = null;
        let internalCanvas: HTMLCanvasElement | null = null;
        let audioBytesToMux: Uint8Array | null = null;

        if (item.type === "pag") {'''
)

# 3. Add extraction block
code = code.replace(
    '''          player.setContentMode(preset ? 'AspectFill' : 'AspectFit');
          player.stepToFrame(0, false);
          internalCanvas = div.querySelector("canvas");
        }

        await new Promise(r => setTimeout(r, 200));''',
    '''          player.setContentMode(preset ? 'AspectFill' : 'AspectFit');
          player.stepToFrame(0, false);
          internalCanvas = div.querySelector("canvas");
          
          try {
            const audioData = await extractAudioFromSvga(videoItem);
            if (audioData.audioBytes) {
               audioBytesToMux = audioData.audioBytes;
            }
          } catch (e) {
            console.warn("Could not extract audio for export", e);
          }
        }

        await new Promise(r => setTimeout(r, 200));'''
)

# 4. Add FFmpeg muxing
code = code.replace(
    '''        let { buffer } = muxer.target as ArrayBufferTarget;
        
        // Audio export disabled as requested by the user

        renderContainer.removeChild(div);''',
    '''        let { buffer } = muxer.target as ArrayBufferTarget;
        
        let finalMp4Buffer = buffer;

        if (audioBytesToMux) {
            try {
                const ffmpeg = await ensureFFmpeg();
                if (ffmpeg) {
                    const videoName = `vid_${item.id}.mp4`;
                    const audioName = `aud_${item.id}.mp3`;
                    const outputName = `out_${item.id}.mp4`;
                    
                    await ffmpeg.writeFile(videoName, new Uint8Array(buffer));
                    await ffmpeg.writeFile(audioName, audioBytesToMux);
                    
                    const durationSec = totalFrames / targetFps;
                    
                    await ffmpeg.exec([
                        '-i', videoName,
                        '-i', audioName,
                        '-c:v', 'copy',
                        '-c:a', 'aac',
                        '-map', '0:v:0',
                        '-map', '1:a:0',
                        '-t', durationSec.toString(),
                        outputName
                    ]);
                    
                    const outData = await ffmpeg.readFile(outputName);
                    finalMp4Buffer = (outData as Uint8Array).buffer;
                    
                    ffmpeg.deleteFile(videoName);
                    ffmpeg.deleteFile(audioName);
                    ffmpeg.deleteFile(outputName);
                }
            } catch (e) {
                console.error("FFmpeg audio muxing failed for", item.name, e);
            }
        }

        renderContainer.removeChild(div);'''
)

# 5. Fix zip and blob outputs
code = code.replace(
    '''        if (streamZip) {
          // ONLY Add MP4 video file to ZIP archive
          streamZip.addFile(mp4Filename, new Uint8Array(buffer));
        } else {
          // Single video direct download
          const blob = new Blob([buffer], { type: "video/mp4" });''',
    '''        if (streamZip) {
          // ONLY Add MP4 video file to ZIP archive
          streamZip.addFile(mp4Filename, new Uint8Array(finalMp4Buffer));
        } else {
          // Single video direct download
          const blob = new Blob([finalMp4Buffer], { type: "video/mp4" });'''
)

with open('src/components/MultiSvgaViewer.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Done phase 5")
