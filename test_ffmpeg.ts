import { FFmpeg } from '@ffmpeg/ffmpeg';
const f = new FFmpeg();
f.off('progress', () => {});
