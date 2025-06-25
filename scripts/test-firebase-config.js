#!/usr/bin/env node

// Test script to verify Firebase configuration in different environments
const path = require('path');
const fs = require('fs');

console.log('🔥 Firebase Configuration Test');
console.log('===============================');

// Test 1: Check environment variables
console.log('\n1. Environment Variables:');
console.log('NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('ELECTRON_APP:', process.env.ELECTRON_APP || 'not set');
console.log('NEXT_PUBLIC_FIREBASE_PROJECT_ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'not set');
console.log('FIREBASE_DATABASE_URL:', process.env.FIREBASE_DATABASE_URL || 'not set');
console.log('FIREBASE_SERVICE_ACCOUNT:', process.env.FIREBASE_SERVICE_ACCOUNT ? 'set (length: ' + process.env.FIREBASE_SERVICE_ACCOUNT.length + ')' : 'not set');

// Test 2: Check service account file locations
console.log('\n2. Service Account File Locations:');

const possiblePaths = [
  path.resolve(process.cwd(), 'firebase-service-account.json'),
  path.resolve(__dirname, '..', 'firebase-service-account.json'),
];

// Add production paths if available
if (process.resourcesPath) {
  possiblePaths.push(
    path.join(process.resourcesPath, 'app.asar', 'firebase-service-account.json'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'firebase-service-account.json'),
    path.join(process.resourcesPath, 'firebase-service-account.json')
  );
}

try {
  const { app } = require('electron');
  if (app) {
    possiblePaths.push(path.join(app.getAppPath(), 'firebase-service-account.json'));
  }
} catch (e) {
  // Electron not available, skip
}

let foundServiceAccount = false;
for (const filePath of possiblePaths) {
  const exists = fs.existsSync(filePath);
  console.log(`${exists ? '✅' : '❌'} ${filePath}`);
  
  if (exists && !foundServiceAccount) {
    foundServiceAccount = true;
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(content);
      console.log(`   📄 File size: ${content.length} bytes`);
      console.log(`   🆔 Project ID: ${parsed.project_id || 'not found'}`);
      console.log(`   📧 Client email: ${parsed.client_email || 'not found'}`);
    } catch (error) {
      console.log(`   ❌ Error reading file: ${error.message}`);
    }
  }
}

// Test 3: Try to initialize Firebase
console.log('\n3. Firebase Initialization Test:');

try {
  // Try to load the Firebase module
  const { initializeApp, getApps, cert } = require('firebase-admin/app');
  console.log('✅ Firebase Admin SDK loaded successfully');
  
  // Check if already initialized
  const apps = getApps();
  if (apps.length > 0) {
    console.log('✅ Firebase already initialized:', apps.length, 'app(s)');
  } else {
    console.log('ℹ️  Firebase not yet initialized - this is expected for this test');
  }
  
  // Test service account loading
  let serviceAccount = null;
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      console.log('✅ Service account loaded from environment variable');
    } catch (error) {
      console.log('❌ Error parsing service account from environment:', error.message);
    }
  } else {
    const serviceAccountPath = possiblePaths.find(p => fs.existsSync(p));
    if (serviceAccountPath) {
      try {
        const rawdata = fs.readFileSync(serviceAccountPath, 'utf8');
        serviceAccount = JSON.parse(rawdata);
        console.log('✅ Service account loaded from file:', serviceAccountPath);
      } catch (error) {
        console.log('❌ Error loading service account from file:', error.message);
      }
    }
  }
  
  if (serviceAccount) {
    console.log('✅ Service account validation passed');
    console.log('   Project ID:', serviceAccount.project_id);
    console.log('   Auth Provider X509 Cert URL:', serviceAccount.auth_provider_x509_cert_url ? 'present' : 'missing');
  } else {
    console.log('❌ No valid service account found');
  }
  
} catch (error) {
  console.log('❌ Error loading Firebase Admin SDK:', error.message);
}

// Test 4: Recommendations
console.log('\n4. Recommendations:');

if (!foundServiceAccount) {
  console.log('🔧 ISSUE: Firebase service account file not found');
  console.log('   → Ensure firebase-service-account.json exists in project root');
  console.log('   → Check that the file is included in the Electron build');
}

if (!process.env.FIREBASE_SERVICE_ACCOUNT && foundServiceAccount) {
  console.log('🔧 OPTIMIZATION: Consider setting FIREBASE_SERVICE_ACCOUNT environment variable');
  console.log('   → This would eliminate file path dependency issues');
}

if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
  console.log('🔧 ISSUE: NEXT_PUBLIC_FIREBASE_PROJECT_ID not set');
  console.log('   → This is required for client-side Firebase initialization');
}

console.log('\n✨ Firebase configuration test completed'); 