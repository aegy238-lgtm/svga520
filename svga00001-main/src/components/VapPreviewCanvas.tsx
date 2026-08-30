import React, { useEffect, useRef } from 'react';

export const VapPreviewCanvas = ({ videoUrl, isVapInput, startTime, endTime, isAutoDuration }: any) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        let animationId: number;
        
        const renderLoop = () => {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (!video || !canvas || video.videoWidth === 0) {
                animationId = requestAnimationFrame(renderLoop);
                return;
            }

            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return;

            if (isVapInput) {
                const w = Math.floor(video.videoWidth / 2);
                const h = video.videoHeight;
                if (canvas.width !== w) canvas.width = w;
                if (canvas.height !== h) canvas.height = h;

                // Create a temporary canvas to read the split video
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = video.videoWidth;
                tempCanvas.height = video.videoHeight;
                const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
                if (!tCtx) return;

                tCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                const alphaData = tCtx.getImageData(0, 0, w, h).data;
                const rgbData = tCtx.getImageData(w, 0, w, h).data;
                const combinedData = ctx.createImageData(w, h);
                const d = combinedData.data;

                for (let j = 0; j < d.length; j += 4) {
                    d[j] = rgbData[j];
                    d[j+1] = rgbData[j+1];
                    d[j+2] = rgbData[j+2];
                    d[j+3] = alphaData[j]; // red channel of alpha half
                }
                ctx.putImageData(combinedData, 0, 0);
            } else {
                if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
                if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            }

            animationId = requestAnimationFrame(renderLoop);
        };

        if (videoUrl) {
            animationId = requestAnimationFrame(renderLoop);
        }

        return () => {
            if (animationId) cancelAnimationFrame(animationId);
        };
    }, [videoUrl, isVapInput]);

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <video 
                ref={videoRef}
                src={videoUrl} 
                style={{ display: 'none' }}
                onTimeUpdate={(e) => {
                    const v = e.currentTarget;
                    const effectiveStart = isAutoDuration ? 0 : startTime;
                    const effectiveEnd = isAutoDuration ? v.duration : endTime;
                    if (v.currentTime > effectiveEnd) v.currentTime = effectiveStart;
                    if (v.currentTime < effectiveStart) v.currentTime = effectiveStart;
                }}
                autoPlay loop muted playsInline
            />
            {videoUrl && (
                <canvas 
                    ref={canvasRef} 
                    className="max-h-40 rounded-xl mb-2 border border-white/10" 
                />
            )}
        </div>
    );
};
