// Script to initialize system settings with default limits
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

async function setupDefaultLimits() {
  console.log('\n=== Setting up Default User Limits ===\n');

  try {
    // Check if settings already exist
    const settingsRef = db.collection('system_settings').doc('default_limits');
    const settingsDoc = await settingsRef.get();

    if (settingsDoc.exists) {
      const existingSettings = settingsDoc.data();
      console.log('✅ Default limits already exist:');
      console.log(`   - Inspections per month: ${existingSettings.defaultMaxInspectionsPerMonth}`);
      console.log(`   - Projects per month: ${existingSettings.defaultMaxProjectsPerMonth}`);
      console.log(`   - Last updated: ${existingSettings.updatedAt.toDate()}`);
      console.log(`   - Updated by: ${existingSettings.updatedBy}`);
      
      const answer = await askQuestion('\nDo you want to update these settings? (y/N): ');
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('Skipping update. Current settings maintained.');
        return;
      }
    }

    // Get new values from user
    const inspectionsLimit = await askQuestion('\nEnter default inspections per month (current: 1000): ') || '1000';
    const projectsLimit = await askQuestion('Enter default projects per month (current: 300): ') || '300';

    // Validate inputs
    const inspectionsNum = parseInt(inspectionsLimit, 10);
    const projectsNum = parseInt(projectsLimit, 10);

    if (isNaN(inspectionsNum) || inspectionsNum < 1 || inspectionsNum > 10000) {
      throw new Error('Inspections limit must be between 1 and 10,000');
    }

    if (isNaN(projectsNum) || projectsNum < 1 || projectsNum > 1000) {
      throw new Error('Projects limit must be between 1 and 1,000');
    }

    // Create/update settings
    const defaultSettings = {
      defaultMaxInspectionsPerMonth: inspectionsNum,
      defaultMaxProjectsPerMonth: projectsNum,
      updatedAt: Timestamp.now(),
      updatedBy: 'setup-script'
    };

    await settingsRef.set(defaultSettings);

    console.log('\n✅ Default limits configured successfully!');
    console.log(`   - Inspections per month: ${inspectionsNum}`);
    console.log(`   - Projects per month: ${projectsNum}`);
    console.log('\nThese limits will be applied to all new user registrations.');
    console.log('Existing users will keep their current limits unless manually changed.');

  } catch (error) {
    console.error('❌ Error setting up default limits:', error.message);
    process.exit(1);
  }
}

// Helper function to get user input
function askQuestion(question) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Run the setup
async function main() {
  try {
    await setupDefaultLimits();
    console.log('\n🎉 Setup completed successfully!');
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  setupDefaultLimits
}; 