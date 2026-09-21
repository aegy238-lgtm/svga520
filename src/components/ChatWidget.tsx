import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  Smile, 
  Gift, 
  X, 
  Crown, 
  Shield, 
  Coins, 
  Sparkles,
  Heart,
  Flame,
  Volume2,
  CheckCircle2,
  Users
} from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { UserProfile, ChatMessage, GiftItem } from '../types/game';

interface ChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  userBalance: number;
  onBalanceUpdated: (newBalance: number) => void;
  onlineUsersCount?: number;
}

export const CASINO_GIFTS: GiftItem[] = [
  { id: 'gift-rose', name: 'وردة ملكية', icon: '🌹', coins: 100, description: 'تحية ودية أنيقة' },
  { id: 'gift-drink', name: 'كوكتيل كازينو', icon: '🍹', coins: 500, description: 'مشروب فاخر للاحتفال' },
  { id: 'gift-car', name: 'سيارة رياضية', icon: '🏎️', coins: 2000, description: 'هدية سريعة ومثيرة' },
  { id: 'gift-diamond', name: 'ألماسة ملكية', icon: '💎', coins: 5000, description: 'ألماس برّاق نادر' },
  { id: 'gift-crown', name: 'تاج الملوك', icon: '👑', coins: 10000, description: 'تاج ذهبي يليق بالملوك' },
  { id: 'gift-rocket', name: 'صاروخ الحظ', icon: '🚀', coins: 25000, description: 'انطلاقة قوية للأرباح' },
  { id: 'gift-palace', name: 'قصر رويال VIP', icon: '🏰', coins: 50000, description: 'أفخم هدية في الكازينو' },
];

const EMOJIS = [
  '😊', '🔥', '👑', '💎', '🚀', '🎉', '❤️', '🎲', 
  '💰', '👏', '😎', '🍀', '🏆', '⭐', '🍾', '🤩', 
  '👍', '🤑', '✨', '⚡', '🎂', '🏎️', '💯', '🤝'
];

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  isOpen,
  onClose,
  user,
  userBalance,
  onBalanceUpdated,
  onlineUsersCount = 48,
}) => {
  const { isRTL, language } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [selectedGift, setSelectedGift] = useState<GiftItem>(CASINO_GIFTS[0]);
  const [recipientInput, setRecipientInput] = useState('');
  const [activeUsersList, setActiveUsersList] = useState<{ id: string; name: string; customId: string }[]>([]);
  const [giftAnnouncement, setGiftAnnouncement] = useState<string | null>(null);
  const [sendingGift, setSendingGift] = useState(false);
  const [giftError, setGiftError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleDeleteMessage = async (msgId: string) => {
    if (confirm(isRTL ? 'هل أنت متأكد من حذف هذه الرسالة؟' : 'Delete this message?')) {
      try {
        await deleteDoc(doc(db, 'global_chat', msgId));
      } catch (err) {
        console.error('Delete error', err);
      }
    }
  };


  // Load chat messages
  const fetchMessages = () => {
    fetch('/api/chat/messages')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.messages) {
          setMessages(data.messages);
        }
      })
      .catch(() => {});
  };

  // Load registered users for recipient picker
  const fetchUsers = () => {
    fetch('/api/admin/users')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.users) {
          const list = data.users
            .filter((u: any) => u.userId !== user?.userId)
            .map((u: any) => ({
              id: u.userId || u.id,
              name: u.displayName || u.email?.split('@')[0] || 'Player',
              customId: u.customId || u.userId,
            }));
          setActiveUsersList(list);
          if (list.length > 0 && !recipientInput) {
            setRecipientInput(list[0].id);
          }
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (isOpen) {
      fetchMessages();
      fetchUsers();
      const interval = setInterval(fetchMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleUserClick = (targetId: string, targetName: string, targetCustomId: string) => {
    if (targetId === user?.userId) return; // Cannot gift yourself

    if (!activeUsersList.find(u => u.id === targetId)) {
      setActiveUsersList(prev => [...prev, { id: targetId, name: targetName, customId: targetCustomId }]);
    }
    setRecipientInput(targetId);
    setShowGiftModal(true);
  };

  
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || !user) return;

    setInputText('');
    setShowEmojiPicker(false);

    try {
      await addDoc(collection(db, 'global_chat'), {
        senderId: user.userId || user.customId || 'unknown',
        senderName: user.name || user.displayName || 'Guest',
        senderRole: user.role || 'player',
        content: text,
        timestamp: serverTimestamp(),
        type: 'text'
      });
    } catch (error) {
      console.error('Error sending message', error);
    }
  };


  const handleSendGift = async () => {
    if (!user || !selectedGift || !recipientInput.trim()) return;
    
    if (userBalance < selectedGift.coins) {
      setGiftError(
        isRTL 
          ? `رصيد الكوينز لديك (${userBalance.toLocaleString()}) غير كافٍ لإرسال هذه الهدية (${selectedGift.coins.toLocaleString()})`
          : `Insufficient balance (${userBalance.toLocaleString()}) for this gift (${selectedGift.coins.toLocaleString()})`
      );
      return;
    }
    
    setSendingGift(true);
    setGiftError(null);
    
    try {
      const bonus = Math.floor(selectedGift.coins * 0.35);
      
      // We deduct coins locally for quick UI update
      onBalanceUpdated(userBalance - selectedGift.coins);
      
      const targetUser = activeUsersList.find(u => u.name === recipientInput || u.customId === recipientInput) || { name: recipientInput, customId: 'unknown' };
      
      const msg = {
        senderId: user.userId || user.customId || 'unknown',
        senderName: user.name || user.displayName || 'Guest',
        senderRole: user.role || 'player',
        content: `${selectedGift.icon} ${selectedGift.name}`,
        timestamp: serverTimestamp(),
        type: 'gift',
        gift: {
          giftId: selectedGift.id,
          giftName: selectedGift.name,
          giftIcon: selectedGift.icon,
          coinsAmount: selectedGift.coins,
          recipientId: targetUser.customId,
          recipientName: targetUser.name,
          recipientCoinsReceived: bonus
        }
      };
      
      await addDoc(collection(db, 'global_chat'), msg);
      
      setGiftAnnouncement(
        isRTL
            ? `🎉 تم إرسال ${selectedGift.name} ${selectedGift.icon} بنجاح! وحصل ${targetUser.name} على +${bonus.toLocaleString()} كوينز (35%) في رصيده فوراً!`
            : `🎉 Gift sent successfully! ${targetUser.name} received +${bonus.toLocaleString()} coins (35%)!`
      );
      
      setTimeout(() => setGiftAnnouncement(null), 5000);
      setShowGiftModal(false);
      setRecipientInput('');
      
    } catch (e) {
      console.error(e);
      setGiftError('Failed to send gift');
    } finally {
      setSendingGift(false);
    }
  };

  const recipientBonusPreview = Math.floor(selectedGift.coins * 0.35);

  return (
    <div 
      className="fixed inset-y-0 z-50 flex justify-end w-full bg-black/60 backdrop-blur-sm select-text animate-fadeIn"
      dir={isRTL ? 'rtl' : 'ltr'}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md bg-[#0a0e1c] border-l border-amber-500/30 flex flex-col h-full shadow-2xl">
        
        {/* Top Header */}
        <div className="p-3.5 sm:p-4 bg-gradient-to-r from-amber-950/70 via-slate-900 to-indigo-950/70 border-b border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 p-0.5 flex items-center justify-center text-slate-950 shadow-md">
              <MessageSquare className="w-5 h-5 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-sm text-white">
                  {language === 'ar' ? 'الدردشة العامة والهدايا' : 'Live Chat & Gifts'}
                </h3>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <Users className="w-3 h-3 text-emerald-400" />
                <span>{onlineUsersCount} {language === 'ar' ? 'متصل الآن' : 'online'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowGiftModal(true)}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:brightness-110 text-white font-black text-xs shadow-md flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
              title="إهداء كوينز وهدايا"
            >
              <Gift className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'إرسال هدية' : 'Send Gift'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Gift Celebration Banner */}
        {giftAnnouncement && (
          <div className="p-3 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 text-slate-950 font-black text-xs text-center shadow-lg animate-bounce">
            {giftAnnouncement}
          </div>
        )}

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-4">
              <Sparkles className="w-8 h-8 text-amber-500/50 mb-2" />
              <p className="text-xs font-bold">
                {language === 'ar' ? 'كن أول من يبدأ المحادثة!' : 'Be the first to say hello!'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {language === 'ar' ? 'أرسل تحية للاعبين أو فاجئ أحدهم بهدية ملكية' : 'Greet other players or send a gift'}
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === user?.userId;
              const isGift = msg.type === 'gift';
              const isAdmin = msg.senderRole === 'admin';
              const isAgency = msg.senderRole === 'agency';

              if (isGift) {
                return (
                  <div 
                    key={msg.id}
                    className="p-3 rounded-2xl bg-gradient-to-r from-amber-950/60 via-pink-950/50 to-slate-900 border border-amber-400/50 shadow-md text-xs"
                  >
                    <div className="flex items-center gap-2 mb-1 text-amber-300 font-bold">
                      <span className="text-base">{msg.gift?.icon || '🎁'}</span>
                      <span 
                        className="font-black text-white cursor-pointer hover:text-rose-400 transition-colors"
                        onClick={() => handleUserClick(msg.senderId, msg.senderName, msg.senderCustomId)}
                        title={language === 'ar' ? 'انقر لإرسال هدية' : 'Click to send gift'}
                      >
                        {msg.senderName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">({msg.senderCustomId})</span>
                    </div>
                    <p className="text-amber-100 font-medium leading-relaxed">
                      {msg.content}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/80 pt-1">
                      <span className="text-emerald-400 font-bold">
                        +{ (msg.gift?.recipientCoinsReceived || 0).toLocaleString() } 🪙 (35%)
                      </span>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>

                        {user?.role === 'admin' && (
                          <button onClick={() => handleDeleteMessage(msg.id)} className="ml-2 text-red-500 hover:text-red-400 p-1 opacity-50 hover:opacity-100">
                            <X size={12} />
                          </button>
                        )}
                    </div>
                  </div>
                );
              }

              return (
                <div 
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5 text-[10px] text-slate-400">
                    <span 
                      className="font-bold text-slate-300 cursor-pointer hover:text-amber-400 transition-colors"
                      onClick={() => handleUserClick(msg.senderId, msg.senderName, msg.senderCustomId)}
                      title={language === 'ar' ? 'انقر لإرسال هدية' : 'Click to send gift'}
                    >
                      {msg.senderName}
                    </span>
                    {isAdmin && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-black border border-amber-500/40">
                        👑 ADMIN
                      </span>
                    )}
                    {isAgency && (
                      <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-black border border-cyan-500/40">
                        🛡️ AGENCY
                      </span>
                    )}
                    <span className="font-mono text-slate-500">{msg.senderCustomId}</span>
                  </div>

                  <div 
                    className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed ${
                      isMe
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-bold rounded-tr-none'
                        : 'bg-slate-900 border border-slate-800 text-white rounded-tl-none'
                    }`}
                  >
                    {msg.content}
                  </div>

                  <span className="text-[9px] text-slate-600 mt-0.5 font-mono px-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Emoji Selector Popup */}
        {showEmojiPicker && (
          <div className="p-3 bg-slate-900 border-t border-slate-800 grid grid-cols-8 gap-2 animate-fadeIn">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  setInputText((prev) => prev + emoji);
                  setShowEmojiPicker(false);
                }}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-lg transition-transform active:scale-125 cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Message Input Bar */}
        <form 
          onSubmit={handleSendMessage}
          className="p-3 bg-slate-950 border-t border-slate-800/80 flex items-center gap-2"
        >
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 transition-colors cursor-pointer"
            title="إضافة سمايل"
          >
            <Smile className="w-5 h-5" />
          </button>

          <input
            type="text"
            placeholder={user ? (language === 'ar' ? 'اكتب رسالتك للجميع هنا...' : 'Type a message...') : (language === 'ar' ? 'يرجى تسجيل الدخول للدردشة' : 'Login to chat')}
            disabled={!user}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 py-2.5 px-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || !user}
            className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 disabled:opacity-40 text-slate-950 font-black shadow-md transition-transform active:scale-95 cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4 rtl:rotate-180" />
          </button>
        </form>

        {/* MODAL: SEND GIFT (35% COMMISSION DIRECTLY TO RECIPIENT) */}
        {showGiftModal && (
          <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col p-4 overflow-y-auto animate-fadeIn">
            
            {/* Header */}
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-rose-400" />
                <h4 className="font-black text-sm text-white">
                  {language === 'ar' ? 'إرسال هدية ملكية (+35% كوينز للمستلم)' : 'Send Royal Gift (+35% Coins)'}
                </h4>
              </div>
              <button
                onClick={() => setShowGiftModal(false)}
                className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 35% Explanation Badge */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-rose-950/60 via-purple-950/40 to-slate-900 border border-rose-500/40 mb-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-rose-300 font-black">
                <Sparkles className="w-4 h-4" />
                <span>قاعدة الهدايا الملكية (35% كوينز كاش):</span>
              </div>
              <p className="text-[11px] text-slate-300">
                عند إرسال هدية لأي لاعب، يحصل المستلم فوراً على <strong>35% من قيمة الهدية ككوينز</strong> مباشرة في رصيده يستطيع اللعب بها أو سحبها!
              </p>
            </div>

            {/* Recipient Picker */}
            <div className="mb-3">
              <label className="block text-xs font-bold text-slate-300 mb-1">
                {language === 'ar' ? 'اختر اللاعب المستلم للهدية:' : 'Select Recipient:'}
              </label>
              <select
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-400 font-bold"
              >
                {activeUsersList.length === 0 ? (
                  <option value="public_lounge">
                    {language === 'ar' ? 'جميع اللاعبين (إهداء عام للصالة)' : 'All Players (Public)'}
                  </option>
                ) : (
                  activeUsersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} - ID: {u.customId}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Gifts Catalog Grid */}
            <div className="grid grid-cols-2 gap-2 mb-4 max-h-[42vh] overflow-y-auto pr-1">
              {CASINO_GIFTS.map((g) => {
                const isSelected = selectedGift.id === g.id;
                const bonus = Math.floor(g.coins * 0.35);
                return (
                  <div
                    key={g.id}
                    onClick={() => setSelectedGift(g)}
                    className={`p-3 rounded-2xl border flex flex-col items-center text-center cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-gradient-to-b from-rose-950/80 to-slate-900 border-rose-400 scale-[1.02] shadow-lg shadow-rose-500/20'
                        : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800'
                    }`}
                  >
                    <span className="text-3xl mb-1">{g.icon}</span>
                    <span className="font-bold text-xs text-white">{g.name}</span>
                    <div className="flex items-center gap-1 mt-1 text-amber-300 font-mono font-black text-xs">
                      <Coins className="w-3.5 h-3.5 text-amber-400" />
                      <span>{g.coins.toLocaleString()}</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-bold mt-0.5">
                      يستلم: +{bonus.toLocaleString()} 🪙
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Error banner */}
            {giftError && (
              <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-300 text-xs mb-3 text-center">
                {giftError}
              </div>
            )}

            {/* Send Button */}
            <button
              onClick={handleSendGift}
              disabled={sendingGift || userBalance < selectedGift.coins}
              className="mt-auto w-full py-3 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-500 to-rose-500 hover:brightness-110 disabled:opacity-50 text-white font-black text-xs shadow-lg shadow-rose-500/30 transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Gift className="w-4 h-4" />
              <span>
                {sendingGift
                  ? (language === 'ar' ? 'جاري الإرسال...' : 'Sending...')
                  : (language === 'ar'
                      ? `إرسال ${selectedGift.name} (${selectedGift.coins.toLocaleString()} كوينز) الآن`
                      : `Send ${selectedGift.name} Now`)}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
