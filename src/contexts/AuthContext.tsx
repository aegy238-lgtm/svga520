
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, updateDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserRecord } from '../types';
import { getActiveClientVersion, DEFAULT_ALLOWED_VERSION } from '../utils/versionControl';

// Helper to get or generate device ID
const getDeviceId = () => {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('deviceId', id);
  }
  return id;
};

// Helper to get client IP
const getClientIp = async () => {
  try {
    const res = await fetch('/api/ip');
    const data = await res.json();
    return data.ip;
  } catch (e) {
    console.warn("Could not fetch IP:", e);
    return 'unknown';
  }
};

interface AuthContextType {
  currentUser: UserRecord | null;
  user: UserRecord | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string, name?: string) => Promise<void>;
  signupWithEmail: (email: string, pass: string, name?: string) => Promise<void>;
  updateUserProfile: (dataOrName: Partial<UserRecord> | string, photoURL?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;
    let isMounted = true;

    // Safety timeout to guarantee loading is never stuck
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 2500);

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          // Set up real-time listener for user document
          const userDocRef = doc(db, 'users', user.uid);
          
          try {
            // Initial fetch to ensure we have data before setting loading to false
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
              const userData = userDoc.data() as UserRecord;
              if (isMounted) setCurrentUser({ ...userData, id: user.uid });
            } else {
              // Create user record if it doesn't exist
              const deviceId = getDeviceId();
              const lastIp = await getClientIp();
              const isAdmin = user.email === 'uhbijnokmpl098900@gmail.com';
              
              let defaultFreeAttempts = 5;
              let defaultAllowedVer = DEFAULT_ALLOWED_VERSION;
              try {
                const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
                if (settingsDoc.exists()) {
                  const sData = settingsDoc.data();
                  if (sData.defaultFreeAttempts !== undefined) defaultFreeAttempts = sData.defaultFreeAttempts;
                  if (sData.defaultAllowedVersion) defaultAllowedVer = sData.defaultAllowedVersion;
                }
              } catch (err) {
                console.warn("Could not fetch default settings:", err);
              }
              
              const newUser: UserRecord = {
                id: user.uid,
                name: user.displayName || user.email?.split('@')[0] || 'User',
                email: user.email || undefined,
                role: isAdmin ? 'admin' : 'user',
                isApproved: true,
                isVIP: isAdmin,
                status: 'active',
                subscriptionType: isAdmin ? 'year' : 'none',
                freeAttempts: isAdmin ? 999999 : defaultFreeAttempts,
                coins: isAdmin ? 999999 : 0,
                subscriptionExpiry: isAdmin ? Timestamp.fromDate(new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)) : null,
                createdAt: Timestamp.now(),
                lastLogin: Timestamp.now(),
                deviceId,
                lastIp,
                hasSvgaExAccess: isAdmin,
                allowedVersion: defaultAllowedVer,
                lastUsedVersion: getActiveClientVersion()
              };
              await setDoc(userDocRef, newUser);
              if (isMounted) setCurrentUser(newUser);
            }
          } catch (e: any) {
            console.warn("Initial user fetch failed, using fallback:", e);
            const isAdmin = user.email === 'uhbijnokmpl098900@gmail.com';
            if (isMounted) {
              setCurrentUser({
                id: user.uid,
                name: user.displayName || user.email?.split('@')[0] || 'User',
                email: user.email || undefined,
                role: isAdmin ? 'admin' : 'user',
                isApproved: true,
                isVIP: isAdmin,
                status: 'active',
                subscriptionType: isAdmin ? 'year' : 'none',
                freeAttempts: isAdmin ? 999999 : 5,
                coins: isAdmin ? 999999 : 0,
                subscriptionExpiry: null,
                createdAt: Timestamp.now(),
                lastLogin: Timestamp.now(),
                deviceId: getDeviceId(),
                lastIp: 'local',
                hasSvgaExAccess: isAdmin
              });
            }
          }

          // Start real-time listener with error safety
          try {
            unsubscribeUser = onSnapshot(userDocRef, (doc) => {
              if (doc.exists() && isMounted) {
                setCurrentUser({ ...doc.data() as UserRecord, id: user.uid });
              }
            }, (error) => {
              console.warn("User onSnapshot error:", error);
            });
          } catch (e) {
            console.warn("Failed to attach user snapshot listener:", e);
          }

        } else {
          if (isMounted) setCurrentUser(null);
          if (unsubscribeUser) {
            unsubscribeUser();
            unsubscribeUser = null;
          }
        }
      } catch (err) {
        console.error("Auth state handler error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, []);

  const login = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signup = async (email: string, pass: string, name: string = '') => {
    // Check if registration is open
    const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
    let defaultFreeAttempts = 5;
    let defaultAllowedVer = DEFAULT_ALLOWED_VERSION;
    if (settingsDoc.exists()) {
      const settings = settingsDoc.data();
      if (settings.isRegistrationOpen === false) {
        throw new Error('التسجيل مغلق حالياً من قبل الإدارة');
      }
      if (settings.defaultFreeAttempts !== undefined) {
        defaultFreeAttempts = settings.defaultFreeAttempts;
      }
      if (settings.defaultAllowedVersion) {
        defaultAllowedVer = settings.defaultAllowedVersion;
      }
    }

    const { user } = await createUserWithEmailAndPassword(auth, email, pass);
    const deviceId = getDeviceId();
    const lastIp = await getClientIp();
    const isAdmin = email === 'uhbijnokmpl098900@gmail.com';
    const userName = name || email.split('@')[0] || 'User';

    const newUser: UserRecord = {
      id: user.uid,
      name: userName,
      email,
      role: isAdmin ? 'admin' : 'user',
      isApproved: true,
      isVIP: isAdmin,
      status: 'active',
      subscriptionType: isAdmin ? 'year' : 'none',
      freeAttempts: isAdmin ? 999999 : defaultFreeAttempts,
      coins: isAdmin ? 999999 : 0,
      subscriptionExpiry: isAdmin ? Timestamp.fromDate(new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)) : null,
      createdAt: Timestamp.now(),
      lastLogin: Timestamp.now(),
      deviceId,
      lastIp,
      hasSvgaExAccess: isAdmin,
      allowedVersion: defaultAllowedVer,
      lastUsedVersion: getActiveClientVersion()
    };

    await setDoc(doc(db, 'users', user.uid), newUser);
    if (userName) {
      await updateProfile(user, { displayName: userName });
    }
    setCurrentUser(newUser);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const refreshUser = async () => {
    if (auth.currentUser) {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        setCurrentUser({ ...userDoc.data() as UserRecord, id: auth.currentUser.uid });
      }
    }
  };

  const updateUserProfile = async (dataOrName: Partial<UserRecord> | string, photoURL?: string) => {
    if (auth.currentUser) {
      if (typeof dataOrName === 'string') {
        const displayName = dataOrName;
        const updates: any = {};
        if (displayName) updates.displayName = displayName;
        if (photoURL) updates.photoURL = photoURL;
        await updateProfile(auth.currentUser, updates);
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          ...(displayName ? { name: displayName, displayName } : {}),
          ...(photoURL ? { photoURL, avatar: photoURL } : {})
        });
      } else {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), dataOrName);
      }
      await refreshUser();
    }
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      user: currentUser,
      loading,
      login,
      loginWithEmail: login,
      signup,
      signupWithEmail: signup,
      updateUserProfile,
      logout,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};
