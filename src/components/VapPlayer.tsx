import React, { useEffect, useRef, useState } from 'react';

interface VapPlayerProps {
    src: string;
    width?: number;
    height?: number;
    className?: string;
    alphaMode?: 'none' | 'right' | 'left' | 'top' | 'bottom' | 'white' | 'black' | 'green';
}

export const VapPlayer: React.FC<VapPlayerProps> = ({ src, width, height, className, alphaMode = 'right' }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const requestRef = useRef<number | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video) return;

        const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
        if (!gl) return;

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

        // Fragment Shader for Side-by-Side (Left: RGB, Right: Alpha) and Luma keys
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
                        // Top-Bottom split
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
                    // White Background
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
                    // Black Background
                    vec4 color = texture2D(u_image, v_texCoord);
                    float maxColor = max(max(color.r, color.g), color.b);
                    float alpha = maxColor;
                    if (alpha <= 0.0) {
                        gl_FragColor = vec4(0.0);
                    } else {
                        gl_FragColor = vec4(color.rgb / max(alpha, 0.001), alpha);
                    }
                } else if (u_alphaMode == 6) {
                    // Green Screen (basic chroma key)
                    vec4 color = texture2D(u_image, v_texCoord);
                    float maxRB = max(color.r, color.b);
                    float key = color.g - maxRB;
                    float alpha = smoothstep(0.05, 0.25, 1.0 - max(0.0, key * 2.0));
                    gl_FragColor = vec4(color.rgb, alpha);
                }
            }
        `;

        // Compile Shaders
        const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
            const shader = gl.createShader(type);
            if (!shader) return null;
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error(gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
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
        // Flip Y for WebGL texture coordinates usually
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0.0, 1.0,
            1.0, 1.0,
            0.0, 0.0,
            0.0, 0.0,
            1.0, 1.0,
            1.0, 0.0,
        ]), gl.STATIC_DRAW);

        // Attributes & Uniforms
        const positionLocation = gl.getAttribLocation(program, "a_position");
        const texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
        const imageLocation = gl.getUniformLocation(program, "u_image");
        const alphaModeLocation = gl.getUniformLocation(program, "u_alphaMode");

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

        const render = () => {
            if (video.readyState >= video.HAVE_CURRENT_DATA) {
                // Set alpha mode
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
                    
                    const targetWidth = isHorizontal ? video.videoWidth / 2 : video.videoWidth;
                    const targetHeight = isSplit && !isHorizontal ? video.videoHeight / 2 : video.videoHeight;
                    
                    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
                        canvas.width = targetWidth;
                        canvas.height = targetHeight;
                        gl.viewport(0, 0, targetWidth, targetHeight);
                    }
                }

                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
            }
            requestRef.current = requestAnimationFrame(render);
        };

        video.addEventListener('play', () => {
            setIsPlaying(true);
            render();
        });

        video.addEventListener('pause', () => {
            setIsPlaying(false);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        });

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [src, alphaMode]);

    return (
        <div className={`relative ${className}`}>
            <video 
                ref={videoRef} 
                src={src} 
                className="hidden" 
                playsInline 
                loop 
                muted
                autoPlay // autoPlay added for consistency with the normal video tag
            />
            <canvas 
                ref={canvasRef} 
                width={width} 
                height={height} 
                className="w-full h-full object-contain cursor-pointer vap-player-canvas"
                onClick={() => {
                    if (videoRef.current) {
                        if (videoRef.current.paused) {
                            videoRef.current.play();
                        } else {
                            videoRef.current.pause();
                        }
                    }
                }}
            />
            {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity">
                    <div className="bg-black/50 rounded-full p-4 shadow-xl border border-white/10 backdrop-blur">
                        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                </div>
            )}
        </div>
    );
};
