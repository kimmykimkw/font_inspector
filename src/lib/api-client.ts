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
  // Fetch inspection history with pagination
  async getHistory(page = 1, limit = 50): Promise<{ data: any[], pagination: any }> {
    try {
      logger.debug(`Fetching history page ${page}...`);
      const response = await authenticatedFetch(`/api/history?page=${page}&limit=${limit}`);
      
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
      
      const result = await response.json();
      logger.info(`Fetched ${result.data?.length || 0} history items (page ${page})`);
      return result;
    } catch (error) {
      logger.error('Error in getHistory:', error);
      throw error;
    }
  },

  // Search inspections
  async searchInspections(searchTerm: string, page = 1, limit = 50): Promise<{ data: any[], pagination: any, isSearch: boolean }> {
    try {
      logger.debug(`Searching inspections for "${searchTerm}" (page ${page})...`);
      const response = await authenticatedFetch(`/api/history?search=${encodeURIComponent(searchTerm)}&page=${page}&limit=${limit}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        logger.error('Search inspections failed:', response.status, errorData);
        throw new Error(errorData.error || `Failed to search inspections (${response.status})`);
      }
      
      const result = await response.json();
      logger.info(`Found ${result.data?.length || 0} matching inspections (page ${page})`);
      return result;
    } catch (error) {
      logger.error('Error in searchInspections:', error);
      throw error;
    }
  },

  // Fetch total counts
  async getTotalCounts(): Promise<{ inspections: number, projects: number }> {
    try {
      logger.debug('Fetching total counts...');
      const response = await authenticatedFetch('/api/history/counts');
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        logger.error('Total counts fetch failed:', response.status, errorData);
        throw new Error(errorData.error || `Failed to fetch total counts (${response.status})`);
      }
      
      const data = await response.json();
      logger.info(`Fetched total counts - Inspections: ${data.inspections}, Projects: ${data.projects}`);
      return data;
    } catch (error) {
      logger.error('Error in getTotalCounts:', error);
      throw error;
    }
  },

  // Fetch projects (legacy method - returns all projects)
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

  // Fetch projects with pagination
  async getProjectsPaginated(page = 1, limit = 50): Promise<{ data: any[], pagination: any }> {
    try {
      logger.debug(`Fetching projects page ${page}...`);
      const response = await authenticatedFetch(`/api/projects?page=${page}&limit=${limit}`);
      
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
      
      const result = await response.json();
      
      // Handle both paginated and legacy response formats
      if (result.data && result.pagination) {
        logger.info(`Fetched ${result.data.length} projects (page ${page})`);
        return result;
      } else {
        // Legacy format - all projects returned
        logger.info(`Fetched ${result.length} projects (all)`);
        return {
          data: result,
          pagination: {
            page: 1,
            limit: result.length,
            hasMore: false
          }
        };
      }
    } catch (error) {
      logger.error('Error in getProjectsPaginated:', error);
      throw error;
    }
  },

  // Search projects
  async searchProjects(searchTerm: string, page = 1, limit = 50): Promise<{ data: any[], pagination: any, isSearch: boolean }> {
    try {
      logger.debug(`Searching projects for "${searchTerm}" (page ${page})...`);
      const response = await authenticatedFetch(`/api/projects?search=${encodeURIComponent(searchTerm)}&page=${page}&limit=${limit}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        logger.error('Search projects failed:', response.status, errorData);
        throw new Error(errorData.error || `Failed to search projects (${response.status})`);
      }
      
      const result = await response.json();
      logger.info(`Found ${result.data?.length || 0} matching projects (page ${page})`);
      return result;
    } catch (error) {
      logger.error('Error in searchProjects:', error);
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

  // Discover pages from a website
  async discoverPages(url: string, pageCount: number) {
    try {
      logger.info(`Discovering ${pageCount} pages from ${url}`);
      
      const response = await authenticatedFetch('/api/discover-pages', {
        method: 'POST',
        body: JSON.stringify({
          url,
          pageCount
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Page discovery failed');
      }

      logger.info(`Successfully discovered ${data.pages?.length || 0} pages`);
      return data;
    } catch (error) {
      logger.error('Error in discoverPages:', error);
      throw error;
    }
  },
}; 