import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';
import { inspectWebsite } from './services/inspectionService.ts';

// Initialize environment variables
dotenv.config();

// Get current file path (ES Module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase
if (getApps().length === 0) {
  try {
    // Try to load the service account
    let serviceAccount;
    try {
      const serviceAccountPath = resolve(__dirname, '../../firebase-service-account.json');
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
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

// Define controller functions for inspections
const inspectionController = {
  createInspection: async (req, res) => {
    try {
      const { urls } = req.body;
      
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'Please provide an array of URLs to inspect' });
      }

      // For now, we only process one URL at a time
      const url = urls[0];
      
      if (typeof url !== 'string' || !url.trim()) {
        return res.status(400).json({ error: 'Invalid URL provided' });
      }

      // Make sure URL has http/https protocol
      let normalizedUrl = url.trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `https://${normalizedUrl}`;
      }
      
      console.log(`Processing inspection request for ${normalizedUrl}`);
      
      try {
        // Call the actual inspection service
        const result = await inspectWebsite(normalizedUrl);
        
        // Save to Firestore
        const inspectionRef = await collections.inspections.add({
          url: normalizedUrl,
          timestamp: new Date(),
          ...result
        });
        
        return res.status(200).json({
          success: true,
          url: normalizedUrl,
          id: inspectionRef.id,
          result
        });
      } catch (inspectionError) {
        console.error('Website inspection failed:', inspectionError);
        return res.status(422).json({
          success: false,
          url: normalizedUrl,
          error: inspectionError.message || 'Website inspection failed'
        });
      }
    } catch (error) {
      console.error('Inspection request error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'An unknown error occurred'
      });
    }
  },

  getInspectionById: async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ error: 'Inspection ID is required' });
      }
      
      // In a real implementation, we would query Firestore here
      return res.status(200).json({
        id,
        url: 'https://example.com',
        timestamp: new Date(),
        downloadedFonts: [],
        fontFaceDeclarations: [],
        activeFonts: []
      });
    } catch (error) {
      console.error('Error retrieving inspection:', error);
      return res.status(500).json({
        error: error.message || 'An unknown error occurred'
      });
    }
  },

  getInspectionHistory: async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 10;
      
      // In a real implementation, we would query Firestore here
      return res.status(200).json([]);
    } catch (error) {
      console.error('Error retrieving inspection history:', error);
      return res.status(500).json({
        error: error.message || 'An unknown error occurred'
      });
    }
  },

  deleteInspection: async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ error: 'Inspection ID is required' });
      }
      
      // In a real implementation, we would delete from Firestore here
      return res.status(200).json({ success: true, message: 'Inspection deleted successfully' });
    } catch (error) {
      console.error('Error deleting inspection:', error);
      return res.status(500).json({
        error: error.message || 'An unknown error occurred'
      });
    }
  }
};

// Define controller functions for projects
const projectController = {
  createNewProject: async (req, res) => {
    try {
      const { name, description, urls } = req.body;
      
      if (!name || !urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ 
          error: 'Please provide a project name and an array of URLs to inspect' 
        });
      }

      // In a real implementation, we would create the project in Firestore here
      return res.status(200).json({
        success: true,
        project: {
          id: 'dummy-project-id',
          name,
          description,
          inspectionIds: []
        },
        inspections: []
      });
    } catch (error) {
      console.error('Project creation error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'An unknown error occurred'
      });
    }
  },

  getProjectById: async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ error: 'Project ID is required' });
      }
      
      // In a real implementation, we would query Firestore here
      return res.status(200).json({
        id,
        name: 'Test Project',
        description: 'Test project description',
        inspectionIds: []
      });
    } catch (error) {
      console.error('Error retrieving project:', error);
      return res.status(500).json({
        error: error.message || 'An unknown error occurred'
      });
    }
  },

  getAllProjects: async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 10;
      
      // In a real implementation, we would query Firestore here
      return res.status(200).json([]);
    } catch (error) {
      console.error('Error retrieving projects:', error);
      return res.status(500).json({
        error: error.message || 'An unknown error occurred'
      });
    }
  },

  deleteProject: async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ error: 'Project ID is required' });
      }
      
      // In a real implementation, we would delete from Firestore here
      return res.status(200).json({ success: true, message: 'Project deleted successfully' });
    } catch (error) {
      console.error('Error deleting project:', error);
      return res.status(500).json({
        error: error.message || 'An unknown error occurred'
      });
    }
  }
};

// Inspection routes
app.post('/api/inspect', inspectionController.createInspection);
app.get('/api/inspections/:id', inspectionController.getInspectionById);
app.get('/api/inspections', inspectionController.getInspectionHistory);
app.delete('/api/inspections/:id', inspectionController.deleteInspection);

// Project routes
app.post('/api/projects', projectController.createNewProject);
app.get('/api/projects/:id', projectController.getProjectById);
app.get('/api/projects', projectController.getAllProjects);
app.delete('/api/projects/:id', projectController.deleteProject);

// Start the server
app.listen(PORT, () => {
  console.log(`Font Inspector server running on port ${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/inspect`);
});

export default app; 