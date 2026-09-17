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
                const vw = video.videoWidth;
                const vh = video.videoHeight;
                const isVertical = vh > vw * 1.25;
                const w = isVertical ? vw : Math.floor(vw / 2);
                const h = isVertical ? Math.floor(vh / 2) : vh;

                if (canvas.width !== w) canvas.width = w;
                if (canvas.height !== h) canvas.height = h;

                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = vw;
                tempCanvas.height = vh;
                const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
                if (!tCtx) return;

                tCtx.drawImage(video, 0, 0, vw, vh);
                
                const rgbX = 0;
                const rgbY = 0;
                const alphaX = isVertical ? 0 : w;
                const alphaY = isVertical ? h : 0;

                const rgbData = tCtx.getImageData(rgbX, rgbY, w, h).data;
                const alphaData = tCtx.getImageData(alphaX, alphaY, w, h).data;
                const combinedData = ctx.createImageData(w, h);
                const d = combinedData.data;

                for (let j = 0; j < d.length; j += 4) {
                    const aVal = alphaData[j]; // red channel of alpha mask
                    const alpha = aVal / 255;
                    d[j] = alpha > 0.01 ? Math.min(255, Math.round(rgbData[j] / alpha)) : rgbData[j];
                    d[j+1] = alpha > 0.01 ? Math.min(255, Math.round(rgbData[j+1] / alpha)) : rgbData[j+1];
                    d[j+2] = alpha > 0.01 ? Math.min(255, Math.round(rgbData[j+2] / alpha)) : rgbData[j+2];
                    d[j+3] = aVal;
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
