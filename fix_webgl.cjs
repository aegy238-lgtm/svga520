const fs = require('fs');
const path = 'src/components/UniversalMotionTools.tsx';
let code = fs.readFileSync(path, 'utf8');

const webglClass = `
class WebGLVapRenderer {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  positionBuffer: WebGLBuffer;
  texCoordBuffer: WebGLBuffer;
  texture: WebGLTexture;
  aPosition: number;
  aTexCoord: number;
  uImage: WebGLUniformLocation | null;
  uRgbRect: WebGLUniformLocation | null;
  uAlphaRect: WebGLUniformLocation | null;
  uThreshold: WebGLUniformLocation | null;
  uUnmultiply: WebGLUniformLocation | null;

  constructor(width: number, height: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    const gl = this.canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL not supported');
    this.gl = gl;

    const vsSource = \`
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    \`;

    const fsSource = \`
      precision highp float;
      varying vec2 v_texCoord;
      uniform sampler2D u_image;
      uniform vec4 u_rgbRect;
      uniform vec4 u_alphaRect;
      uniform float u_threshold;
      uniform float u_unmultiply;

      void main() {
        vec2 rgbCoord = vec2(u_rgbRect.x + v_texCoord.x * u_rgbRect.z, u_rgbRect.y + v_texCoord.y * u_rgbRect.w);
        vec2 alphaCoord = vec2(u_alphaRect.x + v_texCoord.x * u_alphaRect.z, u_alphaRect.y + v_texCoord.y * u_alphaRect.w);

        vec4 rgbPixel = texture2D(u_image, rgbCoord);
        vec4 alphaPixel = texture2D(u_image, alphaCoord);

        float rawAlpha = 0.299 * alphaPixel.r + 0.587 * alphaPixel.g + 0.114 * alphaPixel.b;
        
        if (rawAlpha <= u_threshold) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        } else {
            float aVal = min(1.0, (rawAlpha - u_threshold) / (1.0 - u_threshold));
            vec3 color = rgbPixel.rgb;
            if (u_unmultiply > 0.5 && aVal > 0.02) {
                color = clamp(color / aVal, 0.0, 1.0);
            }
            gl_FragColor = vec4(color, aVal);
        }
      }
    \`;

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
    this.program = gl.createProgram()!;
    gl.attachShader(this.program, vs!);
    gl.attachShader(this.program, fs!);
    gl.linkProgram(this.program);

    this.aPosition = gl.getAttribLocation(this.program, 'a_position');
    this.aTexCoord = gl.getAttribLocation(this.program, 'a_texCoord');
    this.uImage = gl.getUniformLocation(this.program, 'u_image');
    this.uRgbRect = gl.getUniformLocation(this.program, 'u_rgbRect');
    this.uAlphaRect = gl.getUniformLocation(this.program, 'u_alphaRect');
    this.uThreshold = gl.getUniformLocation(this.program, 'u_threshold');
    this.uUnmultiply = gl.getUniformLocation(this.program, 'u_unmultiply');

    this.positionBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1.0, -1.0,   1.0, -1.0,   -1.0,  1.0,
      -1.0,  1.0,   1.0, -1.0,    1.0,  1.0
    ]), gl.STATIC_DRAW);

    this.texCoordBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
       0.0,  1.0,   1.0,  1.0,    0.0,  0.0,
       0.0,  0.0,   1.0,  1.0,    1.0,  0.0
    ]), gl.STATIC_DRAW);

    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }

  render(video: HTMLVideoElement, rgbRect: number[], alphaRect: number[], threshold: number, unmultiply: boolean) {
    const gl = this.gl;
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.aPosition);
    gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.aTexCoord);
    gl.vertexAttribPointer(this.aTexCoord, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    gl.uniform1i(this.uImage, 0);

    gl.uniform4f(this.uRgbRect, rgbRect[0]/vw, rgbRect[1]/vh, rgbRect[2]/vw, rgbRect[3]/vh);
    gl.uniform4f(this.uAlphaRect, alphaRect[0]/vw, alphaRect[1]/vh, alphaRect[2]/vw, alphaRect[3]/vh);
    gl.uniform1f(this.uThreshold, threshold / 255.0);
    gl.uniform1f(this.uUnmultiply, unmultiply ? 1.0 : 0.0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    return this.canvas;
  }
}
`;

// Insert the WebGLVapRenderer class before UniversalMotionTools
const insertIdx = code.indexOf('export const UniversalMotionTools');
if (insertIdx !== -1 && !code.includes('WebGLVapRenderer')) {
  code = code.substring(0, insertIdx) + webglClass + '\n' + code.substring(insertIdx);
  fs.writeFileSync(path, code);
  console.log('Injected WebGL class');
} else {
  console.log('Failed to inject WebGL class');
}

