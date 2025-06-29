import { InspectionResult, ActiveFont as ServiceActiveFont } from './inspectionService';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { collections } from '../../lib/firebase';
import { 
  createInspection as createInspectionModel,
  getInspectionById,
  getRecentInspections,
  deleteInspection,
  ActiveFont as ModelActiveFont
} from '../../lib/models/inspection';
import {
  createProject as createProjectModel,
  getProjectById,
  getAllProjects,
  getRecentProjects,
  addInspectionToProject,
  deleteProject
} from '../../lib/models/project';

/**
 * Save inspection result to Firestore
 */
export const saveInspectionResult = async (url: string, result: InspectionResult, projectId?: string, userId?: string) => {
  try {
    console.log(`Saving inspection result for ${url}${projectId ? `, project ID: ${projectId}` : ''}${userId ? `, user ID: ${userId}` : ''}`);
    
    // Ensure userId is provided when creating inspection
    if (!userId) {
      throw new Error('userId is required to save inspection result');
    }
    
    // Convert ActiveFont format from service to model format
    const convertedActiveFonts: ModelActiveFont[] = result.activeFonts.map((font: ServiceActiveFont) => ({
      family: font.family,
      count: font.elementCount, // Map from elementCount to count
      elementCount: font.elementCount,
      preview: font.preview,
    }));

    const inspectionData = {
      url,
      timestamp: Timestamp.now(),
      createdAt: Timestamp.now(), // Add createdAt for consistency
      updatedAt: Timestamp.now(), // Add updatedAt for consistency
      downloadedFonts: result.downloadedFonts || [],
      fontFaceDeclarations: result.fontFaceDeclarations || [],
      activeFonts: convertedActiveFonts,
      userId: userId, // Required field
      status: 'completed' as const, // Mark as completed
      ...(projectId ? { projectId } : {}), // Only add projectId if it exists
      ...(result.screenshots ? { 
        screenshots: {
          original: result.screenshots.original,
          annotated: result.screenshots.annotated,
          capturedAt: Timestamp.fromDate(result.screenshots.capturedAt),
          dimensions: result.screenshots.dimensions,
          annotationCount: result.screenshots.annotationCount
        }
      } : {}) // Only add screenshots if they exist
    };

    console.log('Creating inspection with data:', {
      url: inspectionData.url,
      hasDownloadedFonts: (inspectionData.downloadedFonts?.length || 0) > 0,
      hasActiveFonts: (inspectionData.activeFonts?.length || 0) > 0,
      projectId: projectId || 'none',
      userId: userId
    });

    const savedInspection = await createInspectionModel(inspectionData);
    console.log(`Inspection saved with ID: ${savedInspection.id} for user: ${userId}`);
    
    // If this inspection is part of a project, update the project with this inspection ID
    if (projectId && savedInspection.id) {
      console.log(`Associating inspection ${savedInspection.id} with project ${projectId}`);
      try {
        const success = await addInspectionToProject(projectId, savedInspection.id);
        
        if (!success) {
          console.warn(`Failed to associate inspection ${savedInspection.id} with project ${projectId}, will retry...`);
          // Retry once more with a delay
          try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const retrySuccess = await addInspectionToProject(projectId, savedInspection.id as string);
            console.log(`Retry to associate inspection with project: ${retrySuccess ? 'succeeded' : 'failed'}`);
            
            if (!retrySuccess) {
              // Do a manual update as a last resort
              console.log('Attempting manual update of project document...');
              try {
                await collections.projects.doc(projectId).update({
                  inspectionIds: FieldValue.arrayUnion(savedInspection.id),
                  updatedAt: Timestamp.now()
                });
                console.log('Manual project update successful');
              } catch (manualUpdateError) {
                console.error('Manual project update failed:', manualUpdateError);
              }
            }
          } catch (retryError) {
            console.error('Error during retry:', retryError);
          }
        }
      } catch (associationError) {
        console.error('Error associating inspection with project:', associationError);
      }
    }
    
    return savedInspection;
  } catch (error) {
    console.error('Error saving inspection result:', error);
    throw error;
  }
};

/**
 * Save failed inspection result to Firestore
 */
export const saveFailedInspectionResult = async (url: string, errorMessage: string, projectId?: string, userId?: string) => {
  try {
    console.log(`Saving failed inspection result for ${url}${projectId ? `, project ID: ${projectId}` : ''}${userId ? `, user ID: ${userId}` : ''}`);
    
    // Ensure userId is provided when creating inspection
    if (!userId) {
      throw new Error('userId is required to save failed inspection result');
    }

    const inspectionData = {
      url,
      timestamp: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      downloadedFonts: [], // Empty arrays for failed inspections
      fontFaceDeclarations: [],
      activeFonts: [],
      userId: userId,
      status: 'failed' as const, // Mark as failed
      error: errorMessage, // Store the error message
      ...(projectId ? { projectId } : {})
    };

    console.log('Creating failed inspection with data:', {
      url: inspectionData.url,
      error: errorMessage,
      projectId: projectId || 'none',
      userId: userId
    });

    const savedInspection = await createInspectionModel(inspectionData);
    console.log(`Failed inspection saved with ID: ${savedInspection.id} for user: ${userId}`);
    
    // If this inspection is part of a project, update the project with this inspection ID
    if (projectId && savedInspection.id) {
      console.log(`Associating failed inspection ${savedInspection.id} with project ${projectId}`);
      try {
        const success = await addInspectionToProject(projectId, savedInspection.id);
        
        if (!success) {
          console.warn(`Failed to associate failed inspection ${savedInspection.id} with project ${projectId}, will retry...`);
          // Retry once more with a delay
          try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const retrySuccess = await addInspectionToProject(projectId, savedInspection.id as string);
            console.log(`Retry to associate failed inspection with project: ${retrySuccess ? 'succeeded' : 'failed'}`);
            
            if (!retrySuccess) {
              // Do a manual update as a last resort
              console.log('Attempting manual update of project document...');
              try {
                await collections.projects.doc(projectId).update({
                  inspectionIds: FieldValue.arrayUnion(savedInspection.id),
                  updatedAt: Timestamp.now()
                });
                console.log('Manual project update successful');
              } catch (manualUpdateError) {
                console.error('Manual project update failed:', manualUpdateError);
              }
            }
          } catch (retryError) {
            console.error('Error during retry:', retryError);
          }
        }
      } catch (associationError) {
        console.error('Error associating failed inspection with project:', associationError);
      }
    }
    
    return savedInspection;
  } catch (error) {
    console.error('Error saving failed inspection result:', error);
    throw error;
  }
};

/**
 * Create a new project
 */
export const createProject = async (name: string, description: string, userId: string) => {
  try {
    return await createProjectModel({
      name,
      description,
      userId
    });
  } catch (error) {
    console.error('Error creating project:', error);
    throw error;
  }
};

/**
 * Get inspection by ID
 */
export const getInspection = async (id: string) => {
  try {
    return await getInspectionById(id);
  } catch (error) {
    console.error(`Error getting inspection with ID ${id}:`, error);
    throw error;
  }
};

/**
 * Get project by ID
 */
export const getProject = async (id: string) => {
  try {
    return await getProjectById(id);
  } catch (error) {
    console.error(`Error getting project with ID ${id}:`, error);
    throw error;
  }
};

/**
 * Get recent inspections
 */
export const getHistory = async (limit = 10) => {
  try {
    return await getRecentInspections(limit);
  } catch (error) {
    console.error('Error getting inspection history:', error);
    throw error;
  }
};

/**
 * Get recent projects
 */
export const getProjects = async (limit = 10) => {
  try {
    return await getRecentProjects(limit);
  } catch (error) {
    console.error('Error getting projects:', error);
    throw error;
  }
};

/**
 * Delete an inspection
 */
export const removeInspection = async (id: string) => {
  try {
    return await deleteInspection(id);
  } catch (error) {
    console.error(`Error deleting inspection with ID ${id}:`, error);
    throw error;
  }
};

/**
 * Delete a project
 */
export const removeProject = async (id: string) => {
  try {
    return await deleteProject(id);
  } catch (error) {
    console.error(`Error deleting project with ID ${id}:`, error);
    throw error;
  }
}; 