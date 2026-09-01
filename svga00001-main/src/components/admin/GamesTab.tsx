import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Save } from 'lucide-react';

export default function GamesTab() {
  const [config, setConfig] = useState({
    fruitWinRatio: 30,
    zeusWinRatio: 20,
    rocketMaxCrash: 5,
    luckyCatWinRatio: 30,
    jackpotFruitsWinRatio: 30,
    jackpotFruitsImage: '',
    luckyCatImage: '',
    fruitImage: '',
    zeusImage: '',
    rocketImage: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      const docSnap = await getDoc(doc(db, 'settings', 'games_config'));
      if (docSnap.exists()) {
        setConfig({
          fruitWinRatio: 30,
          zeusWinRatio: 20,
          rocketMaxCrash: 5,
          luckyCatWinRatio: 30,
          jackpotFruitsWinRatio: 30,
          jackpotFruitsImage: '',
          luckyCatImage: '',
          fruitImage: '',
          zeusImage: '',
          rocketImage: '',
          ...docSnap.data()
        });
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await setDoc(doc(db, 'settings', 'games_config'), config, { merge: true });
      alert('تم حفظ إعدادات الألعاب بنجاح');
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 max-w-2xl mx-auto">
      <h3 className="text-lg font-bold text-gray-800 mb-6">إعدادات الألعاب (نسب الربح والخسارة)</h3>
      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">نسبة الفوز في القط المحظوظ (%)</label>
          <input
            type="number"
            required
            min="0"
            max="100"
            value={config.luckyCatWinRatio}
            onChange={e => setConfig({...config, luckyCatWinRatio: parseInt(e.target.value)})}
            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">مثال: 30 تعني أن اللاعب لديه فرصة 30% للفوز في كل لفة.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">نسبة الفوز في جاكبوت الفواكه (%)</label>
          <input
            type="number"
            required
            min="0"
            max="100"
            value={config.jackpotFruitsWinRatio}
            onChange={e => setConfig({...config, jackpotFruitsWinRatio: parseInt(e.target.value)})}
            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">نسبة الفوز في عجلة الفواكه (%)</label>
          <input
            type="number"
            required
            min="0"
            max="100"
            value={config.fruitWinRatio}
            onChange={e => setConfig({...config, fruitWinRatio: parseInt(e.target.value)})}
            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">نسبة الفوز في سلوتس زيوس (%)</label>
          <input
            type="number"
            required
            min="0"
            max="100"
            value={config.zeusWinRatio}
            onChange={e => setConfig({...config, zeusWinRatio: parseInt(e.target.value)})}
            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">أقصى مضاعف لصاروخ كراش (X)</label>
          <input
            type="number"
            required
            min="1.1"
            step="0.1"
            value={config.rocketMaxCrash}
            onChange={e => setConfig({...config, rocketMaxCrash: parseFloat(e.target.value)})}
            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <div className="border-t pt-6 mt-6">
          <h4 className="text-md font-bold text-gray-800 mb-4">صور واجهات الألعاب (روابط)</h4>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">صورة جاكبوت الفواكه</label>
              <input
                type="url"
                placeholder="https://example.com/image.jpg"
                value={config.jackpotFruitsImage}
                onChange={e => setConfig({...config, jackpotFruitsImage: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-left"
                dir="ltr"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">صورة القط المحظوظ</label>
              <input
                type="url"
                placeholder="https://example.com/image.jpg"
                value={config.luckyCatImage}
                onChange={e => setConfig({...config, luckyCatImage: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-left"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">صورة عجلة الفواكه</label>
              <input
                type="url"
                placeholder="https://example.com/image.jpg"
                value={config.fruitImage}
                onChange={e => setConfig({...config, fruitImage: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-left"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">صورة سلوتس زيوس</label>
              <input
                type="url"
                placeholder="https://example.com/image.jpg"
                value={config.zeusImage}
                onChange={e => setConfig({...config, zeusImage: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-left"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">صورة الصاروخ (Crash)</label>
              <input
                type="url"
                placeholder="https://example.com/image.jpg"
                value={config.rocketImage}
                onChange={e => setConfig({...config, rocketImage: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-left"
                dir="ltr"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
        >
          <Save size={20} />
          {loading ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
        </button>
      </form>
    </div>
  );
}
