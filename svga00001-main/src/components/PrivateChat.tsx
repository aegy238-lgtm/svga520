import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Send, ChevronRight } from 'lucide-react';

interface PrivateChatProps {
  targetUserId: string;
  targetUserName: string;
  targetUserPhoto: string;
  onClose: () => void;
}

export default function PrivateChat({ targetUserId, targetUserName, targetUserPhoto, onClose }: PrivateChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatId = user ? [user.uid, targetUserId].sort().join('_') : '';

  useEffect(() => {
    if (!user || !chatId) return;

    const q = query(collection(db, 'private_chats', chatId, 'messages'), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    return () => unsub();
  }, [user, chatId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim() || !chatId) return;

    const msgText = newMessage.trim();
    setNewMessage('');

    try {
      // Add message
      await addDoc(collection(db, 'private_chats', chatId, 'messages'), {
        text: msgText,
        senderId: user.uid,
        timestamp: serverTimestamp()
      });

      // Update recent chats for both users
      const chatData = {
        lastMessage: msgText,
        timestamp: serverTimestamp(),
        users: [user.uid, targetUserId],
        userNames: {
          [user.uid]: user.displayName || 'مستخدم',
          [targetUserId]: targetUserName
        },
        userPhotos: {
          [user.uid]: user.photoURL || '',
          [targetUserId]: targetUserPhoto
        }
      };

      await setDoc(doc(db, 'users', user.uid, 'recent_chats', targetUserId), chatData);
      await setDoc(doc(db, 'users', targetUserId, 'recent_chats', user.uid), chatData);

    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="absolute inset-0 bg-white z-[100] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
          <ChevronRight size={24} className="text-gray-600" />
        </button>
        {(() => {
          const photoUrl = targetUserPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetUserId}`;
          const isVideo = photoUrl.toLowerCase().includes('.mp4');
          return isVideo ? (
            <video src={photoUrl} autoPlay loop muted playsInline className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <img src={photoUrl} alt={targetUserName} className="w-10 h-10 rounded-full object-cover" />
          );
        })()}
        <h2 className="font-bold text-gray-800 flex-1">{targetUserName}</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 flex flex-col gap-3">
        {messages.map((msg) => {
          const isMe = msg.senderId === user?.uid;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isMe ? 'bg-purple-600 text-white rounded-tr-none' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'}`}>
                <p className="text-sm break-words">{msg.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-gray-100">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="اكتب رسالة..."
            className="flex-1 bg-gray-100 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            dir="auto"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center disabled:opacity-50 hover:bg-purple-700 transition"
          >
            <Send size={18} className="mr-1" />
          </button>
        </form>
      </div>
    </div>
  );
}
