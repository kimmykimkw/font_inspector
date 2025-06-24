import { auth } from '@/lib/firebase-client';
import logger from './logger';

/**
 * Get the current Firebase ID token for authenticated requests
 */
async function getAuthToken(): Promise<string | null> {
  try {
    if (!auth) {
      logger.error('Firebase auth not initialized');
      return null;
    }

    if (!auth.currentUser) {
      logger.debug('No authenticated user found');
      return null;
    }

    logger.debug('Getting ID token');
    const token = await auth.currentUser.getIdToken(true); // Force refresh
    logger.debug('Successfully retrieved ID token');
    return token;
  } catch (error) {
    logger.error('Error getting auth token:', error);
    return null;
  }
}

/**
 * Make an authenticated API request
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  logger.debug(`Making authenticated request to: ${url}`);
  
  const token = await getAuthToken();
  
  if (!token) {
    throw new Error('Authentication required. Please sign in and try again.');
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    logger.warn(`Request failed for ${url}: ${response.status}`);
  }
  
  return response;
}

/**
 * API helper functions for common operations
 */
export const apiClient = {
  // Fetch inspection history
  async getHistory(): Promise<any[]> {
    try {
      logger.debug('Fetching history...');
      const response = await authenticatedFetch('/api/history');
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        logger.error('History fetch failed:', response.status, errorData);
        throw new Error(errorData.error || `Failed to fetch history (${response.status})`);
      }
      
      const data = await response.json();
      logger.info(`Fetched ${data.length} history items`);
      return data;
    } catch (error) {
      logger.error('Error in getHistory:', error);
      throw error;
    }
  },

  // Fetch projects
  async getProjects(): Promise<any[]> {
    try {
      const response = await authenticatedFetch('/api/projects');
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        logger.error('Projects fetch failed:', response.status, errorData);
        throw new Error(errorData.error || `Failed to fetch projects (${response.status})`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      logger.error('Error in getProjects:', error);
      throw error;
    }
  },

  // Create a project
  async createProject(projectData: { name: string; description?: string; inspectionIds?: string[] }): Promise<any> {
    try {
      const response = await authenticatedFetch('/api/projects', {
        method: 'POST',
        body: JSON.stringify(projectData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        logger.error('Project creation failed:', response.status, errorData);
        throw new Error(errorData.error || `Failed to create project (${response.status})`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      logger.error('Error in createProject:', error);
      throw error;
    }
  },

  // Inspect a URL
  async inspectUrl(urls: string[], projectId?: string): Promise<any> {
    try {
      const response = await authenticatedFetch('/api/inspect', {
        method: 'POST',
        body: JSON.stringify({ urls, projectId }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        logger.error('URL inspection failed:', response.status, errorData);
        
        // Create detailed error message
        let errorMessage = 'Website inspection failed';
        if (errorData.error) {
          errorMessage = errorData.error;
        }
        if (errorData.details) {
          errorMessage += `: ${errorData.details}`;
        }
        if (errorData.url) {
          errorMessage += ` (URL: ${errorData.url})`;
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      logger.error('Error in inspectUrl:', error);
      throw error;
    }
  },

  // Get inspection by ID
  async getInspection(id: string): Promise<any> {
    try {
      const response = await authenticatedFetch(`/api/results/${id}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        logger.error('Inspection fetch failed:', response.status, errorData);
        throw new Error(errorData.error || `Failed to fetch inspection (${response.status})`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      logger.error('Error in getInspection:', error);
      throw error;
    }
  },

  // Delete inspection
  async deleteInspection(id: string): Promise<void> {
    try {
      const response = await authenticatedFetch(`/api/results/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        logger.error('Inspection deletion failed:', response.status, errorData);
        throw new Error(errorData.error || `Failed to delete inspection (${response.status})`);
      }
    } catch (error) {
      logger.error('Error in deleteInspection:', error);
      throw error;
    }
  },
}; 