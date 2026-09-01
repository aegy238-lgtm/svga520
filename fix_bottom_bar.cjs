const fs = require('fs');
let content = fs.readFileSync('src/components/UniversalMotionTools.tsx', 'utf8');

const oldStr = `                  <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono">
                          {isPlaybackMuted || (muteOriginalAudio && !audioUrl) ? (
                            <span className="text-red-400 flex items-center gap-1"><VolumeX className="w-3 h-3" /> كتم</span>
                          ) : audioUrl ? (
                            <span className="text-pink-400 flex items-center gap-1"><Headphones className="w-3 h-3" /> مدمج</span>
                          ) : null}`;

const newStr = `                  <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono">
                          {isPlaybackMuted || (muteOriginalAudio && !audioUrl) ? (
                            <span className="text-red-400 flex items-center gap-1"><VolumeX className="w-3 h-3" /> صامت</span>
                          ) : audioUrl ? (
                            <span className="text-pink-400 flex items-center gap-1"><Headphones className="w-3 h-3" /> مدمج</span>
                          ) : null}`;

content = content.replace(oldStr, newStr);
fs.writeFileSync('src/components/UniversalMotionTools.tsx', content);
