// Temporary server file using CommonJS
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase
if (getApps().length === 0) {
  try {
    // Try to load the service account
    let serviceAccount;
    try {
      serviceAccount = require('../firebase-service-account.json');
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
      console.log('Firebase initialized with service account');
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

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(cors());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Simple placeholder API endpoints
app.post('/api/inspect', (req, res) => {
  res.status(200).json({ 
    message: 'Temporary server response - Inspect endpoint',
    body: req.body 
  });
});

app.get('/api/inspections/:id', (req, res) => {
  res.status(200).json({ 
    message: 'Temporary server response - Get inspection',
    id: req.params.id 
  });
});

app.get('/api/inspections', (req, res) => {
  res.status(200).json({ 
    message: 'Temporary server response - Get all inspections' 
  });
});

app.post('/api/projects', (req, res) => {
  res.status(200).json({ 
    message: 'Temporary server response - Create project',
    body: req.body 
  });
});

app.get('/api/projects/:id', (req, res) => {
  res.status(200).json({ 
    message: 'Temporary server response - Get project',
    id: req.params.id 
  });
});

app.get('/api/projects', (req, res) => {
  res.status(200).json({ 
    message: 'Temporary server response - Get all projects' 
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Font Inspector server running on port ${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/inspect`);
}); 