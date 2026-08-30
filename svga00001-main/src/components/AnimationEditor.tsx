import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Layers, MousePointer2, Move, Hand, Search, Undo, Redo, LayoutGrid, Download, Share2, Type, Hexagon, Crosshair, Play, Pause, ChevronRight, Settings, Upload, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import * as JSZip from 'jszip';
import * as pako from 'pako';
import { UserRecord } from '../types';
import { svgaSchema } from '../svga-proto';

declare var protobuf: any;
declare global {
  interface Window {
    SVGA: any;
  }
}

interface AnimationEditorProps {
  currentUser: UserRecord | null;
  onCancel: () => void;
  onSubscriptionRequired: () => void;
}

export const AnimationEditor: React.FC<AnimationEditorProps> = ({ currentUser, onCancel }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [filesLoaded, setFilesLoaded] = useState(false);
  const [layers, setLayers] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>('No file loaded');
  const [images, setImages] = useState<Record<string, Uint8Array>>({});
  const [svgaParams, setSvgaParams] = useState<any>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [player, setPlayer] = useState<any>(null);
  const [videoItemRef, setVideoItemRef] = useState<any>(null);
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(new Set());
  
  const [parsedProto, setParsedProto] = useState<any>(null);
  const [selectedLayerKey, setSelectedLayerKey] = useState<string | null>(null);
  const [layerOffsets, setLayerOffsets] = useState<Record<string, {x: number, y: number, scale: number, rotation: number, alpha: number}>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addLayerInputRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const reloadPlayerFromProto = async (protoMessage: any, preserveFrame = false) => {
      try {
          const root = protobuf.parse(svgaSchema).root;
          const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
          const buffer = MovieEntity.encode(MovieEntity.create(protoMessage)).finish();
          const compressedBuffer = pako.deflate(buffer);
          
          const blob = new Blob([compressedBuffer], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          
          const newPlayer = player || new window.SVGA.Player(canvasContainerRef.current);
          const parser = new window.SVGA.Parser();
          
          newPlayer.loops = 0;
          newPlayer.clearsAfterStop = false;
          
          if (!player) {
              newPlayer.onFrame((frame: number) => {
                  setCurrentFrame(frame);
              });
          }

          parser.load(url, (videoItem: any) => {
              setVideoItemRef(videoItem);
              newPlayer.setVideoItem(videoItem);
              if (preserveFrame) {
                 newPlayer.stepToFrame(currentFrame, isPlaying);
              } else {
                 newPlayer.startAnimation();
                 setIsPlaying(true);
              }
              setPlayer(newPlayer);
              URL.revokeObjectURL(url);
          });
      } catch (err) {
          console.error("Failed to reload player", err);
      }
  };


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | { target: { files: FileList } }) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFilesLoaded(true);
    setCurrentFile(file);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let message: any;

      const root = protobuf.parse(svgaSchema).root;
      const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");

      if (uint8Array[0] === 0x50 && uint8Array[1] === 0x4B) {
        const zip = await JSZip.loadAsync(uint8Array);
        const binaryFile = zip.file("movie.binary");
        if (binaryFile) {
          const binaryData = await binaryFile.async("uint8array");
          message = MovieEntity.decode(binaryData);
        } else {
            console.error("Invalid SVGA 1.0 file: movie.binary not found.");
            return;
        }
      } else {
        let inflated: Uint8Array;
        try {
            inflated = pako.inflate(uint8Array);
        } catch (err) {
            inflated = uint8Array;
        }
        message = MovieEntity.decode(inflated);
      }

      setParsedProto(message);
      setSvgaParams(message.params);
      
      if (message.sprites) {
        const parsedLayers = message.sprites.map((sprite: any, index: number) => ({
          id: `layer_${index}`,
          name: sprite.imageKey || `Layer ${index}`,
          visible: true,
          locked: false,
          imageKey: sprite.imageKey,
          frames: sprite.frames || []
        }));
        setLayers(parsedLayers);
      }
      
      if (message.images) {
          setImages(message.images);
      }

      setLayerOffsets({});
      setSelectedLayerKey(null);
      await reloadPlayerFromProto(message);

    } catch (error) {
      console.error("Failed to parse SVGA file:", error);
      alert("Failed to parse SVGA file. Please check the console for details.");
    }
  };

  const handleAddImageLayer = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !parsedProto) return;

      const reader = new FileReader();
      reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          const imgBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
          
          const newImageKey = `added_img_${Date.now()}`;
          
          const newParsedProto = { ...parsedProto };
          newParsedProto.images = newParsedProto.images || {};
          newParsedProto.images[newImageKey] = imgBytes;

          const frames = [];
          for (let i = 0; i < newParsedProto.params.frames; i++) {
              frames.push({
                  alpha: 1,
                  transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
                  layout: { x: 0, y: 0, width: 200, height: 200 }
              });
          }
          
          const newSprite = {
              imageKey: newImageKey,
              frames: frames
          };

          newParsedProto.sprites = [newSprite, ...(newParsedProto.sprites || [])];
          
          setParsedProto(newParsedProto);
          setImages(newParsedProto.images);
          
          const newLayer = {
              id: `layer_${Date.now()}`,
              name: `New Layer (${file.name})`,
              visible: true,
              locked: false,
              imageKey: newImageKey,
              frames: frames
          };
          setLayers([newLayer, ...layers]);
          setSelectedLayerKey(newImageKey);

          await reloadPlayerFromProto(newParsedProto, true);
      };
      reader.readAsDataURL(file);
  };

  const applyOffsets = async () => {
      if (!selectedLayerKey || !parsedProto) return;
      const offsets = layerOffsets[selectedLayerKey];
      if (!offsets) return;

      const newSprites = JSON.parse(JSON.stringify(parsedProto.sprites));
      const sprite = newSprites.find((s: any) => s.imageKey === selectedLayerKey);
      if (sprite) {
          sprite.frames.forEach((frame: any) => {
              frame.transform = frame.transform || {a:1, b:0, c:0, d:1, tx:0, ty:0};
              frame.transform.tx = (frame.transform.tx || 0) + offsets.x;
              frame.transform.ty = (frame.transform.ty || 0) + offsets.y;
              frame.transform.a = (frame.transform.a || 1) * offsets.scale;
              frame.transform.d = (frame.transform.d || 1) * offsets.scale;
              frame.alpha = Math.max(0, Math.min(1, (frame.alpha !== undefined ? frame.alpha : 1) * offsets.alpha));
          });
      }

      const newProto = { ...parsedProto, sprites: newSprites };
      setParsedProto(newProto);
      
      setLayerOffsets({ ...layerOffsets, [selectedLayerKey]: { x: 0, y: 0, scale: 1, rotation: 0, alpha: 1 } });
      
      await reloadPlayerFromProto(newProto, true);
  };

  const toggleLayerVisibility = (imageKey: string) => {
      if (!player || !videoItemRef) return;
      
      const newHidden = new Set(hiddenLayers);
      const transparentPixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
      
      if (newHidden.has(imageKey)) {
          newHidden.delete(imageKey);
          player.setImage(videoItemRef.images[imageKey], imageKey);
      } else {
          newHidden.add(imageKey);
          player.setImage(transparentPixel, imageKey);
      }
      setHiddenLayers(newHidden);
  };

  const togglePlayback = () => {
      if (!player) return;
      if (isPlaying) {
          player.pauseAnimation();
          setIsPlaying(false);
      } else {
          player.startAnimation();
          setIsPlaying(true);
      }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const ev = { target: { files: e.dataTransfer.files } } as any;
      handleFileUpload(ev);
    }
  };

  const handleTimelineSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const frame = parseInt(e.target.value);
      setCurrentFrame(frame);
      if (player) {
          player.stepToFrame(frame, isPlaying);
      }
  };

  const exportSVGA = async () => {
      if (!currentFile || !svgaParams || !filesLoaded) return;

      try {
          const root = protobuf.parse(svgaSchema).root;
          const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
          
          const filteredSprites = layers
            .filter((l: any) => !hiddenLayers.has(l.imageKey))
            .map((l: any) => {
                // Ensure the sprite structure respects the original svga frame data
                // In protobuf schema it generally uses the imageKey, frames, etc
                return {
                    imageKey: l.imageKey,
                    frames: l.frames || []
                };
            });
          
          const payload = {
              version: "2.0",
              params: svgaParams,
              images: images,
              sprites: filteredSprites,
              audios: videoItemRef?.audios || []
          };
          
          const buffer = MovieEntity.encode(MovieEntity.create(payload)).finish();
          const compressedBuffer = pako.deflate(buffer);
          
          const blob = new Blob([compressedBuffer], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `edited_${fileName}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
      } catch (error) {
          console.error("Export failed:", error);
          alert("Export failed. Please check the console.");
      }
  };

  return (
    <div className="fixed inset-0 bg-[#1e1e1e] text-slate-300 z-[100] flex flex-col font-sans" onDragOver={handleDragOver} onDrop={handleDrop}>
      {/* 1. Top Navbar / Toolbar */}
      <div className="h-14 border-b border-[#333] flex items-center justify-between px-4 bg-[#252526]">
        {/* Left: Tools */}
        <div className="flex items-center gap-1">
          <button className="p-2 hover:bg-[#333] rounded"><MousePointer2 size={18} /></button>
          <button className="p-2 hover:bg-[#333] rounded"><Crosshair size={18} /></button>
          <button className="p-2 hover:bg-[#333] rounded"><Hexagon size={18} /></button>
          <button className="p-2 hover:bg-[#333] rounded"><Type size={18} /></button>
          <button className="p-2 hover:bg-[#333] rounded"><Hand size={18} /></button>
          <button className="p-2 hover:bg-[#333] rounded"><Search size={18} /></button>
          <div className="w-px h-6 bg-[#444] mx-2"></div>
           <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#333] hover:bg-[#444] rounded text-sm transition-colors"
          >
            <Upload size={16} /> Open SVGA
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="*/*"
            onChange={handleFileUpload as any}
          />
        </div>

        {/* Center: File Name */}
        <div className="flex flex-col items-center flex-1">
          <div className="flex items-center gap-2 text-slate-100 font-medium tracking-wide">
            <span>{fileName}</span>
          </div>
          <span className="text-[10px] text-slate-400">
            {filesLoaded ? `Loaded successfully` : 'No file loaded'} 
            {svgaParams && ` • ${svgaParams.viewBoxWidth}x${svgaParams.viewBoxHeight} • ${svgaParams.fps} FPS`}
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button className="p-1.5 hover:bg-[#333] rounded" title="Undo"><Undo size={16} /></button>
          <button className="p-1.5 hover:bg-[#333] rounded" title="Redo"><Redo size={16} /></button>
          <div className="w-px h-6 bg-[#444] mx-2"></div>
          <button className="px-4 py-1.5 text-sm hover:bg-[#333] rounded">Share</button>
          <button onClick={exportSVGA} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium transition-colors">Export</button>
          <button onClick={onCancel} className="px-4 py-1.5 hover:bg-red-900/50 text-red-400 rounded text-sm ml-2 transition-colors">Close</button>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Sidebar: Layers */}
        <div className="w-64 border-r border-[#333] bg-[#252526] flex flex-col z-20">
          <div className="flex items-center justify-between p-3 border-b border-[#333]">
            <div className="flex items-center gap-2 font-medium">
              <Layers size={16} /> Layers
            </div>
            <button onClick={() => addLayerInputRef.current?.click()} className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#333] transition-colors" title="Add Image Layer">
              <Plus size={14} />
            </button>
            <input type="file" ref={addLayerInputRef} className="hidden" accept="image/png,image/jpeg" onChange={handleAddImageLayer} />
          </div>
          <div className="flex items-center justify-between px-4 py-2 text-[10px] text-slate-500 uppercase tracking-widest border-b border-[#222]">
            <span>{layers.length} editable layers</span>
            <span>virtualized</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {layers.map((l, i) => {
              const isHidden = hiddenLayers.has(l.imageKey);
              return (
              <div 
                key={l.id} 
                onClick={() => setSelectedLayerKey(l.imageKey)}
                className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer group text-sm border-b border-white/5 transition-colors ${selectedLayerKey === l.imageKey ? 'bg-[#3b3e52]' : 'hover:bg-[#2a2d3e]'}`}
              >
                <button 
                    onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(l.imageKey); }}
                    className={`flex-shrink-0 p-1 rounded hover:bg-white/10 ${isHidden ? 'text-slate-500' : 'text-slate-300'}`}
                >
                    {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <div className="w-4 h-4 bg-slate-700/50 rounded flex flex-shrink-0 items-center justify-center">
                  <span className="text-[8px]">{l.frames.length > 0 ? l.frames.length : '-'}</span>
                </div>
                <span className={`truncate flex-1 ${isHidden ? 'opacity-50' : ''}`} title={l.name}>{l.name}</span>
                {selectedLayerKey === l.imageKey && (
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            if(confirm('Delete this layer?')) {
                               const newSprites = parsedProto.sprites.filter((s: any) => s.imageKey !== l.imageKey);
                               const newProto = { ...parsedProto, sprites: newSprites };
                               setParsedProto(newProto);
                               setLayers(layers.filter(layer => layer.imageKey !== l.imageKey));
                               if (selectedLayerKey === l.imageKey) setSelectedLayerKey(null);
                               reloadPlayerFromProto(newProto, true);
                            }
                        }}
                        className="text-red-400 hover:text-red-300 p-1 rounded"
                    >
                        <Trash2 size={14} />
                    </button>
                )}
                <button className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white p-1 rounded">
                  <Settings size={14} />
                </button>
              </div>
            )})}
            {layers.length === 0 && (
                <div className="p-6 text-center text-slate-500 text-sm">
                    No layers. Open an SVGA file to begin.
                </div>
            )}
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 bg-[#1a1a1a] flex items-center justify-center relative overflow-hidden">
           {/* Transparency Grid Pattern */}
           <div 
             className="absolute inset-0 opacity-20 pointer-events-none" 
             style={{
               backgroundImage: 'linear-gradient(45deg, #333 25%, transparent 25%, transparent 75%, #333 75%, #333), linear-gradient(45deg, #333 25%, transparent 25%, transparent 75%, #333 75%, #333)',
               backgroundSize: '20px 20px',
               backgroundPosition: '0 0, 10px 10px'
             }}
           />
           
           {!filesLoaded && (
               <div className="text-center animate-pulse opacity-50 z-10 pointer-events-none">
                 <Upload size={48} className="mx-auto mb-4" />
                 <span className="text-sm font-mono text-slate-400">Drag & Drop SVGA file here...</span>
               </div>
           )}

           <div 
             ref={canvasContainerRef}
             className={`bg-transparent border border-[#444] rounded shadow-2xl relative z-10 overflow-hidden ${filesLoaded ? 'block' : 'hidden'}`}
             style={{
                 width: svgaParams ? svgaParams.viewBoxWidth : 400,
                 height: svgaParams ? svgaParams.viewBoxHeight : 400,
                 maxWidth: '90%',
                 maxHeight: '90%',
                 objectFit: 'contain'
             }}
           />
        </div>

        {/* Right Sidebar: Properties */}
        <div className="w-72 border-l border-[#333] bg-[#252526] flex flex-col z-20">
          <div className="p-4 border-b border-[#333] font-medium flex items-center gap-2">
            <LayoutGrid size={16} /> Properties
          </div>
          {selectedLayerKey ? (
              <div className="p-6 flex flex-col gap-6 text-sm flex-1 overflow-y-auto custom-scrollbar">
                 <div className="font-semibold text-slate-300 border-b border-[#444] pb-2">Layer Overrides</div>
                 
                 <div>
                   <label className="text-slate-500 mb-2 flex justify-between">
                     <span>X Offset</span>
                     <span className="text-white font-mono">{layerOffsets[selectedLayerKey]?.x || 0}px</span>
                   </label>
                   <input type="range" min={-500} max={500} value={layerOffsets[selectedLayerKey]?.x || 0} 
                      onChange={(e) => setLayerOffsets({...layerOffsets, [selectedLayerKey]: {...(layerOffsets[selectedLayerKey] || {x:0,y:0,scale:1,rotation:0,alpha:1}), x: parseInt(e.target.value)}})} 
                      className="w-full h-1 bg-[#444] rounded outline-none appearance-none cursor-ew-resize accent-indigo-500"
                   />
                 </div>

                 <div>
                   <label className="text-slate-500 mb-2 flex justify-between">
                     <span>Y Offset</span>
                     <span className="text-white font-mono">{layerOffsets[selectedLayerKey]?.y || 0}px</span>
                   </label>
                   <input type="range" min={-500} max={500} value={layerOffsets[selectedLayerKey]?.y || 0} 
                      onChange={(e) => setLayerOffsets({...layerOffsets, [selectedLayerKey]: {...(layerOffsets[selectedLayerKey] || {x:0,y:0,scale:1,rotation:0,alpha:1}), y: parseInt(e.target.value)}})} 
                      className="w-full h-1 bg-[#444] rounded outline-none appearance-none cursor-ew-resize accent-indigo-500"
                   />
                 </div>

                 <div>
                   <label className="text-slate-500 mb-2 flex justify-between">
                     <span>Scale</span>
                     <span className="text-white font-mono">{(layerOffsets[selectedLayerKey]?.scale || 1).toFixed(2)}x</span>
                   </label>
                   <input type="range" min={0.1} max={5} step={0.1} value={layerOffsets[selectedLayerKey]?.scale || 1} 
                      onChange={(e) => setLayerOffsets({...layerOffsets, [selectedLayerKey]: {...(layerOffsets[selectedLayerKey] || {x:0,y:0,scale:1,rotation:0,alpha:1}), scale: parseFloat(e.target.value)}})} 
                      className="w-full h-1 bg-[#444] rounded outline-none appearance-none cursor-ew-resize accent-indigo-500"
                   />
                 </div>

                 <div className="pt-4 border-t border-[#444]">
                     <button onClick={applyOffsets} className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-white font-medium transition-colors shadow-lg shadow-indigo-500/20">
                         Apply to Player
                     </button>
                     <p className="text-[10px] text-slate-500 mt-2 text-center">
                       Applies transforms to all frames of this layer.
                     </p>
                 </div>
              </div>
          ) : (
              <div className="p-6 text-sm text-slate-500 text-center flex-1">
                Select a layer from the Layers panel to edit its properties.
              </div>
          )}
        </div>
      </div>

      {/* Bottom Timeline */}
      <div className="h-64 border-t border-[#333] bg-[#252526] flex flex-col relative z-20 shadow-[0_-10px_20px_rgba(0,0,0,0.2)]">
        {/* Timeline Header */}
        <div className="h-10 border-b border-[#333] flex items-center bg-[#1e1e1e] text-xs">
           <div className="w-64 border-r border-[#333] px-4 flex items-center justify-between">
              <span className="font-medium flex items-center gap-3">
                  <button onClick={togglePlayback} className="hover:text-white p-1.5 rounded hover:bg-slate-700 bg-slate-800 transition-colors">
                      {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                  </button>
                  <span className="font-mono text-slate-300">
                      {currentFrame} / {svgaParams ? svgaParams.frames : 0}f
                  </span>
              </span>
           </div>
           
           {/* Timeline Ruler */}
           <div className="flex-1 flex px-4 relative items-center h-full">
              {svgaParams && (
                <input 
                    type="range"
                    min={0}
                    max={svgaParams.frames}
                    value={currentFrame}
                    onChange={handleTimelineSeek}
                    className="absolute inset-y-0 left-4 right-4 w-[calc(100%-2rem)] h-full opacity-0 z-50 cursor-ew-resize"
                />
              )}
              
              <div className="w-full flex justify-between text-slate-500 px-4 pointer-events-none text-[10px]">
                  {[...Array(9)].map((_, i) => (
                      <div key={i} className="flex flex-col items-center">
                          <div className="h-1 w-px bg-[#444] mb-1"></div>
                          <span>{svgaParams ? ((svgaParams.frames / 8) * i).toFixed(0) : 0}f</span>
                      </div>
                  ))}
              </div>

              {/* Playhead marker */}
              {svgaParams && (
                  <div 
                      className="absolute top-0 bottom-0 w-px bg-red-500 z-40 transition-transform duration-75 ease-linear pointer-events-none"
                      style={{
                          left: `calc(1rem + ${(currentFrame / svgaParams.frames) * 100}%)`,
                          transform: 'translateX(-50%)'
                      }}
                  >
                     <div className="w-2.5 h-3 bg-red-500 rounded-b absolute top-0 -left-[4.5px]"></div>
                  </div>
              )}
           </div>
        </div>

        {/* Timeline Tracks */}
        <div className="flex-1 flex overflow-hidden">
          <div className="w-64 border-r border-[#333] flex flex-col overflow-y-auto bg-[#252526] shadow-xl z-30 custom-scrollbar pb-10">
             {layers.map((l, i) => (
                <div key={l.id} className="h-10 border-b border-[#333] px-4 flex items-center text-xs text-slate-300 hover:bg-[#333] transition-colors">
                   <ChevronRight size={14} className="mr-2 opacity-50" />
                   <span className={`truncate ${hiddenLayers.has(l.imageKey) ? 'opacity-50' : ''}`} title={l.name}>{l.name}</span>
                </div>
             ))}
          </div>
          
          <div className="flex-1 bg-[#1e1e1e] flex flex-col overflow-y-auto relative custom-scrollbar overflow-x-hidden pb-10">
             {layers.map((l, i) => (
                <div key={l.id} className="h-10 border-b border-[#333] relative flex items-center group hover:bg-[#252526] transition-colors">
                   {/* Layer Bar */}
                   {l.frames && l.frames.length > 0 && (
                       <div 
                         className="absolute top-1.5 bottom-1.5 left-0 bg-[#6366f1]/20 border border-[#6366f1]/80 rounded text-[10px] text-indigo-300 px-2 flex items-center shadow-inner overflow-hidden whitespace-nowrap overflow-ellipsis"
                         style={{
                             left: `0%`,
                             width: `${(l.frames.length / (svgaParams?.frames || 1)) * 100}%`
                         }}
                       >
                         <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                             {l.frames.length} keyframes
                         </span>
                       </div>
                   )}
                </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
};

