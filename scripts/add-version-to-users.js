// Migration script to add appVersion field to existing users
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// Get current version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));
const CURRENT_VERSION = packageJson.version;

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
const usersCollection = db.collection('users');

// Migration configuration
const DRY_RUN = process.argv.includes('--dry-run');

async function addVersionToUsers() {
  console.log('\n=== Adding App Version to Users ===');
  console.log(`Current app version: ${CURRENT_VERSION}`);
  console.log(`Dry run mode: ${DRY_RUN ? 'ON' : 'OFF'}`);
  
  try {
    // Get all users
    const snapshot = await usersCollection.get();
    console.log(`Found ${snapshot.docs.length} users`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const doc of snapshot.docs) {
      const userData = doc.data();
      const userId = doc.id;
      
      // Check if user already has appVersion field
      if (userData.appVersion) {
        console.log(`✓ User ${userData.email || userId} already has version: ${userData.appVersion}`);
        skippedCount++;
        continue;
      }
      
      if (DRY_RUN) {
        console.log(`[DRY RUN] Would update user ${userData.email || userId} with version: ${CURRENT_VERSION}`);
      } else {
        // Update user with current version
        await doc.ref.update({
          appVersion: CURRENT_VERSION
        });
        console.log(`✅ Updated user ${userData.email || userId} with version: ${CURRENT_VERSION}`);
      }
      
      updatedCount++;
    }
    
    console.log('\n=== Migration Summary ===');
    console.log(`Total users: ${snapshot.docs.length}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped (already had version): ${skippedCount}`);
    
    if (DRY_RUN) {
      console.log('\nThis was a dry run. Run without --dry-run to actually update users.');
    } else {
      console.log('\nMigration completed successfully!');
    }
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
addVersionToUsers()
  .then(() => {
    console.log('Migration process finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  }); 