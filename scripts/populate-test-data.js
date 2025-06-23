// Script to populate test data for user_stats and activity_logs collections
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

// Sample user data
const SAMPLE_USERS = [
  {
    userId: 'user1',
    email: 'user1@example.com',
    displayName: 'John Doe',
    totalInspections: 15,
    totalProjects: 3,
    inspectionsThisMonth: 5,
    projectsThisMonth: 1,
    isActive: true
  },
  {
    userId: 'user2', 
    email: 'user2@example.com',
    displayName: 'Jane Smith',
    totalInspections: 8,
    totalProjects: 2,
    inspectionsThisMonth: 3,
    projectsThisMonth: 0,
    isActive: true
  },
  {
    userId: 'user3',
    email: 'user3@example.com', 
    displayName: 'Bob Johnson',
    totalInspections: 25,
    totalProjects: 5,
    inspectionsThisMonth: 8,
    projectsThisMonth: 2,
    isActive: false
  }
];

// Sample activity actions
const SAMPLE_ACTIVITIES = [
  {
    type: 'user_action',
    action: 'user_signin',
    description: 'User signed in',
    severity: 'low'
  },
  {
    type: 'user_action', 
    action: 'inspection_created',
    description: 'User created inspection for example.com',
    severity: 'low'
  },
  {
    type: 'user_action',
    action: 'project_created', 
    description: 'User created project with 3 URLs',
    severity: 'low'
  },
  {
    type: 'admin_action',
    action: 'user_approved',
    description: 'Admin approved access for new user',
    severity: 'medium'
  },
  {
    type: 'system_event',
    action: 'system_error',
    description: 'System error: Database connection timeout',
    severity: 'high'
  }
];

async function populateUserStats() {
  console.log('\n=== Populating User Statistics ===');
  
  for (const user of SAMPLE_USERS) {
    try {
      const now = Timestamp.now();
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      
      const userStats = {
        ...user,
        joinedAt: Timestamp.fromDate(monthAgo),
        lastActiveAt: now,
        lastInspectionAt: now,
        lastProjectAt: now
      };

      await db.collection('user_stats').doc(user.userId).set(userStats);
      console.log(`✅ Created user stats for: ${user.email}`);
    } catch (error) {
      console.error(`❌ Error creating user stats for ${user.email}:`, error);
    }
  }
}

async function populateActivityLogs() {
  console.log('\n=== Populating Activity Logs ===');
  
  const activities = [];
  
  // Generate activities for each user
  SAMPLE_USERS.forEach((user, userIndex) => {
    SAMPLE_ACTIVITIES.forEach((activity, activityIndex) => {
      const daysAgo = Math.floor(Math.random() * 30); // Random day in last 30 days
      const activityDate = new Date();
      activityDate.setDate(activityDate.getDate() - daysAgo);
      
      activities.push({
        ...activity,
        userEmail: user.email,
        userId: user.userId,
        timestamp: Timestamp.fromDate(activityDate),
        metadata: {
          inspectionId: activity.action.includes('inspection') ? `inspection_${userIndex}_${activityIndex}` : null,
          projectId: activity.action.includes('project') ? `project_${userIndex}_${activityIndex}` : null,
          url: activity.action.includes('inspection') ? 'https://example.com' : null
        }
      });
    });
  });

  // Add some admin activities
  activities.push({
    type: 'admin_action',
    action: 'admin_signin',
    description: 'Admin mtkr.marketing@gmail.com signed in to admin panel',
    adminEmail: 'mtkr.marketing@gmail.com',
    timestamp: Timestamp.now(),
    severity: 'low'
  });

  // Shuffle and add activities
  for (const activity of activities) {
    try {
      await db.collection('activity_logs').add(activity);
      console.log(`✅ Created activity: ${activity.action} for ${activity.userEmail || activity.adminEmail}`);
    } catch (error) {
      console.error(`❌ Error creating activity log:`, error);
    }
  }
}

async function main() {
  console.log('\n=== Populating Test Data for Admin Dashboard ===\n');
  
  try {
    await populateUserStats();
    await populateActivityLogs();
    
    console.log('\n✅ Test data population completed successfully!');
    console.log('\nYou can now:');
    console.log('1. Open the admin-app and view the Statistics tab');
    console.log('2. Check the Activity Log tab');
    console.log('3. Both should now show the sample data');
    
  } catch (error) {
    console.error('❌ Error populating test data:', error);
    process.exit(1);
  }
}

main(); 