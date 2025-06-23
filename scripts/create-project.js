// Script to create a test project in Firebase Firestore
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

// Create a sample project
async function createSampleProject() {
  try {
    // Check if 'projects' collection exists by reading a document
    const now = Timestamp.now();
    
    // Create project document
    const projectData = {
      name: 'Sample Project',
      description: 'A test project created to fix the History page',
      inspectionIds: [],
      createdAt: now,
      updatedAt: now
    };
    
    console.log('Creating sample project with data:', projectData);
    
    // Add the project to Firestore
    const docRef = await collections.projects.add(projectData);
    console.log(`Project created successfully with ID: ${docRef.id}`);
    
    // Read back the project to verify
    const projectDoc = await docRef.get();
    if (projectDoc.exists) {
      console.log('Project verified in Firestore:', projectDoc.data());
    } else {
      console.error('Failed to verify project creation');
    }
    
    // Log all available collections in Firestore to verify
    console.log('Listing all collections in Firestore...');
    const collectionsList = await db.listCollections();
    const collectionIds = collectionsList.map(col => col.id);
    console.log('Available collections in Firestore:', collectionIds);
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating sample project:', error);
    throw error;
  }
}

// Link an existing inspection to the project (optional)
async function linkInspectionToProject(projectId, inspectionId) {
  if (!inspectionId) {
    console.log('No inspection ID provided, skipping linking');
    return;
  }
  
  try {
    // Check if inspection exists
    const inspectionDoc = await collections.inspections.doc(inspectionId).get();
    if (!inspectionDoc.exists) {
      console.error(`Inspection with ID ${inspectionId} does not exist`);
      return;
    }
    
    // Update the project to add this inspection ID
    await collections.projects.doc(projectId).update({
      inspectionIds: FieldValue.arrayUnion(inspectionId),
      updatedAt: Timestamp.now()
    });
    
    console.log(`Linked inspection ${inspectionId} to project ${projectId}`);
    
    // Update the inspection to add the project ID
    await collections.inspections.doc(inspectionId).update({
      projectId: projectId,
      updatedAt: Timestamp.now()
    });
    
    console.log(`Updated inspection ${inspectionId} with projectId reference`);
  } catch (error) {
    console.error('Error linking inspection to project:', error);
  }
}

// Run the script
async function main() {
  try {
    // Create a sample project
    const projectId = await createSampleProject();
    
    // Get the first inspection to link (optional)
    const inspectionsSnapshot = await collections.inspections.limit(1).get();
    if (!inspectionsSnapshot.empty) {
      const inspectionId = inspectionsSnapshot.docs[0].id;
      console.log(`Found existing inspection with ID: ${inspectionId}`);
      
      // Link the inspection to the project
      await linkInspectionToProject(projectId, inspectionId);
    } else {
      console.log('No existing inspections found to link to the project');
    }
    
    console.log('Script completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

main(); 