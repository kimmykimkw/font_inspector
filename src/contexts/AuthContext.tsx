'use client';

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { 
  User,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider
} from 'firebase/auth';
import { firestoreDb, auth } from '@/lib/firebase-client';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { userActionLogger } from '@/lib/activity-logger';
import { updateUserStats } from '@/lib/user-stats';

// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider();

// Configure for better Electron compatibility
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// User profile interface
export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt?: any;
  lastLoginAt?: any;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Create or update user profile in Firestore
  const createUserProfile = async (user: User) => {
    if (!firestoreDb) return null;

    try {
      // First check if user is authorized to use the app
      if (user.email) {
        const isAuthorized = await checkUserAuthorization(user.email);
        if (!isAuthorized) {
          // Sign out the user silently
          await signOut(auth!);
          throw new Error('UNAUTHORIZED_USER');
        }
      }

      const userRef = doc(firestoreDb, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      const profileData: UserProfile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        lastLoginAt: serverTimestamp(),
      };

      if (!userSnap.exists()) {
        // Create new user profile
        await setDoc(userRef, {
          ...profileData,
          createdAt: serverTimestamp(),
        });
      } else {
        // Update last login time
        await setDoc(userRef, {
          lastLoginAt: serverTimestamp(),
        }, { merge: true });
      }

      // Update user stats
      await updateUserStats(user.uid, user.email || '', user.displayName || '');

      setUserProfile(profileData);
      return profileData;
    } catch (error) {
      if (error instanceof Error && error.message === 'UNAUTHORIZED_USER') {
        // Don't log authorization errors - they're expected
        throw error;
      }
      console.error('Error creating user profile:', error);
      return null;
    }
  };

  // Check if user is authorized to use the app
  const checkUserAuthorization = async (email: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/check-authorization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.authorized === true;
    } catch (error) {
      console.error('Error checking user authorization:', error);
      return false;
    }
  };

  // Sign in with Google - with popup cancellation support
  const signInWithGoogle = async () => {
    if (!auth) {
      throw new Error('Auth not initialized');
    }
    
    try {
      setLoading(true);
      console.log('Attempting Google sign-in with popup...');
      
      // First try popup authentication
      const result = await signInWithPopup(auth, googleProvider);
      console.log('Popup sign-in successful');
      await createUserProfile(result.user);
      
    } catch (error: any) {
      // Check if user is not authorized first (don't log this)
      if (error.message === 'UNAUTHORIZED_USER') {
        throw new Error('Your account does not have access to Font Inspector. Please request access or contact an administrator.');
      }
      
      console.error('Popup sign-in failed:', error);
      
      // Check if it's a popup blocked or cancelled error
      if (error.code === 'auth/popup-blocked' || 
          error.code === 'auth/cancelled-popup-request' ||
          error.code === 'auth/popup-closed-by-user' ||
          error.message?.includes('popup') ||
          error.message?.includes('blocked')) {
        
        console.log('Popup issue detected, falling back to redirect authentication...');
        
        try {
          // Fall back to redirect authentication
          await signInWithRedirect(auth, googleProvider);
          // Note: The redirect will handle the rest, so we don't need to do anything else here
          // The user will be redirected away from the current page
        } catch (redirectError) {
          // Check for authorization error in redirect flow first
          if (redirectError instanceof Error && redirectError.message === 'UNAUTHORIZED_USER') {
            throw new Error('Your account does not have access to Font Inspector. Please request access or contact an administrator.');
          }
          
          console.error('Redirect sign-in also failed:', redirectError);
          throw new Error('Authentication failed. Please try refreshing the page and trying again.');
        }
      } else {
        // Re-throw other errors
        throw error;
      }
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const logout = async () => {
    if (!auth) {
      throw new Error('Auth not initialized');
    }
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
      // Redirect to homepage after logout
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  // Check for redirect result on component mount
  useEffect(() => {
    const checkRedirectResult = async () => {
      if (!auth) return;
      
      try {
        console.log('Checking for redirect result...');
        const result = await getRedirectResult(auth);
        if (result) {
          console.log('Redirect sign-in successful');
          await createUserProfile(result.user);
        }
      } catch (error) {
        console.error('Error processing redirect result:', error);
        
        // If it's an authorization error, handle silently
        if (error instanceof Error && error.message === 'UNAUTHORIZED_USER') {
          // The user will be signed out by createUserProfile, so they'll see the login page
          // Don't log this as it's an expected authorization failure
        }
      }
    };

    checkRedirectResult();
  }, []);

  // Listen for authentication state changes
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        // TEMPORARY: Log UID for admin setup
        console.log('🔑 YOUR FIREBASE UID FOR ADMIN SETUP:', user.uid);
        console.log('📧 Your email:', user.email);
        console.log('👤 Your display name:', user.displayName);
        console.log('Copy the UID above and paste it into the admin setup script!');
        
        try {
          await createUserProfile(user);
        } catch (error) {
          // If authorization fails, the user will be signed out by createUserProfile
          if (error instanceof Error && error.message === 'UNAUTHORIZED_USER') {
            // User is not authorized - silently handle this case
            setUser(null);
            setUserProfile(null);
          }
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = {
    user,
    userProfile,
    loading,
    signInWithGoogle,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
} 