import { collection, getDocs, getDoc, doc, setDoc, updateDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db, ensureFirebaseAuth } from './firebase';
import { GiftItem, DeliveryItem, EmployeeUser, HeroBannerItem, CustomCategory, SiteSettings, UserRole, UserPermissions, SavedGiftName } from '../types';
import { INITIAL_GIFTS } from '../data/initialGifts';
import { INITIAL_EMPLOYEES } from '../data/initialEmployees';
import { INITIAL_BANNERS } from '../data/initialBanners';
import { INITIAL_CATEGORIES } from '../data/initialCategories';
import { INITIAL_SAVED_GIFT_NAMES } from '../data/initialSavedNames';
import { handleFirestoreError } from './firebaseErrors';

export const collections = {
  gifts: collection(db, 'gifts'),
  deliveries: collection(db, 'deliveries'),
  employees: collection(db, 'employees'),
  users: collection(db, 'users'),
  banners: collection(db, 'banners'),
  categories: collection(db, 'categories'),
  settings: collection(db, 'settings'),
  assets: collection(db, 'assets'),
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: 'Destroy KING Designer',
  siteSlogan: 'Animation Gallery & Live Stream VFX',
  siteSubTitle: 'Choose a design and watch it here',
  logoUrl: '',
  primaryPhone: '+923400700013',
  primaryPhoneLabel: 'WhatsApp',
  secondaryPhone: '',
  secondaryPhoneLabel: 'WhatsApp 2',
  whatsapp: '+923400700013',
  secondaryWhatsapp: '',
  phone: '+923400700013',
  email: 'southasia216@gmail.com',
  wechat: 'southasia216',
  wechatQrUrl: '',
  deletePasscode: '150150',
  giftsPerPage: 26
};

export async function seedDatabase() {
  try {
    await ensureFirebaseAuth();

    // 1. Seed & ensure Official Admin and initial employees are present
    const employeesSnapshot = await getDocs(collections.employees);
    if (employeesSnapshot.empty) {
      console.log('Seeding employees into Firestore database...');
      for (const emp of INITIAL_EMPLOYEES) {
        await setDoc(doc(db, 'employees', emp.id), emp);
      }
    } else {
      // Ensure the official admin exists and has latest permissions
      const officialAdmin = INITIAL_EMPLOYEES[0];
      const adminDoc = doc(db, 'employees', officialAdmin.id);
      await setDoc(adminDoc, officialAdmin, { merge: true });
    }

    // 2. Seed gifts (only if never explicitly cleared by admin and collection is empty)
    const initDoc = await getDoc(doc(db, 'settings', 'system_init'));
    const isGiftsCleared = initDoc.exists() && initDoc.data()?.initialGiftsCleared;

    const giftsSnapshot = await getDocs(collections.gifts);
    if (giftsSnapshot.empty && !isGiftsCleared) {
      console.log('Seeding real gifts into Firestore database...');
      for (const gift of INITIAL_GIFTS) {
        await setDoc(doc(db, 'gifts', gift.id), gift);
      }
    }

    // 3. Seed banners
    const bannersSnapshot = await getDocs(collections.banners);
    if (bannersSnapshot.empty) {
      console.log('Seeding hero banners into Firestore database...');
      for (const banner of INITIAL_BANNERS) {
        await setDoc(doc(db, 'banners', banner.id), banner);
      }
    }

    // 4. Seed categories (General Category as base default)
    const categoriesSnapshot = await getDocs(collections.categories);
    if (categoriesSnapshot.empty) {
      console.log('Seeding initial categories into Firestore database...');
      for (const cat of INITIAL_CATEGORIES) {
        await setDoc(doc(db, 'categories', cat.id), cat);
      }
    }

    // 5. Seed site settings
    const settingsDoc = doc(db, 'settings', 'general');
    const settingsSnapshot = await getDocs(collections.settings);
    if (settingsSnapshot.empty) {
      console.log('Seeding default site settings into Firestore...');
      await setDoc(settingsDoc, DEFAULT_SITE_SETTINGS);
    }

    // 6. Seed saved gift names presets if not yet initialized
    try {
      const namesDoc = doc(db, 'settings', 'gift_names_presets');
      const namesSnap = await getDoc(namesDoc);
      if (!namesSnap.exists()) {
        console.log('Seeding initial saved gift names into Firestore...');
        await setDoc(namesDoc, {
          names: INITIAL_SAVED_GIFT_NAMES,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (presetErr) {
      console.warn('Note on gift names preset check:', presetErr);
    }
  } catch (error) {
    console.error('Error seeding database:', handleFirestoreError(error));
  }
}

function sanitizeData<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        clean[k] = sanitizeData(v);
      } else {
        clean[k] = v;
      }
    }
  }
  return clean;
}

// Helper to detect any artificially created dummy/test gifts to satisfy user request
export const isDummyGift = (gift: Partial<GiftItem>): boolean => {
  if (!gift || !gift.id) return false;
  // Match NO.242... dummy range created earlier, or DUMMY, TEST, MOCK
  if (gift.id.startsWith('NO.242') || gift.id.startsWith('DUMMY_') || gift.id.startsWith('TEST_') || gift.id.startsWith('MOCK_')) {
    return true;
  }
  const dummyKeywords = [
    '黄金帝王冠冕', 'تاج الملوك الذهبي الفاخر',
    '赛博幽灵超跑', 'سيارة سايبربانك فانتوم الخارقة',
    '永恒之心钻戒', 'خاتم الألماس الأبدي الفاخر',
    '星河冠军战旗', 'راية أبطال المجرة الكونية',
    '幻海星途游艇', 'يخت المحيط الفاخر المسافر',
    '不死神鸟涅槃', 'طائر الفينيق الخالد المنبعث',
    '冰魄幻晶王座', 'عرش الكريستال الجليدي الملكي'
  ];
  if (gift.title && dummyKeywords.includes(gift.title)) return true;
  if (gift.titleAr && dummyKeywords.includes(gift.titleAr)) return true;
  return false;
};

/**
 * Purges any dummy or fake gifts from both Firestore and localStorage
 */
export async function purgeDummyGifts(): Promise<number> {
  let count = 0;
  // 1. Purge from localStorage
  try {
    const localGifts: GiftItem[] = JSON.parse(localStorage.getItem('jiawei_custom_gifts_v1') || '[]');
    const filtered = localGifts.filter(g => !isDummyGift(g));
    count += (localGifts.length - filtered.length);
    localStorage.setItem('jiawei_custom_gifts_v1', JSON.stringify(filtered));
  } catch(e) {}

  // 2. Purge from Firestore
  try {
    await ensureFirebaseAuth();
    const giftsSnapshot = await getDocs(collections.gifts);
    const toDelete: Promise<void>[] = [];
    giftsSnapshot.docs.forEach(docSnap => {
      const data = docSnap.data() as GiftItem;
      if (isDummyGift(data) || isDummyGift({ id: docSnap.id })) {
        toDelete.push(deleteDoc(docSnap.ref));
        count++;
      }
    });
    if (toDelete.length > 0) {
      await Promise.all(toDelete);
    }
  } catch (error) {
    console.error('Error purging dummy gifts from Firestore:', handleFirestoreError(error));
  }
  return count;
}

// ----------------- GIFTS -----------------
export function subscribeToGifts(callback: (gifts: GiftItem[]) => void) {
  return onSnapshot(collections.gifts, (snapshot) => {
    const rawGifts = snapshot.docs.map(d => d.data() as GiftItem);
    // Remove any dummy gifts and silently clean them up
    const gifts = rawGifts.filter(g => !isDummyGift(g));
    rawGifts.forEach(g => {
      if (isDummyGift(g)) {
        deleteDoc(doc(db, 'gifts', g.id)).catch(() => {});
      }
    });

    try {
      const localGifts: GiftItem[] = JSON.parse(localStorage.getItem('jiawei_custom_gifts_v1') || '[]');
      const cleanLocal = localGifts.filter(g => !isDummyGift(g));
      if (cleanLocal.length !== localGifts.length) {
        localStorage.setItem('jiawei_custom_gifts_v1', JSON.stringify(cleanLocal));
      }

      const isCleared = localStorage.getItem('jiawei_gifts_cleared') === 'true';
      const map = new Map<string, GiftItem>();

      // Firestore gifts take priority
      gifts.forEach(g => map.set(g.id, g));
      cleanLocal.forEach((g: GiftItem) => {
        if (!map.has(g.id)) map.set(g.id, g);
      });

      // Only if no gifts exist at all and never cleared, fall back to initial gifts
      if (map.size === 0 && !isCleared) {
        INITIAL_GIFTS.filter(g => !isDummyGift(g)).forEach(g => map.set(g.id, g));
      }

      callback(Array.from(map.values()));
      return;
    } catch(e) {}
    callback(gifts);
  }, (error) => {
    console.error('Error subscribing to gifts:', handleFirestoreError(error));
    try {
      const localGifts: GiftItem[] = JSON.parse(localStorage.getItem('jiawei_custom_gifts_v1') || '[]');
      const cleanLocal = localGifts.filter(g => !isDummyGift(g));
      const map = new Map<string, GiftItem>();
      cleanLocal.forEach((g: GiftItem) => map.set(g.id, g));
      if (map.size === 0) {
        INITIAL_GIFTS.filter(g => !isDummyGift(g)).forEach(g => map.set(g.id, g));
      }
      callback(Array.from(map.values()));
    } catch(e) {}
  });
}

export async function addGift(gift: GiftItem) {
  if (isDummyGift(gift)) return;
  try {
    const localGifts = JSON.parse(localStorage.getItem('jiawei_custom_gifts_v1') || '[]');
    const filtered = localGifts.filter((g: GiftItem) => g.id !== gift.id && !isDummyGift(g));
    filtered.unshift(gift);
    localStorage.setItem('jiawei_custom_gifts_v1', JSON.stringify(filtered));
  } catch(e) {}

  try {
    await ensureFirebaseAuth();
    await setDoc(doc(db, 'gifts', gift.id), sanitizeData(gift));
  } catch (error) {
    console.error('Error adding gift to Firestore:', handleFirestoreError(error));
  }
}

/**
 * Batch add multiple gifts to Firestore & local state simultaneously
 */
export async function addGiftsBatch(giftsToAdd: GiftItem[]): Promise<void> {
  const validGifts = giftsToAdd.filter(g => !isDummyGift(g));
  if (validGifts.length === 0) return;

  try {
    const localGifts: GiftItem[] = JSON.parse(localStorage.getItem('jiawei_custom_gifts_v1') || '[]');
    const map = new Map<string, GiftItem>();
    validGifts.forEach(g => map.set(g.id, g));
    localGifts.forEach(g => {
      if (!map.has(g.id) && !isDummyGift(g)) {
        map.set(g.id, g);
      }
    });
    localStorage.setItem('jiawei_custom_gifts_v1', JSON.stringify(Array.from(map.values())));
  } catch(e) {}

  try {
    await ensureFirebaseAuth();
    const batchPromises = validGifts.map(gift => setDoc(doc(db, 'gifts', gift.id), sanitizeData(gift)));
    await Promise.all(batchPromises);
  } catch (error) {
    console.error('Error batch adding gifts to Firestore:', handleFirestoreError(error));
  }
}

export async function updateGift(gift: GiftItem) {
  try {
    const localGifts = JSON.parse(localStorage.getItem('jiawei_custom_gifts_v1') || '[]');
    const idx = localGifts.findIndex((g: GiftItem) => g.id === gift.id);
    if (idx >= 0) localGifts[idx] = gift;
    else localGifts.unshift(gift);
    localStorage.setItem('jiawei_custom_gifts_v1', JSON.stringify(localGifts));
  } catch(e) {}

  try {
    await ensureFirebaseAuth();
    await setDoc(doc(db, 'gifts', gift.id), sanitizeData(gift), { merge: true });
  } catch (error) {
    console.error('Error updating gift in Firestore:', handleFirestoreError(error));
  }
}

export async function deleteGift(id: string) {
  try {
    const localGifts = JSON.parse(localStorage.getItem('jiawei_custom_gifts_v1') || '[]');
    const filtered = localGifts.filter((g: GiftItem) => g.id !== id);
    localStorage.setItem('jiawei_custom_gifts_v1', JSON.stringify(filtered));
  } catch(e) {}

  try {
    await ensureFirebaseAuth();
    await deleteDoc(doc(db, 'gifts', id));
  } catch (error) {
    console.error('Error deleting gift from Firestore:', handleFirestoreError(error));
  }
}

/**
 * Deletes ALL uploaded gifts from Firestore database & local backup
 */
export async function deleteAllGiftsFromDb(): Promise<number> {
  try {
    localStorage.removeItem('jiawei_custom_gifts_v1');
  } catch(e) {}

  try {
    await ensureFirebaseAuth();
    const giftsSnapshot = await getDocs(collections.gifts);
    const deletePromises = giftsSnapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
    await Promise.all(deletePromises);

    // Record in Firestore system_init that initial gifts were cleared
    try {
      const settingsDoc = doc(db, 'settings', 'system_init');
      await setDoc(settingsDoc, { 
        initialGiftsCleared: true, 
        lastClearedAt: new Date().toISOString() 
      }, { merge: true });
    } catch (sErr) {
      console.warn('Could not record system_init marker:', sErr);
    }

    return giftsSnapshot.size;
  } catch (error) {
    console.error('Error deleting all gifts:', handleFirestoreError(error));
    return 0;
  }
}

/**
 * Updates WhatsApp contact on all gifts uploaded by a specific creator/employee
 */
export async function updateCreatorGiftsWhatsapp(creatorId: string, creatorName: string, newWhatsapp: string): Promise<number> {
  try {
    await ensureFirebaseAuth();
    const giftsSnapshot = await getDocs(collections.gifts);
    let updatedCount = 0;
    const updatePromises: Promise<void>[] = [];

    giftsSnapshot.forEach((giftDoc) => {
      const data = giftDoc.data() as GiftItem;
      const matchById = creatorId && data.author?.id === creatorId;
      const matchByName = creatorName && data.author?.name && 
        data.author.name.trim().toLowerCase() === creatorName.trim().toLowerCase();

      if (matchById || matchByName) {
        const updatedAuthor = {
          ...data.author,
          whatsapp: newWhatsapp
        };
        updatePromises.push(
          updateDoc(doc(db, 'gifts', giftDoc.id), {
            'author.whatsapp': newWhatsapp
          })
        );
        updatedCount++;
      }
    });

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }
    return updatedCount;
  } catch (error) {
    console.error('Error updating creator gifts WhatsApp:', handleFirestoreError(error));
    return 0;
  }
}

// ----------------- DELIVERIES / ORDERS -----------------
export function subscribeToDeliveries(callback: (deliveries: DeliveryItem[]) => void) {
  return onSnapshot(collections.deliveries, (snapshot) => {
    const deliveries = snapshot.docs.map(d => d.data() as DeliveryItem);
    callback(deliveries);
  }, (error) => {
    console.error('Error subscribing to deliveries:', handleFirestoreError(error));
  });
}

export async function addDelivery(delivery: DeliveryItem) {
  try {
    await ensureFirebaseAuth();
    await setDoc(doc(db, 'deliveries', delivery.id), delivery);
  } catch (error) {
    console.error('Error adding delivery:', handleFirestoreError(error));
    throw error;
  }
}

export async function deleteDelivery(id: string) {
  try {
    await ensureFirebaseAuth();
    await deleteDoc(doc(db, 'deliveries', id));
  } catch (error) {
    console.error('Error deleting delivery:', handleFirestoreError(error));
    throw error;
  }
}

// ----------------- EMPLOYEES -----------------
export function subscribeToEmployees(callback: (employees: EmployeeUser[]) => void) {
  return onSnapshot(collections.employees, (snapshot) => {
    if (!snapshot.empty) {
      const employees = snapshot.docs.map(d => d.data() as EmployeeUser);
      callback(employees);
    } else {
      callback(INITIAL_EMPLOYEES);
    }
  }, (error) => {
    console.error('Error subscribing to employees:', handleFirestoreError(error));
  });
}

export async function updateEmployee(employee: EmployeeUser) {
  try {
    await ensureFirebaseAuth();
    const colName = (employee.role === 'designer' || employee.role === 'admin' || employee.role === 'employee') 
      ? 'employees' 
      : 'users';
    await setDoc(doc(db, colName, employee.id), sanitizeData(employee), { merge: true });
  } catch (error) {
    console.error('Error updating employee:', handleFirestoreError(error));
    throw error;
  }
}

export async function changeEmployeeRole(employee: EmployeeUser, newRole: UserRole) {
  try {
    await ensureFirebaseAuth();
    
    // Determine collections based on old and new roles
    const oldColName = (employee.role === 'designer' || employee.role === 'admin' || employee.role === 'employee') 
      ? 'employees' 
      : 'users';
      
    const newColName = (newRole === 'designer' || newRole === 'admin' || newRole === 'employee') 
      ? 'employees' 
      : 'users';
      
    const updatedEmployee = { ...employee, role: newRole };
    
    // If collection changes, write to new and delete from old
    if (oldColName !== newColName) {
      await setDoc(doc(db, newColName, employee.id), sanitizeData(updatedEmployee), { merge: true });
      await deleteDoc(doc(db, oldColName, employee.id));
    } else {
      // Just update in the same collection
      await setDoc(doc(db, newColName, employee.id), sanitizeData(updatedEmployee), { merge: true });
    }
  } catch (error) {
    console.error('Error changing employee role:', handleFirestoreError(error));
    throw error;
  }
}

export async function toggleEmployeeStatus(id: string, status: 'active' | 'inactive', role: UserRole = 'employee') {
  try {
    await ensureFirebaseAuth();
    const colName = (role === 'designer' || role === 'admin' || role === 'employee') 
      ? 'employees' 
      : 'users';
    await setDoc(doc(db, colName, id), { status }, { merge: true });
  } catch (error) {
    console.error('Error toggling employee status:', handleFirestoreError(error));
    throw error;
  }
}

export async function updateEmployeePermissions(id: string, permissions: Partial<UserPermissions>, role: UserRole = 'employee') {
  try {
    await ensureFirebaseAuth();
    const colName = (role === 'designer' || role === 'admin' || role === 'employee') 
      ? 'employees' 
      : 'users';
    const empRef = doc(db, colName, id);
    
    // We update the permissions object inside the document
    await setDoc(empRef, { permissions }, { merge: true });
  } catch (error) {
    console.error('Error updating employee permissions:', handleFirestoreError(error));
    throw error;
  }
}

export async function toggleEmployeeGiftPermission(id: string, canUpload: boolean, role: UserRole = 'employee') {
  try {
    await ensureFirebaseAuth();
    const colName = (role === 'designer' || role === 'admin' || role === 'employee') 
      ? 'employees' 
      : 'users';
    const empRef = doc(db, colName, id);
    try {
      await updateDoc(empRef, {
        'permissions.giftUploadAndPublish': canUpload
      });
    } catch {
      await setDoc(empRef, { 
        permissions: { 
          giftUploadAndPublish: canUpload 
        } 
      }, { merge: true });
    }
  } catch (error) {
    console.error('Error toggling employee gift permission:', handleFirestoreError(error));
    throw error;
  }
}

export async function deleteEmployee(id: string, role: UserRole = 'employee') {
  try {
    await ensureFirebaseAuth();
    const colName = (role === 'designer' || role === 'admin' || role === 'employee') 
      ? 'employees' 
      : 'users';
    await deleteDoc(doc(db, colName, id));
  } catch (error) {
    console.error('Error deleting employee:', handleFirestoreError(error));
    throw error;
  }
}

// ----------------- USERS / BUYERS ACCOUNTS -----------------
export function subscribeToUsers(callback: (users: EmployeeUser[]) => void) {
  return onSnapshot(collections.users, (snapshot) => {
    if (!snapshot.empty) {
      const users = snapshot.docs.map(d => d.data() as EmployeeUser);
      callback(users);
    } else {
      callback([]);
    }
  }, (error) => {
    console.error('Error subscribing to users:', handleFirestoreError(error));
  });
}

export async function saveUserToDatabase(user: EmployeeUser) {
  try {
    await ensureFirebaseAuth();
    // Save to users collection, or employees if role is designer/admin/employee
    const colName = (user.role === 'designer' || user.role === 'admin' || user.role === 'employee') 
      ? 'employees' 
      : 'users';
    await setDoc(doc(db, colName, user.id), sanitizeData(user), { merge: true });
  } catch (error) {
    console.error('Error saving user to database:', handleFirestoreError(error));
    throw error;
  }
}

// ----------------- BANNERS -----------------
export function subscribeToBanners(callback: (banners: HeroBannerItem[]) => void) {
  return onSnapshot(collections.banners, (snapshot) => {
    let cloudBanners: HeroBannerItem[] = [];
    if (!snapshot.empty) {
      cloudBanners = snapshot.docs.map(d => d.data() as HeroBannerItem);
    }
    try {
      const localBanners = JSON.parse(localStorage.getItem('jiawei_custom_banners_v1') || '[]');
      const map = new Map<string, HeroBannerItem>();
      (cloudBanners.length > 0 ? cloudBanners : INITIAL_BANNERS).forEach(b => map.set(b.id, b));
      localBanners.forEach((b: HeroBannerItem) => {
        if (!map.has(b.id) || b.updatedAt) map.set(b.id, b);
      });
      callback(Array.from(map.values()));
      return;
    } catch(e) {}
    callback(cloudBanners.length > 0 ? cloudBanners : INITIAL_BANNERS);
  }, (error) => {
    console.error('Error subscribing to banners:', handleFirestoreError(error));
    try {
      const localBanners = JSON.parse(localStorage.getItem('jiawei_custom_banners_v1') || '[]');
      const map = new Map<string, HeroBannerItem>();
      INITIAL_BANNERS.forEach(b => map.set(b.id, b));
      localBanners.forEach((b: HeroBannerItem) => map.set(b.id, b));
      callback(Array.from(map.values()));
    } catch(e) {
      callback(INITIAL_BANNERS);
    }
  });
}

export async function saveBanner(banner: HeroBannerItem) {
  try {
    const localBanners = JSON.parse(localStorage.getItem('jiawei_custom_banners_v1') || '[]');
    const idx = localBanners.findIndex((b: HeroBannerItem) => b.id === banner.id);
    if (idx >= 0) localBanners[idx] = banner;
    else localBanners.unshift(banner);
    localStorage.setItem('jiawei_custom_banners_v1', JSON.stringify(localBanners));
  } catch(e) {}

  try {
    await ensureFirebaseAuth();
    await setDoc(doc(db, 'banners', banner.id), sanitizeData(banner));
  } catch (error) {
    console.error('Error saving banner to Firestore:', handleFirestoreError(error));
  }
}

export async function deleteBanner(id: string) {
  try {
    const localBanners = JSON.parse(localStorage.getItem('jiawei_custom_banners_v1') || '[]');
    const filtered = localBanners.filter((b: HeroBannerItem) => b.id !== id);
    localStorage.setItem('jiawei_custom_banners_v1', JSON.stringify(filtered));
  } catch(e) {}

  try {
    await ensureFirebaseAuth();
    await deleteDoc(doc(db, 'banners', id));
  } catch (error) {
    console.error('Error deleting banner from Firestore:', handleFirestoreError(error));
  }
}

// ----------------- CUSTOM CATEGORIES -----------------
export function subscribeToCategories(callback: (categories: CustomCategory[]) => void) {
  return onSnapshot(collections.categories, (snapshot) => {
    if (!snapshot.empty) {
      const cats = snapshot.docs.map(d => d.data() as CustomCategory);
      // Ensure 'general' exists and is at the beginning
      const generalIndex = cats.findIndex(c => c.id === 'general');
      if (generalIndex > 0) {
        const [gen] = cats.splice(generalIndex, 1);
        cats.unshift(gen);
      } else if (generalIndex === -1) {
        cats.unshift(INITIAL_CATEGORIES[0]);
      }
      callback(cats);
    } else {
      callback(INITIAL_CATEGORIES);
    }
  }, (error) => {
    console.error('Error subscribing to categories:', handleFirestoreError(error));
    callback(INITIAL_CATEGORIES);
  });
}

export async function saveCategory(category: CustomCategory) {
  try {
    await ensureFirebaseAuth();
    await setDoc(doc(db, 'categories', category.id), sanitizeData(category));
  } catch (error) {
    console.error('Error saving category:', handleFirestoreError(error));
    throw error;
  }
}

export async function deleteCategory(id: string) {
  if (id === 'general') {
    throw new Error('لا يمكن حذف القسم العام لأنه القسم الأساسي للنظام');
  }
  try {
    await ensureFirebaseAuth();
    await deleteDoc(doc(db, 'categories', id));
  } catch (error) {
    console.error('Error deleting category:', handleFirestoreError(error));
    throw error;
  }
}

// ----------------- SITE SETTINGS (NAME, LOGO & PHONE NUMBERS) -----------------
export function subscribeToSiteSettings(callback: (settings: SiteSettings) => void) {
  const settingsDocRef = doc(db, 'settings', 'general');
  return onSnapshot(settingsDocRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data() as SiteSettings;
      localStorage.setItem('jiawei_site_settings', JSON.stringify(data));
      callback(data);
    } else {
      const cached = localStorage.getItem('jiawei_site_settings');
      if (cached) {
        try {
          callback(JSON.parse(cached));
          return;
        } catch (e) {}
      }
      callback(DEFAULT_SITE_SETTINGS);
    }
  }, (error) => {
    console.error('Error subscribing to site settings:', handleFirestoreError(error));
    const cached = localStorage.getItem('jiawei_site_settings');
    if (cached) {
      try {
        callback(JSON.parse(cached));
        return;
      } catch (e) {}
    }
    callback(DEFAULT_SITE_SETTINGS);
  });
}

export async function saveSiteSettings(settings: SiteSettings): Promise<SiteSettings> {
  try {
    await ensureFirebaseAuth();
    const settingsDocRef = doc(db, 'settings', 'general');

    // Normalize and synchronize primary and secondary phone numbers
    const cleanSettings: SiteSettings = {
      ...settings,
      whatsapp: settings.primaryPhone || settings.whatsapp || '+923400700013',
      primaryPhone: settings.primaryPhone || settings.whatsapp || '+923400700013',
      secondaryWhatsapp: settings.secondaryPhone || settings.secondaryWhatsapp || '',
      secondaryPhone: settings.secondaryPhone || settings.secondaryWhatsapp || '',
      updatedAt: new Date().toISOString()
    };

    await setDoc(settingsDocRef, sanitizeData(cleanSettings), { merge: true });
    // Local storage backup for instantaneous initial paint and permanent offline cache
    localStorage.setItem('jiawei_site_settings', JSON.stringify(cleanSettings));
    return cleanSettings;
  } catch (error) {
    console.error('Error saving site settings:', handleFirestoreError(error));
    // Always persist to localStorage even if offline
    localStorage.setItem('jiawei_site_settings', JSON.stringify(settings));
    throw error;
  }
}

// ----------------- SAVED GIFT NAMES PRESETS (PERSISTENT IN FIRESTORE & LOCAL) -----------------
export function subscribeToSavedGiftNames(callback: (names: SavedGiftName[]) => void) {
  const namesDocRef = doc(db, 'settings', 'gift_names_presets');
  return onSnapshot(namesDocRef, (docSnap) => {
    if (docSnap.exists() && docSnap.data()?.names && Array.isArray(docSnap.data().names)) {
      const items = docSnap.data().names as SavedGiftName[];
      callback(items);
      try {
        localStorage.setItem('jiawei_saved_gift_names_v1', JSON.stringify(items));
      } catch (e) {}
    } else {
      const local = localStorage.getItem('jiawei_saved_gift_names_v1');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) {
            callback(parsed);
            return;
          }
        } catch (e) {}
      }
      callback(INITIAL_SAVED_GIFT_NAMES);
    }
  }, (error) => {
    console.error('Error subscribing to saved gift names:', handleFirestoreError(error));
    const local = localStorage.getItem('jiawei_saved_gift_names_v1');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          callback(parsed);
          return;
        }
      } catch (e) {}
    }
    callback(INITIAL_SAVED_GIFT_NAMES);
  });
}

export async function saveGiftNamesList(names: SavedGiftName[]) {
  try {
    // 1. Immediately cache locally
    localStorage.setItem('jiawei_saved_gift_names_v1', JSON.stringify(names));
    
    // 2. Persist in cloud Firestore
    await ensureFirebaseAuth();
    const namesDocRef = doc(db, 'settings', 'gift_names_presets');
    await setDoc(namesDocRef, {
      names: sanitizeData(names),
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    console.error('Error saving gift names list:', handleFirestoreError(error));
    // Still keep in localStorage even if cloud network hiccups
    localStorage.setItem('jiawei_saved_gift_names_v1', JSON.stringify(names));
    throw error;
  }
}

export async function addSavedGiftName(item: { title: string; titleAr?: string }): Promise<SavedGiftName> {
  const local = localStorage.getItem('jiawei_saved_gift_names_v1');
  let currentList: SavedGiftName[] = INITIAL_SAVED_GIFT_NAMES;
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) currentList = parsed;
    } catch (e) {}
  }

  // Check if already exists (case-insensitive)
  const existing = currentList.find(n => 
    (item.title && n.title.trim().toLowerCase() === item.title.trim().toLowerCase()) ||
    (item.titleAr && n.titleAr && n.titleAr.trim().toLowerCase() === item.titleAr.trim().toLowerCase())
  );

  if (existing) {
    // Update existing
    const updatedList = currentList.map(n => n.id === existing.id ? { ...n, title: item.title.trim() || n.title, titleAr: item.titleAr?.trim() || n.titleAr } : n);
    await saveGiftNamesList(updatedList);
    return { ...existing, title: item.title.trim() || existing.title, titleAr: item.titleAr?.trim() || existing.titleAr };
  }

  const newEntry: SavedGiftName = {
    id: `sgn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title: item.title.trim(),
    titleAr: item.titleAr?.trim() || '',
    createdAt: new Date().toISOString()
  };

  const updatedList = [newEntry, ...currentList];
  await saveGiftNamesList(updatedList);
  return newEntry;
}

export async function deleteSavedGiftName(id: string): Promise<void> {
  const local = localStorage.getItem('jiawei_saved_gift_names_v1');
  let currentList: SavedGiftName[] = INITIAL_SAVED_GIFT_NAMES;
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) currentList = parsed;
    } catch (e) {}
  }

  const updatedList = currentList.filter(n => n.id !== id);
  await saveGiftNamesList(updatedList);
}

// ==========================================
// ASSET LIBRARY & MEDIA OPTIMIZER FIRESTORE SERVICES
// ==========================================

export async function saveAssetToDb(asset: any): Promise<void> {
  try {
    await ensureFirebaseAuth();
    const docRef = doc(db, 'assets', asset.id);
    const sanitized = sanitizeData(asset);
    await setDoc(docRef, sanitized, { merge: true });
  } catch (error) {
    console.error('Error saving asset to Firestore:', handleFirestoreError(error));
    // Local fallback
    try {
      const localAssets = JSON.parse(localStorage.getItem('jiawei_assets_v1') || '[]');
      const idx = localAssets.findIndex((a: any) => a.id === asset.id || a.hash === asset.hash);
      if (idx >= 0) localAssets[idx] = asset;
      else localAssets.unshift(asset);
      localStorage.setItem('jiawei_assets_v1', JSON.stringify(localAssets));
    } catch (e) {}
  }
}

export async function addBatchGifts(giftsList: GiftItem[]): Promise<number> {
  try {
    await ensureFirebaseAuth();
    const promises = giftsList.map(gift => setDoc(doc(db, 'gifts', gift.id), sanitizeData(gift)));
    await Promise.all(promises);
    return giftsList.length;
  } catch (error) {
    console.error('Error batch adding gifts:', handleFirestoreError(error));
    throw error;
  }
}

export async function deleteAssetFromDb(assetId: string): Promise<void> {
  try {
    await ensureFirebaseAuth();
    await deleteDoc(doc(db, 'assets', assetId));
  } catch (error) {
    console.error('Error deleting asset from Firestore:', handleFirestoreError(error));
  }
  try {
    const localAssets = JSON.parse(localStorage.getItem('jiawei_assets_v1') || '[]');
    const filtered = localAssets.filter((a: any) => a.id !== assetId);
    localStorage.setItem('jiawei_assets_v1', JSON.stringify(filtered));
  } catch (e) {}
}

export async function deleteBatchAssetsFromDb(assetIds: string[]): Promise<void> {
  try {
    await ensureFirebaseAuth();
    const promises = assetIds.map(id => deleteDoc(doc(db, 'assets', id)));
    await Promise.all(promises);
  } catch (error) {
    console.error('Error deleting batch assets:', handleFirestoreError(error));
  }
  try {
    const localAssets = JSON.parse(localStorage.getItem('jiawei_assets_v1') || '[]');
    const idSet = new Set(assetIds);
    const filtered = localAssets.filter((a: any) => !idSet.has(a.id));
    localStorage.setItem('jiawei_assets_v1', JSON.stringify(filtered));
  } catch (e) {}
}

export async function deleteAllAssetsFromDb(): Promise<void> {
  try {
    await ensureFirebaseAuth();
    const snapshot = await getDocs(collections.assets);
    const promises: Promise<void>[] = [];
    snapshot.forEach(docSnap => {
      promises.push(deleteDoc(doc(db, 'assets', docSnap.id)));
    });
    await Promise.all(promises);
  } catch (error) {
    console.error('Error deleting all assets:', handleFirestoreError(error));
  }
  try {
    localStorage.removeItem('jiawei_assets_v1');
  } catch (e) {}
}

export async function updateBatchAssetsCategory(assetIds: string[], category: string): Promise<void> {
  try {
    await ensureFirebaseAuth();
    const promises = assetIds.map(id => updateDoc(doc(db, 'assets', id), { category }));
    await Promise.all(promises);
  } catch (error) {
    console.error('Error updating batch asset categories:', handleFirestoreError(error));
  }
  try {
    const localAssets = JSON.parse(localStorage.getItem('jiawei_assets_v1') || '[]');
    const idSet = new Set(assetIds);
    const updated = localAssets.map((a: any) => idSet.has(a.id) ? { ...a, category } : a);
    localStorage.setItem('jiawei_assets_v1', JSON.stringify(updated));
  } catch (e) {}
}

export function subscribeToAssets(callback: (assets: any[]) => void): () => void {
  try {
    return onSnapshot(collections.assets, (snapshot) => {
      const liveAssets: any[] = [];
      snapshot.forEach((d) => {
        liveAssets.push(d.data());
      });
      if (liveAssets.length > 0) {
        callback(liveAssets);
        localStorage.setItem('jiawei_assets_v1', JSON.stringify(liveAssets));
      } else {
        const local = localStorage.getItem('jiawei_assets_v1');
        if (local) {
          try {
            callback(JSON.parse(local));
          } catch (e) {}
        }
      }
    }, (error) => {
      console.warn('Assets snapshot error:', error);
      const local = localStorage.getItem('jiawei_assets_v1');
      if (local) {
        try {
          callback(JSON.parse(local));
        } catch (e) {}
      }
    });
  } catch (e) {
    const local = localStorage.getItem('jiawei_assets_v1');
    if (local) {
      try {
        callback(JSON.parse(local));
      } catch (err) {}
    }
    return () => {};
  }
}

export async function saveOptimizerSettings(settings: any): Promise<void> {
  try {
    await ensureFirebaseAuth();
    const docRef = doc(db, 'settings', 'optimizer_config');
    await setDoc(docRef, { ...settings, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    console.warn('Error saving optimizer settings:', error);
  }
  localStorage.setItem('jiawei_optimizer_settings_v1', JSON.stringify(settings));
}

export function subscribeToOptimizerSettings(callback: (settings: any) => void): () => void {
  try {
    const docRef = doc(db, 'settings', 'optimizer_config');
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        callback(snap.data());
      } else {
        const local = localStorage.getItem('jiawei_optimizer_settings_v1');
        if (local) {
          try {
            callback(JSON.parse(local));
          } catch (e) {}
        }
      }
    }, (err) => {
      const local = localStorage.getItem('jiawei_optimizer_settings_v1');
      if (local) {
        try {
          callback(JSON.parse(local));
        } catch (e) {}
      }
    });
  } catch (e) {
    const local = localStorage.getItem('jiawei_optimizer_settings_v1');
    if (local) {
      try {
        callback(JSON.parse(local));
      } catch (err) {}
    }
    return () => {};
  }
}



