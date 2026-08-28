import * as pako from 'pako';
import { parse } from 'protobufjs';

export const convertVapToSvga = async (
    video: HTMLVideoElement,
    vw: number,
    vh: number,
    totalFrames: number,
    fps: number,
    onProgress: (progress: number, phase: string) => void
): Promise<Blob> => {
    onProgress(0, "جاري إعداد محرك SVGA...");

    const protoStr = `
        syntax = "proto3";
        package com.opensource.svga;

        message MovieParams {
            float viewBoxWidth = 1;
            float viewBoxHeight = 2;
            int32 fps = 3;
            int32 frames = 4;
        }

        message Transform {
            float a = 1;
            float b = 2;
            float c = 3;
            float d = 4;
            float tx = 5;
            float ty = 6;
        }

        message Layout {
            float x = 1;
            float y = 2;
            float width = 3;
            float height = 4;
        }

        message SpriteEntity {
            string imageKey = 1;
            repeated FrameEntity frames = 2;
            string matteKey = 3;
        }

        message FrameEntity {
            float alpha = 1;
            Layout layout = 2;
            Transform transform = 3;
            string clipPath = 4;
            repeated ShapeEntity shapes = 5;
        }

        message MovieEntity {
            string version = 1;
            MovieParams params = 2;
            map<string, bytes> images = 3;
            repeated SpriteEntity sprites = 4;
            repeated AudioEntity audios = 5;
        }

        message AudioEntity {
            string audioKey = 1;
            int32 startFrame = 2;
            int32 endFrame = 3;
            int32 startTime = 4;
            int32 totalTime = 5;
        }

        message ShapeEntity {
            // Placeholder for basic SVGA shape definitions
        }
    `;

    const root = parse(protoStr).root;
    const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");

    const imagesData: Record<string, Uint8Array> = {};
    const finalSprites: any[] = [];
    
    // Create an offscreen canvas
    const actualWidth = Math.floor(vw / 2); // Left is alpha, right is RGB
    const actualHeight = vh;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = vw;
    tempCanvas.height = vh;
    const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = actualWidth;
    frameCanvas.height = actualHeight;
    const fCtx = frameCanvas.getContext('2d');

    if (!tCtx || !fCtx) throw new Error("Canvas context not available");

    const originalTime = video.currentTime;
    const originalPaused = video.paused;

    const frameDuration = 1 / fps;
    const spriteFrames = [];
    let currentKey = "";

    video.pause();

    for (let i = 0; i < totalFrames; i++) {
        video.currentTime = i * frameDuration;
        await new Promise(r => {
            const onSeek = () => { video.removeEventListener('seeked', onSeek); r(null); };
            video.addEventListener('seeked', onSeek);
            // backup timeout
            setTimeout(() => { video.removeEventListener('seeked', onSeek); r(null); }, 500);
        });

        tCtx.clearRect(0, 0, vw, vh);
        tCtx.drawImage(video, 0, 0, vw, vh);
        
        const alphaData = tCtx.getImageData(0, 0, actualWidth, actualHeight).data;
        const rgbData = tCtx.getImageData(actualWidth, 0, actualWidth, actualHeight).data;
        
        const combinedData = fCtx.createImageData(actualWidth, actualHeight);
        const d = combinedData.data;
        for (let j = 0; j < rgbData.length; j += 4) {
            d[j] = rgbData[j];
            d[j + 1] = rgbData[j + 1];
            d[j + 2] = rgbData[j + 2];
            d[j + 3] = (alphaData[j] + alphaData[j+1] + alphaData[j+2]) / 3;
        }
        
        fCtx.putImageData(combinedData, 0, 0);

        const dataUrl = frameCanvas.toDataURL("image/png");
        const base64Data = dataUrl.split(',')[1];
        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let k = 0; k < binaryStr.length; k++) {
            bytes[k] = binaryStr.charCodeAt(k);
        }

        currentKey = `frame_${i}`;
        imagesData[currentKey] = bytes;

        spriteFrames.push({
            alpha: 1.0,
            layout: { x: 0, y: 0, width: actualWidth, height: actualHeight },
            transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
        });

        finalSprites.push({
            imageKey: currentKey,
            frames: new Array(totalFrames).fill({ alpha: 0 }).map((f, idx) => idx === i ? spriteFrames[i] : f)
        });

        if (i % 5 === 0) {
            onProgress(Math.floor((i / totalFrames) * 90), `جاري معالجة الإطار ${i + 1}/${totalFrames}`);
            await new Promise(r => requestAnimationFrame(r));
        }
    }

    if (!originalPaused) video.play();

    onProgress(90, "جاري ضغط الملف (SVGA Level 9)...");

    const payload = {
        version: "2.0",
        params: {
            viewBoxWidth: actualWidth,
            viewBoxHeight: actualHeight,
            fps: fps,
            frames: totalFrames
        },
        images: imagesData,
        sprites: finalSprites,
        audios: []
    };

    const movie = MovieEntity.create(payload);
    const buffer = MovieEntity.encode(movie).finish();
    const compressed = pako.deflate(buffer, { level: 9 });

    onProgress(100, "اكتمل التصدير!");
    return new Blob([compressed], { type: 'application/octet-stream' });
};
