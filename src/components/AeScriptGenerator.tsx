import React, { useState } from 'react';
import { FileCode, Clock, Layers, Copy, Download, Check } from 'lucide-react';
import { generateAESyncScript } from '../services/aeExportService';

export const AeScriptGenerator: React.FC<{ 
  onCancel: () => void;
  initialLayers?: string[];
  initialDuration?: number;
}> = ({ onCancel, initialLayers = [], initialDuration = 5.0 }) => {
  const [layersInput, setLayersInput] = useState(initialLayers.join('\n'));
  const [targetDuration, setTargetDuration] = useState(initialDuration.toString());
  const [useOriginalDuration, setUseOriginalDuration] = useState(false);
  const [generatedScript, setGeneratedScript] = useState('');
  const [copied, setCopied] = useState(false);

  const generateScript = () => {
    const layerNames = layersInput.split('\n').filter(line => line.trim() !== '');
    const script = generateAESyncScript({
      layers: layerNames,
      targetDuration: parseFloat(targetDuration) || 5.0,
      useOriginalDuration
    });
    setGeneratedScript(script);
    return script;
  };

  const handleCopy = () => {
    const script = generatedScript || generateScript();
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    const script = generatedScript || generateScript();
    const blob = new Blob([script], { type: 'text/javascript;charset=utf-8' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `AE_Layer_Duration_Sync.jsx`;
    link.click();
  };

  return (
    <div className="bg-slate-900 p-8 rounded-2xl border border-slate-700 shadow-2xl max-w-2xl mx-auto">
      <h2 className="text-3xl font-black text-white mb-6 flex items-center gap-3">
        <FileCode className="text-indigo-500" />
        Professional AE Script Generator
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="text-slate-400 font-bold mb-2 block">أسماء الطبقات (واحدة في كل سطر)</label>
          <textarea
            className="w-full h-48 bg-slate-800 text-white p-4 rounded-xl border border-slate-700 focus:border-indigo-500 transition-all"
            placeholder="Layer 1&#10;Layer 2 (hidden)"
            value={layersInput}
            onChange={(e) => setLayersInput(e.target.value)}
          />
        </div>
        
        <div className="space-y-6">
          <div>
            <label className="text-slate-400 font-bold mb-2 block flex items-center gap-2">
              <Clock className="w-4 h-4" /> مدة الطبقات (بالثواني)
            </label>
            <input
              type="number"
              step="0.1"
              className="w-full bg-slate-800 text-white p-3 rounded-xl border border-slate-700 disabled:opacity-50"
              value={targetDuration}
              onChange={(e) => setTargetDuration(e.target.value)}
              disabled={useOriginalDuration}
            />
          </div>
          
          <div className="flex items-center gap-3 bg-slate-800 p-4 rounded-xl">
            <input
              type="checkbox"
              id="useOriginal"
              className="w-5 h-5 accent-indigo-500"
              checked={useOriginalDuration}
              onChange={(e) => setUseOriginalDuration(e.target.checked)}
            />
            <label htmlFor="useOriginal" className="text-white font-bold cursor-pointer">
              استخدام المدة الأصلية للطبقة
            </label>
          </div>
        </div>
      </div>
      
      <button 
        onClick={generateScript} 
        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl text-lg transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
      >
        توليد السكريبت الاحترافي
      </button>
      
      {generatedScript && (
        <div className="mt-8 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">الكود الناتج (انسخه إلى AE):</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'تم النسخ!' : 'نسخ الكود'}</span>
              </button>
              <button
                onClick={handleDownload}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل .jsx</span>
              </button>
            </div>
          </div>
          <pre className="bg-black text-green-400 p-6 rounded-xl overflow-x-auto text-sm font-mono border border-slate-700 max-h-64">
            {generatedScript}
          </pre>
        </div>
      )}
      
      <button onClick={onCancel} className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl mt-6">
        إلغاء
      </button>
    </div>
  );
};
