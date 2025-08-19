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
        // In packaged Electron app, resources are in different locations
        let serviceAccountPath;
        const possiblePaths = [];
        
        if (process.env.NODE_ENV === 'production') {
          // Try multiple locations for production
          if (process.resourcesPath) {
            possiblePaths.push(path.join(process.resourcesPath, 'app.asar', 'firebase-service-account.json'));
            possiblePaths.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'firebase-service-account.json'));
            possiblePaths.push(path.join(process.resourcesPath, 'firebase-service-account.json'));
          }
          
          // Also try app path and current working directory
          try {
            const { app } = require('electron');
            if (app) {
              possiblePaths.push(path.join(app.getAppPath(), 'firebase-service-account.json'));
            }
          } catch (e) {
            // Electron not available, skip
          }
          
          possiblePaths.push(path.resolve(process.cwd(), 'firebase-service-account.json'));
          possiblePaths.push(path.resolve(__dirname, '..', '..', 'firebase-service-account.json'));
          possiblePaths.push(path.resolve(__dirname, '..', '..', '..', 'firebase-service-account.json'));
        } else {
          // Development mode - use current working directory
          possiblePaths.push(path.resolve(process.cwd(), 'firebase-service-account.json'));
        }
        
        // Try each path until we find the file
        serviceAccountPath = possiblePaths.find(p => fs.existsSync(p));
        
        console.log('Looking for Firebase service account. Tried paths:', possiblePaths);
        console.log('Found Firebase service account at:', serviceAccountPath || 'not found');
        
        if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
          console.log('Using Firebase service account from file');
          const rawdata = fs.readFileSync(serviceAccountPath, 'utf8');
          serviceAccount = JSON.parse(rawdata);
        } else {
          console.warn('Firebase service account file not found in any of the tried locations');
          
          // Additional debug info for production
          if (process.env.NODE_ENV === 'production') {
            console.log('process.resourcesPath:', process.resourcesPath);
            console.log('process.cwd():', process.cwd());
            console.log('__dirname:', __dirname);
            
            // Try to list files in resource directory
            if (process.resourcesPath && fs.existsSync(process.resourcesPath)) {
              try {
                const files = fs.readdirSync(process.resourcesPath);
                console.log('Files in resourcesPath:', files);
              } catch (e) {
                console.log('Could not list resource files:', e);
              }
            }
          }
        }
      } catch (fileError) {
        console.error('Error reading Firebase service account file:', fileError);
      }
    }
    
    // Initialize Firebase with service account if available
    if (serviceAccount) {
      const firebaseConfig = {
        credential: cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL || `https://${serviceAccount.project_id}.firebaseio.com`,
      };
      
      initializeApp(firebaseConfig);
      console.log('Firebase initialized with service account credentials');
    } else {
      console.error('Firebase service account not found - this will affect data retrieval');
      
      // In production, we should still try to initialize Firebase even without service account
      // for read-only operations, but log the issue prominently
      if (process.env.NODE_ENV === 'production') {
        console.error('CRITICAL: Firebase service account missing in production - CSV exports may show incorrect data');
        console.error('Application will continue but font family names in CSV exports may be incomplete');
        
        // Try to initialize with minimal config for basic functionality
        try {
          initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'font-inspector',
            databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://font-inspector.firebaseio.com',
          });
          console.log('Firebase initialized with minimal configuration');
        } catch (fallbackError) {
          console.error('Failed to initialize Firebase with minimal config:', fallbackError);
          throw new Error('Firebase initialization completely failed - application cannot start');
        }
      } else {
        // Development - throw error to force proper setup
        throw new Error('Firebase service account credentials are required but not found');
      }
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
  user_permissions: db.collection('user_permissions'),
  system_settings: db.collection('system_settings'),
  announcements: db.collection('announcements')
}; 