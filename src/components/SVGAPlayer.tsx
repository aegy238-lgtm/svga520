import React, { useEffect, useRef } from 'react';
import { Player, Parser } from 'svga.lite';

interface SVGAPlayerProps {
  data: any;
  className?: string;
  replacedImages?: Record<string, string>;
  replacedColors?: Record<string, string>;
}

const SVGAPlayer: React.FC<SVGAPlayerProps> = ({ data, className, replacedImages, replacedColors }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);

  useEffect(() => {
    if (!containerRef.current || !data) return;

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    containerRef.current.appendChild(canvas);

    const parser = new Parser();
    const player = new Player(canvas);
    playerRef.current = player;

    const init = async () => {
      try {
        const svgaData = await parser.do(data);
        
        // Apply Replaced Images
        if (replacedImages && svgaData.images) {
          for (const [key, base64] of Object.entries(replacedImages)) {
            if (base64 && svgaData.images[key]) {
              // Convert base64 to Uint8Array
              const base64Data = (base64 as string).split(',')[1] || base64;
              const binaryString = atob(base64Data as string);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              svgaData.images[key] = bytes;
            }
          }
        }

        // Apply Replaced Colors
        if (replacedColors && svgaData.sprites && Object.keys(replacedColors).length > 0) {
          const hexToRgba = (hex: string, originalA: number) => {
            const r = parseInt(hex.slice(1, 3), 16) / 255;
            const g = parseInt(hex.slice(3, 5), 16) / 255;
            const b = parseInt(hex.slice(5, 7), 16) / 255;
            return { r, g, b, a: originalA };
          };

          const rgbaToHex = (r: number, g: number, b: number, a: number) => {
            const toHex = (n: number) => {
              const hex = Math.round(n * 255).toString(16);
              return hex.length === 1 ? '0' + hex : hex;
            };
            return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
          };

          for (const sprite of svgaData.sprites) {
            if (sprite.frames) {
              for (const frame of sprite.frames) {
                if (frame.shapes) {
                  for (const shape of frame.shapes) {
                    if (shape.styles) {
                      if (shape.styles.fill && typeof shape.styles.fill.r === 'number') {
                        const c = shape.styles.fill;
                        const hex = rgbaToHex(c.r, c.g, c.b, c.a);
                        if (replacedColors[hex]) {
                          shape.styles.fill = hexToRgba(replacedColors[hex], c.a);
                        }
                      }
                      if (shape.styles.stroke && typeof shape.styles.stroke.r === 'number') {
                        const c = shape.styles.stroke;
                        const hex = rgbaToHex(c.r, c.g, c.b, c.a);
                        if (replacedColors[hex]) {
                          shape.styles.stroke = hexToRgba(replacedColors[hex], c.a);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

        await player.mount(svgaData);
        player.start();
      } catch (error) {
        console.error('Failed to load SVGA:', error);
      }
    };

    init();

    return () => {
      player.destroy();
      if (containerRef.current && canvas.parentNode === containerRef.current) {
        containerRef.current.removeChild(canvas);
      }
    };
  }, [data, replacedImages, replacedColors]);

  return <div ref={containerRef} className={className} id="svga-container" />;
};

export default SVGAPlayer;
