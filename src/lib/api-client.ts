import { auth } from '@/lib/firebase-client';

/**
 * Get the current Firebase ID token for authenticated requests
 */
async function getAuthToken(): Promise<string | null> {
  try {
    if (!auth) {
      console.error('Firebase auth not initialized');
      return null;
    }

    if (!auth.currentUser) {
      console.warn('No authenticated user found');
      return null;
    }

    console.log('Getting ID token for user:', auth.currentUser.uid);
    const token = await auth.currentUser.getIdToken(true); // Force refresh
    console.log('Successfully retrieved ID token');
    return token;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}

/**
 * Make an authenticated API request
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  console.log(`Making authenticated request to: ${url}`);
  
  const token = await getAuthToken();
  
  if (!token) {
    throw new Error('Authentication required. Please sign in and try again.');
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };

  console.log('Request headers:', { ...headers, Authorization: `Bearer ${token.substring(0, 20)}...` });

  const response = await fetch(url, {
    ...options,
    headers,
  });

  console.log(`Response status for ${url}: ${response.status}`);
  
  return response;
}

/**
 * API helper functions for common operations
 */
export const apiClient = {
  // Fetch inspection history
  async getHistory(): Promise<any[]> {
    try {
      console.log('API Client: Fetching history...');
      const response = await authenticatedFetch('/api/history');
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        console.error('History fetch failed:', response.status, errorData);
        throw new Error(errorData.error || `Failed to fetch history (${response.status})`);
      }
      
      const data = await response.json();
      console.log('API Client: Successfully fetched history:', data.length, 'items');
      return data;
    } catch (error) {
      console.error('API Client: Error in getHistory:', error);
      throw error;
    }
  },

  // Fetch projects
  async getProjects(): Promise<any[]> {
    try {
      console.log('API Client: Fetching projects...');
      const response = await authenticatedFetch('/api/projects');
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        console.error('Projects fetch failed:', response.status, errorData);
        throw new Error(errorData.error || `Failed to fetch projects (${response.status})`);
      }
      
      const data = await response.json();
      console.log('API Client: Successfully fetched projects:', data.length, 'items');
      return data;
    } catch (error) {
      console.error('API Client: Error in getProjects:', error);
      throw error;
    }
  },

  // Create a project
  async createProject(projectData: { name: string; description?: string; inspectionIds?: string[] }): Promise<any> {
    try {
      console.log('API Client: Creating project:', projectData);
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
        console.error('Project creation failed:', response.status, errorData);
        throw new Error(errorData.error || `Failed to create project (${response.status})`);
      }
      
      const data = await response.json();
      console.log('API Client: Successfully created project:', data);
      return data;
    } catch (error) {
      console.error('API Client: Error in createProject:', error);
      throw error;
    }
  },

  // Inspect a URL
  async inspectUrl(urls: string[], projectId?: string): Promise<any> {
    try {
      console.log('API Client: Inspecting URLs:', urls, 'for project:', projectId);
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
        console.error('URL inspection failed:', response.status, errorData);
        
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
      console.log('API Client: Successfully inspected URL:', data);
      return data;
    } catch (error) {
      console.error('API Client: Error in inspectUrl:', error);
      throw error;
    }
  },

  // Get inspection by ID
  async getInspection(id: string): Promise<any> {
    try {
      console.log('API Client: Fetching inspection:', id);
      const response = await authenticatedFetch(`/api/results/${id}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        console.error('Inspection fetch failed:', response.status, errorData);
        throw new Error(errorData.error || `Failed to fetch inspection (${response.status})`);
      }
      
      const data = await response.json();
      console.log('API Client: Successfully fetched inspection:', data);
      return data;
    } catch (error) {
      console.error('API Client: Error in getInspection:', error);
      throw error;
    }
  },

  // Delete inspection
  async deleteInspection(id: string): Promise<void> {
    try {
      console.log('API Client: Deleting inspection:', id);
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
        console.error('Inspection deletion failed:', response.status, errorData);
        throw new Error(errorData.error || `Failed to delete inspection (${response.status})`);
      }
      
      console.log('API Client: Successfully deleted inspection:', id);
    } catch (error) {
      console.error('API Client: Error in deleteInspection:', error);
      throw error;
    }
  },
}; 