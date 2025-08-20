'use client';

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { 
  User,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { firestoreDb, auth } from '@/lib/firebase-client';
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { updateUserStats } from '@/lib/user-stats';
import { getCurrentAppVersion } from '@/lib/version';

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
  authProvider: 'google' | 'email_password';
  createdAt?: any;
  lastLoginAt?: any;
  appVersion?: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
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

  // Migrate user permissions from email-based to UID-based
  const migrateUserPermissions = async (userId: string, email: string) => {
    if (!firestoreDb) return;

    try {
      const permissionsRef = collection(firestoreDb, 'user_permissions');
      
      // First check if UID-based permissions already exist
      const uidQuery = query(permissionsRef, where('userId', '==', userId));
      const uidSnapshot = await getDocs(uidQuery);
      
      if (!uidSnapshot.empty) {
        // UID-based permissions already exist, but check if we need to refresh limits
        const existingPermission = uidSnapshot.docs[0];
        const permissionData = existingPermission.data();
        
        // Check if limits look outdated (less than admin-configured limits)
        if (permissionData.maxInspectionsPerMonth < 1000 || permissionData.maxProjectsPerMonth < 100) {
          console.log(`Refreshing outdated limits for user ${userId}: ${permissionData.maxInspectionsPerMonth}/${permissionData.maxProjectsPerMonth}`);
          
          try {
            const defaultLimitsResponse = await fetch('/api/admin/settings', {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' }
            });
            
            if (defaultLimitsResponse.ok) {
              const defaultLimits = await defaultLimitsResponse.json();
              
              await updateDoc(existingPermission.ref, {
                maxInspectionsPerMonth: defaultLimits.defaultMaxInspectionsPerMonth,
                maxProjectsPerMonth: defaultLimits.defaultMaxProjectsPerMonth,
                updatedAt: serverTimestamp()
              });
              
              console.log(`Updated user limits to ${defaultLimits.defaultMaxInspectionsPerMonth}/${defaultLimits.defaultMaxProjectsPerMonth}`);
            }
          } catch (error) {
            console.error('Error refreshing user limits:', error);
          }
        }
        
        return; // No email-to-UID migration needed
      }
      
      // Find existing user permissions by email
      const emailQuery = query(permissionsRef, where('userId', '==', email.toLowerCase()));
      const emailSnapshot = await getDocs(emailQuery);

      if (!emailSnapshot.empty) {
        // Update the first matching document to use the actual UID and refresh limits
        const permissionDoc = emailSnapshot.docs[0];
        
        // Get current admin-configured default limits
        try {
          const defaultLimitsResponse = await fetch('/api/admin/settings', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (defaultLimitsResponse.ok) {
            const defaultLimits = await defaultLimitsResponse.json();
            
            await updateDoc(permissionDoc.ref, {
              userId: userId, // Update from email to actual Firebase Auth UID
              maxInspectionsPerMonth: defaultLimits.defaultMaxInspectionsPerMonth,
              maxProjectsPerMonth: defaultLimits.defaultMaxProjectsPerMonth,
              updatedAt: serverTimestamp()
            });
            
            console.log(`Migrated user permissions from email (${email}) to UID (${userId}) and updated limits to ${defaultLimits.defaultMaxInspectionsPerMonth}/${defaultLimits.defaultMaxProjectsPerMonth}`);
          } else {
            // Fallback: just migrate the userId without updating limits
            await updateDoc(permissionDoc.ref, {
              userId: userId,
              updatedAt: serverTimestamp()
            });
            
            console.log(`Migrated user permissions from email (${email}) to UID (${userId}) - could not refresh limits`);
          }
        } catch (limitError) {
          console.error('Error fetching admin settings during migration:', limitError);
          
          // Fallback: just migrate the userId without updating limits
          await updateDoc(permissionDoc.ref, {
            userId: userId,
            updatedAt: serverTimestamp()
          });
          
          console.log(`Migrated user permissions from email (${email}) to UID (${userId}) - could not refresh limits`);
        }
      }
    } catch (error) {
      console.error('Error migrating user permissions:', error);
      // Don't throw - this shouldn't block user login
    }
  };

  // Create or update user profile in Firestore
  const createUserProfile = async (user: User, authProvider: 'google' | 'email_password' = 'google') => {
    if (!firestoreDb) return null;

    try {
      // First check if user is authorized to use the app
      if (user.email) {
        const isAuthorized = await checkUserAuthorization(user.email, user.uid);
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
        authProvider,
        lastLoginAt: serverTimestamp(),
        appVersion: getCurrentAppVersion(),
      };

      if (!userSnap.exists()) {
        // Create new user profile
        await setDoc(userRef, {
          ...profileData,
          createdAt: serverTimestamp(),
        });
      } else {
        // Update last login time and app version
        await setDoc(userRef, {
          lastLoginAt: serverTimestamp(),
          appVersion: getCurrentAppVersion(),
        }, { merge: true });
      }

      // Migrate user permissions from email-based to UID-based (run on every login)
      if (user.email) {
        await migrateUserPermissions(user.uid, user.email);
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
  const checkUserAuthorization = async (email: string, userId?: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/check-authorization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, userId }),
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

  // Sign in with Email/Password
  const signInWithEmail = async (email: string, password: string) => {
    if (!auth) {
      throw new Error('Auth not initialized');
    }
    
    try {
      setLoading(true);
      console.log('Attempting email/password sign-in...');
      
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log('Email sign-in successful');
      await createUserProfile(result.user, 'email_password');
      
    } catch (error: any) {
      // Check if user is not authorized first (don't log this)
      if (error.message === 'UNAUTHORIZED_USER') {
        throw new Error('Your account does not have access to Font Inspector. Please contact an administrator.');
      }
      
      console.error('Email sign-in failed:', error);
      
      // Handle Firebase auth errors
      if (error.code === 'auth/user-not-found') {
        throw new Error('No account found with this email address.');
      } else if (error.code === 'auth/wrong-password') {
        throw new Error('Incorrect password. Please try again.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Invalid email address.');
      } else if (error.code === 'auth/user-disabled') {
        throw new Error('This account has been disabled.');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many failed attempts. Please try again later.');
      } else {
        throw new Error('Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Reset password
  const resetPassword = async (email: string) => {
    if (!auth) {
      throw new Error('Auth not initialized');
    }
    
    try {
      await sendPasswordResetEmail(auth, email);
      console.log('Password reset email sent');
    } catch (error: any) {
      console.error('Password reset failed:', error);
      
      if (error.code === 'auth/user-not-found') {
        throw new Error('No account found with this email address.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Invalid email address.');
      } else {
        throw new Error('Failed to send password reset email. Please try again.');
      }
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
    signInWithEmail,
    resetPassword,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
} 