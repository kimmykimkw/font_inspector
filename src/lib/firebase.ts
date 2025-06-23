import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';
import * as path from 'path';

// Check if the Firebase app has already been initialized
const apps = getApps();

// Initialize Firebase if it hasn't been initialized yet
if (!apps.length) {
  try {
    let serviceAccount;
    
    // First try to get service account from environment variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.log('Using Firebase service account from environment variable');
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } 
    // If not available, try to load from file
    else {
      try {
        const serviceAccountPath = path.resolve(process.cwd(), 'firebase-service-account.json');
        console.log('Looking for Firebase service account at:', serviceAccountPath);
        
        if (fs.existsSync(serviceAccountPath)) {
          console.log('Using Firebase service account from file');
          const rawdata = fs.readFileSync(serviceAccountPath, 'utf8');
          serviceAccount = JSON.parse(rawdata);
        } else {
          console.warn('Firebase service account file not found');
        }
      } catch (fileError) {
        console.error('Error reading Firebase service account file:', fileError);
      }
    }
    
    // Initialize Firebase with service account if available
    if (serviceAccount) {
      initializeApp({
        credential: cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL || `https://${serviceAccount.project_id}.firebaseio.com`,
      });
      console.log('Firebase initialized with service account credentials');
    } else {
      // Initialize with default credentials (useful for local development)
      initializeApp();
      console.warn('Firebase initialized without service account credentials - this may not work as expected');
    }
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    throw new Error(`Firebase initialization failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Export Firestore for database operations
export const db = getFirestore();

// Export Firebase Auth for authentication operations
export const auth = getAuth();

// Export Firebase collections
export const collections = {
  inspections: db.collection('inspections'),
  projects: db.collection('projects'),
  users: db.collection('users'),
  // Admin system collections
  user_invitations: db.collection('user_invitations'),
  admin_users: db.collection('admin_users'),
  user_stats: db.collection('user_stats'),
  user_permissions: db.collection('user_permissions')
}; 