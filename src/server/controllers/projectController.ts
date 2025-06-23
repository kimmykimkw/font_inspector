import { Request, Response } from 'express';
import { inspectWebsite } from '../services/inspectionService';
import { 
  createProject, 
  saveInspectionResult, 
  getProject, 
  getProjects, 
  removeProject 
} from '../services/firebaseService';

// Create a new project with multiple URLs
export const createNewProject = async (req: Request, res: Response) => {
  try {
    const { name, description, urls } = req.body;
    
    if (!name || !urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ 
        error: 'Please provide a project name and an array of URLs to inspect' 
      });
    }

    // Create a new project
    const project = await createProject(name, description || '');
    
    if (!project || !project.id) {
      return res.status(500).json({ error: 'Failed to create project' });
    }
    
    // Queue inspections for all URLs
    const inspectionPromises = urls.map(async (url: string) => {
      if (typeof url !== 'string' || !url.trim()) {
        return { url, error: 'Invalid URL' };
      }

      // Normalize URL
      let normalizedUrl = url.trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `https://${normalizedUrl}`;
      }
      
      try {
        // Inspect the website
        const result = await inspectWebsite(normalizedUrl);
        
        // Save the results and associate with the project
        const savedInspection = await saveInspectionResult(normalizedUrl, result, project.id);
        
        return { 
          url: normalizedUrl, 
          id: savedInspection.id,
          success: true 
        };
      } catch (error) {
        return { 
          url: normalizedUrl, 
          error: error instanceof Error ? error.message : 'Inspection failed',
          success: false
        };
      }
    });
    
    // Wait for all inspections to complete
    const inspectionResults = await Promise.all(inspectionPromises);
    
    return res.status(200).json({
      success: true,
      project,
      inspections: inspectionResults
    });
  } catch (error) {
    console.error('Project creation error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
};

// Get project by ID
export const getProjectById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    
    const project = await getProject(id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    return res.status(200).json(project);
  } catch (error) {
    console.error('Error retrieving project:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
};

// Get all projects
export const getAllProjects = async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    
    const projects = await getProjects(limit);
    
    return res.status(200).json(projects);
  } catch (error) {
    console.error('Error retrieving projects:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
};

// Delete project
export const deleteProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    
    const deleted = await removeProject(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Project not found or could not be deleted' });
    }
    
    return res.status(200).json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
}; 