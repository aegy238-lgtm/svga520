import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { UserRecord } from '../../types';
import { Search, Save, CheckSquare, Square, Star, Lock, ShieldCheck, X } from 'lucide-react';

export const AVAILABLE_FEATURES = [
  { id: 'aiVideoMatting', name: 'AI Video Matting Studio', desc: 'عزل الأشخاص والخلفيات بالذكاء الاصطناعي' },
  { id: 'name3DEditor', name: '3D Name Editor', desc: 'محرر وتصميم الأسماء ثلاثية الأبعاد' },
  { id: 'imageEnhancer', name: 'AI Image Enhancer', desc: 'تحسين جودة الصور بالذكاء الاصطناعي' },
  { id: 'imageProcessor', name: 'Image Processor', desc: 'معالجة وتعديل ألوان وإضاءة الصور' },
  { id: 'imageEditor', name: 'Image Editor', desc: 'محرر صور متكامل مع الطبقات' },
  { id: 'imageMatcher', name: 'Image Matcher', desc: 'مطابقة الألوان والستايلات بين صورتين' },
  { id: 'svgaLayerEditor', name: 'تحرير طبقات SVGA', desc: 'محرر طبقات تفاعلي لملفات SVGA' },
  { id: 'svgaBatchCompressor', name: 'SVGA & VAP Batch Compressor', desc: 'ضغط دفعات ضخمة من ملفات SVGA و VAP' },
  { id: 'svgaEx', name: 'SVGA Editor EX', desc: 'محرر لعمل تركيبات معقدة من عدة ملفات' },
  { id: 'pagConverterOpen', name: 'PAG to SVGA Converter', desc: 'تحويل PAG إلى SVGA' },
  { id: 'multiSvga', name: 'Multi SVGA Preview', desc: 'استعراض ومقارنة عدة ملفات SVGA' },
  { id: 'imageConverter', name: 'Image to SVGA', desc: 'تحويل الصور الثابتة إلى ملفات SVGA' },
  { id: 'audioExtractor', name: 'Audio Extractor', desc: 'استخراج الصوت من الفيديو' },
  { id: 'batchImageProcessor', name: 'Batch Image Processor', desc: 'تعديلات وتحسينات على مجلد كامل من الصور' },
  { id: 'batchCompress', name: 'Batch Compress', desc: 'ضغط وتقليل حجم كمية كبيرة من الصور' },
  { id: 'batchCropper', name: 'Batch Cropper', desc: 'قص واقتطاع مجموعة صور دفعة واحدة' },
  { id: 'universalConverter', name: 'Universal Motion Tools', desc: 'تحويل ومعاينة كافة صيغ الأنيميشن' },
  { id: 'videoConverter', name: 'Video Converter', desc: 'تحويل وتفريغ مقاطع الفيديو' },
  { id: 'store', name: 'SVGA Store', desc: 'متجر التأثيرات والملحقات الجاهزة' },
];

export const FeatureAccessControlTab: React.FC = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  
  // Form State
  const [allFeaturesEnabled, setAllFeaturesEnabled] = useState(true);
  const [allowedFeatures, setAllowedFeatures] = useState<string[]>([]);
  const [defaultFeature, setDefaultFeature] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const usersData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as UserRecord));
      setUsers(usersData);
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (user: UserRecord) => {
    setSelectedUser(user);
    // Initialize form with user's data
    setAllFeaturesEnabled(user.allFeaturesEnabled !== false); // Default is true if undefined
    setAllowedFeatures(user.allowedFeatures || []);
    setDefaultFeature(user.defaultFeature || '');
    setSaveMessage('');
  };

  const toggleFeature = (featureId: string) => {
    setAllowedFeatures(prev => 
      prev.includes(featureId) 
        ? prev.filter(id => id !== featureId)
        : [...prev, featureId]
    );
  };

  const selectAll = () => {
    setAllowedFeatures(AVAILABLE_FEATURES.map(f => f.id));
  };

  const deselectAll = () => {
    setAllowedFeatures([]);
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    setSaveMessage('');
    
    try {
      const userRef = doc(db, 'users', selectedUser.id);
      
      const updateData = {
        allFeaturesEnabled: allFeaturesEnabled,
        allowedFeatures: allFeaturesEnabled ? [] : allowedFeatures,
        defaultFeature: defaultFeature,
        featuresUpdatedAt: new Date().toISOString()
      };

      await updateDoc(userRef, updateData);
      
      // Update local state
      setUsers(users.map(u => u.id === selectedUser.id ? { ...u, ...updateData } : u));
      setSelectedUser({ ...selectedUser, ...updateData });
      
      setSaveMessage('تم حفظ الصلاحيات بنجاح!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error("Error saving feature access:", err);
      setSaveMessage('حدث خطأ أثناء الحفظ.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.id.includes(searchQuery)
  );

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-160px)]">
      {/* Users List (Sidebar) */}
      <div className="w-full md:w-1/3 flex flex-col bg-slate-900/50 border border-white/10 rounded-2xl overflow-hidden shrink-0">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <ShieldCheck size={18} className="text-indigo-400" />
            صلاحيات المستخدمين
          </h3>
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالاسم، الإيميل، أو الـ ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl pr-9 pl-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition-colors"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {loading ? (
            <div className="text-center text-slate-500 py-10 text-sm">جاري التحميل...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center text-slate-500 py-10 text-sm">لا يوجد مستخدمين</div>
          ) : (
            filteredUsers.map(user => (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user)}
                className={`w-full text-right p-3 rounded-xl flex items-center gap-3 transition-colors ${
                  selectedUser?.id === user.id 
                    ? 'bg-indigo-600/20 border border-indigo-500/30' 
                    : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-white/10">
                  {user.avatarUrl || user.photoURL ? (
                    <img src={user.avatarUrl || user.photoURL} alt={user.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-slate-400 font-bold">{user.name?.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-sm truncate flex items-center justify-between">
                    <span>{user.name}</span>
                    {user.allFeaturesEnabled === false && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 shrink-0">
                        مخصص
                      </span>
                    )}
                  </div>
                  <div className="text-slate-400 text-xs truncate">{user.email || user.id}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Configuration Area */}
      <div className="flex-1 flex flex-col bg-slate-900/50 border border-white/10 rounded-2xl overflow-hidden relative">
        {selectedUser ? (
          <>
            <div className="p-5 border-b border-white/10 bg-black/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
              <div>
                <h2 className="text-lg font-black text-white mb-1">تحديد الوظائف لـ {selectedUser.name}</h2>
                <p className="text-sm text-slate-400">تحكم في الصلاحيات والوظائف التي يمكن لهذا المستخدم رؤيتها واستخدامها.</p>
              </div>
              <div className="flex items-center gap-3">
                {saveMessage && (
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${saveMessage.includes('خطأ') ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {saveMessage}
                  </span>
                )}
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Save size={16} />
                  {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              
              {/* Global Mode Switch */}
              <div className="bg-black/30 border border-white/10 rounded-2xl p-5">
                <h4 className="text-white font-bold mb-4">وضع الصلاحيات العام</h4>
                <div className="flex gap-4">
                  <label className={`flex-1 flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${allFeaturesEnabled ? 'bg-indigo-600/20 border-indigo-500/50' : 'bg-slate-800/50 border-white/10 hover:bg-slate-800'}`}>
                    <input type="radio" checked={allFeaturesEnabled} onChange={() => setAllFeaturesEnabled(true)} className="w-4 h-4 accent-indigo-500" />
                    <div>
                      <div className="text-white font-bold text-sm">الوضع الطبيعي (بدون تحديد)</div>
                      <div className="text-slate-400 text-xs mt-1">السماح بجميع وظائف الموقع بشكل طبيعي (موصى به).</div>
                    </div>
                  </label>
                  
                  <label className={`flex-1 flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${!allFeaturesEnabled ? 'bg-purple-600/20 border-purple-500/50' : 'bg-slate-800/50 border-white/10 hover:bg-slate-800'}`}>
                    <input type="radio" checked={!allFeaturesEnabled} onChange={() => setAllFeaturesEnabled(false)} className="w-4 h-4 accent-purple-500" />
                    <div>
                      <div className="text-white font-bold text-sm">تخصيص الوظائف (محدود)</div>
                      <div className="text-slate-400 text-xs mt-1">تحديد وظائف معينة فقط وإخفاء باقي الوظائف من حسابه.</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Features Selection Grid */}
              <div className={`transition-opacity duration-300 ${allFeaturesEnabled ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-white font-bold">الوظائف المتاحة للمستخدم ({allowedFeatures.length} محددة)</h4>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={selectAll} className="text-xs text-indigo-400 hover:text-indigo-300 font-bold px-3 py-1.5 bg-indigo-500/10 rounded-lg transition-colors">تحديد الكل</button>
                    <button type="button" onClick={deselectAll} className="text-xs text-slate-400 hover:text-white font-bold px-3 py-1.5 bg-white/5 rounded-lg transition-colors">إلغاء تحديد الكل</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {AVAILABLE_FEATURES.map(feature => {
                    const isSelected = allowedFeatures.includes(feature.id);
                    const isDefault = defaultFeature === feature.id;
                    
                    return (
                      <div 
                        key={feature.id}
                        className={`flex flex-col p-4 rounded-xl border transition-all ${
                          isSelected ? 'bg-indigo-900/20 border-indigo-500/30 shadow-inner' : 'bg-black/20 border-white/5 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                            <button
                              type="button"
                              onClick={() => toggleFeature(feature.id)}
                              className={`flex items-center justify-center w-5 h-5 rounded border ${isSelected ? 'bg-indigo-500 border-indigo-400 text-white' : 'border-slate-500 text-transparent'}`}
                            >
                              {isSelected && <CheckSquare size={14} className="fill-current" />}
                            </button>
                            <span className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-slate-400'}`}>{feature.name}</span>
                          </label>
                          
                          {/* Star for Default Feature */}
                          {isSelected && (
                            <button
                              type="button"
                              onClick={() => setDefaultFeature(isDefault ? '' : feature.id)}
                              className={`p-1.5 rounded-lg transition-colors ${isDefault ? 'bg-amber-500/20 text-amber-400' : 'text-slate-500 hover:text-amber-400 hover:bg-white/5'}`}
                              title={isDefault ? 'هذه هي الوظيفة الرئيسية الحالية' : 'تعيين كوظيفة رئيسية للمستخدم'}
                            >
                              <Star size={16} className={isDefault ? 'fill-amber-400' : ''} />
                            </button>
                          )}
                          {!isSelected && (
                            <div className="p-1.5 text-slate-600" title="مقفولة">
                              <Lock size={14} />
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 pr-7">{feature.desc}</p>
                        
                        {isDefault && isSelected && (
                          <div className="mt-2 pr-7">
                            <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              <Star size={10} className="fill-amber-400" />
                              الوظيفة المميزة / الرئيسية
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
            <ShieldCheck size={64} className="mb-4 opacity-20" />
            <h3 className="text-xl font-bold text-white mb-2">نظام تحديد الوظائف</h3>
            <p className="max-w-sm text-sm">اختر مستخدماً من القائمة الجانبية للتحكم في الوظائف والأدوات المسموح له باستخدامها، وتعيين وظيفته الرئيسية.</p>
          </div>
        )}
      </div>
    </div>
  );
};
