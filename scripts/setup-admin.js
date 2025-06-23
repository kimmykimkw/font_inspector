// Script to set up the admin system and create the first admin user
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// Initialize Firebase if not already initialized
if (getApps().length === 0) {
  try {
    // Try to load the service account
    let serviceAccount;
    try {
      const serviceAccountPath = path.resolve(__dirname, '../firebase-service-account.json');
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      console.log('Using Firebase service account from file');
    } catch (err) {
      // If file not found, try env var
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        console.log('Using Firebase service account from environment variable');
      }
    }

    if (serviceAccount) {
      initializeApp({
        credential: cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL || `https://${serviceAccount.project_id}.firebaseio.com`,
      });
      console.log('Firebase initialized with service account');
    } else {
      // Initialize with default credentials
      initializeApp();
      console.log('Firebase initialized with default credentials');
    }
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    process.exit(1);
  }
}

// Get Firestore instance
const db = getFirestore();
const collections = {
  user_invitations: db.collection('user_invitations'),
  admin_users: db.collection('admin_users'),
  user_stats: db.collection('user_stats'),
  user_permissions: db.collection('user_permissions')
};

// Configuration
const ADMIN_CONFIG = {
  // Replace these with your actual admin details
  uid: 'NiAetxnnBSaeTgfjxB510yUX8WF2', // You'll get this after signing in with Google
  email: 'mtkr.marketing@gmail.com', // You can change this to your email
  displayName: 'System Administrator'
};

// Default admin permissions
const DEFAULT_ADMIN_PERMISSIONS = {
  canApproveUsers: true,
  canManageUsers: true,
  canViewStats: true,
  canManageAdmins: true,
  canExportData: true
};

async function setupAdminSystem() {
  console.log('\n=== Setting up Font Inspector Admin System ===\n');

  try {
    // 1. Create admin user
    await createAdminUser();
    
    // 2. Set up collections indexes (informational)
    await showRequiredIndexes();
    
    console.log('\n✅ Admin system setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Update the ADMIN_CONFIG in this script with your actual Firebase Auth UID');
    console.log('2. Run this script again after updating the config');
    console.log('3. Deploy the Firestore security rules: firebase deploy --only firestore:rules');
    console.log('4. Create any required composite indexes in Firebase Console');
    console.log('5. Deploy your admin web application');
    
  } catch (error) {
    console.error('❌ Error setting up admin system:', error);
    process.exit(1);
  }
}

async function createAdminUser() {
  console.log('=== Creating Admin User ===');
  
  try {
    // Check if admin user already exists
    const existingAdminQuery = await collections.admin_users
      .where('email', '==', ADMIN_CONFIG.email)
      .limit(1)
      .get();

    if (!existingAdminQuery.empty) {
      console.log(`✅ Admin user already exists: ${ADMIN_CONFIG.email}`);
      return;
    }

    // Create admin user
    const adminData = {
      uid: ADMIN_CONFIG.uid,
      email: ADMIN_CONFIG.email,
      displayName: ADMIN_CONFIG.displayName,
      role: 'super_admin',
      permissions: DEFAULT_ADMIN_PERMISSIONS,
      createdAt: Timestamp.now(),
      isActive: true
    };

    console.log(`Creating admin user: ${ADMIN_CONFIG.email}`);
    
    if (ADMIN_CONFIG.uid === 'REPLACE_WITH_YOUR_ACTUAL_UID_FROM_FIREBASE_AUTH') {
      console.log('⚠️  Please update ADMIN_CONFIG.uid with your actual Firebase Auth UID');
      console.log('   You can get this by signing in to your app and checking the browser console');
      return;
    }

    await collections.admin_users.add(adminData);
    console.log(`✅ Created admin user: ${ADMIN_CONFIG.email}`);

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    throw error;
  }
}

async function showRequiredIndexes() {
  console.log('\n=== Required Firestore Indexes ===');
  
  console.log('\nThe following composite indexes may be required:');
  console.log('');
  
  console.log('1. user_invitations collection:');
  console.log('   - email (Ascending) + status (Ascending)');
  console.log('   - status (Ascending) + requestedAt (Descending)');
  console.log('');
  
  console.log('2. admin_users collection:');
  console.log('   - uid (Ascending) + isActive (Ascending)');
  console.log('   - email (Ascending) + isActive (Ascending)');
  console.log('');
  
  console.log('3. user_permissions collection:');
  console.log('   - userId (Ascending) + canUseApp (Ascending)');
  console.log('');
  
  console.log('4. user_stats collection:');
  console.log('   - lastActiveAt (Descending)');
  console.log('   - isActive (Ascending) + lastActiveAt (Descending)');
  console.log('');
  
  console.log('These will be created automatically when you first query them,');
  console.log('or you can create them manually in the Firebase Console.');
}

// Create sample invitation for testing
async function createSampleInvitation() {
  console.log('\n=== Creating Sample Invitation ===');
  
  try {
    const sampleInvitation = {
      name: 'Test User',
      email: 'test@example.com',
      status: 'pending',
      requestedAt: Timestamp.now()
    };

    const existingQuery = await collections.user_invitations
      .where('email', '==', sampleInvitation.email)
      .limit(1)
      .get();

    if (existingQuery.empty) {
      await collections.user_invitations.add(sampleInvitation);
      console.log(`✅ Created sample invitation: ${sampleInvitation.email}`);
    } else {
      console.log(`✅ Sample invitation already exists: ${sampleInvitation.email}`);
    }
  } catch (error) {
    console.error('❌ Error creating sample invitation:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--sample')) {
    await createSampleInvitation();
    return;
  }
  
  await setupAdminSystem();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  setupAdminSystem,
  createAdminUser,
  createSampleInvitation
}; 