import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';

interface VapPlayerProps {
    src: string;
    width?: number;
    height?: number;
    className?: string;
    alphaMode?: 'none' | 'right' | 'left' | 'top' | 'bottom' | 'white' | 'black' | 'green';
    showControls?: boolean;
    bgMode?: 'checker' | 'dark' | 'black' | 'white' | 'green';
    onDimensionsDetected?: (dim: { width: number; height: number; duration: number }) => void;
}

export const VapPlayer: React.FC<VapPlayerProps> = ({ 
    src, 
    width = 800, 
    height = 450, 
    className = '', 
    alphaMode = 'right',
    showControls = true,
    bgMode = 'checker',
    onDimensionsDetected
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const requestRef = useRef<number | null>(null);
    const glRef = useRef<WebGLRenderingContext | null>(null);
    const programRef = useRef<WebGLProgram | null>(null);
    const textureRef = useRef<WebGLTexture | null>(null);
    const alphaModeLocationRef = useRef<WebGLUniformLocation | null>(null);

    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [duration, setDuration] = useState<number>(0);
    const [isMuted, setIsMuted] = useState<boolean>(true);
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const [isControlsVisible, setIsControlsVisible] = useState<boolean>(true);
    const [detectedSize, setDetectedSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-hide controls after inactivity on mobile
    const triggerControlsVisibility = useCallback(() => {
        setIsControlsVisible(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying) {
                setIsControlsVisible(false);
            }
        }, 3500);
    }, [isPlaying]);

    // Single frame renderer (callable even when video is paused)
    const renderFrame = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const gl = glRef.current;
        const texture = textureRef.current;
        const alphaModeLocation = alphaModeLocationRef.current;

        if (!video || !canvas || !gl || !texture || !alphaModeLocation) return;
        if (video.readyState < video.HAVE_CURRENT_DATA && video.readyState < 2) return;

        // Set alpha mode uniform
        let am = 0;
        if (alphaMode === 'left') am = 1;
        else if (alphaMode === 'bottom') am = 2;
        else if (alphaMode === 'top') am = 3;
        else if (alphaMode === 'white') am = 4;
        else if (alphaMode === 'black') am = 5;
        else if (alphaMode === 'green') am = 6;
        gl.uniform1i(alphaModeLocation, am);

        // Dynamically resize canvas to match the expected actual size
        if (video.videoWidth > 0 && video.videoHeight > 0) {
            const isHorizontal = alphaMode === 'right' || alphaMode === 'left';
            const isSplit = isHorizontal || alphaMode === 'top' || alphaMode === 'bottom';

            const targetWidth = isHorizontal ? Math.floor(video.videoWidth / 2) : video.videoWidth;
            const targetHeight = isSplit && !isHorizontal ? Math.floor(video.videoHeight / 2) : video.videoHeight;

            if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                gl.viewport(0, 0, targetWidth, targetHeight);
                setDetectedSize({ width: targetWidth, height: targetHeight });
                if (onDimensionsDetected) {
                    onDimensionsDetected({ 
                        width: targetWidth, 
                        height: targetHeight, 
                        duration: video.duration || 0 
                    });
                }
            }
        }

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }, [alphaMode, onDimensionsDetected]);

    // Initialize WebGL context & shaders
    useEffect(() => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video) return;

        const gl = canvas.getContext('webgl', { 
            alpha: true, 
            premultipliedAlpha: false,
            preserveDrawingBuffer: true 
        });
        if (!gl) {
            console.warn('[VAP Player] WebGL not supported on this device');
            return;
        }
        glRef.current = gl;

        // Shaders
        const vsSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;

        const fsSource = `
            precision mediump float;
            uniform sampler2D u_image;
            uniform int u_alphaMode;
            varying vec2 v_texCoord;
            void main() {
                vec2 rgbUV = v_texCoord;
                vec2 alphaUV = v_texCoord;
                
                // 0: right (Alpha Right, RGB Left)
                // 1: left (Alpha Left, RGB Right)
                // 2: bottom (Alpha Bottom, RGB Top)
                // 3: top (Alpha Top, RGB Bottom)
                // 4: white (Extract alpha from white background)
                // 5: black (Extract alpha from black background)
                // 6: green (Extract alpha from green screen)
                
                if (u_alphaMode < 4) {
                    if (u_alphaMode == 0) {
                        rgbUV.x = v_texCoord.x * 0.5;
                        alphaUV.x = v_texCoord.x * 0.5 + 0.5;
                    } else if (u_alphaMode == 1) {
                        rgbUV.x = v_texCoord.x * 0.5 + 0.5;
                        alphaUV.x = v_texCoord.x * 0.5;
                    } else if (u_alphaMode == 2) {
                        rgbUV.y = v_texCoord.y * 0.5 + 0.5;
                        alphaUV.y = v_texCoord.y * 0.5;
                    } else if (u_alphaMode == 3) {
                        rgbUV.y = v_texCoord.y * 0.5;
                        alphaUV.y = v_texCoord.y * 0.5 + 0.5;
                    }
                    
                    vec4 color = texture2D(u_image, rgbUV);
                    vec4 alphaStr = texture2D(u_image, alphaUV);
                    gl_FragColor = vec4(color.rgb, alphaStr.r);
                } else if (u_alphaMode == 4) {
                    vec4 color = texture2D(u_image, v_texCoord);
                    float minColor = min(min(color.r, color.g), color.b);
                    float alpha = 1.0 - minColor;
                    if (alpha <= 0.0) {
                        gl_FragColor = vec4(0.0);
                    } else {
                        vec3 rgb = clamp((color.rgb - 1.0 + alpha) / max(alpha, 0.001), 0.0, 1.0);
                        gl_FragColor = vec4(rgb, alpha);
                    }
                } else if (u_alphaMode == 5) {
                    vec4 color = texture2D(u_image, v_texCoord);
                    float maxColor = max(max(color.r, color.g), color.b);
                    float alpha = maxColor;
                    if (alpha <= 0.0) {
                        gl_FragColor = vec4(0.0);
                    } else {
                        gl_FragColor = vec4(color.rgb / max(alpha, 0.001), alpha);
                    }
                } else if (u_alphaMode == 6) {
                    vec4 color = texture2D(u_image, v_texCoord);
                    float maxRB = max(color.r, color.b);
                    float key = color.g - maxRB;
                    float alpha = smoothstep(0.05, 0.25, 1.0 - max(0.0, key * 2.0));
                    gl_FragColor = vec4(color.rgb, alpha);
                }
            }
        `;

        const createShader = (glCtx: WebGLRenderingContext, type: number, source: string) => {
            const shader = glCtx.createShader(type);
            if (!shader) return null;
            glCtx.shaderSource(shader, source);
            glCtx.compileShader(shader);
            if (!glCtx.getShaderParameter(shader, glCtx.COMPILE_STATUS)) {
                console.error(glCtx.getShaderInfoLog(shader));
                glCtx.deleteShader(shader);
                return null;
            }
            return shader;
        };

        const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
        const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
        if (!vertexShader || !fragmentShader) return;

        const program = gl.createProgram();
        if (!program) return;
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        gl.useProgram(program);
        programRef.current = program;

        // Buffers
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1.0, -1.0,
             1.0, -1.0,
            -1.0,  1.0,
            -1.0,  1.0,
             1.0, -1.0,
             1.0,  1.0,
        ]), gl.STATIC_DRAW);

        const texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0.0, 1.0,
            1.0, 1.0,
            0.0, 0.0,
            0.0, 0.0,
            1.0, 1.0,
            1.0, 0.0,
        ]), gl.STATIC_DRAW);

        const positionLocation = gl.getAttribLocation(program, "a_position");
        const texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
        alphaModeLocationRef.current = gl.getUniformLocation(program, "u_alphaMode");

        gl.enableVertexAttribArray(positionLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        gl.enableVertexAttribArray(texCoordLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

        // Texture
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        textureRef.current = texture;

        // Continuous render loop when playing
        const renderLoop = () => {
            renderFrame();
            requestRef.current = requestAnimationFrame(renderLoop);
        };

        const handlePlay = () => {
            setIsPlaying(true);
            if (!requestRef.current) {
                requestRef.current = requestAnimationFrame(renderLoop);
            }
        };

        const handlePause = () => {
            setIsPlaying(false);
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
                requestRef.current = null;
            }
            renderFrame();
        };

        const handleLoadedData = () => {
            if (video.duration) setDuration(video.duration);
            renderFrame();
            // Attempt autoplay on mobile
            video.play().then(() => {
                setIsPlaying(true);
            }).catch(() => {
                setIsPlaying(false);
            });
        };

        const handleTimeUpdate = () => {
            setCurrentTime(video.currentTime);
            if (!isPlaying) renderFrame();
        };

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('loadeddata', handleLoadedData);
        video.addEventListener('loadedmetadata', handleLoadedData);
        video.addEventListener('canplay', renderFrame);
        video.addEventListener('seeked', renderFrame);
        video.addEventListener('timeupdate', handleTimeUpdate);

        // Initial render if video has already loaded
        if (video.readyState >= 2) {
            handleLoadedData();
        }

        return () => {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
                requestRef.current = null;
            }
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('loadeddata', handleLoadedData);
            video.removeEventListener('loadedmetadata', handleLoadedData);
            video.removeEventListener('canplay', renderFrame);
            video.removeEventListener('seeked', renderFrame);
            video.removeEventListener('timeupdate', handleTimeUpdate);
        };
    }, [src, alphaMode, renderFrame]);

    // Handle toggle play/pause
    const togglePlay = () => {
        const video = videoRef.current;
        if (!video) return;

        triggerControlsVisibility();
        if (video.paused) {
            video.play().then(() => {
                setIsPlaying(true);
            }).catch((err) => {
                console.warn("[VAP Player] Play error:", err);
            });
        } else {
            video.pause();
            setIsPlaying(false);
        }
    };

    // Replay from start
    const handleReplay = (e: React.MouseEvent) => {
        e.stopPropagation();
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = 0;
        video.play().then(() => setIsPlaying(true)).catch(() => {});
        triggerControlsVisibility();
    };

    // Toggle Mute
    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        const video = videoRef.current;
        if (!video) return;
        const newMuted = !video.muted;
        video.muted = newMuted;
        setIsMuted(newMuted);
        triggerControlsVisibility();
    };

    // Seek handling
    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current;
        if (!video || !duration) return;
        const targetTime = parseFloat(e.target.value);
        video.currentTime = targetTime;
        setCurrentTime(targetTime);
        renderFrame();
        triggerControlsVisibility();
    };

    // Fullscreen toggle
    const toggleFullscreen = (e: React.MouseEvent) => {
        e.stopPropagation();
        const container = containerRef.current;
        if (!container) return;

        if (!document.fullscreenElement) {
            container.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
        }
    };

    // Format seconds to mm:ss
    const formatTime = (secs: number) => {
        if (isNaN(secs)) return '00:00';
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Determine background style
    const getBgStyle = () => {
        if (bgMode === 'black') return 'bg-black';
        if (bgMode === 'white') return 'bg-white';
        if (bgMode === 'dark') return 'bg-slate-950';
        if (bgMode === 'green') return 'bg-[#00FF00]';
        return "bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2ZmZiI+PC9yZWN0Pgo8cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNlNmU2ZTYiPjwvcmVjdD4KPHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNlNmU2ZTYiPjwvcmVjdD4KPC9zdmc+')] bg-repeat";
    };

    return (
        <div 
            ref={containerRef}
            onClick={triggerControlsVisibility}
            className={`relative flex items-center justify-center overflow-hidden select-none ${getBgStyle()} ${className}`}
        >
            {/* 
              CRITICAL MOBILE FIX:
              Never use 'display: none' (Tailwind 'hidden') on the video tag.
              iOS Safari and Android WebViews will suspend video hardware decoding 
              and fail to upload frames to WebGL textures if the element is 'display: none'.
              Instead, position it off-screen with 0.001 opacity.
            */}
            <video 
                ref={videoRef} 
                src={src} 
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '1px',
                    height: '1px',
                    opacity: 0.001,
                    pointerEvents: 'none',
                    zIndex: -10
                }}
                playsInline 
                webkit-playsinline="true"
                loop 
                muted={isMuted}
                autoPlay
                crossOrigin="anonymous"
            />

            {/* Hardware-Accelerated Alpha Canvas */}
            <canvas 
                ref={canvasRef} 
                width={width} 
                height={height} 
                className="max-w-full max-h-full object-contain cursor-pointer transition-transform"
                onClick={togglePlay}
            />

            {/* Tap/Play overlay when paused */}
            {!isPlaying && (
                <div 
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[2px] transition-all cursor-pointer z-10"
                >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-transform border border-white/20">
                        <Play className="w-8 h-8 sm:w-10 sm:h-10 ml-1 fill-white" />
                    </div>
                </div>
            )}

            {/* Bottom Playback Control Bar for Mobile & Desktop */}
            {showControls && (
                <div 
                    className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-6 transition-opacity duration-300 z-20 flex flex-col gap-2 ${
                        isControlsVisible || !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Scrubber Slider */}
                    <div className="flex items-center gap-2 w-full">
                        <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-300 min-w-[35px]">
                            {formatTime(currentTime)}
                        </span>
                        <input 
                            type="range"
                            min="0"
                            max={duration || 1}
                            step="0.05"
                            value={currentTime}
                            onChange={handleSeek}
                            className="flex-1 h-1.5 bg-white/20 accent-indigo-500 rounded-lg cursor-pointer"
                        />
                        <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-400 min-w-[35px]">
                            {formatTime(duration)}
                        </span>
                    </div>

                    {/* Button Row */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <button
                                type="button"
                                onClick={togglePlay}
                                className="p-2 sm:p-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-indigo-600 text-white transition-colors"
                                title={isPlaying ? "إيقاف مؤقت" : "تشغيل"}
                            >
                                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                            </button>

                            <button
                                type="button"
                                onClick={handleReplay}
                                className="p-2 sm:p-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-indigo-600 text-white transition-colors"
                                title="إعادة التشغيل من البداية"
                            >
                                <RotateCcw className="w-4 h-4" />
                            </button>

                            <button
                                type="button"
                                onClick={toggleMute}
                                className={`p-2 sm:p-2.5 rounded-xl transition-colors ${
                                    isMuted 
                                        ? 'bg-red-500/20 text-red-300 border border-red-500/30' 
                                        : 'bg-white/10 hover:bg-white/20 text-white'
                                }`}
                                title={isMuted ? "إلغاء كتم الصوت" : "كتم الصوت"}
                            >
                                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            {detectedSize.width > 0 && (
                                <span className="hidden xs:inline-block px-2 py-1 rounded-lg bg-black/60 text-[10px] font-mono text-indigo-300 border border-white/10">
                                    {detectedSize.width} × {detectedSize.height}
                                </span>
                            )}

                            <button
                                type="button"
                                onClick={toggleFullscreen}
                                className="p-2 sm:p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                                title="ملء الشاشة"
                            >
                                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
