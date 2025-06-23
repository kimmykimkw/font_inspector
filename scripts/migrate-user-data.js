// Migration script to add userId to existing inspections and projects
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
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
  inspections: db.collection('inspections'),
  projects: db.collection('projects'),
  users: db.collection('users')
};

// Migration configuration
const DEFAULT_USER_ID = 'admin'; // Default user ID for existing data
const DRY_RUN = process.argv.includes('--dry-run'); // Run without making changes

async function migrateInspections() {
  console.log('\n=== Migrating Inspections ===');
  
  try {
    // Get all inspections that don't have a userId field
    const inspectionsSnapshot = await collections.inspections.get();
    
    if (inspectionsSnapshot.empty) {
      console.log('No inspections found');
      return;
    }
    
    console.log(`Found ${inspectionsSnapshot.size} inspections to check`);
    
    const batch = db.batch();
    let migratedCount = 0;
    
    inspectionsSnapshot.forEach(doc => {
      const data = doc.data();
      
      // Check if userId field is missing
      if (!data.userId) {
        if (DRY_RUN) {
          console.log(`[DRY RUN] Would add userId to inspection: ${doc.id}`);
        } else {
          console.log(`Adding userId to inspection: ${doc.id}`);
          batch.update(collections.inspections.doc(doc.id), {
            userId: DEFAULT_USER_ID,
            updatedAt: Timestamp.now()
          });
        }
        migratedCount++;
      }
    });
    
    if (!DRY_RUN && migratedCount > 0) {
      await batch.commit();
      console.log(`✅ Successfully migrated ${migratedCount} inspections`);
    } else if (DRY_RUN) {
      console.log(`[DRY RUN] Would migrate ${migratedCount} inspections`);
    } else {
      console.log('✅ All inspections already have userId field');
    }
    
  } catch (error) {
    console.error('❌ Error migrating inspections:', error);
  }
}

async function migrateProjects() {
  console.log('\n=== Migrating Projects ===');
  
  try {
    // Get all projects that don't have a userId field
    const projectsSnapshot = await collections.projects.get();
    
    if (projectsSnapshot.empty) {
      console.log('No projects found');
      return;
    }
    
    console.log(`Found ${projectsSnapshot.size} projects to check`);
    
    const batch = db.batch();
    let migratedCount = 0;
    
    projectsSnapshot.forEach(doc => {
      const data = doc.data();
      
      // Check if userId field is missing
      if (!data.userId) {
        if (DRY_RUN) {
          console.log(`[DRY RUN] Would add userId to project: ${doc.id} (${data.name})`);
        } else {
          console.log(`Adding userId to project: ${doc.id} (${data.name})`);
          batch.update(collections.projects.doc(doc.id), {
            userId: DEFAULT_USER_ID,
            updatedAt: Timestamp.now()
          });
        }
        migratedCount++;
      }
    });
    
    if (!DRY_RUN && migratedCount > 0) {
      await batch.commit();
      console.log(`✅ Successfully migrated ${migratedCount} projects`);
    } else if (DRY_RUN) {
      console.log(`[DRY RUN] Would migrate ${migratedCount} projects`);
    } else {
      console.log('✅ All projects already have userId field');
    }
    
  } catch (error) {
    console.error('❌ Error migrating projects:', error);
  }
}

async function createDefaultUser() {
  console.log('\n=== Creating Default User ===');
  
  try {
    const userRef = collections.users.doc(DEFAULT_USER_ID);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      if (DRY_RUN) {
        console.log(`[DRY RUN] Would create default user: ${DEFAULT_USER_ID}`);
      } else {
        await userRef.set({
          uid: DEFAULT_USER_ID,
          email: 'admin@fontinspector.com',
          displayName: 'Default Admin User',
          createdAt: Timestamp.now(),
          lastLoginAt: Timestamp.now()
        });
        console.log(`✅ Created default user: ${DEFAULT_USER_ID}`);
      }
    } else {
      console.log(`✅ Default user already exists: ${DEFAULT_USER_ID}`);
    }
  } catch (error) {
    console.error('❌ Error creating default user:', error);
  }
}

async function main() {
  console.log('🚀 Starting user data migration...');
  console.log(`📝 Default User ID: ${DEFAULT_USER_ID}`);
  console.log(`🔍 Dry Run Mode: ${DRY_RUN ? 'ENABLED' : 'DISABLED'}`);
  
  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN MODE: No changes will be made to the database');
    console.log('    Run without --dry-run flag to apply changes');
  }
  
  try {
    await createDefaultUser();
    await migrateInspections();
    await migrateProjects();
    
    console.log('\n🎉 Migration completed successfully!');
    
    if (!DRY_RUN) {
      console.log('\n📋 Next Steps:');
      console.log('1. Existing data is now associated with the default user');
      console.log('2. New user registrations will have their own isolated data');
      console.log('3. Users can now only see their own inspections and projects');
      console.log(`4. The default user (${DEFAULT_USER_ID}) owns all existing data`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
main(); 