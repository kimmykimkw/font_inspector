// Script to update project-inspection relationships in Firebase
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
  projects: db.collection('projects')
};

// Connect to Firebase and update project-inspection relationships
async function main() {
  try {
    console.log('Finding inspections with projectId...');
    
    // Find all inspections with projectId
    const inspectionsSnapshot = await collections.inspections
      .where('projectId', '!=', null)
      .get();
    
    if (inspectionsSnapshot.empty) {
      console.log('No inspections found with projectId');
      return;
    }
    
    console.log(`Found ${inspectionsSnapshot.size} inspections with projectId`);
    
    // Group inspections by projectId
    const projectInspections = {};
    
    inspectionsSnapshot.forEach(doc => {
      const inspection = doc.data();
      const inspectionId = doc.id;
      const projectId = inspection.projectId;
      
      if (!projectInspections[projectId]) {
        projectInspections[projectId] = [];
      }
      
      projectInspections[projectId].push(inspectionId);
    });
    
    console.log(`Grouped inspections for ${Object.keys(projectInspections).length} projects`);
    
    // Update each project with its inspections
    const batch = db.batch();
    const updatedProjects = [];
    
    for (const [projectId, inspectionIds] of Object.entries(projectInspections)) {
      console.log(`Updating project ${projectId} with ${inspectionIds.length} inspections`);
      
      // Get the project document
      const projectDoc = await collections.projects.doc(projectId).get();
      
      if (!projectDoc.exists) {
        console.log(`Project ${projectId} not found, skipping`);
        continue;
      }
      
      // Update the project document with inspectionIds
      const projectRef = collections.projects.doc(projectId);
      batch.update(projectRef, { 
        inspectionIds: inspectionIds,
        updatedAt: Timestamp.now()
      });
      
      updatedProjects.push(projectId);
    }
    
    // Commit the batch update
    await batch.commit();
    console.log(`Updated ${updatedProjects.length} projects with inspection IDs`);
    
    console.log('Database update completed successfully!');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the main function
main()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  }); 