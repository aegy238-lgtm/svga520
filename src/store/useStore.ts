import { create } from 'zustand';
import { Product, ProductType, PaymentMethod, Review, ProductDurationOption, PromoCode } from '../data/mockData';
import { db, auth } from '../lib/firebase';
import { 
  collection, doc, setDoc, getDocs, onSnapshot, 
  updateDoc, deleteDoc, query, orderBy, 
  addDoc, serverTimestamp, getDoc 
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';

export interface CartItem {
  product: Product;
  quantity: number;
  selectedDuration?: ProductDurationOption;
}

export interface Order {
  id: string;
  date: string;
  userId: string;
  userEmail: string;
  items: CartItem[];
  total: number;
  status: 'Completed' | 'Pending' | 'Failed';
  method: 'Auto' | 'WhatsApp';
  keys: {
    productId: string;
    productName: string;
    type: ProductType;
    value: string;
  }[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  usedPromoCodes?: string[];
}

export interface Banner {
  id: string;
  imageUrl: string;
  linkUrl?: string;
  isActive: boolean;
  position?: 'top' | 'middle';
  showAsSlider?: boolean;
  positionIndex?: number;
  afterProductCount?: number;
}

export interface Announcement {
  id: string;
  text: string;
  isActive: boolean;
}

interface AppState {
  products: Product[];
  cart: CartItem[];
  user: User | null;
  allOrders: Order[];
  whatsappNumber: string;
  banners: Banner[];
  announcements: Announcement[];
  paymentMethods: PaymentMethod[];
  promoCodes: PromoCode[];
  reviews: Review[];
  wishlist: string[];
  siteName: string;
  siteLogo: string;
  welcomeGiftEnabled: boolean;
  welcomeGiftDiscount: number;
  isInitialized: boolean;
  
  // Real-time Init
  initFirebase: () => void;
  setUser: (user: User | null) => void;
  
  // Wishlist functions
  toggleWishlist: (productId: string) => Promise<void>;

  // Settings functions
  updateSettings: (data: { siteName?: string; siteLogo?: string; whatsappNumber?: string; welcomeGiftEnabled?: boolean; welcomeGiftDiscount?: number }) => Promise<void>;

  addToCart: (product: Product, selectedDuration?: ProductDurationOption) => void;
  removeFromCart: (productId: string, durationId?: string) => void;
  clearCart: () => void;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  placeOrder: (method: 'Auto' | 'WhatsApp', promoId?: string) => Promise<void>;
  
  // Admin functions
  addProduct: (product: Product) => Promise<void>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: Order['status']) => Promise<void>;
  clearStatistics: () => Promise<void>;
  updateWhatsAppNumber: (num: string) => Promise<void>;
  
  // Banner functions
  addBanner: (banner: Omit<Banner, 'id'>) => Promise<void>;
  updateBanner: (id: string, data: Partial<Banner>) => Promise<void>;
  deleteBanner: (id: string) => Promise<void>;
  toggleBannerStatus: (id: string) => Promise<void>;

  // Announcement functions
  addAnnouncement: (text: string) => Promise<void>;
  updateAnnouncement: (id: string, data: Partial<Announcement>) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
  toggleAnnouncementStatus: (id: string) => Promise<void>;

  // Payment Methods functions
  addPaymentMethod: (method: Omit<PaymentMethod, 'id'>) => Promise<void>;
  updatePaymentMethod: (id: string, data: Partial<PaymentMethod>) => Promise<void>;
  deletePaymentMethod: (id: string) => Promise<void>;
  
  // Reviews functions
  addReview: (review: Omit<Review, 'id' | 'date'>) => Promise<void>;
  deleteReview: (id: string) => Promise<void>;
  
  // Promotion/PromoCode functions
  addPromoCode: (promo: Omit<PromoCode, 'id' | 'usageCount'>) => Promise<void>;
  updatePromoCode: (id: string, data: Partial<PromoCode>) => Promise<void>;
  deletePromoCode: (id: string) => Promise<void>;
  applyPromoCode: (code: string) => Promise<PromoCode | null>;
}

const generateMockDelivery = (type: ProductType) => {
  if (type === 'License Key') return `XXXX-XXXX-XXXX-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  if (type === 'Account') return `Email: user${Math.floor(Math.random() * 999)}@shared.io | Pass: ${Math.random().toString(36).slice(-8)}`;
  return `Sub ID: SUB-${Math.random().toString(36).slice(-10).toUpperCase()}`;
};

export const useStore = create<AppState>((set, get) => ({
  products: [],
  cart: [],
  user: null,
  allOrders: [],
  whatsappNumber: '+1234567890',
  banners: [],
  announcements: [],
  paymentMethods: [],
  promoCodes: [],
  reviews: [],
  wishlist: JSON.parse(localStorage.getItem('wishlist') || '[]'),
  siteName: 'KeyMaster',
  siteLogo: '',
  welcomeGiftEnabled: false,
  welcomeGiftDiscount: 10,
  isInitialized: false,

  setUser: (user) => set({ user }),

  toggleWishlist: async (productId) => {
    const { user, wishlist } = get();
    const isWishlisted = wishlist.includes(productId);
    const newWishlist = isWishlisted 
      ? wishlist.filter(id => id !== productId)
      : [...wishlist, productId];
    
    set({ wishlist: newWishlist });
    localStorage.setItem('wishlist', JSON.stringify(newWishlist));
    
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.id), {
          wishlist: newWishlist
        });
      } catch (error) {
        console.error('Error updating wishlist in Firestore:', error);
      }
    }
  },

  updateSettings: async (data) => {
    try {
      await setDoc(doc(db, 'settings', 'general'), data, { merge: true });
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  },

  initFirebase: () => {
    const { isInitialized } = get();
    if (isInitialized) return;

    // Listen to Auth
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Real-time listener for user document
        onSnapshot(doc(db, 'users', firebaseUser.uid), (snapshot) => {
          if (snapshot.exists()) {
            const userData = snapshot.data();
            
            // Sync wishlist from Firestore if it exists
            if (userData?.wishlist) {
              set({ wishlist: userData.wishlist });
              localStorage.setItem('wishlist', JSON.stringify(userData.wishlist));
            }

            set({ 
              user: { 
                id: firebaseUser.uid, 
                name: userData?.name || firebaseUser.email?.split('@')[0] || 'User', 
                email: firebaseUser.email || '', 
                role: userData?.role || 'user',
                usedPromoCodes: userData?.usedPromoCodes || []
              } 
            });
          }
        });
      } else {
        set({ user: null });
      }
    });

    // Listen to Products
    onSnapshot(collection(db, 'products'), (snapshot) => {
      const products = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Product));
      set({ products });
    });

    // Listen to Banners
    onSnapshot(collection(db, 'banners'), (snapshot) => {
      const banners = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Banner));
      set({ banners });
    });

    // Listen to Announcements
    onSnapshot(collection(db, 'announcements'), (snapshot) => {
      const announcements = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Announcement));
      set({ announcements });
    });

    // Listen to Payment Methods
    onSnapshot(collection(db, 'paymentMethods'), (snapshot) => {
      const paymentMethods = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as PaymentMethod));
      set({ paymentMethods });
    });
    
    // Listen to PromoCodes
    onSnapshot(collection(db, 'promoCodes'), (snapshot) => {
      const promoCodes = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as PromoCode));
      set({ promoCodes });
    });

    // Listen to Orders
    onSnapshot(query(collection(db, 'orders'), orderBy('date', 'desc')), (snapshot) => {
      const allOrders = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Order));
      set({ allOrders });
    });

    // Listen to Reviews
    onSnapshot(query(collection(db, 'reviews'), orderBy('date', 'desc')), (snapshot) => {
      const reviews = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Review));
      set({ reviews });
    });

    // Listen to Settings
    onSnapshot(doc(db, 'settings', 'general'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        set({ 
          siteName: data.siteName || 'KeyMaster', 
          siteLogo: data.siteLogo || '', 
          whatsappNumber: data.whatsappNumber || '+1234567890',
          welcomeGiftEnabled: !!data.welcomeGiftEnabled,
          welcomeGiftDiscount: data.welcomeGiftDiscount || 10
        });
      }
    });

    set({ isInitialized: true });
  },

  addToCart: (product, selectedDuration) => set((state) => {
    const existing = state.cart.find(item => 
      item.product.id === product.id && 
      item.selectedDuration?.id === selectedDuration?.id
    );
    if (existing) {
      return { 
        cart: state.cart.map(item => 
          (item.product.id === product.id && item.selectedDuration?.id === selectedDuration?.id) 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        ) 
      };
    }
    return { cart: [...state.cart, { product, quantity: 1, selectedDuration }] };
  }),
  
  removeFromCart: (productId, durationId) => set((state) => ({
    cart: state.cart.filter(item => !(item.product.id === productId && item.selectedDuration?.id === durationId))
  })),
  
  clearCart: () => set({ cart: [] }),
  
  login: async (email, pass) => {
    await signInWithEmailAndPassword(auth, email, pass);
  },

  register: async (email, pass) => {
    const res = await createUserWithEmailAndPassword(auth, email, pass);
    // Create user profile in firestore
    await setDoc(doc(db, 'users', res.user.uid), {
      name: email.split('@')[0],
      email,
      role: 'user',
      createdAt: serverTimestamp()
    });
  },
  
  logout: async () => {
    await signOut(auth);
  },
  
  placeOrder: async (method, promoId) => {
    const { cart, user, promoCodes, applyPromoCode } = get();
    if (!user || cart.length === 0) return;

    let subtotal = 0;
    let total = 0;

    const promo = promoId ? promoCodes.find(p => p.id === promoId) : null;

    cart.forEach(item => {
      const basePrice = item.selectedDuration ? item.selectedDuration.price : item.product.price;
      const nativeDiscounted = item.product.discountPercentage 
        ? basePrice * (1 - item.product.discountPercentage / 100)
        : basePrice;
      
      subtotal += nativeDiscounted * item.quantity;

      let finalPrice = nativeDiscounted;
      if (promo && (!promo.targetProductId || promo.targetProductId === item.product.id)) {
        if (promo.discountType === 'percentage') {
          finalPrice = finalPrice * (1 - promo.discountValue / 100);
        } else {
          finalPrice = Math.max(0, finalPrice - promo.discountValue);
        }
      }
      total += finalPrice * item.quantity;
    });
    
    const keys = method === 'Auto' ? cart.map(item => ({
      productId: item.product.id,
      productName: item.product.name,
      type: item.product.type,
      value: generateMockDelivery(item.product.type)
    })) : [];

    const newOrder = {
      date: new Date().toISOString(),
      userId: user.id,
      userEmail: user.email,
      promoId: promoId || null,
      items: cart.map(item => ({
        product: {
          id: item.product.id,
          name: item.product.name,
          price: item.product.price,
          type: item.product.type,
          imageUrl: item.product.imageUrl
        },
        quantity: item.quantity,
        selectedDuration: item.selectedDuration || null
      })),
      total,
      subtotal,
      status: method === 'WhatsApp' ? 'Pending' : 'Completed',
      method,
      keys
    };

    await addDoc(collection(db, 'orders'), newOrder);
    
    // Increment usage count of promo code if used
    if (promoId) {
      if (user) {
        const userRef = doc(db, 'users', user.id);
        const updatedUsedPromos = [...(user.usedPromoCodes || []), promoId];
        await updateDoc(userRef, { usedPromoCodes: updatedUsedPromos });
        
        // If it's a dynamic gift code, also track it in a global collection
        if (promoId.startsWith('GIFT-')) {
          await setDoc(doc(db, 'globalUsedPromos', promoId), {
            usedBy: user.id,
            usedAt: serverTimestamp()
          });
        }
      }

      const promoRef = doc(db, 'promoCodes', promoId);
      const currentPromo = promoCodes.find(p => p.id === promoId);
      if (currentPromo) {
        await updateDoc(promoRef, { usageCount: (currentPromo.usageCount || 0) + 1 });
      }
    }

    set({ cart: [] });
  },

  addProduct: async (product) => {
    const { id, ...data } = product;
    await setDoc(doc(collection(db, 'products')), data);
  },

  updateProduct: async (id, data) => {
    await updateDoc(doc(db, 'products', id), data);
  },

  deleteProduct: async (id) => {
    await deleteDoc(doc(db, 'products', id));
  },

  updateOrderStatus: async (orderId, status) => {
    await updateDoc(doc(db, 'orders', orderId), { status });
  },

  clearStatistics: async () => {
    try {
      const snapshot = await getDocs(collection(db, 'orders'));
      const deletePromises = snapshot.docs.map(docSnap => deleteDoc(doc(db, 'orders', docSnap.id)));
      await Promise.all(deletePromises);

      const promoSnapshot = await getDocs(collection(db, 'globalUsedPromos'));
      const deletePromoPromises = promoSnapshot.docs.map(docSnap => deleteDoc(doc(db, 'globalUsedPromos', docSnap.id)));
      await Promise.all(deletePromoPromises);

      const usersSnapshot = await getDocs(collection(db, 'users'));
      const updateUserPromises = usersSnapshot.docs.map(docSnap => updateDoc(doc(db, 'users', docSnap.id), { usedPromoCodes: [] }));
      await Promise.all(updateUserPromises);
    } catch (error) {
      console.error('Failed to clear statistics:', error);
    }
  },

  updateWhatsAppNumber: async (num) => {
    await setDoc(doc(db, 'settings', 'general'), { whatsappNumber: num }, { merge: true });
  },
  
  addBanner: async (banner) => {
    await addDoc(collection(db, 'banners'), banner);
  },
  
  updateBanner: async (id, data) => {
    await updateDoc(doc(db, 'banners', id), data);
  },
  
  deleteBanner: async (id) => {
    await deleteDoc(doc(db, 'banners', id));
  },
  
  toggleBannerStatus: async (id) => {
    const banner = get().banners.find(b => b.id === id);
    if (banner) {
      await updateDoc(doc(db, 'banners', id), { isActive: !banner.isActive });
    }
  },

  addAnnouncement: async (text) => {
    await addDoc(collection(db, 'announcements'), { text, isActive: true });
  },

  updateAnnouncement: async (id, data) => {
    await updateDoc(doc(db, 'announcements', id), data);
  },

  deleteAnnouncement: async (id) => {
    await deleteDoc(doc(db, 'announcements', id));
  },

  toggleAnnouncementStatus: async (id) => {
    const announcement = get().announcements.find(a => a.id === id);
    if (announcement) {
      await updateDoc(doc(db, 'announcements', id), { isActive: !announcement.isActive });
    }
  },
  
  addPaymentMethod: async (method) => {
    await addDoc(collection(db, 'paymentMethods'), method);
  },
  
  updatePaymentMethod: async (id, data) => {
    await updateDoc(doc(db, 'paymentMethods', id), data);
  },
  
  deletePaymentMethod: async (id) => {
    await deleteDoc(doc(db, 'paymentMethods', id));
  },

  addReview: async (review) => {
    await addDoc(collection(db, 'reviews'), {
      ...review,
      date: new Date().toISOString()
    });
  },
  
  deleteReview: async (id) => {
    await deleteDoc(doc(db, 'reviews', id));
  },

  addPromoCode: async (promo) => {
    const { ...data } = promo;
    await addDoc(collection(db, 'promoCodes'), { ...data, usageCount: 0 });
  },

  updatePromoCode: async (id, data) => {
    await updateDoc(doc(db, 'promoCodes', id), data);
  },

  deletePromoCode: async (id) => {
    await deleteDoc(doc(db, 'promoCodes', id));
  },

  applyPromoCode: async (code: string) => {
    const { promoCodes, welcomeGiftEnabled, welcomeGiftDiscount, user } = get();
    
    // Regular check
    const promo = promoCodes.find(p => p.code === code && p.isActive);
    
    // Check if user already used this promo (local check)
    if (user?.usedPromoCodes?.includes(promo?.id || '')) return null;
    if (user?.usedPromoCodes?.includes(code)) return null; // for dynamic codes

    // Global check for dynamic codes
    if (code.startsWith('GIFT-')) {
      try {
        const globalRef = doc(db, 'globalUsedPromos', code);
        const globalSnap = await getDoc(globalRef);
        if (globalSnap.exists()) return null;
      } catch (err) {
        console.error('Error checking global promos:', err);
      }
    }

    if (promo) return promo;

    // Dynamic Gift Code check (Pattern: GIFT-[DISCOUNT]-[RANDOM])
    if (welcomeGiftEnabled && code.startsWith('GIFT-')) {
      const parts = code.split('-');
      if (parts.length >= 2) {
        const discountVal = parseInt(parts[1]);
        if (discountVal === welcomeGiftDiscount) {
          return {
            id: code,
            code: code,
            discountType: 'percentage',
            discountValue: welcomeGiftDiscount,
            isActive: true,
            usageCount: 0
          } as PromoCode;
        }
      }
    }

    return null;
  }
}))
