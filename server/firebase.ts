import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  addDoc,
  deleteDoc,
  setLogLevel 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import config from '../firebase-applet-config.json';

// Suppress raw gRPC console spam when offline or database not yet provisioned
try {
  setLogLevel('silent');
} catch {
  // ignore
}

const app = getApps().length > 0 ? getApp() : initializeApp(config);
export const db = (config as { firestoreDatabaseId?: string }).firestoreDatabaseId
  ? getFirestore(app, (config as { firestoreDatabaseId?: string }).firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);

let firestoreAvailable: boolean | null = null;
let lastCheckTime = 0;
const CHECK_INTERVAL_MS = 60000; // 1 minute retry interval

export async function isFirestoreOnline(): Promise<boolean> {
  const now = Date.now();
  if (firestoreAvailable !== null && (now - lastCheckTime < CHECK_INTERVAL_MS)) {
    return firestoreAvailable;
  }
  lastCheckTime = now;
  try {
    const checkRef = doc(db, 'system_config', 'health_check');
    await getDoc(checkRef);
    firestoreAvailable = true;
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('NOT_FOUND') || msg.includes('offline') || msg.includes('unavailable')) {
      firestoreAvailable = false;
      return false;
    }
    firestoreAvailable = true;
    return true;
  }
}

export function getFirestoreStatus() {
  const dbId = (config as { firestoreDatabaseId?: string }).firestoreDatabaseId || '(default)';
  return {
    isAvailable: firestoreAvailable ?? true,
    projectId: config.projectId,
    databaseId: dbId,
    instructions: `Connected to Cloud Firestore (Database: ${dbId})`
  };
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errStr = error instanceof Error ? error.message : String(error);
  if (errStr.includes('NOT_FOUND') || errStr.includes('offline')) {
    firestoreAvailable = false;
  }
  const errInfo: FirestoreErrorInfo = {
    error: errStr,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
    },
    operationType,
    path,
  };
  return errInfo;
}

// User Balance in Firestore
export async function getFirebaseUserBalance(userId: string, defaultBalance: number = 0): Promise<number> {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    return defaultBalance;
  }
  const cleanId = userId.trim();

  const online = await isFirestoreOnline();
  if (!online) {
    return defaultBalance;
  }

  const userDocRef = doc(db, 'users', cleanId);
  try {
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      return typeof data.balance === 'number' ? data.balance : defaultBalance;
    } else {
      // Initialize new user in Firestore
      await setDoc(userDocRef, {
        userId: cleanId,
        balance: defaultBalance,
        displayName: `Player_${cleanId.slice(-4)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return defaultBalance;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${cleanId}`);
    return defaultBalance;
  }
}

export async function setFirebaseUserBalance(userId: string, newBalance: number, displayName?: string) {
  if (!userId || typeof userId !== 'string' || !userId.trim()) return;
  const cleanId = userId.trim();

  const online = await isFirestoreOnline();
  if (!online) return;

  const userDocRef = doc(db, 'users', cleanId);
  try {
    await setDoc(userDocRef, {
      userId: cleanId,
      balance: newBalance,
      ...(displayName ? { displayName } : {}),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${cleanId}`);
  }
}

// Fetch all registered users for Admin Dashboard
export async function getAllFirebaseUsers(): Promise<any[]> {
  const online = await isFirestoreOnline();
  if (!online) return [];

  try {
    const usersCol = collection(db, 'users');
    const snapshot = await getDocs(usersCol);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'users');
    return [];
  }
}

// Delete user profile from Firestore
export async function deleteFirebaseUser(userId: string): Promise<boolean> {
  if (!userId || typeof userId !== 'string' || !userId.trim()) return false;
  const cleanId = userId.trim();

  const online = await isFirestoreOnline();
  if (!online) return false;

  const userDocRef = doc(db, 'users', cleanId);
  try {
    await deleteDoc(userDocRef);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${cleanId}`);
    return false;
  }
}

// Upsert complete user profile (email, customId, role, balance)
export async function upsertFirebaseUserProfile(userId: string, profileData: any) {
  if (!userId || typeof userId !== 'string' || !userId.trim()) return;
  const cleanId = userId.trim();

  const online = await isFirestoreOnline();
  if (!online) return;

  const userDocRef = doc(db, 'users', cleanId);
  try {
    await setDoc(userDocRef, {
      userId: cleanId,
      ...profileData,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${cleanId}`);
  }
}

// Save game round history directly to Firestore
export async function saveFirebaseRoundHistory(historyEntry: any) {
  const online = await isFirestoreOnline();
  if (!online) return;

  try {
    const historyCol = collection(db, 'game_history');
    await addDoc(historyCol, {
      ...historyEntry,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'game_history');
  }
}

// Fetch historical game rounds from Firestore
export async function getFirebaseGameHistory(limitCount: number = 50): Promise<any[]> {
  const online = await isFirestoreOnline();
  if (!online) return [];

  try {
    const historyCol = collection(db, 'game_history');
    const q = query(historyCol, orderBy('timestamp', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'game_history');
    return [];
  }
}

// Save transaction record to Firestore
export async function saveFirebaseTransaction(tx: any) {
  const online = await isFirestoreOnline();
  if (!online) return;

  try {
    const txCol = collection(db, 'transactions');
    await addDoc(txCol, {
      ...tx,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'transactions');
  }
}

// System settings
export async function getFirebaseAdminConfig(): Promise<any | null> {
  const online = await isFirestoreOnline();
  if (!online) return null;

  try {
    const configDoc = doc(db, 'system_config', 'main');
    const snap = await getDoc(configDoc);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'system_config/main');
    return null;
  }
}

export async function setFirebaseAdminConfig(newConfig: any) {
  const online = await isFirestoreOnline();
  if (!online) return;

  try {
    const configDoc = doc(db, 'system_config', 'main');
    await setDoc(configDoc, {
      ...newConfig,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'system_config/main');
  }
}

// Withdrawal requests persistence
export async function saveFirebaseWithdrawal(withdrawal: any) {
  const online = await isFirestoreOnline();
  if (!online) return;

  try {
    const wDoc = doc(db, 'withdrawals', withdrawal.id);
    await setDoc(wDoc, {
      ...withdrawal,
      createdAt: withdrawal.createdAt || new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `withdrawals/${withdrawal.id}`);
  }
}

export async function getFirebaseWithdrawals(): Promise<any[]> {
  const online = await isFirestoreOnline();
  if (!online) return [];

  try {
    const wCol = collection(db, 'withdrawals');
    const snapshot = await getDocs(wCol);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'withdrawals');
    return [];
  }
}

export async function updateFirebaseWithdrawal(id: string, updateData: any) {
  const online = await isFirestoreOnline();
  if (!online) return;

  try {
    const wDoc = doc(db, 'withdrawals', id);
    await setDoc(wDoc, {
      ...updateData,
      reviewedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `withdrawals/${id}`);
  }
}

// Chat Messages persistence
export async function saveFirebaseChatMessage(chatMsg: any) {
  const online = await isFirestoreOnline();
  if (!online) return;

  try {
    const cDoc = doc(db, 'chat_messages', chatMsg.id);
    await setDoc(cDoc, {
      ...chatMsg,
      savedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `chat_messages/${chatMsg.id}`);
  }
}

export async function getFirebaseChatMessages(limitCount = 1000): Promise<any[]> {
  const online = await isFirestoreOnline();
  if (!online) return [];

  try {
    const cCol = collection(db, 'chat_messages');
    const q = query(cCol, orderBy('timestamp', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    const messages = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    return messages.reverse(); // Return oldest to newest to display correctly
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'chat_messages');
    return [];
  }
}

export async function clearFirebaseChatMessages() {
  const online = await isFirestoreOnline();
  if (!online) return;

  try {
    const cCol = collection(db, 'chat_messages');
    const snapshot = await getDocs(cCol);
    for (const d of snapshot.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'chat_messages');
  }
}
