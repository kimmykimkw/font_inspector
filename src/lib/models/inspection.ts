import { db, collections } from '../firebase';
import { Timestamp, DocumentReference } from 'firebase-admin/firestore';

// Type definitions for font metadata
export interface FontMetadata {
  foundry: string | null;           // Font foundry (Monotype, Adobe, etc.)
  copyright: string | null;         // Copyright notice
  version: string | null;           // Font version
  licenseInfo: string | null;       // License information
  embeddingPermissions: {    // Font embedding rights
    installable: boolean;
    editable: boolean;
    previewAndPrint: boolean;
    restrictedLicense: boolean;
  } | null;
  uniqueIdentifier: string | null;  // Font unique ID
  creationDate: string | null;      // Font creation date
  designer: string | null;          // Font designer
  fontName: string | null;          // Full font name
}

// Type definitions for downloaded fonts
export interface DownloadedFont {
  name: string;
  format: string;
  size: number;
  url: string;
  source: string;
  metadata: FontMetadata | null;    // Font metadata or null if not available
}

// Type definitions for font face declarations
export interface FontFaceDeclaration {
  family: string;
  source: string;
  weight?: string;
  style?: string;
}

// Type definitions for active fonts
export interface ActiveFont {
  family: string;
  count: number;
  elementCount: number;
  preview?: string;
}

// Type definitions for screenshots
export interface ScreenshotData {
  original: string;        // Local file path to original screenshot
  annotated: string;       // Local file path to annotated screenshot
  capturedAt: Timestamp | Date;  // When the screenshot was taken
  dimensions?: {
    width: number;
    height: number;
  };
  annotationCount?: number; // Number of font annotations added
}

// Type definition for Inspection document
export interface Inspection {
  id?: string;
  url: string;
  timestamp: Timestamp | Date;
  downloadedFonts: DownloadedFont[];
  fontFaceDeclarations: FontFaceDeclaration[];
  activeFonts: ActiveFont[];
  projectId?: string;
  userId: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  status?: 'completed' | 'failed';
  error?: string;
  screenshots?: ScreenshotData; // Optional screenshot data
}

// Convert Firestore document to Inspection object
export const convertInspection = (doc: FirebaseFirestore.DocumentSnapshot): Inspection | null => {
  if (!doc.exists) return null;
  
  const data = doc.data();
  if (!data) return null;
  
  return {
    id: doc.id,
    ...data,
  } as Inspection;
};

// Create a new inspection
export const createInspection = async (inspection: Omit<Inspection, 'id' | 'createdAt' | 'updatedAt'>): Promise<Inspection> => {
  const now = Timestamp.now();
  
  // Ensure userId is provided
  if (!inspection.userId) {
    throw new Error('userId is required to create an inspection');
  }
  
  const newInspection = {
    ...inspection,
    createdAt: now,
    updatedAt: now,
  };
  
  const docRef = await collections.inspections.add(newInspection);
  const doc = await docRef.get();
  
  return convertInspection(doc) as Inspection;
};

// Get inspection by ID (with user verification)
export const getInspectionById = async (id: string, userId?: string): Promise<Inspection | null> => {
  const doc = await collections.inspections.doc(id).get();
  const inspection = convertInspection(doc);
  
  // If userId is provided, verify the inspection belongs to the user
  if (inspection && userId && inspection.userId !== userId) {
    return null; // User is not authorized to view this inspection
  }
  
  return inspection;
};

// Get inspections by project ID (with user verification)
export const getInspectionsByProjectId = async (projectId: string, userId?: string): Promise<Inspection[]> => {
  try {
    console.log(`Fetching inspections for project ${projectId}${userId ? ` for user ${userId}` : ''}`);
    
    // Build query with user filtering if userId is provided
    let query = collections.inspections.where('projectId', '==', projectId);
    
    if (userId) {
      query = query.where('userId', '==', userId);
    }
    
    const snapshot = await query.get();
    
    console.log(`Found ${snapshot.docs.length} inspections for project ${projectId}${userId ? ` for user ${userId}` : ''} in Firestore`);
    
    if (snapshot.empty) {
      console.warn(`No inspections found for project ${projectId}${userId ? ` for user ${userId}` : ''}. Checking project document for inspectionIds.`);
      
      try {
        // As a fallback, get the project document and try to fetch inspections by their IDs
        const projectDoc = await collections.projects.doc(projectId).get();
        if (!projectDoc.exists) {
          console.warn(`Project ${projectId} not found`);
          return [];
        }
        
        const projectData = projectDoc.data();
        
        // If userId is provided, verify the project belongs to the user
        if (userId && projectData?.userId !== userId) {
          console.warn(`Project ${projectId} does not belong to user ${userId}`);
          return [];
        }
        
        if (!projectData || !projectData.inspectionIds || !Array.isArray(projectData.inspectionIds) || projectData.inspectionIds.length === 0) {
          console.warn(`Project ${projectId} has no inspectionIds array or it's empty`);
          return [];
        }
        
        console.log(`Project ${projectId} has ${projectData.inspectionIds.length} inspectionIds. Fetching individually.`);
        
        // Fetch inspections by their IDs
        const inspections: Inspection[] = [];
        for (const inspId of projectData.inspectionIds) {
          try {
            const inspDoc = await collections.inspections.doc(inspId).get();
            if (inspDoc.exists) {
              const inspection = convertInspection(inspDoc);
              if (inspection) {
                // Verify the inspection belongs to the user if userId is provided
                if (userId && inspection.userId !== userId) {
                  console.warn(`Inspection ${inspId} does not belong to user ${userId}`);
                  continue;
                }
                
                // If the inspection doesn't have a projectId, add it
                if (!inspection.projectId) {
                  // Update the inspection with the projectId
                  await collections.inspections.doc(inspId).update({
                    projectId: projectId,
                    updatedAt: new Date()
                  });
                  inspection.projectId = projectId;
                }
                inspections.push(inspection);
              }
            } else {
              console.warn(`Inspection ${inspId} listed in project but not found in database`);
            }
          } catch (error) {
            console.error(`Error fetching inspection ${inspId}:`, error);
          }
        }
        
        console.log(`Retrieved ${inspections.length} inspections by ID for project ${projectId}${userId ? ` for user ${userId}` : ''}`);
        return inspections;
      } catch (error) {
        console.error(`Error in fallback inspection retrieval for project ${projectId}:`, error);
        return [];
      }
    }
    
    // Sort in memory instead of using Firestore's orderBy
    const inspections = snapshot.docs
      .map(convertInspection)
      .filter((inspection): inspection is Inspection => inspection !== null);
    
    // Sort by createdAt in descending order manually
    return inspections.sort((a, b) => {
      const aTime = a.createdAt instanceof Date 
        ? a.createdAt.getTime() 
        : a.createdAt.toDate().getTime();
      
      const bTime = b.createdAt instanceof Date 
        ? b.createdAt.getTime() 
        : b.createdAt.toDate().getTime();
      
      return bTime - aTime; // Descending order
    });
  } catch (error) {
    console.error(`Error getting inspections for project ${projectId}:`, error);
    return [];
  }
};

// Get recent inspections for a specific user
export const getRecentInspections = async (limit = 10, userId?: string): Promise<Inspection[]> => {
  try {
    console.log(`Querying 'inspections' collection with limit: ${limit}${userId ? ` for user: ${userId}` : ''}`);
    
    // First, check if the collection exists and has any documents
    const collectionRef = collections.inspections;
    const quickSnapshot = await collectionRef.limit(1).get();
    console.log(`Collection exists: ${!quickSnapshot.empty}`);
    console.log(`Collection has documents: ${!quickSnapshot.empty}`);
    
    if (quickSnapshot.empty) {
      console.log("The 'inspections' collection exists but is empty. No records to return.");
      return [];
    }

    // Build query with user filtering if userId is provided
    let query: FirebaseFirestore.Query = collectionRef;
    
    if (userId) {
      query = query.where('userId', '==', userId);
    }
    
    // Apply limit
    query = query.limit(limit);
    
    console.log(`Querying${userId ? ` with userId filter` : ''} to get documents`);
    const snapshot = await query.get();
    console.log(`Query returned ${snapshot.docs.length} documents`);
    
    // Continue with the normal conversion and filtering
    const results = snapshot.docs
      .map(doc => {
        const data = doc.data();
        
        // Add missing createdAt/updatedAt fields if they don't exist
        if (!data.createdAt) {
          data.createdAt = data.timestamp || new Date();
        }
        if (!data.updatedAt) {
          data.updatedAt = data.timestamp || new Date();
        }
        
        // Convert to inspection object
        const inspection = {
          id: doc.id,
          ...data,
        } as Inspection;
        
        return inspection;
      })
      .filter(inspection => inspection !== null);
    
    console.log(`Returning ${results.length} inspection records after conversion`);
    return results;
  } catch (error) {
    console.error("Error in getRecentInspections:", error);
    throw error;
  }
};

// Delete an inspection
export const deleteInspection = async (id: string): Promise<boolean> => {
  try {
    await collections.inspections.doc(id).delete();
    return true;
  } catch (error) {
    console.error('Error deleting inspection:', error);
    return false;
  }
}; 