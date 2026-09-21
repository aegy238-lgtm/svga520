import { db } from '../lib/firebase';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

export interface RandomUserAccount {
  id: string;
  uid: string;
  numericId: string;
  displayName: string;
  email: string;
  password: string;
  plainPassword: string;
  diamonds: number;
  role: 'user' | 'admin';
  isVIP: boolean;
  status: 'active' | 'banned';
  photoURL: string;
  createdAt: any;
  createdAtStr: string;
}

/**
 * Generate a random user account, persist it in Firestore `users` collection,
 * and return the created account details.
 */
export async function createRandomUserAccount(options: {
  role?: 'user' | 'admin';
  initialDiamonds?: number;
  isVIP?: boolean;
  customPrefix?: string;
} = {}): Promise<RandomUserAccount> {
  const role = options.role || 'user';
  const initialDiamonds = options.initialDiamonds !== undefined ? options.initialDiamonds : 10000;
  const isVIP = options.isVIP !== undefined ? options.isVIP : true;

  // Generate random numeric ID (7 digits)
  const numericId = Math.floor(1000000 + Math.random() * 9000000).toString();

  // Generate random letters/numbers suffix
  const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
  const userId = `user_random_${Date.now()}_${randomSuffix}`;

  // Generate random username
  const firstNames = ['أمير', 'ملك', 'صقر', 'فارس', 'شبح', 'سلطان', 'نجم', 'كابتن', 'الأسد', 'رويال'];
  const randomName = `${firstNames[Math.floor(Math.random() * firstNames.length)]} الملكي #${randomSuffix}`;

  // Generate email & password
  const cleanPrefix = (options.customPrefix || 'royal_user').toLowerCase().replace(/[^\w]/g, '');
  const email = `${cleanPrefix}_${numericId}@royalcache.app`;
  
  // Generate strong random password
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let password = 'Royal#';
  for (let i = 0; i < 6; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  // Generate avatar URL using Dicebear
  const photoURL = `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`;

  const now = Timestamp.now();
  const accountData: RandomUserAccount = {
    id: userId,
    uid: userId,
    numericId,
    displayName: randomName,
    email,
    password,
    plainPassword: password,
    diamonds: initialDiamonds,
    role,
    isVIP,
    status: 'active',
    photoURL,
    createdAt: now,
    createdAtStr: new Date().toISOString()
  };

  // Write to Firestore database
  if (db) {
    await setDoc(doc(db, 'users', userId), {
      ...accountData,
      createdAt: now
    });
  }

  return accountData;
}
