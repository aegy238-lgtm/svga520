import React, { useState, useEffect, useRef } from 'react';
import { X, Users, Gift, Mic, MicOff, MessageCircle, Smile, MoreHorizontal, Crown, Star, Music, ShieldBan, Settings, ShoppingBag, Image as ImageIcon, Send, Check, TrendingUp, Diamond, User, ShieldAlert, Heart, Gamepad2, Zap, Edit3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../firebase';
import { collection, doc, onSnapshot, updateDoc, getDoc, addDoc, query, orderBy, limit, runTransaction, setDoc, increment, deleteDoc, where, getDocs, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { motion, AnimatePresence } from 'motion/react';
import { calculateLevel, getLevelColor } from '../lib/levels';
import BackgroundSelector from './BackgroundSelector';
import { registerBackHandler, unregisterBackHandler } from '../hooks/useBackButton';
import GameCenterModal from './games/GameCenterModal';
import PrivateChat from './PrivateChat';
import { useAgora, AGORA_APP_ID } from '../hooks/useAgora';
import AgoraRTC from 'agora-rtc-sdk-ng';

export default function LiveRoom({ 
  roomId, 
  onClose, 
  onMinimize,
  hasShownEntrance,
  onEntranceShown 
}: { 
  roomId: string, 
  onClose: () => void, 
  onMinimize?: () => void,
  hasShownEntrance: boolean,
  onEntranceShown: () => void
}) {
  const { user } = useAuth();
  const [showAdminTools, setShowAdminTools] = useState(false);
  const [showEditRoomName, setShowEditRoomName] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  const [roomBackground, setRoomBackground] = useState<any>(null);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showMallModal, setShowMallModal] = useState(false);
  const [showLuckyBoxModal, setShowLuckyBoxModal] = useState(false);
  const [showGameCenter, setShowGameCenter] = useState(false);
  const [bigWinConfig, setBigWinConfig] = useState<any>(null);
  const [cpConfig, setCpConfig] = useState<any>(null);
  const [incomingCpRequest, setIncomingCpRequest] = useState<any>(null);
  const [room, setRoom] = useState<any>({});

  useEffect(() => {
    const fetchBigWinConfig = async () => {
      const docSnap = await getDoc(doc(db, 'settings', 'big_win_config'));
      if (docSnap.exists()) {
        setBigWinConfig(docSnap.data());
      }
    };
    fetchBigWinConfig();

    const fetchCpConfig = async () => {
      const docSnap = await getDoc(doc(db, 'settings', 'cp_config'));
      if (docSnap.exists()) {
        setCpConfig(docSnap.data());
      }
    };
    fetchCpConfig();
  }, []);
  const [mallCategory, setMallCategory] = useState('mic_frame');
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  
  const [settings, setSettings] = useState({ maxMics: 8, allowMovement: true });
  const [mics, setMics] = useState<any[]>([]);
  const [gifts, setGifts] = useState<any[]>([]);
  const [giftCategories, setGiftCategories] = useState<any[]>([]);
  const [storeItems, setStoreItems] = useState<any[]>([]);
  const [vipLevels, setVipLevels] = useState<any[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showEmotePicker, setShowEmotePicker] = useState(false);
  const [activeEmotes, setActiveEmotes] = useState<{[userId: string]: string}>({});
  const [emotes, setEmotes] = useState<any[]>([]);

  const [activeGiftEvents, setActiveGiftEvents] = useState<any[]>([]);
  const [activeJackpotEvent, setActiveJackpotEvent] = useState<any>(null);
  const [selectedReceivers, setSelectedReceivers] = useState<string[]>([]);
  const [selectedReceiver, setSelectedReceiver] = useState<string | null>(null);
  const [showCpChat, setShowCpChat] = useState(false);
  const [cpMessages, setCpMessages] = useState<any[]>([]);
  const [selectedGift, setSelectedGift] = useState<any>(null);
  const [giftCategory, setGiftCategory] = useState<string>('classic');
  const [giftQuantity, setGiftQuantity] = useState(1);
  const [isSendingGift, setIsSendingGift] = useState(false);
  const [userDiamonds, setUserDiamonds] = useState(0);
  const [equippedItems, setEquippedItems] = useState<any>({});
  const [purchasedItems, setPurchasedItems] = useState<any[]>([]);
  const [showEntrance, setShowEntrance] = useState<any>(null);
  const [lastSentGiftData, setLastSentGiftData] = useState<{gift: any, receiverIds: string[], timestamp: number} | null>(null);
  const [comboTimeout, setComboTimeout] = useState<NodeJS.Timeout | null>(null);
  const [appIcons, setAppIcons] = useState<Record<string, string>>({});
  const [activePrivateChat, setActivePrivateChat] = useState<{id: string, name: string, photo: string} | null>(null);
  const [globalSettings, setGlobalSettings] = useState<any>({});
  const [confirmModal, setConfirmModal] = useState<{show: boolean, title: string, message: string, onConfirm: () => void}>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const [isUploadingMusic, setIsUploadingMusic] = useState(false);
  const [localMusicUrl, setLocalMusicUrl] = useState<string | null>(null);
  const [localMusicTrack, setLocalMusicTrack] = useState<any>(null);
  const [musicClient, setMusicClient] = useState<any>(null);
  const [musicVolume, setMusicVolume] = useState(50);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const micRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const mountTime = useRef(Date.now());
  const entranceTriggeredRef = useRef(false);

  const isOnMic = !!mics.find(m => m.userId === user?.uid);
  const { isJoined, isMuted, toggleMute, remoteUsers, speakingUsers, client } = useAgora(roomId, user?.uid, isOnMic);

  useEffect(() => {
    if (localMusicUrl && localAudioRef.current) {
      localAudioRef.current.volume = musicVolume / 100;
      localAudioRef.current.play().catch(e => console.error("Auto-play failed:", e));
    }
  }, [localMusicUrl]);

  useEffect(() => {
    if (room?.currentMusic?.isPlaying === false) {
      if (localMusicTrack && musicClient) {
        musicClient.unpublish(localMusicTrack).catch(console.error);
        localMusicTrack.close();
        setLocalMusicTrack(null);
        musicClient.leave();
        setMusicClient(null);
      }
      if (localMusicUrl) {
        URL.revokeObjectURL(localMusicUrl);
        setLocalMusicUrl(null);
      }
    }
  }, [room?.currentMusic?.isPlaying, musicClient, localMusicTrack, localMusicUrl]);

  useEffect(() => {
    return () => {
      if (localMusicTrack && musicClient) {
        musicClient.unpublish(localMusicTrack).catch(console.error);
        localMusicTrack.close();
        musicClient.leave();
      }
      if (localMusicUrl) {
        URL.revokeObjectURL(localMusicUrl);
      }
    };
  }, [localMusicTrack, musicClient, localMusicUrl]);

  useEffect(() => {
    const musicUser = remoteUsers.find(u => String(u.uid).includes('_music'));
    if (musicUser && musicUser.audioTrack) {
      musicUser.audioTrack.setVolume(musicVolume);
    }
  }, [remoteUsers, musicVolume]);

  useEffect(() => {
    const handleBack = () => {
      if (showAdminTools) { setShowAdminTools(false); return true; }
      if (showBackgroundModal) { setShowBackgroundModal(false); return true; }
      if (showGiftModal) { setShowGiftModal(false); return true; }
      if (showExitModal) { setShowExitModal(false); return true; }
      if (showMallModal) { setShowMallModal(false); return true; }
      if (showLuckyBoxModal) { setShowLuckyBoxModal(false); return true; }
      if (showGameCenter) { setShowGameCenter(false); return true; }
      if (selectedProfile) { setSelectedProfile(null); return true; }
      return false;
    };

    registerBackHandler(handleBack);
    return () => unregisterBackHandler(handleBack);
  }, [showAdminTools, showBackgroundModal, showGiftModal, showExitModal, showMallModal, showLuckyBoxModal, selectedProfile]);

  // Fetch data
  useEffect(() => {
    if (!user) return;

    const unsubUser = onSnapshot(doc(db, 'users', user.uid), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData(data);
        setUserDiamonds(data.diamonds || 0);
        setEquippedItems({
          mic_frame: data.equippedMicFrame,
          mic_icon: data.equippedMicIcon,
          entrance: data.equippedEntrance,
          chat_bubble: data.equippedBubble,
          text_color: data.equippedTextColor,
          room_background: data.equippedBackground,
          vip: data.isVIP ? data.vipLevel : null
        });
      }
    });

    const unsubAppIcons = onSnapshot(doc(db, 'settings', 'app_icons'), (doc) => {
      if (doc.exists()) setAppIcons(doc.data() as any);
    });

    const unsubSettings = onSnapshot(doc(db, 'system', 'mic_settings'), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data() as any);
      }
    });

    const unsubRoom = onSnapshot(doc(db, 'rooms', roomId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        
        // Check if user is banned
        if (data.bannedUsers && data.bannedUsers.includes(user.uid)) {
          alert('لقد تم حظرك من هذه الغرفة.');
          onClose();
          return;
        }
        
        setRoomBackground(data.backgroundUrl || null);
        setRoom(data);
      } else {
        // Room was deleted
        alert('تم إغلاق الغرفة.');
        onClose();
      }
    });

    const unsubGlobalSettings = onSnapshot(doc(db, 'settings', 'general'), (doc) => {
      if (doc.exists()) {
        setGlobalSettings(doc.data());
      }
    });

    const unsubMics = onSnapshot(collection(db, 'rooms', roomId, 'mics'), async (snapshot) => {
      if (snapshot.empty) {
        for (let i = 0; i < 12; i++) {
          await setDoc(doc(db, 'rooms', roomId, 'mics', `mic_${i}`), { order: i, userId: null, status: 'open' });
        }
      } else {
        const micsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        setMics(micsData.sort((a, b) => a.order - b.order));
      }
    });

    const unsubGifts = onSnapshot(collection(db, 'gifts'), (snapshot) => {
      setGifts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubGiftCategories = onSnapshot(collection(db, 'gift_categories'), (snapshot) => {
      setGiftCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubVip = onSnapshot(collection(db, 'vip_levels'), (snapshot) => {
      setVipLevels(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubStore = onSnapshot(collection(db, 'store_items'), (snapshot) => {
      setStoreItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubEmotes = onSnapshot(collection(db, 'emotes'), (snapshot) => {
      setEmotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubPurchased = onSnapshot(collection(db, 'users', user.uid, 'purchased_items'), (snapshot) => {
      setPurchasedItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qChat = query(collection(db, 'rooms', roomId, 'room_chat'), orderBy('timestamp', 'desc'), limit(30));
    const unsubChat = onSnapshot(qChat, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any })).reverse();
      // Filter out all messages that were sent before the user joined the room
      const filteredMessages = messages.filter(msg => {
        return msg.timestamp >= mountTime.current;
      });
      setChatMessages(filteredMessages);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    const qEvents = query(collection(db, 'rooms', roomId, 'room_events'), orderBy('timestamp', 'desc'), limit(15));
    const unsubEvents = onSnapshot(qEvents, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const event = { id: change.doc.id, ...change.doc.data() } as any;
          // Only show events that happened after the component mounted AND within the last 5 seconds
          if (event.timestamp > mountTime.current && event.timestamp > Date.now() - 5000) {
            if (event.type === 'gift') {
              // Skip if it's our own gift event (we already showed it optimistically)
              if (event.senderId === user.uid) return;
              
              setActiveGiftEvents(prev => [...prev, event]);
              setTimeout(() => {
                setActiveGiftEvents(prev => prev.filter(e => e.id !== event.id));
              }, (event.giftDuration || 6) * 1000);
            } else if (event.type === 'lucky_jackpot') {
              setActiveJackpotEvent(event);
              setTimeout(() => setActiveJackpotEvent(null), 8000);
            } else if (event.type === 'entrance') {
              setShowEntrance({ ...event.entranceData, userName: event.userName });
              const duration = event.entranceData.duration ? event.entranceData.duration * 1000 : 4000;
              setTimeout(() => setShowEntrance(null), duration);
            } else if (event.type === 'emote') {
              setActiveEmotes(prev => ({ ...prev, [event.userId]: event.emoteUrl }));
              setTimeout(() => {
                setActiveEmotes(prev => {
                  const next = { ...prev };
                  delete next[event.userId];
                  return next;
                });
              }, 3000);
            }
          }
        }
      });
    });

    const qCpChat = query(collection(db, 'rooms', roomId, 'cp_chat'), orderBy('timestamp', 'asc'), limit(50));
    const unsubCpChat = onSnapshot(qCpChat, (snapshot) => {
      setCpMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qCpRequests = query(collection(db, 'cp_requests'), where('receiverId', '==', user.uid), where('roomId', '==', roomId), where('status', '==', 'pending'));
    const unsubCpRequests = onSnapshot(qCpRequests, (snapshot) => {
      if (!snapshot.empty) {
        setIncomingCpRequest({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      } else {
        setIncomingCpRequest(null);
      }
    });

    return () => { unsubUser(); unsubAppIcons(); unsubSettings(); unsubGlobalSettings(); unsubRoom(); unsubMics(); unsubGifts(); unsubGiftCategories(); unsubStore(); unsubEmotes(); unsubChat(); unsubEvents(); unsubPurchased(); unsubCpChat(); unsubCpRequests(); };
  }, [user]);

  // Handle entrance effect on join
  useEffect(() => {
    if (!user || hasShownEntrance || entranceTriggeredRef.current) return;

    const triggerEntrance = async () => {
      try {
        entranceTriggeredRef.current = true;
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.equippedEntrance) {
            await addDoc(collection(db, 'rooms', roomId, 'room_events'), {
              type: 'entrance',
              userName: user.displayName || 'مستخدم',
              entranceData: data.equippedEntrance,
              timestamp: Date.now()
            });
            onEntranceShown();
          }
        }
      } catch (e) {
        console.error('Error triggering entrance:', e);
        entranceTriggeredRef.current = false;
      }
    };
    
    triggerEntrance();
  }, [roomId, user, hasShownEntrance, onEntranceShown]);

  const handleMicClick = async (mic: any) => {
    if (!user) return;
    const isLocked = mic.status === 'locked';
    const isOccupied = !!mic.userId;
    const myCurrentMic = mics.find(m => m.userId === user.uid);

    if (isLocked) return alert('هذا المايك مغلق');

    if (isOccupied) {
      if (mic.userId === user.uid) {
        if (window.confirm('هل تريد النزول من المايك؟')) {
          await updateDoc(doc(db, 'rooms', roomId, 'mics', mic.id), { userId: null, userAvatar: null, userName: null, userMicFrame: null, userMicIcon: null });
        }
      } else {
        const userDoc = await getDoc(doc(db, 'users', mic.userId));
        const userData = userDoc.exists() ? userDoc.data() : {};
        let partnerData: any = {};
        if (userData.cpPartnerId) {
          const partnerDoc = await getDoc(doc(db, 'users', userData.cpPartnerId));
          if (partnerDoc.exists()) partnerData = partnerDoc.data();
        }
        setSelectedProfile({ 
          uid: mic.userId, 
          name: mic.userName, 
          avatar: mic.userAvatar,
          totalSpent: userData.totalSpent || 0,
          totalSupport: userData.totalSupport || 0,
          numericId: userData.numericId,
          badges: userData.badges || [],
          cpPartnerId: userData.cpPartnerId,
          cpPartnerName: userData.cpPartnerName,
          cpPartnerAvatar: userData.cpPartnerAvatar,
          equippedCpFrame: userData.equippedCpFrame,
          cpBackground: userData.cpBackground,
          equippedMicFrame: userData.equippedMicFrame,
          partnerCpFrame: partnerData.equippedCpFrame || null,
          partnerMicFrame: partnerData.equippedMicFrame || null
        });
      }
      return;
    }

    if (myCurrentMic) {
      if (!settings.allowMovement) return alert('التنقل بين المايكات غير مسموح حالياً');
      await updateDoc(doc(db, 'rooms', roomId, 'mics', myCurrentMic.id), { userId: null, userAvatar: null, userName: null, userMicFrame: null, userMicIcon: null });
    }
    
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.exists() ? userDoc.data() : {};
    const equippedFrame = userData.equippedMicFrame || null;
    const equippedIcon = userData.equippedMicIcon || null;
    const cpPartnerId = userData.cpPartnerId || null;

    await updateDoc(doc(db, 'rooms', roomId, 'mics', mic.id), { 
      userId: user.uid, 
      userAvatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
      userName: user.displayName || 'مستخدم',
      userMicFrame: equippedFrame || null,
      userMicIcon: equippedIcon || null,
      cpPartnerId: cpPartnerId
    });
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !user) return;
    
    await addDoc(collection(db, 'rooms', roomId, 'room_chat'), {
      text: chatInput,
      userId: user.uid,
      userName: user.displayName || 'مستخدم',
      userBubble: equippedItems.chat_bubble || null,
      userTextColor: equippedItems.text_color || null,
      timestamp: Date.now()
    });
    setChatInput('');
  };

  const executeSendGift = async (gift: any, receiverIds: string[], quantity: number = 1) => {
    const totalCost = gift.value * receiverIds.length * quantity;
    if (userDiamonds < totalCost) return alert('رصيدك من الألماس لا يكفي!');

    // Optimistic UI Update
    setUserDiamonds(prev => prev - totalCost);
    
    const isLucky = gift.category === 'lucky';
    const clientEventId = 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const localEvents: any[] = [];
    
    if (!isLucky && gift.hasAnimation !== false) {
      localEvents.push({
        id: clientEventId,
        type: 'gift',
        senderName: user!.displayName || 'مستخدم',
        receiverName: receiverIds.length > 1 ? 'الجميع' : (mics.find(m => m.userId === receiverIds[0])?.userName || 'مستخدم'),
        giftImageUrl: gift.imageUrl,
        giftAnimationUrl: gift.link || gift.imageUrl,
        giftAnimationSize: gift.animationSize || 'normal',
        giftSize: gift.giftSize || null,
        giftAudioUrl: gift.audioUrl || null,
        giftDuration: gift.duration || 6,
        giftName: gift.name,
        giftCategory: gift.category || 'normal',
        giftEffect: gift.effect || 'normal',
        receiverId: receiverIds.length === 1 ? receiverIds[0] : null,
        timestamp: Date.now(),
        senderId: user!.uid
      });
    } else if (isLucky && gift.hasAnimation !== false) {
      receiverIds.forEach((receiverId, index) => {
        localEvents.push({
          id: `${clientEventId}_${index}`,
          type: 'gift',
          senderName: user!.displayName || 'مستخدم',
          receiverName: mics.find(m => m.userId === receiverId)?.userName || 'مستخدم',
          giftImageUrl: gift.imageUrl,
          giftAnimationUrl: gift.link || gift.imageUrl,
          giftAnimationSize: gift.animationSize || 'small',
          giftSize: gift.giftSize || null,
          giftAudioUrl: gift.audioUrl || null,
          giftDuration: gift.duration || 3,
          giftName: gift.name,
          giftCategory: 'lucky',
          giftEffect: 'zoom_mic',
          receiverId: receiverId,
          timestamp: Date.now() + Math.random() * 500,
          senderId: user!.uid
        });
      });
    }

    localEvents.forEach(event => {
      setActiveGiftEvents(prev => [...prev, event]);
      setTimeout(() => {
        setActiveGiftEvents(prev => prev.filter(e => e.id !== event.id));
      }, (event.giftDuration || 6) * 1000);
    });

    // Setup Combo immediately
    if (receiverIds.length > 0) {
      setLastSentGiftData({ gift, receiverIds: receiverIds, timestamp: Date.now() });
      if (comboTimeout) clearTimeout(comboTimeout);
      const timeout = setTimeout(() => {
        setLastSentGiftData(null);
      }, 5000);
      setComboTimeout(timeout);
    }

    setShowGiftModal(false);

    // Run backend transaction in background
    (async () => {
      try {
        const batch = writeBatch(db);
        const senderRef = doc(db, 'users', user!.uid);
        
        let totalWinAmount = 0;

        // 3. NOW EXECUTE ALL WRITES
        
        if (!isLucky && gift.hasAnimation !== false) {
          batch.set(doc(collection(db, 'rooms', roomId, 'room_events')), {
            type: 'gift', 
            senderId: user!.uid,
            clientEventId: clientEventId,
            senderName: user!.displayName || 'مستخدم', 
            receiverName: receiverIds.length > 1 ? 'الجميع' : (mics.find(m => m.userId === receiverIds[0])?.userName || 'مستخدم'), 
            giftImageUrl: gift.imageUrl, 
            giftAnimationUrl: gift.link || gift.imageUrl,
            giftAnimationSize: gift.animationSize || 'normal',
            giftSize: gift.giftSize || null,
            giftAudioUrl: gift.audioUrl || null,
            giftDuration: gift.duration || 6,
            giftName: gift.name, 
            giftCategory: gift.category || 'normal',
            giftEffect: gift.effect || 'normal',
            receiverId: receiverIds.length === 1 ? receiverIds[0] : null,
            timestamp: Date.now()
          });
        }

        for (let i = 0; i < receiverIds.length; i++) {
          const receiverId = receiverIds[i];
          const receiverName = mics.find(m => m.userId === receiverId)?.userName || 'مستخدم';

          const receiverRef = doc(db, 'users', receiverId);
          let winAmount = 0;
          let isWin = false;

          if (isLucky) {
            const winProb = gift.winProbability || 20;
            const multiplier = gift.winMultiplier || 5;
            isWin = Math.random() * 100 < winProb;
            if (isWin) {
              winAmount = gift.value * multiplier;
              totalWinAmount += winAmount;
            }

            if (gift.hasAnimation !== false) {
              batch.set(doc(collection(db, 'rooms', roomId, 'room_events')), {
                type: 'gift', 
                senderId: user!.uid,
                clientEventId: `${clientEventId}_${i}`,
                senderName: user!.displayName || 'مستخدم', 
                receiverName: receiverName, 
                giftImageUrl: gift.imageUrl, 
                giftAnimationUrl: gift.link || gift.imageUrl,
                giftAnimationSize: gift.animationSize || 'small',
                giftSize: gift.giftSize || null,
                giftAudioUrl: gift.audioUrl || null,
                giftDuration: gift.duration || 3,
                giftName: gift.name, 
                giftCategory: 'lucky',
                giftEffect: 'zoom_mic',
                receiverId: receiverId,
                timestamp: Date.now() + Math.random() * 500
              });
            }
          }

          batch.set(receiverRef, { diamonds: increment(gift.value) }, { merge: true });

          const targetMic = mics.find(m => m.userId === receiverId);
          if (targetMic) {
            batch.set(doc(db, 'rooms', roomId, 'mics', targetMic.id), {
              charisma: increment(gift.value)
            }, { merge: true });
          }

          batch.set(doc(collection(db, 'transactions')), {
            type: 'gift', senderId: user!.uid, receiverId: receiverId, giftId: gift.id, amount: gift.value * quantity, winAmount, timestamp: new Date().toISOString(), quantity
          });

          if (isWin && winAmount >= (bigWinConfig?.threshold || 100000)) {
            batch.set(doc(collection(db, 'rooms', roomId, 'room_events')), {
              type: 'lucky_jackpot',
              userName: user!.displayName || 'مستخدم',
              amount: winAmount,
              giftName: gift.name,
              audioUrl: bigWinConfig?.audioUrl || null,
              timestamp: Date.now()
            });
          }

          let chatText = `أرسل 🎁 ${gift.name} ${quantity > 1 ? `(x${quantity})` : ''} إلى ${receiverName}`;
          if (isLucky) {
            chatText += isWin ? ` وفاز بـ ${winAmount} 💎! 🎉` : ` ولم يحالفه الحظ 😢`;
          }

          batch.set(doc(collection(db, 'rooms', roomId, 'room_chat')), {
            text: chatText,
            userId: user!.uid,
            userName: user!.displayName || 'مستخدم',
            isSystemGift: true,
            timestamp: Date.now()
          });
        }

        batch.set(senderRef, { 
          diamonds: increment(-totalCost + totalWinAmount),
          dailySupport: increment(totalCost),
          totalSupport: increment(totalCost)
        }, { merge: true });

        batch.set(doc(db, 'rooms', roomId), {
          charisma: increment(totalCost)
        }, { merge: true });
        
        await batch.commit();
      } catch (error: any) {
        console.error('Background gift error:', error);
        alert('حدث خطأ في إرسال الهدية: ' + error.message);
      }
    })();
  };

  const handleLocalMusicPlay = async () => {
    if (!localAudioRef.current || musicClient || localMusicTrack) return;
    try {
      const audioEl = localAudioRef.current as any;
      audioEl.volume = musicVolume / 100;
      
      const stream = audioEl.captureStream ? audioEl.captureStream() : audioEl.mozCaptureStream ? audioEl.mozCaptureStream() : null;
      if (stream) {
        const track = stream.getAudioTracks()[0];
        if (track) {
          const customTrack = AgoraRTC.createCustomAudioTrack({ mediaStreamTrack: track });
          setLocalMusicTrack(customTrack);
          
          const mClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
          const randomSuffix = Math.floor(Math.random() * 10000);
          await mClient.join(AGORA_APP_ID, roomId, null, (user?.uid || '') + '_music_' + randomSuffix);
          await mClient.publish(customTrack);
          setMusicClient(mClient);
        }
      }
    } catch (e) {
      console.error("Failed to publish local music track", e);
    }
  };

  const handleSendGift = async () => {
    if (selectedReceivers.length === 0) return alert('الرجاء تحديد شخص لإرسال الهدية له');
    if (!selectedGift) return alert('الرجاء تحديد هدية');

    if (cpConfig && selectedGift.id === cpConfig.cpGiftId) {
      if (selectedReceivers.length > 1) {
        return alert('هدية الارتباط (CP) يمكن إرسالها لشخص واحد فقط في كل مرة.');
      }
      const receiverId = selectedReceivers[0];
      if (receiverId === user?.uid) {
        return alert('لا يمكنك إرسال هدية الارتباط لنفسك.');
      }
      
      const totalCost = selectedGift.value * giftQuantity;
      if (userDiamonds < totalCost) {
        return alert('رصيدك غير كافٍ لإرسال هذه الهدية.');
      }

      setIsSendingGift(true);
      try {
        // Send CP request
        const receiverDoc = await getDoc(doc(db, 'users', receiverId));
        const receiverData = receiverDoc.data();
        
        await setDoc(doc(collection(db, 'cp_requests')), {
          senderId: user!.uid,
          senderName: user!.displayName || 'مستخدم',
          senderAvatar: user!.photoURL || '',
          receiverId: receiverId,
          receiverName: receiverData?.displayName || 'مستخدم',
          receiverAvatar: receiverData?.photoURL || '',
          status: 'pending',
          roomId: roomId,
          createdAt: new Date().toISOString(),
          frameUrl: cpConfig.frameUrl || '',
          backgroundUrl: cpConfig.backgroundUrl || ''
        });

        // Add a room chat message
        await setDoc(doc(collection(db, 'rooms', roomId, 'room_chat')), {
          text: `أرسل هدية الارتباط (CP) إلى ${receiverData?.displayName || 'مستخدم'}! 💍`,
          userId: user!.uid,
          userName: user!.displayName || 'مستخدم',
          isSystemGift: true,
          timestamp: Date.now()
        });

        // Execute the standard gift logic (animation, deduction, charisma, room events)
        await executeSendGift(selectedGift, selectedReceivers, giftQuantity);

        alert('تم إرسال طلب الارتباط (CP) بنجاح! في انتظار موافقة الطرف الآخر.');
      } catch (error: any) {
        alert('حدث خطأ: ' + error.message);
      } finally {
        setIsSendingGift(false);
      }
      return;
    }

    executeSendGift(selectedGift, selectedReceivers, giftQuantity);
  };

  const handleComboClick = () => {
    if (lastSentGiftData) {
      executeSendGift(lastSentGiftData.gift, lastSentGiftData.receiverIds, giftQuantity);
    }
  };

  const displayBackground = roomBackground || globalSettings?.defaultRoomBackground;

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 text-white flex justify-center font-sans h-[100dvh]" dir="rtl">
      <div className="w-full max-w-md h-[100dvh] relative overflow-hidden">
        {/* Background Layer */}
        <div className="absolute inset-0 z-0">
          {displayBackground ? (
            displayBackground.toLowerCase().match(/\.(mp4|webm|ogg)(\?.*)?$/) ? (
              <video 
                src={displayBackground} 
                autoPlay 
                loop 
                muted 
                playsInline 
                className="w-full h-full object-cover"
              />
            ) : (
              <img src={displayBackground} className="w-full h-full object-cover" alt="Background" />
            )
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-indigo-950 via-purple-950 to-black"></div>
          )}
          <div className="absolute inset-0 bg-black/40"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-20"></div>
        </div>

        {/* Entrance Animation Overlay */}
        <AnimatePresence>
          {showEntrance && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className={`absolute z-[120] pointer-events-none flex justify-center ${showEntrance.isFullScreen ? 'inset-0' : 'top-1/4 left-0 right-0'}`}
            >
              {showEntrance.audioUrl && <audio autoPlay src={showEntrance.audioUrl || undefined} />}
              <div className="relative w-full h-full flex justify-center items-center">
                {showEntrance.imageUrl?.toLowerCase().match(/\.(mp4|webm|ogg|mov)(\?.*)?$/) ? (
                  <video 
                    src={showEntrance.imageUrl || undefined} 
                    autoPlay 
                    loop 
                    muted 
                    playsInline 
                    className={showEntrance.isFullScreen ? "w-full h-full object-cover" : "w-80 h-80 object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]"} 
                  />
                ) : (
                  <img 
                    src={showEntrance.imageUrl || undefined} 
                    alt="Entrance" 
                    className={showEntrance.isFullScreen ? "w-full h-full object-cover" : "w-80 h-80 object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]"} 
                  />
                )}
                {!showEntrance.isFullScreen && (
                  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm px-4 py-1.5 rounded-full border border-yellow-500/50 whitespace-nowrap">
                    <span className="text-yellow-400 font-bold text-sm">✨ {user?.displayName} دخل الغرفة ✨</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 100k Jackpot Banner */}
        <AnimatePresence>
          {activeJackpotEvent && (
            <motion.div
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="absolute top-4 left-4 right-4 z-[110] pointer-events-none"
            >
              {activeJackpotEvent.audioUrl && (
                <audio src={activeJackpotEvent.audioUrl || undefined} autoPlay />
              )}
              <div className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 p-[2px] rounded-2xl shadow-[0_0_30px_rgba(234,179,8,0.5)]">
                <div className="bg-gray-900/90 backdrop-blur-md rounded-2xl p-3 flex items-center gap-3">
                  <div className="bg-yellow-500/20 p-2 rounded-xl">
                    <Crown className="text-yellow-400 animate-pulse" size={24} />
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-xs font-bold">ضربة حظ أسطورية! 🎉</p>
                    <p className="text-yellow-400 text-sm font-black">
                      {activeJackpotEvent.userName} فاز بـ {activeJackpotEvent.amount.toLocaleString()} 💎
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-[10px]">من هدية</p>
                    <p className="text-pink-400 text-xs font-bold">{activeJackpotEvent.giftName}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Gift Animation Overlay */}
        <AnimatePresence>
          {activeGiftEvents.map((event) => (
            <motion.div 
              key={event.timestamp}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 z-[100] flex flex-col items-center justify-center pointer-events-none overflow-hidden"
            >
              {/* Media */}
              {(() => {
                const mediaUrl = event.giftAnimationUrl || event.giftImageUrl;
                const isVideo = mediaUrl?.toLowerCase().match(/\.(mp4|webm|ogg|mov)(\?.*)?$/) != null || mediaUrl?.includes('video');
                const isFullscreen = event.giftAnimationSize === 'fullscreen';
                const isLarge = event.giftAnimationSize === 'large';
                const isLucky = event.giftCategory === 'lucky';
                
                // Use custom giftSize if available, otherwise fallback to defaults
                const giftSize = event.giftSize || (isFullscreen ? 100 : (isLarge ? 80 : 60));
                const sizePx = isFullscreen ? '100%' : `${(giftSize / 100) * 400}px`;

                const mediaStyle: React.CSSProperties = isFullscreen 
                  ? { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }
                  : { width: sizePx, height: sizePx };

                const mediaClass = isFullscreen 
                  ? "object-cover z-0" 
                  : "object-contain z-0 drop-shadow-[0_0_50px_rgba(255,255,255,0.6)]";

                // Lucky gift animation: start center, move to mic
                let animationProps: any = isFullscreen 
                  ? { animate: { scale: [1.05, 1] }, transition: { duration: 0.5 } }
                  : { animate: { scale: [0.8, 1.2, 1] }, transition: { duration: 0.5 } };

                if ((isLucky || event.giftEffect === 'zoom_mic') && event.receiverId) {
                  // Find the mic position
                  const targetMic = mics.find(m => m.userId === event.receiverId);
                  const micElement = targetMic ? micRefs.current[targetMic.id] : null;
                  
                  if (micElement) {
                    const rect = micElement.getBoundingClientRect();
                    const parentRect = micElement.closest('.relative.overflow-hidden')?.getBoundingClientRect();
                    
                    if (parentRect) {
                      const targetX = rect.left + rect.width / 2 - parentRect.left - parentRect.width / 2;
                      const targetY = rect.top + rect.height / 2 - parentRect.top - parentRect.height / 2;
                      
                      animationProps = {
                        initial: { scale: 0, x: 0, y: 0, opacity: 0 },
                        animate: { 
                          scale: [0, 1.5, 1.2, 1.5, 0], 
                          x: [0, 0, targetX, targetX, targetX],
                          y: [0, 0, targetY, targetY, targetY],
                          opacity: [0, 1, 1, 1, 0]
                        },
                        transition: { 
                          duration: event.giftDuration || 6,
                          times: [0, 0.2, 0.5, 0.8, 1],
                          ease: "easeInOut"
                        }
                      };
                    }
                  }
                }

                let effectClass = "";
                if (event.giftEffect === 'shake') effectClass = "animate-[shake_0.5s_ease-in-out_infinite]";
                if (event.giftEffect === 'pulse') effectClass = "animate-pulse";
                if (event.giftEffect === 'spin') effectClass = "animate-[spin_2s_linear_infinite]";
                if (event.giftEffect === 'bounce') effectClass = "animate-bounce";

                return (
                  <>
                    {event.giftAudioUrl && (
                      <audio autoPlay src={event.giftAudioUrl || undefined} />
                    )}
                    {isVideo ? (
                      <motion.video 
                        key={mediaUrl}
                        autoPlay 
                        loop 
                        muted 
                        playsInline 
                        src={mediaUrl || undefined} 
                        className={`${mediaClass} ${effectClass}`} 
                        style={mediaStyle}
                        {...animationProps}
                        onLoadedData={(e) => {
                          e.currentTarget.play().catch(err => console.error("Video play error:", err));
                        }}
                        onCanPlay={(e) => {
                          e.currentTarget.play().catch(err => console.error("Video play error:", err));
                        }}
                      />
                    ) : (
                      <motion.img key={mediaUrl} src={mediaUrl || undefined} className={`${mediaClass} ${effectClass}`} style={mediaStyle} {...animationProps} />
                    )}
                  </>
                );
              })()}
            </motion.div>
          ))}
        </AnimatePresence>

        <div className="relative z-10 h-full flex flex-col">
          {/* Top Bar */}
          <div className="p-4 flex justify-between items-start">
            <div className="flex items-center gap-2 bg-black/40 rounded-full p-1 pr-3 backdrop-blur-md">
              <img src="https://picsum.photos/seed/host/50/50" alt="Host" className="w-8 h-8 rounded-full border border-purple-400" referrerPolicy="no-referrer" />
              <div className="flex flex-col">
                <span className="text-xs font-bold">{room?.name || 'الغرفة العامة'} 🎵</span>
                <span className="text-[8px] text-gray-300">ID: {room?.numericId || '10001'}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button onClick={() => setShowExitModal(true)} className="p-1.5 bg-black/40 rounded-full backdrop-blur-md hover:bg-black/60 transition">
                {appIcons.closeIcon ? <img src={appIcons.closeIcon} className="w-4 h-4 object-contain" /> : <X size={18} />}
              </button>
            </div>
          </div>

          {/* Music Player */}
          {isUploadingMusic && (
            <div className="px-4 mb-2">
              <div className="bg-black/40 backdrop-blur-md rounded-xl p-2 flex items-center gap-3 border border-white/10">
                <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin"></div>
                <div className="text-xs font-bold text-white">جاري رفع الموسيقى...</div>
              </div>
            </div>
          )}
          {room?.currentMusic?.isPlaying && (
            <div className="px-4 mb-2">
              <div className="bg-black/40 backdrop-blur-md rounded-xl p-3 flex flex-col gap-2 border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center animate-[spin_3s_linear_infinite]">
                    <Music size={14} className="text-white" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="text-xs font-bold text-white truncate">{room.currentMusic.name}</div>
                    <div className="text-[10px] text-gray-400 truncate">بواسطة: {room.currentMusic.playedBy}</div>
                  </div>
                  <button 
                    onClick={async () => {
                      await updateDoc(doc(db, 'rooms', roomId), {
                        'currentMusic.isPlaying': false
                      });
                    }}
                    className="p-1.5 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500/40 transition"
                  >
                    <X size={14} />
                  </button>
                </div>
                
                {/* Volume Control */}
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] text-gray-400">الصوت</span>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={musicVolume}
                    onChange={(e) => {
                      const newVol = parseInt(e.target.value);
                      setMusicVolume(newVol);
                      if (localAudioRef.current) {
                        localAudioRef.current.volume = newVol / 100;
                      }
                      // Adjust remote music track volume if listening
                      const musicUser = remoteUsers.find(u => String(u.uid).includes('_music'));
                      if (musicUser && musicUser.audioTrack) {
                        musicUser.audioTrack.setVolume(newVol);
                      }
                    }}
                    className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full"
                  />
                </div>

                {!room.currentMusic.isLocalStream && room.currentMusic.url && (
                  <audio src={room.currentMusic.url} autoPlay loop />
                )}
                {localMusicUrl && (
                  <audio 
                    ref={localAudioRef}
                    src={localMusicUrl} 
                    autoPlay 
                    loop 
                    onPlaying={handleLocalMusicPlay}
                  />
                )}
              </div>
            </div>
          )}

          {/* Seats Grid */}
          <div className="px-4 py-2 shrink-0">
            <div className="grid grid-cols-4 gap-y-6 gap-x-4">
              {mics.slice(0, settings.maxMics).map((mic, i) => (
                <div 
                  key={mic.id} 
                  ref={el => micRefs.current[mic.id] = el}
                  onClick={() => handleMicClick(mic)} 
                  className="flex flex-col items-center relative cursor-pointer group"
                >
                  <div className="relative">
                    {/* Lucky Gift Icon Overlay */}
                    <AnimatePresence>
                      {activeGiftEvents.filter(e => e.giftCategory === 'lucky' && e.receiverId === mic.userId).map(e => (
                        <motion.div
                          key={e.timestamp}
                          initial={{ scale: 0, y: 0, opacity: 0 }}
                          animate={{ scale: [0, 1.2, 1], y: -20, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          className="absolute -top-8 left-1/2 -translate-x-1/2 z-20"
                        >
                          <img src={e.giftImageUrl || undefined} className="w-8 h-8 object-contain drop-shadow-lg" />
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    <div className={`w-16 h-16 rounded-full border-2 p-0.5 transition-all ${mic.userId ? 'border-purple-400 bg-purple-500/20' : mic.status === 'locked' ? 'border-red-500/50 bg-red-500/20' : 'border-transparent'} ${mic.userId && mic.cpPartnerId && mics.some(m => m.userId === mic.cpPartnerId) ? 'ring-2 ring-pink-500 ring-offset-2 ring-offset-black/20' : ''} ${speakingUsers.includes(mic.userId) ? 'ring-4 ring-green-400 shadow-[0_0_15px_rgba(74,222,128,0.6)]' : ''}`}>
                      {mic.userId ? (
                        <>
                          <img src={mic.userAvatar || undefined} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                          
                          {/* Active Emote Overlay */}
                          <AnimatePresence>
                            {activeEmotes[mic.userId] && (
                              <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1.5, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
                              >
                                <img src={activeEmotes[mic.userId]} alt="emote" className="w-12 h-12 object-contain drop-shadow-xl" />
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {mic.userId && mic.cpPartnerId && mics.some(m => m.userId === mic.cpPartnerId) && (
                            <div className="absolute -top-1 -right-1 z-30 animate-bounce">
                              <Heart size={16} className="text-pink-500 fill-pink-500 drop-shadow-[0_0_5px_rgba(236,72,153,0.8)]" />
                            </div>
                          )}
                          {mic.userMicFrame && (
                            <img src={mic.userMicFrame || undefined} className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none scale-125" />
                          )}
                          {mic.userMicIcon && (
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gray-900 rounded-full flex items-center justify-center border border-gray-700 z-20">
                              <img src={mic.userMicIcon || undefined} className="w-4 h-4 object-contain" />
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="w-full h-full rounded-full flex items-center justify-center overflow-hidden">
                          {mic.status === 'locked' ? (
                            <div className="w-full h-full bg-black/40 flex items-center justify-center rounded-full">
                              {appIcons.micLockedIcon ? <img src={appIcons.micLockedIcon} className="w-5 h-5 object-contain opacity-50" /> : <ShieldBan size={20} className="text-red-400/50" />}
                            </div>
                          ) : appIcons.micIcon ? (
                            <img src={appIcons.micIcon || undefined} alt="Mic" className="w-full h-full object-contain drop-shadow-md" />
                          ) : (
                            <div className="w-full h-full bg-black/40 flex items-center justify-center rounded-full"><Mic size={20} className="text-white/30" /></div>
                          )}
                        </div>
                      )}
                    </div>
                    {mic.userId && (
                      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center">
                        <div className="bg-black/80 text-white text-[9px] px-2 py-0.5 rounded-full whitespace-nowrap backdrop-blur-sm border border-white/10 max-w-[60px] truncate mb-0.5">
                          {mic.userName}
                        </div>
                        {/* Charisma Bar */}
                        {(() => {
                          const charisma = mic.charisma || 0;
                          const level = charisma >= 100000 ? 4 : charisma >= 20000 ? 3 : charisma >= 5000 ? 2 : 1;
                          const colors = {
                            1: 'from-gray-400 to-gray-600',
                            2: 'from-purple-400 to-indigo-600',
                            3: 'from-yellow-400 to-orange-600',
                            4: 'from-pink-400 to-rose-600'
                          }[level];
                          const glow = {
                            1: 'shadow-none',
                            2: 'shadow-[0_0_10px_rgba(168,85,247,0.3)]',
                            3: 'shadow-[0_0_15px_rgba(234,179,8,0.3)]',
                            4: 'shadow-[0_0_20px_rgba(236,72,153,0.4)]'
                          }[level];

                          return (
                            <div className={`flex items-center gap-0.5 bg-black/60 px-1.5 py-0.5 rounded-full border border-white/10 ${glow} transition-all duration-500`}>
                              <div className={`w-1 h-1 rounded-full bg-gradient-to-tr ${colors} animate-pulse`} />
                              <span className={`text-[8px] font-black tracking-tighter ${
                                level === 4 ? 'text-pink-300' :
                                level === 3 ? 'text-yellow-300' :
                                level === 2 ? 'text-purple-300' :
                                'text-gray-300'
                              }`}>
                                {charisma.toLocaleString()}
                              </span>
                              <Heart size={7} className={`fill-current ${
                                level === 4 ? 'text-pink-500' :
                                level === 3 ? 'text-yellow-500' :
                                level === 2 ? 'text-purple-500' :
                                'text-red-500'
                              }`} />
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 px-4 overflow-y-auto flex flex-col pb-2 space-y-2 mask-image-to-top relative [&::-webkit-scrollbar]:hidden">
            <div className="bg-black/30 w-fit px-3 py-1.5 rounded-xl backdrop-blur-sm mb-2">
              <span className="text-yellow-400 text-xs font-bold mr-1">النظام:</span>
              <span className="text-xs text-gray-200">مرحباً بك في الغرفة! الرجاء الالتزام بالقوانين.</span>
            </div>
            {chatMessages.map(msg => (
              <div 
                key={msg.id} 
                className={`w-fit max-w-[80%] px-3 py-1.5 rounded-xl backdrop-blur-sm break-words relative ${msg.isSystemGift ? 'bg-pink-500/30 border border-pink-500/50' : msg.userBubble ? 'bg-transparent' : 'bg-black/30'}`}
              >
                {msg.userBubble && !msg.isSystemGift && (
                  <img src={msg.userBubble || undefined} className="absolute inset-0 w-full h-full object-fill z-0 rounded-xl opacity-90 pointer-events-none" />
                )}
                <div className="relative z-10">
                  <span 
                    onClick={async () => {
                      const userDoc = await getDoc(doc(db, 'users', msg.userId));
                      const userData = userDoc.exists() ? userDoc.data() : {};
                      let partnerData: any = {};
                      if (userData.cpPartnerId) {
                        const partnerDoc = await getDoc(doc(db, 'users', userData.cpPartnerId));
                        if (partnerDoc.exists()) partnerData = partnerDoc.data();
                      }
                      setSelectedProfile({
                        uid: msg.userId,
                        name: msg.userName,
                        avatar: msg.userAvatar,
                        totalSpent: userData.totalSpent || 0,
                        totalSupport: userData.totalSupport || 0,
                        numericId: userData.numericId,
                        badges: userData.badges || [],
                        cpPartnerId: userData.cpPartnerId,
                        cpPartnerName: userData.cpPartnerName,
                        cpPartnerAvatar: userData.cpPartnerAvatar,
                        equippedCpFrame: userData.equippedCpFrame,
                        cpBackground: userData.cpBackground,
                        equippedMicFrame: userData.equippedMicFrame,
                        partnerCpFrame: partnerData.equippedCpFrame || null,
                        partnerMicFrame: partnerData.equippedMicFrame || null
                      });
                    }}
                    className={`${msg.isSystemGift ? 'text-pink-300' : 'text-purple-300'} text-xs font-bold mr-1 cursor-pointer hover:underline`}
                  >
                    {msg.userName}:
                  </span>
                  <span className="text-xs" style={{ color: msg.userTextColor || 'white' }}>
                    {msg.type === 'emote' ? (
                      <img src={msg.emoteUrl} alt="emote" className="inline-block w-8 h-8 mr-1" />
                    ) : (
                      msg.text
                    )}
                  </span>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Bottom Controls */}
          <div className="p-4 pt-2 bg-gradient-to-t from-black/90 to-transparent relative">
            {/* Combo Button - Moved to bottom left above chat input */}
            <AnimatePresence>
              {lastSentGiftData && (
                <motion.button
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleComboClick}
                  disabled={isSendingGift}
                  className="absolute -top-16 left-4 z-50 bg-gradient-to-r from-pink-500 to-purple-600 p-1 rounded-full shadow-[0_0_15px_rgba(236,72,153,0.5)] border-2 border-white/20 flex flex-col items-center justify-center w-14 h-14 overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-white/20 group-hover:bg-transparent transition-colors"></div>
                  <img src={lastSentGiftData.gift.imageUrl || undefined} alt="combo" className="w-6 h-6 object-contain drop-shadow-md z-10" />
                  <span className="text-[9px] font-black text-white z-10 mt-0.5">تكرار</span>
                  
                  {/* Timer Progress Bar */}
                  <motion.div 
                    key={lastSentGiftData.timestamp} // Force re-render on new combo
                    initial={{ height: "100%" }}
                    animate={{ height: "0%" }}
                    transition={{ duration: 5, ease: "linear" }}
                    className="absolute bottom-0 left-0 w-full bg-yellow-400/30 z-0"
                  />
                </motion.button>
              )}
            </AnimatePresence>

            <form onSubmit={handleSendChat} className="flex gap-2 mb-3">
              <input 
                type="text" 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="تحدث هنا..." 
                className="flex-1 bg-black/40 border border-white/10 rounded-full px-4 py-2 text-sm text-white outline-none focus:border-purple-500 backdrop-blur-md"
              />
              <button type="submit" className="bg-purple-600 p-2 rounded-full text-white hover:bg-purple-700 transition">
                {appIcons.sendIcon ? <img src={appIcons.sendIcon} className="w-5 h-5 object-contain" /> : <Send size={20} />}
              </button>
            </form>
            
            <div className="flex items-center gap-3 relative">
              <button 
                onClick={toggleMute}
                disabled={!isOnMic}
                className={`p-2.5 rounded-full backdrop-blur-md transition ${!isOnMic ? 'bg-black/20 opacity-50 cursor-not-allowed' : isMuted ? 'bg-red-500/80 text-white' : 'bg-black/40 hover:bg-black/60'}`}
              >
                {isMuted ? <MicOff size={20} /> : (appIcons.micIcon ? <img src={appIcons.micIcon} className="w-5 h-5 object-contain" /> : <Mic size={20} />)}
              </button>
              <button 
                onClick={() => setShowEmotePicker(!showEmotePicker)}
                className={`p-2.5 rounded-full backdrop-blur-md transition ${showEmotePicker ? 'bg-purple-600 text-white' : 'bg-black/40 hover:bg-black/60'}`}
              >
                {appIcons.smileIcon ? <img src={appIcons.smileIcon} className="w-5 h-5 object-contain" /> : <Smile size={20} />}
              </button>
              
              {/* Emote Picker */}
              <AnimatePresence>
                {showEmotePicker && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                    className="absolute bottom-full mb-4 right-0 bg-gray-900/90 backdrop-blur-xl border border-gray-700 rounded-2xl p-3 shadow-2xl z-50 w-64"
                  >
                    <div className="grid grid-cols-3 gap-2">
                      {emotes.map(emote => (
                        <button
                          key={emote.id}
                          onClick={async () => {
                            setShowEmotePicker(false);
                            if (!user) return;
                            
                            // Send chat message
                            await addDoc(collection(db, 'rooms', roomId, 'room_chat'), {
                              userId: user.uid,
                              userName: user.displayName,
                              userAvatar: user.photoURL,
                              type: 'emote',
                              emoteUrl: emote.url,
                              timestamp: Date.now()
                            });
                            
                            // Send event for mic animation
                            await addDoc(collection(db, 'rooms', roomId, 'room_events'), {
                              type: 'emote',
                              userId: user.uid,
                              emoteUrl: emote.url,
                              timestamp: Date.now()
                            });
                          }}
                          className="bg-gray-800 hover:bg-gray-700 rounded-xl p-2 flex items-center justify-center transition"
                        >
                          <img src={emote.url} alt={emote.id} className="w-10 h-10 object-contain" />
                        </button>
                      ))}
                      {emotes.length === 0 && (
                        <div className="col-span-3 text-center text-gray-500 text-xs py-2">لا توجد إيموشنات</div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {user && room.speakers?.some((s: any) => s.uid === user.uid) && (
                <button 
                  onClick={() => setShowCpChat(true)}
                  className="bg-pink-500/20 p-2.5 rounded-full backdrop-blur-md hover:bg-pink-500/30 transition border border-pink-500/30 text-pink-500"
                  title="دردشة CP"
                >
                  <Heart size={20} />
                </button>
              )}
              <button onClick={() => setShowAdminTools(true)} className="bg-black/40 p-2.5 rounded-full backdrop-blur-md hover:bg-black/60 transition">
                {appIcons.moreIcon ? <img src={appIcons.moreIcon} className="w-5 h-5 object-contain" /> : <MoreHorizontal size={20} />}
              </button>
              <button onClick={async () => {
                if (!user) return;
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                const userData = userDoc.exists() ? userDoc.data() : {};
                let partnerData: any = {};
                if (userData.cpPartnerId) {
                  const partnerDoc = await getDoc(doc(db, 'users', userData.cpPartnerId));
                  if (partnerDoc.exists()) partnerData = partnerDoc.data();
                }
                setSelectedProfile({ 
                  uid: user.uid, 
                  name: user.displayName, 
                  avatar: user.photoURL,
                  totalSpent: userData.totalSpent || 0,
                  totalSupport: userData.totalSupport || 0,
                  numericId: userData.numericId,
                  badges: userData.badges || [],
                  cpPartnerId: userData.cpPartnerId,
                  cpPartnerName: userData.cpPartnerName,
                  cpPartnerAvatar: userData.cpPartnerAvatar,
                  equippedCpFrame: userData.equippedCpFrame,
                  cpBackground: userData.cpBackground,
                  equippedMicFrame: userData.equippedMicFrame,
                  partnerCpFrame: partnerData.equippedCpFrame || null,
                  partnerMicFrame: partnerData.equippedMicFrame || null
                });
              }} className="bg-black/40 p-2.5 rounded-full backdrop-blur-md hover:bg-black/60 transition">
                {appIcons.profileIcon ? <img src={appIcons.profileIcon} className="w-5 h-5 object-contain" /> : <User size={20} />}
              </button>
              <div className="flex-1"></div>
              <button onClick={() => {
                const firstUserOnMic = mics.find(m => m.userId);
                if (!selectedReceiver && firstUserOnMic) {
                  setSelectedReceiver(firstUserOnMic.userId);
                }
                setShowGiftModal(true);
              }} className="hover:scale-110 transition active:scale-95 drop-shadow-2xl">
                {appIcons.giftBoxIcon ? (
                  <img src={appIcons.giftBoxIcon || undefined} alt="Gift" className="w-12 h-12 object-contain" />
                ) : (
                  <div className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center shadow-lg shadow-pink-500/50">
                    <Gift size={24} className="text-white" />
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Gift Modal */}
        {showGiftModal && (
          <div className="absolute inset-0 z-50 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowGiftModal(false)}></div>
            <div className="bg-black/80 backdrop-blur-xl rounded-t-3xl relative z-10 border-t border-white/10 h-[55%] flex flex-col overflow-hidden shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
              {/* Header */}
              <div className="p-3 border-b border-white/10 flex justify-between items-center bg-transparent sticky top-0 z-20">
                <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-full border border-white/5">
                  <span className="text-yellow-400 font-bold text-xs">{userDiamonds}</span>
                  <span className="text-[10px] text-gray-300">💎 رصيدك</span>
                </div>
                <h3 className="font-bold text-white text-base drop-shadow-md">صندوق الهدايا</h3>
                <button onClick={() => setShowGiftModal(false)} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition text-white"><X size={18} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 hide-scrollbar">
                {/* Receiver Selection */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs text-gray-300 font-bold">إرسال إلى:</p>
                    {selectedReceivers.length > 0 && (
                      <button 
                        onClick={() => setSelectedReceivers([])}
                        className="text-[9px] text-red-400 font-bold flex items-center gap-1 bg-red-500/10 px-1.5 py-0.5 rounded-md border border-red-500/20"
                      >
                        <X size={10} />
                        إلغاء الكل
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                    <button 
                      onClick={() => {
                        const allUserIds = mics.filter(m => m.userId).map(m => m.userId!);
                        if (selectedReceivers.length === allUserIds.length) {
                          setSelectedReceivers([]);
                        } else {
                          setSelectedReceivers(allUserIds);
                        }
                      }}
                      className={`flex flex-col items-center gap-1.5 min-w-[55px] p-1.5 rounded-2xl border transition-all ${selectedReceivers.length > 0 && selectedReceivers.length === mics.filter(m => m.userId).length ? 'border-yellow-500 bg-yellow-500/20 scale-105' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center border border-yellow-500/50 relative">
                        <Users size={18} className="text-yellow-500" />
                        {selectedReceivers.length > 0 && selectedReceivers.length === mics.filter(m => m.userId).length && (
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedReceivers([]);
                            }}
                            className="absolute -top-1 -left-1 bg-red-500 rounded-full p-0.5 border border-black/50 hover:bg-red-600 transition-colors cursor-pointer"
                          >
                            <X size={8} className="text-white" />
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] font-bold text-gray-200">الكل</span>
                    </button>

                    {mics.filter(m => m.userId).map(m => (
                      <button 
                        key={m.userId}
                        onClick={() => {
                          if (selectedReceivers.includes(m.userId!)) {
                            setSelectedReceivers(prev => prev.filter(id => id !== m.userId));
                          } else {
                            setSelectedReceivers(prev => [...prev, m.userId!]);
                          }
                        }}
                        className={`flex flex-col items-center gap-1.5 min-w-[55px] p-1.5 rounded-2xl border transition-all ${selectedReceivers.includes(m.userId!) ? 'border-pink-500 bg-pink-500/20 scale-105 shadow-[0_0_15px_rgba(236,72,153,0.3)]' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                      >
                        <div className="relative">
                          <img src={m.userAvatar || undefined} className={`w-10 h-10 rounded-full object-cover ${selectedReceivers.includes(m.userId!) ? 'ring-2 ring-pink-500 ring-offset-1 ring-offset-black/50' : ''}`} />
                          {selectedReceivers.includes(m.userId!) && (
                            <>
                              <div className="absolute -bottom-1 -right-1 bg-pink-500 rounded-full p-0.5 border border-black/50">
                                <Check size={8} className="text-white" />
                              </div>
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedReceivers(prev => prev.filter(id => id !== m.userId));
                                }}
                                className="absolute -top-1 -left-1 bg-red-500 rounded-full p-0.5 border border-black/50 hover:bg-red-600 transition-colors cursor-pointer"
                              >
                                <X size={8} className="text-white" />
                              </div>
                            </>
                          )}
                        </div>
                        <span className="text-[9px] font-medium truncate w-full text-center text-gray-200">{m.userName}</span>
                      </button>
                    ))}
                    {mics.filter(m => m.userId).length === 0 && (
                      <div className="text-xs text-gray-400 w-full text-center py-3 bg-white/5 rounded-xl border border-white/5">لا يوجد أشخاص على المايكات</div>
                    )}
                  </div>
                </div>

                {/* Gift Categories Tabs */}
                <div className="flex gap-1.5 mb-3 bg-black/40 p-1 rounded-xl border border-white/5 overflow-x-auto hide-scrollbar">
                  <button 
                    onClick={() => setGiftCategory('classic')}
                    className={`flex-none px-3 py-1 text-xs font-bold rounded-lg transition-all ${giftCategory === 'classic' ? 'bg-white/20 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                  >
                    هدايا عادية
                  </button>
                  <button 
                    onClick={() => setGiftCategory('lucky')}
                    className={`flex-none px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${giftCategory === 'lucky' ? 'bg-gradient-to-r from-yellow-500/30 to-orange-500/30 text-yellow-400 shadow-sm border border-yellow-500/30' : 'text-gray-400 hover:text-gray-200'}`}
                  >
                    <Star size={12} className={giftCategory === 'lucky' ? 'text-yellow-400' : ''} />
                    هدايا الحظ
                  </button>
                  {giftCategories.map(cat => (
                    <button 
                      key={cat.id}
                      onClick={() => setGiftCategory(cat.id)}
                      className={`flex-none px-3 py-1 text-xs font-bold rounded-lg transition-all ${giftCategory === cat.id ? 'bg-white/20 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                {/* Gifts Grid */}
                <div>
                  <div className="grid grid-cols-4 gap-2">
                    {gifts.filter(g => (g.category || 'classic') === giftCategory).map(gift => (
                      <button 
                        key={gift.id}
                        onClick={() => setSelectedGift(gift)}
                        className={`rounded-xl p-2 flex flex-col items-center gap-1 border transition-all relative ${selectedGift?.id === gift.id ? 'border-pink-500 bg-pink-500/20 scale-105 shadow-[0_0_15px_rgba(236,72,153,0.3)]' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
                      >
                        {cpConfig && cpConfig.cpGiftId === gift.id && (
                          <div className="absolute -top-2 -right-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-white/20 shadow-lg z-10 flex items-center gap-0.5">
                            <Heart size={8} className="fill-white" />
                            CP
                          </div>
                        )}
                        <img src={gift.imageUrl || undefined} alt={gift.name} className="w-10 h-10 object-contain drop-shadow-md" />
                        <span className="text-[8px] font-medium text-gray-300 truncate w-full text-center">{gift.name}</span>
                        <div className="flex items-center gap-0.5 text-yellow-400 text-[9px] font-bold bg-black/40 px-1.5 py-0.5 rounded-full border border-white/5">
                          {gift.value} 💎
                        </div>
                      </button>
                    ))}
                    {gifts.filter(g => (g.category || 'classic') === giftCategory).length === 0 && (
                      <div className="col-span-4 text-center text-gray-400 py-6 text-xs bg-white/5 rounded-xl border border-white/5">لا توجد هدايا في هذا القسم</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer / Send Button */}
              <div className="p-2.5 bg-black/60 border-t border-white/10 backdrop-blur-md">
                <div className="flex gap-1.5 overflow-x-auto hide-scrollbar mb-2 pb-1">
                  {[1, 10, 66, 99, 520, 1314].map(q => (
                    <button
                      key={q}
                      onClick={() => setGiftQuantity(q)}
                      className={`px-2.5 py-0.5 rounded-full text-[9px] font-black transition-all border ${giftQuantity === q ? 'bg-pink-500 text-white border-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.4)]' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}
                    >
                      x{q}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    {selectedGift ? (
                      <div className="flex items-center gap-1.5 relative group">
                        <div className="bg-white/10 p-1 rounded-lg border border-white/5">
                          <img src={selectedGift.imageUrl || undefined} className="w-6 h-6 object-contain" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-white">{selectedGift.name}</p>
                          <p className="text-[9px] text-yellow-400 font-bold">{selectedGift.value} 💎</p>
                        </div>
                        <button 
                          onClick={() => setSelectedGift(null)}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <X size={8} />
                        </button>
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-400 font-medium ml-1">لم يتم تحديد هدية</p>
                    )}
                  </div>
                  <button 
                    onClick={handleSendGift}
                    disabled={!selectedGift || selectedReceivers.length === 0 || isSendingGift}
                    className={`px-4 py-2 rounded-full font-bold text-xs flex items-center gap-1.5 transition-all ${(!selectedGift || selectedReceivers.length === 0 || isSendingGift) ? 'bg-white/10 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.4)] hover:scale-105 active:scale-95 border border-pink-400/50'}`}
                  >
                    {isSendingGift ? (
                      <span className="animate-pulse text-[10px]">جاري الإرسال...</span>
                    ) : (
                      <>
                        <Send size={14} />
                        إرسال الهدية
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Admin Tools Drawer */}
        {showAdminTools && (
          <div className="absolute inset-0 z-50 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowAdminTools(false)}></div>
            <div className="bg-gray-900 rounded-t-3xl p-6 relative z-10 border-t border-gray-800">
              <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-6"></div>
              <h3 className="text-center font-bold mb-6 text-gray-200">أدوات الغرفة</h3>
              <div className="grid grid-cols-4 gap-y-6 gap-x-4">
                {[
                  { icon: appIcons.gamesIcon ? <img src={appIcons.gamesIcon} className="w-6 h-6 object-contain" /> : <Gamepad2 />, label: 'الألعاب', color: 'text-purple-400', action: () => { setShowAdminTools(false); setShowGameCenter(true); } },
                  { icon: <Gift />, label: 'صندوق الحظ', color: 'text-yellow-400', action: () => { setShowAdminTools(false); setShowLuckyBoxModal(true); } },
                  { icon: appIcons.storeIcon ? <img src={appIcons.storeIcon} className="w-6 h-6 object-contain" /> : <ShoppingBag />, label: 'مول', color: 'text-pink-400', action: () => { setShowAdminTools(false); setShowMallModal(true); } },
                  { icon: <Star />, label: 'PK', color: 'text-orange-400' },
                  { icon: appIcons.settingsIcon ? <img src={appIcons.settingsIcon} className="w-6 h-6 object-contain" /> : <Settings />, label: 'قرص الحظ', color: 'text-purple-400' },
                  { icon: <ImageIcon />, label: 'صورة', color: 'text-blue-400', action: () => { setShowAdminTools(false); setShowBackgroundModal(true); } },
                  { icon: appIcons.musicIcon ? <img src={appIcons.musicIcon} className="w-6 h-6 object-contain" /> : <Music />, label: 'موسيقى', color: 'text-green-400', action: () => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'audio/*';
                    input.onchange = async (e: any) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      
                      try {
                        const url = URL.createObjectURL(file);
                        setLocalMusicUrl(url);
                        setShowAdminTools(false);
                        
                        await updateDoc(doc(db, 'rooms', roomId), {
                          currentMusic: {
                            name: file.name,
                            isPlaying: true,
                            startTime: Date.now(),
                            playedBy: user?.displayName || 'مستخدم',
                            isLocalStream: true
                          }
                        });
                      } catch (error) {
                        console.error('Error starting music:', error);
                        alert('حدث خطأ أثناء تشغيل الموسيقى');
                      }
                    };
                    input.click();
                  } },
                  { icon: appIcons.usersIcon ? <img src={appIcons.usersIcon} className="w-6 h-6 object-contain" /> : <Users />, label: 'دعوة الأصدقاء', color: 'text-teal-400' },
                  { icon: <ShieldBan />, label: 'القائمة السوداء', color: 'text-red-400' },
                  { icon: <Zap />, label: 'تصفير الكاريزما', color: 'text-yellow-400', action: async () => {
                    setShowAdminTools(false);
                    setConfirmModal({
                      show: true,
                      title: 'تصفير الكاريزما',
                      message: 'هل أنت متأكد من تصفير كاريزما الغرفة والمايكات؟ لا يمكن التراجع عن هذا الإجراء.',
                      onConfirm: async () => {
                        await updateDoc(doc(db, 'rooms', roomId), { charisma: 0 });
                        const micsSnap = await getDocs(collection(db, 'rooms', roomId, 'mics'));
                        const batch = writeBatch(db);
                        micsSnap.docs.forEach(d => {
                          batch.update(d.ref, { charisma: 0 });
                        });
                        await batch.commit();
                        setConfirmModal({ show: false, title: '', message: '', onConfirm: () => {} });
                      }
                    });
                  }},
                  { icon: <Edit3 />, label: 'تغيير الاسم', color: 'text-blue-400', action: () => {
                    setShowAdminTools(false);
                    setNewRoomName(room?.name || '');
                    setShowEditRoomName(true);
                  }}
                ].map((tool, idx) => (
                  <div key={idx} onClick={tool.action} className="flex flex-col items-center gap-2 cursor-pointer">
                    <div className={`w-12 h-12 rounded-2xl bg-gray-800 flex items-center justify-center ${tool.color}`}>
                      {tool.icon}
                    </div>
                    <span className="text-[10px] text-gray-400 text-center">{tool.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Edit Room Name Modal */}
        {showEditRoomName && (
          <div className="absolute inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-gray-900 w-full max-w-sm rounded-3xl p-6 border border-white/10 shadow-2xl"
            >
              <h3 className="text-lg font-bold mb-4 text-center">تغيير اسم الغرفة</h3>
              <input 
                type="text" 
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="أدخل اسم الغرفة الجديد"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm mb-6 focus:outline-none focus:border-purple-500 transition-all"
              />
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowEditRoomName(false)}
                  className="flex-1 py-3 rounded-xl bg-gray-800 font-bold text-sm hover:bg-gray-700 transition"
                >
                  إلغاء
                </button>
                <button 
                  onClick={async () => {
                    if (!newRoomName.trim()) return;
                    await updateDoc(doc(db, 'rooms', roomId), { name: newRoomName });
                    setShowEditRoomName(false);
                  }}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-sm shadow-lg shadow-purple-500/20"
                >
                  حفظ
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Background Modal */}
        {showBackgroundModal && (
          <div className="absolute inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setShowBackgroundModal(false)}>
            <div className="bg-gray-900 w-full rounded-t-3xl p-6 border-t border-gray-800 relative shadow-[0_-10px_40px_rgba(0,0,0,0.5)] h-[70%]" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">خلفية الغرفة</h3>
                <button onClick={() => setShowBackgroundModal(false)} className="text-gray-400 hover:text-white bg-gray-800 p-2 rounded-full"><X size={20} /></button>
              </div>

              <BackgroundSelector roomId={roomId} onClose={() => setShowBackgroundModal(false)} />
            </div>
          </div>
        )}

        {/* Exit/Minimize Modal */}
        {showExitModal && (
          <div className="absolute inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-xs text-center border border-gray-800 shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-6">ماذا تريد أن تفعل؟</h3>
              <div className="space-y-3">
                {onMinimize && (
                  <button onClick={() => { setShowExitModal(false); onMinimize(); }} className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 transition text-white rounded-xl font-bold">
                    تصغير الغرفة
                  </button>
                )}
                <button onClick={async () => {
                  if (user) {
                    const myMic = mics.find(m => m.userId === user.uid);
                    if (myMic) await updateDoc(doc(db, 'rooms', roomId, 'mics', myMic.id), { userId: null, userAvatar: null, userName: null });
                    
                    // Check if user is owner and mark room as inactive
                    const roomDoc = await getDoc(doc(db, 'rooms', roomId));
                    if (roomDoc.exists() && roomDoc.data().ownerId === user.uid) {
                      await updateDoc(doc(db, 'rooms', roomId), { active: false });
                    }
                  }
                  onClose();
                }} className="w-full py-3.5 bg-red-500/10 hover:bg-red-500/20 transition text-red-500 rounded-xl font-bold">
                  الخروج من الغرفة
                </button>
                <button onClick={() => setShowExitModal(false)} className="w-full py-3.5 text-gray-400 hover:text-white transition font-bold">
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Custom Confirmation Modal */}
        <AnimatePresence>
          {confirmModal.show && (
            <div className="absolute inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-gray-900 w-full max-w-sm rounded-3xl p-6 border border-white/10 shadow-2xl"
              >
                <h3 className="text-lg font-bold mb-4 text-center text-white">{confirmModal.title}</h3>
                <p className="text-gray-400 text-sm text-center mb-6">{confirmModal.message}</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setConfirmModal({ ...confirmModal, show: false })}
                    className="flex-1 py-3 rounded-xl bg-gray-800 font-bold text-sm hover:bg-gray-700 transition text-white"
                  >
                    إلغاء
                  </button>
                  <button 
                    onClick={() => {
                      confirmModal.onConfirm();
                    }}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-sm shadow-lg shadow-purple-500/20 text-white"
                  >
                    تأكيد
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Mall Modal */}
        {showMallModal && (
          <div className="absolute inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setShowMallModal(false)}>
            <div className="bg-gray-900 w-full rounded-t-3xl p-6 border-t border-gray-800 relative shadow-[0_-10px_40px_rgba(0,0,0,0.5)] h-[80%]" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border border-white/5">
                  <span className="text-yellow-400 font-bold text-sm">{userDiamonds}</span>
                  <span className="text-xs text-gray-300">💎 رصيدك</span>
                </div>
                <h3 className="text-xl font-bold text-white">المتجر</h3>
                <button onClick={() => setShowMallModal(false)} className="text-gray-400 hover:text-white bg-gray-800 p-2 rounded-full"><X size={20} /></button>
              </div>

              {/* Mall Tabs */}
              <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-4 pb-2">
                {[
                  { id: 'mic_frame', label: 'إطارات المايك' },
                  { id: 'mic_icon', label: 'أشكال المايك' },
                  { id: 'entrance', label: 'دخوليات' },
                  { id: 'chat_bubble', label: 'فقاعات' },
                  { id: 'text_color', label: 'كتابة ملونة' },
                  { id: 'room_background', label: 'خلفيات الغرف' },
                  { id: 'vip', label: 'VIP 👑' },
                  { id: 'bag', label: 'الحقيبة 🎒' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setMallCategory(tab.id)}
                    className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                      mallCategory === tab.id 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              
              <div className="overflow-y-auto h-[calc(100%-130px)] hide-scrollbar pb-10">
                {mallCategory === 'bag' ? (
                  <div className="grid grid-cols-3 gap-4 pb-10">
                    {purchasedItems.map((item: any) => {
                      const typeLabels: any = {
                        mic_frame: 'إطار مايك',
                        mic_icon: 'شكل مايك',
                        entrance: 'دخولية',
                        chat_bubble: 'فقاعة',
                        text_color: 'كتابة ملونة',
                        room_background: 'خلفية غرفة'
                      };
                      
                      const isEquipped = (() => {
                        const equipped = equippedItems[item.type];
                        if (item.type === 'vip') return equippedItems.vip === item.levelNumber;
                        if (!equipped) return false;
                        if (item.type === 'entrance') return equipped.imageUrl === item.imageUrl;
                        return equipped === item.imageUrl;
                      })();

                      return (
                        <div key={item.id} className={`bg-gray-800/50 border ${isEquipped ? 'border-purple-500' : 'border-gray-700'} rounded-2xl p-3 flex flex-col items-center relative`}>
                          {isEquipped && (
                            <div className="absolute top-2 right-2 bg-purple-500 text-white text-[8px] px-2 py-0.5 rounded-full z-20">
                              مستخدم
                            </div>
                          )}
                          <div className="w-16 h-16 bg-gray-900 rounded-full mb-3 relative flex items-center justify-center overflow-hidden">
                            {item.type === 'text_color' ? (
                              <div className="w-full h-full" style={{ backgroundColor: item.imageUrl }}></div>
                            ) : item.type === 'vip' ? (
                              <div className="w-full h-full rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white font-black text-xl shadow-lg">
                                V{item.levelNumber}
                              </div>
                            ) : (
                              <img src={item.imageUrl || undefined} className={`absolute inset-0 w-full h-full object-cover z-10 pointer-events-none ${item.type === 'mic_frame' ? 'scale-125' : ''}`} />
                            )}
                            {item.type === 'mic_frame' && <img src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} className="w-full h-full rounded-full object-cover opacity-50" />}
                            {item.type === 'mic_icon' && <Mic size={20} className="text-gray-400" />}
                          </div>
                          <h4 className="text-white text-[10px] font-bold text-center mb-2 truncate w-full">{item.name}</h4>
                          
                          <div className="flex flex-col gap-1 w-full">
                            <button 
                              onClick={async () => {
                                if (!user) return;
                                try {
                                  const updateData: any = {};
                                  if (item.type === 'mic_frame') updateData.equippedMicFrame = item.imageUrl;
                                  if (item.type === 'mic_icon') updateData.equippedMicIcon = item.imageUrl;
                                  if (item.type === 'entrance') updateData.equippedEntrance = {
                                    imageUrl: item.imageUrl,
                                    isFullScreen: item.isFullScreen,
                                    audioUrl: item.audioUrl,
                                    duration: item.duration
                                  };
                                  if (item.type === 'chat_bubble') updateData.equippedBubble = item.imageUrl;
                                  if (item.type === 'text_color') updateData.equippedTextColor = item.imageUrl;
                                  if (item.type === 'room_background') updateData.equippedBackground = item.imageUrl;
                                  if (item.type === 'vip') {
                                    updateData.vipLevel = item.levelNumber;
                                    updateData.isVIP = true;
                                  }

                                  await updateDoc(doc(db, 'users', user.uid), updateData);
                                  
                                  if (item.type === 'mic_frame') {
                                    const myMic = mics.find(m => m.userId === user.uid);
                                    if (myMic) await updateDoc(doc(db, 'rooms', roomId, 'mics', myMic.id), { userMicFrame: item.imageUrl });
                                  }
                                } catch (e: any) {
                                  alert('خطأ: ' + e.message);
                                }
                              }}
                              className={`w-full py-1 rounded-lg text-[8px] font-bold transition ${isEquipped ? 'bg-gray-700 text-gray-400 cursor-default' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
                              disabled={isEquipped}
                            >
                              {isEquipped ? 'مفعل' : 'تفعيل'}
                            </button>
                            
                            {isEquipped && (
                              <button 
                                onClick={async () => {
                                  if (!user) return;
                                  try {
                                    const updateData: any = {};
                                    if (item.type === 'mic_frame') updateData.equippedMicFrame = null;
                                    if (item.type === 'mic_icon') updateData.equippedMicIcon = null;
                                    if (item.type === 'entrance') updateData.equippedEntrance = null;
                                    if (item.type === 'chat_bubble') updateData.equippedBubble = null;
                                    if (item.type === 'text_color') updateData.equippedTextColor = null;
                                    if (item.type === 'room_background') updateData.equippedBackground = null;
                                    if (item.type === 'vip') {
                                      updateData.vipLevel = 0;
                                      updateData.isVIP = false;
                                    }

                                    await updateDoc(doc(db, 'users', user.uid), updateData);
                                    
                                    if (item.type === 'mic_frame') {
                                      const myMic = mics.find(m => m.userId === user.uid);
                                      if (myMic) await updateDoc(doc(db, 'rooms', roomId, 'mics', myMic.id), { userMicFrame: null });
                                    }
                                  } catch (e: any) {
                                    alert('خطأ: ' + e.message);
                                  }
                                }}
                                className="w-full py-1 bg-red-500/10 text-red-500 rounded-lg text-[8px] font-bold hover:bg-red-500/20 transition"
                              >
                                إلغاء التفعيل
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {purchasedItems.length === 0 && (
                      <div className="col-span-3 text-center text-gray-400 py-10">الحقيبة فارغة</div>
                    )}
                  </div>
                ) : mallCategory === 'vip' ? (
                  <div className="grid grid-cols-2 gap-4 pb-10">
                    {vipLevels.map((level: any) => {
                      const isMyVip = userData?.vipLevel === level.levelNumber;
                      return (
                        <div key={level.id} className={`bg-gray-800/50 border ${isMyVip ? 'border-yellow-500' : 'border-gray-700'} rounded-2xl p-4 flex flex-col items-center relative overflow-hidden`}>
                          <div className="absolute -top-4 -right-4 w-12 h-12 bg-yellow-500/10 rounded-full blur-xl"></div>
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white font-black text-2xl shadow-lg mb-3">
                            V{level.levelNumber}
                          </div>
                          <h4 className="text-white text-xs font-bold mb-1">{level.name}</h4>
                          <div className="flex items-center gap-1 mb-4">
                            <span className="text-yellow-400 font-bold text-sm">{(level.levelNumber * 5000).toLocaleString()}</span>
                            <span className="text-[8px] text-gray-400">💎</span>
                          </div>
                          
                          <button 
                            onClick={async () => {
                              if (!user) return;
                              const cost = level.levelNumber * 5000;
                              if (userDiamonds < cost) return alert('رصيدك غير كافٍ');
                              
                              setConfirmModal({
                                show: true,
                                title: 'شراء VIP',
                                message: `هل تريد شراء ${level.name} بـ ${cost.toLocaleString()} ماسة؟`,
                                onConfirm: async () => {
                                  try {
                                    await runTransaction(db, async (transaction) => {
                                      const userRef = doc(db, 'users', user.uid);
                                      const userSnap = await transaction.get(userRef);
                                      if (!userSnap.exists()) return;
                                      
                                      const currentDiamonds = userSnap.data().diamonds || 0;
                                      if (currentDiamonds < cost) throw new Error('رصيدك غير كافٍ');
                                      
                                      transaction.update(userRef, {
                                        diamonds: currentDiamonds - cost,
                                        vipLevel: level.levelNumber,
                                        isVIP: true,
                                        equippedMicFrame: level.frameUrl || userSnap.data().equippedMicFrame,
                                        equippedEntrance: level.entranceEffectUrl ? {
                                          imageUrl: level.entranceEffectUrl,
                                          isFullScreen: true,
                                          duration: 4
                                        } : userSnap.data().equippedEntrance
                                      });
                                      
                                      const purchasedRef = doc(collection(db, 'users', user.uid, 'purchased_items'));
                                      transaction.set(purchasedRef, {
                                        type: 'vip',
                                        name: level.name,
                                        levelNumber: level.levelNumber,
                                        frameUrl: level.frameUrl || null,
                                        entranceEffectUrl: level.entranceEffectUrl || null,
                                        purchasedAt: Date.now()
                                      });
                                    });
                                    setConfirmModal({ show: false, title: '', message: '', onConfirm: () => {} });
                                  } catch (error: any) {
                                    alert('خطأ في الشراء: ' + error.message);
                                  }
                                }
                              });
                            }}
                            className={`w-full py-2 rounded-xl text-xs font-bold transition ${isMyVip ? 'bg-gray-700 text-gray-400 cursor-default' : 'bg-yellow-500 text-black hover:bg-yellow-600'}`}
                            disabled={isMyVip}
                          >
                            {isMyVip ? 'مفعل حالياً' : 'شراء الآن'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4 pb-10">
                    {storeItems.filter(item => item.type === mallCategory).map(item => (
                    <div key={item.id} className="bg-gray-800/50 border border-gray-700 rounded-2xl p-3 flex flex-col items-center relative">
                      <div className="w-16 h-16 bg-gray-900 rounded-full mb-3 relative flex items-center justify-center overflow-hidden">
                        {item.type === 'text_color' ? (
                          <div className="w-full h-full" style={{ backgroundColor: item.imageUrl }}></div>
                        ) : (
                          <img src={item.imageUrl || undefined} alt={item.name} className={`absolute inset-0 w-full h-full object-cover z-10 pointer-events-none ${item.type === 'mic_frame' ? 'scale-125' : ''}`} />
                        )}
                        {item.type === 'mic_frame' && <img src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} className="w-full h-full rounded-full object-cover opacity-50" />}
                        {item.type === 'mic_icon' && <Mic size={20} className="text-gray-400" />}
                      </div>
                      <h4 className="text-white text-xs font-bold text-center mb-1">{item.name}</h4>
                      <p className="text-yellow-400 text-[10px] font-bold mb-3">{item.price} 💎</p>
                      <button 
                        onClick={async () => {
                          if (!user) return;
                          if (userDiamonds < item.price) return alert('رصيدك لا يكفي');
                          if (window.confirm(`هل تريد شراء ${item.name} بـ ${item.price} ماسة؟`)) {
                            try {
                              const updateData: any = { diamonds: userDiamonds - item.price };
                              if (item.type === 'mic_frame') updateData.equippedMicFrame = item.imageUrl;
                              if (item.type === 'mic_icon') updateData.equippedMicIcon = item.imageUrl;
                              if (item.type === 'entrance') updateData.equippedEntrance = {
                                imageUrl: item.imageUrl,
                                isFullScreen: item.isFullScreen,
                                audioUrl: item.audioUrl,
                                duration: item.duration
                              };
                              if (item.type === 'chat_bubble') updateData.equippedBubble = item.imageUrl;
                              if (item.type === 'text_color') updateData.equippedTextColor = item.imageUrl;
                              if (item.type === 'room_background') updateData.equippedBackground = item.imageUrl;

                              await updateDoc(doc(db, 'users', user.uid), updateData);
                              
                              // Add to purchased items
                              await addDoc(collection(db, 'users', user.uid, 'purchased_items'), {
                                ...item,
                                purchasedAt: Date.now()
                              });

                              // Update mic if currently on it and it's a mic frame
                              if (item.type === 'mic_frame') {
                                const myMic = mics.find(m => m.userId === user.uid);
                                if (myMic) {
                                  await updateDoc(doc(db, 'rooms', roomId, 'mics', myMic.id), { userMicFrame: item.imageUrl });
                                }
                              }
                              alert('تم الشراء والتركيب بنجاح!');
                            } catch (e: any) {
                              alert('خطأ: ' + e.message);
                            }
                          }
                        }}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[10px] py-1.5 rounded-lg font-bold hover:scale-105 transition"
                      >
                        شراء وتركيب
                      </button>
                    </div>
                  ))}
                  {storeItems.filter(item => item.type === mallCategory).length === 0 && (
                    <div className="col-span-3 text-center text-gray-400 py-10">لا توجد عناصر متاحة حالياً في هذا القسم</div>
                  )}
                </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Lucky Box Modal */}
        {showLuckyBoxModal && (
          <div className="absolute inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowLuckyBoxModal(false)}>
            <div className="bg-gradient-to-b from-gray-900 to-black w-full max-w-sm rounded-3xl p-6 border border-yellow-500/30 relative shadow-[0_0_50px_rgba(234,179,8,0.2)] text-center" onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowLuckyBoxModal(false)} className="absolute top-4 left-4 text-gray-400 hover:text-white bg-gray-800 p-2 rounded-full"><X size={20} /></button>
              
              <div className="w-24 h-24 mx-auto mb-6 relative">
                <div className="absolute inset-0 bg-yellow-500/20 blur-xl rounded-full animate-pulse"></div>
                <Gift size={96} className="text-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)] relative z-10" />
              </div>
              
              <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 mb-2">صندوق الحظ</h3>
              <p className="text-gray-400 text-sm mb-8">افتح الصندوق لفرصة ربح ألماس مضاعف أو هدايا نادرة!</p>
              
              <div className="flex justify-center gap-4 mb-6">
                <div className="bg-black/50 border border-white/10 px-4 py-2 rounded-xl">
                  <span className="text-xs text-gray-400 block mb-1">رصيدك</span>
                  <span className="text-yellow-400 font-bold">{userDiamonds} 💎</span>
                </div>
                <div className="bg-black/50 border border-white/10 px-4 py-2 rounded-xl">
                  <span className="text-xs text-gray-400 block mb-1">سعر الفتح</span>
                  <span className="text-pink-400 font-bold">100 💎</span>
                </div>
              </div>
              
              <button 
                onClick={async () => {
                  if (!user) return;
                  if (userDiamonds < 100) return alert('رصيدك لا يكفي');
                  
                  try {
                    // Simple random logic for lucky box
                    const isWin = Math.random() > 0.6; // 40% chance to win
                    const winAmount = isWin ? Math.floor(Math.random() * 400) + 50 : 0; // Win 50-450
                    
                    await updateDoc(doc(db, 'users', user.uid), {
                      diamonds: userDiamonds - 100 + winAmount
                    });
                    
                    if (isWin) {
                      alert(`مبروك! 🎉 لقد ربحت ${winAmount} ماسة!`);
                    } else {
                      alert(`حظ أوفر المرة القادمة 😢`);
                    }
                  } catch (e: any) {
                    alert('خطأ: ' + e.message);
                  }
                }}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 text-white py-4 rounded-2xl font-black text-lg shadow-[0_0_20px_rgba(234,179,8,0.4)] hover:scale-105 active:scale-95 transition-all"
              >
                افتح الصندوق الآن
              </button>
            </div>
          </div>
        )}

        {/* Game Center Modal */}
        {showGameCenter && (
          <GameCenterModal onClose={() => setShowGameCenter(false)} />
        )}

        {/* CP Chat Modal */}
        {showCpChat && (
          <div className="absolute inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setShowCpChat(false)}>
            <div className="bg-gray-900 w-full rounded-t-3xl p-6 border-t border-gray-800 relative shadow-[0_-10px_40px_rgba(0,0,0,0.5)] h-[60%] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Heart className="text-pink-500" size={20} />
                  <h3 className="text-lg font-bold text-white">دردشة الـ CP</h3>
                </div>
                <button onClick={() => setShowCpChat(false)} className="text-gray-400 hover:text-white bg-gray-800 p-2 rounded-full"><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-y-auto mb-4 space-y-3 hide-scrollbar">
                {cpMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
                    <Heart size={40} className="opacity-20" />
                    <p className="text-sm">ابدأ الدردشة مع شريكك</p>
                  </div>
                ) : (
                  cpMessages.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.userId === user?.uid ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${msg.userId === user?.uid ? 'bg-pink-600 text-white rounded-tr-none' : 'bg-gray-800 text-gray-200 rounded-tl-none'}`}>
                        {msg.text}
                      </div>
                      <span className="text-[8px] text-gray-500 mt-1">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))
                )}
              </div>

              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!chatInput.trim() || !user) return;
                  const msg = {
                    text: chatInput,
                    userId: user.uid,
                    userName: user.displayName,
                    timestamp: Date.now()
                  };
                  try {
                    await addDoc(collection(db, 'rooms', roomId, 'cp_chat'), msg);
                    setChatInput('');
                  } catch (err) {
                    console.error('Error sending CP message:', err);
                  }
                }}
                className="flex gap-2"
              >
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="اكتب رسالة خاصة..." 
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-full px-4 py-2 text-sm text-white outline-none focus:border-pink-500"
                />
                <button type="submit" className="bg-pink-600 p-2 rounded-full text-white hover:bg-pink-700 transition">
                  <Send size={20} />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* User Profile Modal */}
        {selectedProfile && (
          <div className="absolute inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setSelectedProfile(null)}>
            <div className="bg-gray-900/80 backdrop-blur-xl w-full rounded-t-3xl p-6 border-t border-white/10 relative shadow-[0_-10px_40px_rgba(0,0,0,0.5)]" onClick={e => e.stopPropagation()}>
              <div className="absolute top-4 left-4 flex gap-2">
                <button onClick={() => setSelectedProfile(null)} className="text-gray-400 hover:text-white bg-black/40 p-2 rounded-full backdrop-blur-md"><X size={20} /></button>
              </div>
              <div className="absolute top-4 right-4 flex gap-2">
                <button onClick={() => { setSelectedProfile(null); setShowMallModal(true); }} className="text-pink-400 hover:text-pink-300 bg-pink-500/10 p-2 rounded-full backdrop-blur-md border border-pink-500/20"><ShoppingBag size={20} /></button>
                <button className="text-blue-400 hover:text-blue-300 bg-blue-500/10 p-2 rounded-full backdrop-blur-md border border-blue-500/20"><User size={20} /></button>
              </div>
              
              <div className="flex flex-col items-center -mt-12 mb-4">
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <img src={selectedProfile.avatar || undefined} className="w-full h-full rounded-full border-4 border-gray-900 object-cover shadow-xl" referrerPolicy="no-referrer" />
                  {selectedProfile.equippedMicFrame && (
                    <img src={selectedProfile.equippedMicFrame || undefined} className="absolute inset-0 w-full h-full object-contain scale-[1.35] pointer-events-none z-10" alt="Avatar Frame" />
                  )}
                </div>
                <h3 className="text-xl font-bold text-white mt-2">{selectedProfile.name}</h3>
                
                <div className="mt-2 relative h-8 px-6 flex items-center justify-center overflow-hidden rounded-lg border border-white/10 group">
                  {appIcons.idIcon && (
                    <img src={appIcons.idIcon || undefined} className="absolute inset-0 w-full h-full object-cover opacity-80" />
                  )}
                  <span className="relative z-10 text-white text-xs font-mono font-bold tracking-wider">
                    ID: {selectedProfile.numericId || selectedProfile.uid.substring(0,8)}
                  </span>
                </div>
              </div>
              
              <div className="flex justify-center gap-4 mb-6">
                <div className={`bg-gray-800/50 border px-6 py-2.5 rounded-2xl text-center flex-1 ${getLevelColor(calculateLevel(selectedProfile.totalSupport || 0)).border}`}>
                  <p className="text-[10px] text-gray-400 mb-1">مستوى الدعم</p>
                  <p className={`font-bold flex items-center gap-1 justify-center ${getLevelColor(calculateLevel(selectedProfile.totalSupport || 0)).text}`}><Crown size={14}/> Lv.{calculateLevel(selectedProfile.totalSupport || 0)}</p>
                </div>
                <div className={`bg-gray-800/50 border px-6 py-2.5 rounded-2xl text-center flex-1 ${getLevelColor(calculateLevel(selectedProfile.totalSpent || 0)).border}`}>
                  <p className="text-[10px] text-gray-400 mb-1">مستوى الشحن</p>
                  <p className={`font-bold flex items-center gap-1 justify-center ${getLevelColor(calculateLevel(selectedProfile.totalSpent || 0)).text}`}>
                    {appIcons.diamondIcon ? <img src={appIcons.diamondIcon} className="w-3.5 h-3.5 object-contain" /> : <Diamond size={14}/>} Lv.{calculateLevel(selectedProfile.totalSpent || 0)}
                  </p>
                </div>
              </div>

              {selectedProfile.cpPartnerId && (
                <div className="border border-pink-500/30 rounded-2xl p-4 mb-6 relative overflow-hidden flex items-center justify-between">
                  {selectedProfile.cpBackground ? (
                    <img src={selectedProfile.cpBackground || undefined} className="absolute inset-0 w-full h-full object-cover" style={{ imageRendering: 'high-quality' }} alt="CP Background" />
                  ) : (
                    <div className="absolute inset-0 bg-gray-800/50"></div>
                  )}
                  <div className="absolute inset-0 bg-black/40"></div>
                  
                  <div className="relative z-10 flex items-center gap-4 w-full justify-center">
                    <div className="flex flex-col items-center">
                      <div className="relative w-14 h-14 flex items-center justify-center">
                        <img src={selectedProfile.avatar || undefined} className="w-full h-full rounded-full object-cover border-2 border-white/50" alt="User" referrerPolicy="no-referrer" />
                        {selectedProfile.equippedCpFrame && (
                          <img src={selectedProfile.equippedCpFrame || undefined} className="absolute inset-0 w-full h-full object-contain scale-[1.35] pointer-events-none z-10" alt="CP Frame" />
                        )}
                      </div>
                      <span className="text-[9px] font-bold text-white mt-3 truncate max-w-[60px] bg-black/50 px-2 py-0.5 rounded-full">{selectedProfile.name}</span>
                    </div>

                    <div className="flex flex-col items-center justify-center animate-pulse px-2">
                      <Heart className="text-pink-500 fill-pink-500 drop-shadow-md" size={24} />
                      <span className="text-[8px] font-bold text-pink-400 mt-1 bg-black/50 px-2 py-0.5 rounded-full">CP</span>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="relative w-14 h-14 flex items-center justify-center">
                        <img src={selectedProfile.cpPartnerAvatar || undefined} className="w-full h-full rounded-full object-cover border-2 border-white/50" alt="Partner" referrerPolicy="no-referrer" />
                        {(selectedProfile.partnerCpFrame || selectedProfile.equippedCpFrame) && (
                          <img src={selectedProfile.partnerCpFrame || selectedProfile.equippedCpFrame || undefined} className="absolute inset-0 w-full h-full object-contain scale-[1.35] pointer-events-none z-10" alt="CP Frame" />
                        )}
                        {selectedProfile.partnerMicFrame && (
                          <img src={selectedProfile.partnerMicFrame || undefined} className="absolute inset-0 w-full h-full object-contain scale-[1.35] pointer-events-none z-20" alt="Partner Mic Frame" />
                        )}
                      </div>
                      <span className="text-[9px] font-bold text-white mt-3 truncate max-w-[60px] bg-black/50 px-2 py-0.5 rounded-full">{selectedProfile.cpPartnerName}</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4 mb-6 min-h-[80px]">
                <p className="text-[10px] text-gray-400 mb-3">الأوسمة</p>
                <div className="flex flex-wrap gap-3">
                  {selectedProfile.badges && selectedProfile.badges.length > 0 ? (
                    selectedProfile.badges.map((badge: any) => (
                      <div key={badge.id} className="group/badge relative">
                        <img src={badge.imageUrl || undefined} alt={badge.name} className="w-10 h-10 object-contain hover:scale-110 transition drop-shadow-lg" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-[10px] rounded opacity-0 group-hover/badge:opacity-100 whitespace-nowrap pointer-events-none z-50">
                          {badge.name}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500 text-xs italic">لا توجد أوسمة حالياً</div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-3">
                <button onClick={() => {
                  setSelectedReceiver(selectedProfile.uid);
                  setSelectedProfile(null);
                  setShowGiftModal(true);
                }} className="flex-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-pink-500/30">
                  إرسال هدية
                </button>
                <button 
                  onClick={() => {
                    setActivePrivateChat({
                      id: selectedProfile.uid,
                      name: selectedProfile.name,
                      photo: selectedProfile.avatar
                    });
                    setSelectedProfile(null);
                  }}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 transition text-white py-3.5 rounded-xl font-bold border border-purple-500"
                >
                  رسالة
                </button>
                <button className="flex-1 bg-gray-800 hover:bg-gray-700 transition text-white py-3.5 rounded-xl font-bold border border-gray-700">
                  متابعة
                </button>
              </div>

              {/* Room Admin Controls */}
              {(room.hostId === user?.uid || userData?.role === 'admin') && selectedProfile.uid !== user?.uid && (
                <>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-800 pt-4">
                    {mics.some(m => m.userId === selectedProfile.uid) && (
                      <button 
                        onClick={async () => {
                          if (!confirm('هل أنت متأكد من إنزال هذا المستخدم من المايك؟')) return;
                          try {
                            const micToClear = mics.find(m => m.userId === selectedProfile.uid);
                            if (micToClear) {
                              await updateDoc(doc(db, 'rooms', roomId, 'mics', micToClear.id), { 
                                userId: null, 
                                userAvatar: null, 
                                userName: null, 
                                userMicFrame: null, 
                                userMicIcon: null 
                              });
                              setSelectedProfile(null);
                            }
                          } catch (err) {
                            console.error('Error removing from mic:', err);
                          }
                        }}
                        className="flex-1 bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 transition py-2.5 rounded-xl font-bold border border-yellow-500/30 flex items-center justify-center gap-2 text-xs"
                      >
                        إنزال من المايك
                      </button>
                    )}
                    <button 
                      onClick={async () => {
                        if (!confirm('هل أنت متأكد من طرد هذا المستخدم من الغرفة؟')) return;
                        try {
                          const newAudience = (room.audience || []).filter((a: any) => a.uid !== selectedProfile.uid);
                          const newSpeakers = (room.speakers || []).filter((s: any) => s.uid !== selectedProfile.uid);
                          await updateDoc(doc(db, 'rooms', roomId), {
                            audience: newAudience,
                            speakers: newSpeakers
                          });
                          
                          // Also remove from mic if they are on one
                          const micToClear = mics.find(m => m.userId === selectedProfile.uid);
                          if (micToClear) {
                            await updateDoc(doc(db, 'rooms', roomId, 'mics', micToClear.id), { 
                              userId: null, 
                              userAvatar: null, 
                              userName: null, 
                              userMicFrame: null, 
                              userMicIcon: null 
                            });
                          }
                          
                          setSelectedProfile(null);
                        } catch (error) {
                          console.error('Error kicking user:', error);
                        }
                      }}
                      className="flex-1 bg-orange-500/20 text-orange-500 hover:bg-orange-500/30 transition py-2.5 rounded-xl font-bold border border-orange-500/30 flex items-center justify-center gap-2 text-xs"
                    >
                      طرد
                    </button>
                    {selectedProfile.cpPartnerId && (
                      <button 
                        onClick={async () => {
                          setConfirmModal({
                            show: true,
                            title: 'إلغاء CP',
                            message: 'هل أنت متأكد من إلغاء علاقة الـ CP؟',
                            onConfirm: async () => {
                              try {
                                const partnerId = selectedProfile.cpPartnerId;
                                await updateDoc(doc(db, 'users', selectedProfile.uid), {
                                  cpPartnerId: null,
                                  cpPartnerName: null,
                                  cpPartnerAvatar: null,
                                  equippedCpFrame: null,
                                  cpBackground: null
                                });
                                await updateDoc(doc(db, 'users', partnerId), {
                                  cpPartnerId: null,
                                  cpPartnerName: null,
                                  cpPartnerAvatar: null,
                                  equippedCpFrame: null,
                                  cpBackground: null
                                });
                                setSelectedProfile(null);
                                setConfirmModal({ show: false, title: '', message: '', onConfirm: () => {} });
                              } catch (error) {
                                console.error('Error cancelling CP:', error);
                              }
                            }
                          });
                        }}
                        className="flex-1 bg-red-500/20 text-red-500 hover:bg-red-500/30 transition py-2.5 rounded-xl font-bold border border-red-500/30 flex items-center justify-center gap-2 text-xs"
                      >
                        إلغاء CP
                      </button>
                    )}
                  </div>
                  <div className="mt-4 flex gap-3 border-t border-gray-800 pt-4">
                    <button 
                      onClick={async () => {
                        setConfirmModal({
                          show: true,
                          title: 'حظر مستخدم',
                          message: 'هل أنت متأكد من حظر هذا المستخدم من الغرفة نهائياً؟',
                          onConfirm: async () => {
                            try {
                              const newAudience = (room.audience || []).filter((a: any) => a.uid !== selectedProfile.uid);
                              const newSpeakers = (room.speakers || []).filter((s: any) => s.uid !== selectedProfile.uid);
                              const newBanned = [...(room.bannedUsers || []), selectedProfile.uid];
                              await updateDoc(doc(db, 'rooms', roomId), {
                                audience: newAudience,
                                speakers: newSpeakers,
                                bannedUsers: newBanned
                              });
                              setSelectedProfile(null);
                              setConfirmModal({ show: false, title: '', message: '', onConfirm: () => {} });
                            } catch (error) {
                              console.error('Error banning user:', error);
                            }
                          }
                        });
                      }}
                      className="flex-1 bg-red-500/20 text-red-500 hover:bg-red-500/30 transition py-2.5 rounded-xl font-bold border border-red-500/30 flex items-center justify-center gap-2"
                    >
                      <ShieldBan size={16} />
                      حظر
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {/* Incoming CP Request Modal */}
        {incomingCpRequest && (
          <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-gradient-to-b from-pink-950 to-gray-900 rounded-3xl p-6 w-full max-w-sm relative border border-pink-500/30 shadow-2xl animate-scale-up overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-overlay"></div>
              
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-16 h-16 bg-pink-500/20 rounded-full flex items-center justify-center mb-4 animate-pulse border border-pink-500/50">
                  <Heart size={32} className="text-pink-400 fill-pink-400" />
                </div>
                
                <h3 className="text-2xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-400 text-center">
                  طلب ارتباط (CP) 💍
                </h3>
                
                <p className="text-gray-300 text-center mb-8 text-sm">
                  لقد أرسل لك <span className="font-bold text-pink-400">{incomingCpRequest.senderName}</span> هدية الارتباط! هل تقبل أن تكونوا ثنائي (CP)؟
                </p>
                
                <div className="flex items-center justify-center gap-4 mb-8 w-full">
                  {/* Sender */}
                  <div className="flex flex-col items-center gap-2 w-1/3">
                    <div className="relative">
                      <img src={incomingCpRequest.senderAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${incomingCpRequest.senderId}`} className="w-20 h-20 rounded-full object-cover border-4 border-pink-500/50 shadow-[0_0_20px_rgba(236,72,153,0.3)]" />
                      {incomingCpRequest.frameUrl && <img src={incomingCpRequest.frameUrl} className="absolute -inset-3 w-[calc(100%+24px)] h-[calc(100%+24px)] max-w-none object-contain pointer-events-none" />}
                    </div>
                    <p className="text-sm font-bold text-white text-center truncate w-full">{incomingCpRequest.senderName}</p>
                  </div>

                  {/* Heart */}
                  <div className="flex flex-col items-center justify-center">
                    <Heart size={24} className="text-pink-500 fill-pink-500 animate-bounce" />
                  </div>

                  {/* Receiver (You) */}
                  <div className="flex flex-col items-center gap-2 w-1/3">
                    <div className="relative">
                      <img src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} className="w-20 h-20 rounded-full object-cover border-4 border-pink-500/50 shadow-[0_0_20px_rgba(236,72,153,0.3)]" />
                      {incomingCpRequest.frameUrl && <img src={incomingCpRequest.frameUrl} className="absolute -inset-3 w-[calc(100%+24px)] h-[calc(100%+24px)] max-w-none object-contain pointer-events-none" />}
                    </div>
                    <p className="text-sm font-bold text-white text-center truncate w-full">أنت</p>
                  </div>
                </div>

                <div className="flex gap-3 w-full">
                  <button 
                    onClick={async () => {
                      try {
                        await updateDoc(doc(db, 'cp_requests', incomingCpRequest.id), { status: 'rejected' });
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                    className="flex-1 py-3 rounded-xl font-bold text-gray-300 bg-white/5 hover:bg-white/10 transition border border-white/10"
                  >
                    رفض
                  </button>
                  <button 
                    onClick={async () => {
                      try {
                        const batch = writeBatch(db);
                        
                        // Update sender
                        batch.update(doc(db, 'users', incomingCpRequest.senderId), {
                          cpPartnerId: user!.uid,
                          cpPartnerName: user!.displayName || 'مستخدم',
                          cpPartnerAvatar: user!.photoURL || '',
                          equippedCpFrame: incomingCpRequest.frameUrl || '',
                          cpBackground: incomingCpRequest.backgroundUrl || ''
                        });

                        // Update receiver
                        batch.update(doc(db, 'users', user!.uid), {
                          cpPartnerId: incomingCpRequest.senderId,
                          cpPartnerName: incomingCpRequest.senderName || 'مستخدم',
                          cpPartnerAvatar: incomingCpRequest.senderAvatar || '',
                          equippedCpFrame: incomingCpRequest.frameUrl || '',
                          cpBackground: incomingCpRequest.backgroundUrl || ''
                        });

                        // Update request status
                        batch.update(doc(db, 'cp_requests', incomingCpRequest.id), { status: 'accepted' });

                        // Send room message
                        batch.set(doc(collection(db, 'rooms', roomId, 'room_chat')), {
                          text: `🎉 مبروك! ${incomingCpRequest.senderName} و ${user!.displayName} أصبحا ثنائي (CP) الآن! 💍`,
                          userId: 'system',
                          userName: 'النظام',
                          isSystemGift: true,
                          timestamp: Date.now()
                        });

                        await batch.commit();
                      } catch (e) {
                        console.error(e);
                        alert('حدث خطأ أثناء قبول الطلب');
                      }
                    }}
                    className="flex-1 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-pink-500 to-rose-600 hover:shadow-lg hover:shadow-pink-500/25 transition border border-pink-400/50"
                  >
                    قبول
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Private Chat */}
        {activePrivateChat && (
          <div className="absolute inset-0 z-[200]">
            <PrivateChat
              targetUserId={activePrivateChat.id}
              targetUserName={activePrivateChat.name}
              targetUserPhoto={activePrivateChat.photo}
              onClose={() => setActivePrivateChat(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
