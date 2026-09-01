export interface LayerTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number; // in degrees
  opacity: number;  // 0 to 100
}

export type KeyframeEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'cubic-bezier' | 'step';

export interface LayerKeyframe {
  id: string;
  frame: number; // 0 to totalFrames - 1
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  opacity?: number;
  easing: KeyframeEasing;
  cubicBezier?: [number, number, number, number]; // [x1, y1, x2, y2] default: [0.25, 0.1, 0.25, 1.0]
}

export interface MotionTracksConfig {
  showTransform: boolean;
  showPosition: boolean;
  showScale: boolean;
  showRotation: boolean;
  showOpacity: boolean;
}

export interface SVGAKeyframeSummary {
  startFrame: number;
  endFrame: number;
  hasShapes: boolean;
  hasTransform: boolean;
}

export interface EditableLayer {
  id: string;
  originalIndex: number;
  imageKey: string;
  name: string;
  type: 'image' | 'shape' | 'composite';
  visible: boolean;
  locked: boolean;
  thumbnailUrl?: string;
  groupId?: string;
  groupName?: string;
  
  // Transform properties
  transform: LayerTransform;
  initialBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  
  // Aspect ratio lock toggle
  aspectRatioLocked: boolean;
  
  // Motion Animation Keyframes
  keyframes?: LayerKeyframe[];
  motionTracksConfig?: MotionTracksConfig;
  isMotionExpanded?: boolean;

  // Associated sprite data
  spriteRef: any;
  matteKey?: string;
  framesCount: number;
  keyframeSummary: SVGAKeyframeSummary;

  // Merged layer properties
  isMerged?: boolean;
  mergedLayers?: EditableLayer[];
  mergedLayersCount?: number;
  motionReferenceLayerId?: string;
  isMotionSynced?: boolean;

  // Original immutable snapshot for absolute reset independent of copies/merges
  originalInitialBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  originalTransform?: LayerTransform;
  originalSpriteFrames?: any[];
  originalKeyframes?: LayerKeyframe[];
  isDuplicate?: boolean;
  sourceLayerId?: string;
}

export interface SVGAAudioTrack {
  audioKey: string;
  startFrame: number;
  endFrame: number;
  startTime: number; // in ms
  totalTime: number; // in ms
  name?: string;
  dataUrl?: string;
  durationSec?: number;
}

export interface SVGAProjectData {
  fileName: string;
  fileSize: number;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  durationSec: number;
  imagesMap: Record<string, string>; // key -> DataURL
  rawImages: Record<string, Uint8Array>; // key -> bytes
  audios: SVGAAudioTrack[];
  rawMovie: any; // Raw protobuf object
}

export interface GuideLine {
  type: 'vertical' | 'horizontal';
  position: number;
}

export type CanvasTool = 'select' | 'hand' | 'zoom';
