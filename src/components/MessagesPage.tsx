import React, { useState, useEffect } from 'react';
import { Receipt, Users, Phone, ShieldCheck, Bell, Search } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import PrivateChat from './PrivateChat';

export default function MessagesPage() {
  const { user } = useAuth();
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<{id: string, name: string, photo: string} | null>(null);
  const [appName, setAppName] = useState('Cocco');

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'settings', 'app_config'), (doc) => {
      if (doc.exists() && doc.data().appName) {
        setAppName(doc.data().appName);
      }
    });
    return () => unsubConfig();
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'users', user.uid, 'recent_chats'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setRecentChats(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsub();
  }, [user]);

  const shortcuts = [
    { icon: <Receipt size={20} />, label: 'فاتورة', color: 'bg-blue-100 text-blue-600' },
    { icon: <Users size={20} />, label: 'متابع', color: 'bg-pink-100 text-pink-600' },
    { icon: <Phone size={20} />, label: 'الاتصالات', color: 'bg-green-100 text-green-600' },
    { icon: <ShieldCheck size={20} />, label: appName, color: 'bg-purple-100 text-purple-600' },
  ];

  if (activeChat) {
    return (
      <PrivateChat
        targetUserId={activeChat.id}
        targetUserName={activeChat.name}
        targetUserPhoto={activeChat.photo}
        onClose={() => setActiveChat(null)}
      />
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 sticky top-0 z-10 bg-white border-b border-gray-50">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-800">رسالة</h1>
          <div className="flex gap-3 text-gray-600">
            <Search size={22} />
            <div className="relative">
              <Users size={22} />
              <span className="absolute -top-1 -right-1 bg-red-500 w-2.5 h-2.5 rounded-full border border-white"></span>
            </div>
          </div>
        </div>

        {/* Shortcuts */}
        <div className="flex justify-between items-center px-2">
          {shortcuts.map((item, idx) => (
            <div key={idx} className="flex flex-col items-center gap-2 cursor-pointer">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${item.color}`}>
                {item.icon}
              </div>
              <span className="text-xs font-medium text-gray-600">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {/* System Messages */}
        <div className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 cursor-pointer transition border-b border-gray-50">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white shadow-sm">
            <Bell size={24} />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-sm">Activity</h3>
              <span className="text-[10px] text-gray-400">10:42 AM</span>
            </div>
            <p className="text-xs text-gray-500 truncate mt-0.5">تهانينا! لقد حصلت على مكافأة تسجيل الدخول...</p>
          </div>
          <div className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
            1
          </div>
        </div>

        <div className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 cursor-pointer transition border-b border-gray-50">
          <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-white shadow-sm relative">
            <ShieldCheck size={24} />
            <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-0.5 border border-white">
              <ShieldCheck size={10} className="text-white" />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1">
                {appName} Official
                <span className="bg-blue-100 text-blue-600 text-[8px] px-1 rounded">رسمي</span>
              </h3>
              <span className="text-[10px] text-gray-400">Yesterday</span>
            </div>
            <p className="text-xs text-gray-500 truncate mt-0.5">تحديث جديد متاح للتطبيق، اكتشف الميزات...</p>
          </div>
        </div>

        {/* User Chats */}
        {recentChats.map((chat) => {
          const targetId = chat.id;
          const targetName = chat.userNames?.[targetId] || 'مستخدم';
          const targetPhoto = chat.userPhotos?.[targetId] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetId}`;
          
          return (
            <div 
              key={chat.id} 
              onClick={() => setActiveChat({ id: targetId, name: targetName, photo: targetPhoto })}
              className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 cursor-pointer transition"
            >
              <div className="relative">
                {(() => {
                  const isVideo = targetPhoto.toLowerCase().includes('.mp4');
                  return isVideo ? (
                    <video src={targetPhoto} autoPlay loop muted playsInline className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <img src={targetPhoto} alt={targetName} className="w-12 h-12 rounded-full object-cover" referrerPolicy="no-referrer" />
                  );
                })()}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-gray-800 text-sm">{targetName}</h3>
                  <span className="text-[10px] text-gray-400">
                    {chat.timestamp ? new Date(chat.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {chat.lastMessage}
                </p>
              </div>
            </div>
          );
        })}
        
        {recentChats.length === 0 && (
          <div className="text-center py-10 text-gray-500 text-sm">
            لا توجد رسائل سابقة
          </div>
        )}
      </div>
    </div>
  );
}
