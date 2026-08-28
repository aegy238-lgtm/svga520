export type ColorFillType = 'color' | 'gradient' | 'image';

export interface ColorFill {
  type: ColorFillType;
  color: string; // HEX or RGB
  gradient?: {
    color1: string;
    color2: string;
    angle: number;
  };
  image?: HTMLImageElement | null;
  imageUrl?: string;
}

export interface Ornament {
  id: string;
  type: 'arabic' | 'english' | 'symbol';
  char: string; // The character or path
  x: number;
  y: number;
  scale: number;
  rotation: number;
  fill: ColorFill;
  zIndex: number;
}

export interface Name3DState {
  text: string;
  fontFamily: string;
  fontSize: number;
  letterSpacing: number;
  lineHeight: number;
  textAlign: 'left' | 'center' | 'right';
  textX: number;
  textY: number;
  textRotation: number;
  
  frontFill: ColorFill;
  sideFill: ColorFill;
  
  depth: number;
  depthAngle: number;
  
  lightingIntensity: number;
  glossiness: number;
  
  shadow: {
    enabled: boolean;
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
  
  ornaments: Ornament[];
  
  canvasWidth: number;
  canvasHeight: number;
  bgColor: string;
  transparentBg: boolean;
}
