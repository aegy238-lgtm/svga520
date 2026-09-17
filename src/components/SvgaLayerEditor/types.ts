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
  hasAnyExplicitAlpha?: boolean;
  activeFrames?: number[];
  isSequenceOrRepeated?: boolean;
  sequenceGroupId?: string;
  sequenceIndex?: number;
  sequenceTotal?: number;
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
  sequenceGroupId?: string;
  sequenceIndex?: number;
  sequenceTotal?: number;
  
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
  blendMode?: string;
  isMatteMask?: boolean;
  framesCount: number;
  keyframeSummary: SVGAKeyframeSummary;

  // Visibility Time Span & Track Color
  inFrame?: number;   // Start frame of appearance (defaults to 0)
  outFrame?: number;  // End frame of appearance (defaults to totalFrames - 1)
  trackColor?: string; // Hex color for the timeline clip bar (e.g. '#ef4444' for red)

  // Merged layer properties
  isMerged?: boolean;
  mergedLayers?: EditableLayer[];
  mergedLayersCount?: number;
  motionReferenceLayerId?: string;
  isMotionSynced?: boolean;

  // Layer Shine Effect Configuration
  shineConfig?: ShineEffectConfig;

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

export interface FadeConfig {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export type CropShape = 
  | 'rect' 
  | 'square' 
  | 'circle' 
  | 'ellipse' 
  | 'rounded-rect' 
  | 'capsule' 
  | 'diamond';

export interface CropConfig {
  top: number;
  bottom: number;
  left: number;
  right: number;
  shape?: CropShape;
  cornerRadius?: number;
}

export interface CropFeather {
  top: number;
  bottom: number;
  left: number;
  right: number;
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
  fadeConfig?: FadeConfig;
  cropConfig?: CropConfig;
  cropFeather?: CropFeather;
}

export interface GuideLine {
  type: 'vertical' | 'horizontal';
  position: number;
}

export type CanvasTool = 'select' | 'hand' | 'zoom';

export interface ShineEffectConfig {
  enabled: boolean;
  beamWidth?: number;          // width in px (default 50)
  angleDeg?: number;           // angle deg (default 90)
  opacity?: number;            // max opacity (0.1 to 1.0)
  featherSides?: number;       // side feather (0 to 1)
  featherTopBottom?: number;   // top/bottom feather (0 to 1)
  maskToAlpha?: boolean;       // mask to layer image boundary
  color?: string;              // RGB color string e.g. "255, 255, 255"
  keyframeStart?: number;      // 0.0 to 1.0 (default 0.0)
  keyframeEnd?: number;        // 0.0 to 1.0 (default 1.0)
  durationSeconds?: number;    // duration (default 2.0)
}
