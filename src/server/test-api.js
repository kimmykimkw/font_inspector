const fetch = require('node-fetch');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config();

// Initialize Firebase if not already initialized
if (getApps().length === 0) {
  try {
    // Try to load the service account from file or env var for testing
    let serviceAccount;
    try {
      serviceAccount = require('../../firebase-service-account.json');
    } catch (err) {
      // If file not found, try env var
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      }
    }

    if (serviceAccount) {
      initializeApp({
        credential: cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL
      });
      console.log('Firebase initialized for testing');
    } else {
      // Initialize with default credentials
      initializeApp();
      console.log('Firebase initialized with default credentials');
    }
  } catch (error) {
    console.error('Error initializing Firebase:', error);
  }
}

// Get Firestore instance
const db = getFirestore();
const collections = {
  inspections: db.collection('inspections'),
  projects: db.collection('projects')
};

// Base URL for API
const API_BASE_URL = 'http://localhost:3001/api';

// Test data
const TEST_URL = 'https://fonts.google.com/'; // A URL likely to have many fonts
const TEST_PROJECT = {
  name: 'API Test Project',
  description: 'Test project for API integration tests',
  urls: [
    'https://fonts.google.com/',
    'https://developer.mozilla.org/',
    'https://github.com/'
  ]
};

// Timer utility
const timer = (name) => {
  const start = process.hrtime();
  return {
    stop: () => {
      const end = process.hrtime(start);
      const timeInMs = (end[0] * 1000) + (end[1] / 1000000);
      console.log(`Time for ${name}: ${timeInMs.toFixed(2)}ms`);
      return timeInMs;
    }
  };
};

// Test single URL inspection
async function testSingleInspection() {
  console.log('\n🔍 Testing single URL inspection API...');
  
  try {
    const apiTimer = timer('Single URL inspection');
    
    const response = await fetch(`${API_BASE_URL}/inspect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        urls: [TEST_URL] 
      }),
    });
    
    const data = await response.json();
    apiTimer.stop();
    
    if (!response.ok) {
      console.error('❌ API request failed:', data.error || response.status);
      return false;
    }
    
    console.log('✅ Inspection API request successful');
    console.log(`📊 Found ${data.result.downloadedFonts.length} fonts on ${TEST_URL}`);
    
    // Verify data was saved to Firestore
    const dbTimer = timer('Database verification');
    const snapshot = await collections.inspections
      .where('url', '==', TEST_URL)
      .limit(1)
      .get();
    dbTimer.stop();
    
    if (!snapshot.empty) {
      const inspection = snapshot.docs[0];
      console.log('✅ Inspection record saved to Firestore');
      console.log(`📊 Database record has ${inspection.data().downloadedFonts.length} fonts`);
      return { success: true, inspectionId: inspection.id };
    } else {
      console.warn('⚠️ Inspection not found in Firestore');
      return { success: true, inspectionId: data.id }; // Use the ID from the API response
    }
  } catch (error) {
    console.error('❌ Single inspection test failed:', error.message);
    return { success: false };
  }
}

// Test project inspection
async function testProjectInspection() {
  console.log('\n🔍 Testing project inspection API...');
  
  try {
    const apiTimer = timer('Project inspection');
    
    const response = await fetch(`${API_BASE_URL}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(TEST_PROJECT),
    });
    
    const data = await response.json();
    apiTimer.stop();
    
    if (!response.ok) {
      console.error('❌ Project API request failed:', data.error || response.status);
      return false;
    }
    
    console.log('✅ Project API request successful');
    console.log(`📊 Project created with ${TEST_PROJECT.urls.length} URLs`);
    
    // Verify project was saved to Firestore
    const dbTimer = timer('Database verification');
    const snapshot = await collections.projects
      .where('name', '==', TEST_PROJECT.name)
      .limit(1)
      .get();
    dbTimer.stop();
    
    if (!snapshot.empty) {
      const project = snapshot.docs[0];
      console.log('✅ Project record saved to Firestore');
      console.log(`📊 Project has ${project.data().inspectionIds.length} inspections`);
      
      // Check if all URLs were processed
      const inspectionsSnapshot = await collections.inspections
        .where('projectId', '==', project.id)
        .get();
        
      if (inspectionsSnapshot.size === TEST_PROJECT.urls.length) {
        console.log('✅ All URLs in project were processed');
      } else {
        console.warn(`⚠️ Only ${inspectionsSnapshot.size}/${TEST_PROJECT.urls.length} URLs were processed`);
      }
      
      return { success: true, projectId: project.id };
    } else {
      console.warn('⚠️ Project not found in Firestore');
      return { success: true, projectId: data.project?.id }; // Use the ID from the API response
    }
  } catch (error) {
    console.error('❌ Project inspection test failed:', error.message);
    return { success: false };
  }
}

// Test retrieving inspection results
async function testGetInspection(inspectionId) {
  console.log('\n🔍 Testing inspection retrieval API...');
  
  if (!inspectionId) {
    console.warn('⚠️ No inspection ID provided, skipping test');
    return { success: false };
  }
  
  try {
    const apiTimer = timer('Get inspection results');
    
    const response = await fetch(`${API_BASE_URL}/inspections/${inspectionId}`);
    const data = await response.json();
    apiTimer.stop();
    
    if (!response.ok) {
      console.error('❌ Get inspection API request failed:', data.error || response.status);
      return { success: false };
    }
    
    console.log('✅ Inspection retrieval successful');
    console.log(`📊 Retrieved inspection for URL: ${data.url}`);
    
    return { success: true };
  } catch (error) {
    console.error('❌ Get inspection test failed:', error.message);
    return { success: false };
  }
}

// Test retrieving project results
async function testGetProject(projectId) {
  console.log('\n🔍 Testing project retrieval API...');
  
  if (!projectId) {
    console.warn('⚠️ No project ID provided, skipping test');
    return { success: false };
  }
  
  try {
    const apiTimer = timer('Get project results');
    
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}`);
    const data = await response.json();
    apiTimer.stop();
    
    if (!response.ok) {
      console.error('❌ Get project API request failed:', data.error || response.status);
      return { success: false };
    }
    
    console.log('✅ Project retrieval successful');
    console.log(`📊 Retrieved project: ${data.name} with ${data.inspectionIds?.length || 0} inspections`);
    
    return { success: true };
  } catch (error) {
    console.error('❌ Get project test failed:', error.message);
    return { success: false };
  }
}

// Test error handling
async function testErrorHandling() {
  console.log('\n🔍 Testing API error handling...');
  
  try {
    // Test invalid URL format
    console.log('Testing invalid URL format...');
    const invalidUrlResponse = await fetch(`${API_BASE_URL}/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: ['not-a-valid-url'] }),
    });
    
    const invalidUrlData = await invalidUrlResponse.json();
    
    if (invalidUrlResponse.status >= 400) {
      console.log('✅ API correctly rejected invalid URL');
    } else {
      console.warn('⚠️ API accepted invalid URL');
    }
    
    // Test non-existent resource
    console.log('Testing non-existent resource...');
    const nonExistentResponse = await fetch(`${API_BASE_URL}/inspections/non-existent-id`);
    
    if (nonExistentResponse.status === 404) {
      console.log('✅ API correctly returned 404 for non-existent resource');
    } else {
      console.warn(`⚠️ API returned ${nonExistentResponse.status} for non-existent resource`);
    }
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error handling test failed:', error.message);
    return { success: false };
  }
}

// Clean up test data
async function cleanupTestData() {
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    // Delete test inspections
    const inspectionSnapshot = await collections.inspections
      .where('url', '==', TEST_URL)
      .get();
      
    if (!inspectionSnapshot.empty) {
      const batch = db.batch();
      inspectionSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`Deleted ${inspectionSnapshot.size} test inspections`);
    }
    
    // Delete test projects
    const projectSnapshot = await collections.projects
      .where('name', '==', TEST_PROJECT.name)
      .get();
      
    if (!projectSnapshot.empty) {
      const batch = db.batch();
      
      for (const projectDoc of projectSnapshot.docs) {
        // Find and delete inspections belonging to this project
        const projectInspections = await collections.inspections
          .where('projectId', '==', projectDoc.id)
          .get();
          
        projectInspections.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        // Delete the project
        batch.delete(projectDoc.ref);
      }
      
      await batch.commit();
      console.log(`Deleted ${projectSnapshot.size} test projects and their inspections`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Starting API Integration Tests 🧪');
  console.log('===================================');
  
  try {
    // First clean up any existing test data
    await cleanupTestData();
    
    // Run the tests
    const singleResult = await testSingleInspection();
    const projectResult = await testProjectInspection();
    
    // Test retrieving results if the previous tests succeeded
    if (singleResult.success && singleResult.inspectionId) {
      await testGetInspection(singleResult.inspectionId);
    }
    
    if (projectResult.success && projectResult.projectId) {
      await testGetProject(projectResult.projectId);
    }
    
    // Test error handling
    await testErrorHandling();
    
    // Clean up test data
    await cleanupTestData();
    
    console.log('\n✅ All API tests completed');
  } catch (error) {
    console.error('\n❌ API tests failed:', error.message);
  } finally {
    console.log('===================================');
    console.log('🧪 API Test Suite Completed 🧪');
  }
}

// Run the tests
runTests(); 