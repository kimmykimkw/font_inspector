import { db, collections } from '../firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { getInspectionsByProjectId } from './inspection';

// Type definition for Project document
export interface Project {
  id?: string;
  name: string;
  description: string;
  inspectionIds: string[];
  userId: string; // Required field for user-specific data isolation
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

// Convert Firestore document to Project object
export const convertProject = (doc: FirebaseFirestore.DocumentSnapshot): Project | null => {
  if (!doc.exists) return null;
  
  const data = doc.data();
  if (!data) return null;
  
  return {
    id: doc.id,
    ...data,
  } as Project;
};

// Create a new project
export const createProject = async (
  project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'inspectionIds'> & { inspectionIds?: string[] }
): Promise<Project> => {
  const now = Timestamp.now();
  
  // Ensure userId is provided
  if (!project.userId) {
    throw new Error('userId is required to create a project');
  }
  
  // Check if a project with the same name already exists for this user
  const existingProjectsQuery = await collections.projects
    .where('userId', '==', project.userId)
    .where('name', '==', project.name)
    .limit(1)
    .get();
  
  if (!existingProjectsQuery.empty) {
    // Return the existing project instead of creating a duplicate
    console.log(`Project with name "${project.name}" already exists for user ${project.userId}, returning existing project`);
    return convertProject(existingProjectsQuery.docs[0]) as Project;
  }
  
  const newProject = {
    ...project,
    inspectionIds: project.inspectionIds || [],
    createdAt: now,
    updatedAt: now,
  };
  
  console.log(`Creating new project "${project.name}" for user ${project.userId}`);
  const docRef = await collections.projects.add(newProject);
  const doc = await docRef.get();
  
  return convertProject(doc) as Project;
};

// Get project by ID (with user verification)
export const getProjectById = async (id: string, userId?: string): Promise<Project | null> => {
  const doc = await collections.projects.doc(id).get();
  const project = convertProject(doc);
  
  // If userId is provided, verify the project belongs to the user
  if (project && userId && project.userId !== userId) {
    return null; // User is not authorized to view this project
  }
  
  return project;
};

// Get all projects for a specific user
export const getAllProjects = async (userId?: string): Promise<Project[]> => {
  let query: FirebaseFirestore.Query = collections.projects;
  
  // Filter by user if userId is provided
  if (userId) {
    query = query.where('userId', '==', userId);
  }
  
  // Get documents without ordering to avoid composite index requirement
  const snapshot = await query.get();
  
  const projects = snapshot.docs
    .map(convertProject)
    .filter((project): project is Project => project !== null);
  
  // Sort by createdAt in memory (most recent first)
  return projects.sort((a, b) => {
    const aTime = a.createdAt instanceof Timestamp ? a.createdAt.toDate() : new Date(a.createdAt);
    const bTime = b.createdAt instanceof Timestamp ? b.createdAt.toDate() : new Date(b.createdAt);
    return bTime.getTime() - aTime.getTime();
  });
};

// Get recent projects for a specific user
export const getRecentProjects = async (limit = 10, userId?: string): Promise<Project[]> => {
  // Get all projects and then limit in memory to avoid composite index
  const allProjects = await getAllProjects(userId);
  
  // Return only the requested number of projects
  return allProjects.slice(0, limit);
};

// Add inspection to project
export const addInspectionToProject = async (projectId: string, inspectionId: string): Promise<boolean> => {
  try {
    console.log(`Adding inspection ${inspectionId} to project ${projectId}`);

    // Start a transaction to ensure data consistency
    await db.runTransaction(async (transaction) => {
      // Get the project document
      const projectRef = collections.projects.doc(projectId);
      const projectDoc = await transaction.get(projectRef);
      
      if (!projectDoc.exists) {
        throw new Error(`Project with ID ${projectId} not found`);
      }
      
      // Get the inspection document
      const inspectionRef = collections.inspections.doc(inspectionId);
      const inspectionDoc = await transaction.get(inspectionRef);
      
      if (!inspectionDoc.exists) {
        throw new Error(`Inspection with ID ${inspectionId} not found`);
      }
      
      // Update the project with the inspection ID
      transaction.update(projectRef, {
        inspectionIds: FirebaseFirestore.FieldValue.arrayUnion(inspectionId),
        updatedAt: Timestamp.now()
      });
      
      // Update the inspection with the project ID reference
      transaction.update(inspectionRef, {
        projectId: projectId,
        updatedAt: Timestamp.now()
      });
    });
    
    console.log(`Successfully added inspection ${inspectionId} to project ${projectId}`);
    return true;
  } catch (error) {
    console.error('Error adding inspection to project:', error);
    return false;
  }
};

// Delete a project
export const deleteProject = async (id: string): Promise<boolean> => {
  try {
    // Get all inspections associated with this project
    const inspections = await getInspectionsByProjectId(id);
    
    // Start a batch
    const batch = db.batch();
    
    // Delete each inspection
    for (const inspection of inspections) {
      if (inspection.id) {
        const inspectionRef = collections.inspections.doc(inspection.id);
        batch.delete(inspectionRef);
      }
    }
    
    // Delete the project
    const projectRef = collections.projects.doc(id);
    batch.delete(projectRef);
    
    // Commit the batch
    await batch.commit();
    return true;
  } catch (error) {
    console.error('Error deleting project:', error);
    return false;
  }
}; 