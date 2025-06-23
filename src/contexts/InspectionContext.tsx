'use client';

import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// Types
export interface InspectionItem {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
  projectId?: string; // Reference to the project this inspection belongs to
  backendId?: string; // Reference to the backend ID of this inspection
}

export interface Project {
  id: string;
  name: string; // Changed from title to name to match backend
  description?: string; // Added to match backend
  createdAt: Date;
  inspectionIds: string[]; // References to the inspections in this project
  updatedAt?: Date; // Added to match backend
}

interface InspectionContextType {
  queue: InspectionItem[];
  recentInspections: InspectionItem[];
  projects: Project[];
  addToQueue: (urls: string[], projectTitle?: string) => Promise<void>;
  getInspectionById: (id: string) => InspectionItem | undefined;
  getProjectById: (id: string) => Project | undefined;
  getProjectInspections: (projectId: string) => InspectionItem[];
  deleteInspection: (id: string) => void;
  deleteProject: (id: string) => void;
  exportInspectionToCsv: (id: string) => void;
  exportProjectToCsv: (id: string) => void;
}

// Create the context
const InspectionContext = createContext<InspectionContextType | undefined>(undefined);

// Hook to use the inspection context
export function useInspection() {
  const context = useContext(InspectionContext);
  if (context === undefined) {
    throw new Error('useInspection must be used within an InspectionProvider');
  }
  return context;
}

// Provider component
export function InspectionProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<InspectionItem[]>([]);
  const [recentInspections, setRecentInspections] = useState<InspectionItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [savingProjects, setSavingProjects] = useState<Set<string>>(new Set()); // Track projects being saved

  // Function to generate a unique ID
  const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Add a function to save a project to the backend database
  const saveProjectToDatabase = async (project: Project, inspectionIds: string[] = []): Promise<string | null> => {
    // Check if this project is already being saved
    if (savingProjects.has(project.id)) {
      console.log(`Project ${project.id} is already being saved, skipping duplicate save`);
      return null;
    }

    // Mark project as being saved
    setSavingProjects(prev => new Set(prev).add(project.id));

    try {
      // Use only valid inspection IDs (non-empty strings)
      const validInspectionIds = inspectionIds.filter(id => id && typeof id === 'string' && id.trim() !== '');
      
      console.log('Attempting to save project:', { 
        name: project.name, 
        description: project.description,
        inspectionIdsCount: validInspectionIds.length,
        inspectionIds: validInspectionIds 
      });
      
      const responseData = await apiClient.createProject({
        name: project.name,
        description: project.description,
        inspectionIds: validInspectionIds.length > 0 ? validInspectionIds : []
      });
      
      console.log('Project API response:', responseData);
      
      if (responseData && responseData.project && responseData.project._id) {
        console.log('Project saved successfully with ID:', responseData.project._id);
        return responseData.project._id;
      } else {
        console.error('Project save response did not contain expected _id field:', responseData);
        return null;
      }
    } catch (error) {
      console.error('Error saving project to database:', error);
      return null;
    } finally {
      // Remove project from saving set
      setSavingProjects(prev => {
        const newSet = new Set(prev);
        newSet.delete(project.id);
        return newSet;
      });
    }
  };

  // Add URLs to the inspection queue
  const addToQueue = async (urls: string[], projectTitle?: string) => {
    console.log('Starting addToQueue with project title:', projectTitle);
    
    // Initialize projectId as potentially undefined
    let projectId: string | undefined = undefined;
    let localProjectId: string | undefined = undefined;
    let projectObject: Project | undefined = undefined;
    
    // If project title is provided, create a new project
    if (projectTitle) {
      localProjectId = generateId('proj');
      console.log('Generated local project ID:', localProjectId);
      
      // Create the project object to use throughout the function
      projectObject = {
        id: localProjectId,
        name: projectTitle,
        description: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        inspectionIds: []
      };
      
      console.log('Created project object:', projectObject);
      
      // Add project to state
      setProjects(prev => {
        const newProjects = [...prev, projectObject as Project];
        console.log('Updated projects state with new project. Total projects:', newProjects.length);
        return newProjects;
      });

      // IMPORTANT: Create the project in Firebase FIRST before processing inspections
      // This prevents the race condition where inspections try to associate with non-existent projects
      try {
        console.log('Creating project in Firebase before processing inspections...');
        const savedProjectId = await saveProjectToDatabase(projectObject, []);
        
        if (savedProjectId) {
          console.log(`Project created in Firebase with ID: ${savedProjectId}`);
          projectId = savedProjectId; // Use the real Firebase project ID for inspections
          
          // Update the project in our local state with the saved ID
          setProjects(prev => {
            return prev.map(project => 
              project.id === localProjectId 
                ? { ...project, id: savedProjectId } 
                : project
            );
          });
        } else {
          console.error('Failed to create project in Firebase');
          projectId = localProjectId; // Fallback to local ID
        }
      } catch (error) {
        console.error('Error creating project in Firebase:', error);
        projectId = localProjectId; // Fallback to local ID
      }
    }

    // Create new queue items
    const newItems = urls.map(url => ({
      id: generateId('insp'),
      url,
      status: 'pending' as const,
      progress: 0,
      createdAt: new Date(),
      projectId: projectId // Use the real Firebase project ID
    }));

    // Add to queue
    setQueue(prev => [...prev, ...newItems]);

    // Process each URL sequentially for now
    const completedInspectionIds: string[] = [];
    const backendInspectionIds: string[] = []; // Store backend IDs from inspections
    
    for (const item of newItems) {
      // Update status to processing
      setQueue(prev => 
        prev.map(qItem => 
          qItem.id === item.id 
            ? { ...qItem, status: 'processing' as const, progress: 10 } 
            : qItem
        )
      );

      try {
        console.log(`Processing inspection for URL: ${item.url}`);
        
        // Call the API to inspect the URL
        const inspectionResult = await apiClient.inspectUrl([item.url], projectId);
        
        console.log(`Inspection completed for ${item.url}:`, inspectionResult);
        
        // Check if this is a failed inspection
        if (inspectionResult.status === 'failed') {
          // Handle failed inspection
          setQueue(prev => 
            prev.map(qItem => 
              qItem.id === item.id 
                ? { 
                    ...qItem, 
                    status: 'failed' as const, 
                    error: inspectionResult.error || 'Inspection failed',
                    completedAt: new Date(),
                    backendInspectionId: inspectionResult.id,
                    result: inspectionResult
                  }
                : qItem
            )
          );
        } else {
          // Handle successful inspection
          setQueue(prev => 
            prev.map(qItem => 
              qItem.id === item.id 
                ? { 
                    ...qItem, 
                    status: 'completed' as const, 
                    completedAt: new Date(),
                    backendInspectionId: inspectionResult.id,
                    backendId: inspectionResult.id, // Add this for analyze page compatibility
                    result: inspectionResult
                  }
                : qItem
            )
          );
        }

        // Capture the inspection ID from the backend for database association
        const backendInspectionId = inspectionResult._id || inspectionResult.inspectionId || inspectionResult.id || null;
        if (backendInspectionId) {
          completedInspectionIds.push(item.id); // Local ID for state updates
          backendInspectionIds.push(backendInspectionId); // Backend ID for database association
        }

        // Add to recent inspections for quick access (only for successful inspections)
        if (inspectionResult.status !== 'failed') {
          setRecentInspections(prev => [{
            id: inspectionResult.id || inspectionResult._id,
            url: item.url,
            status: 'completed' as const,
            progress: 100,
            result: inspectionResult,
            createdAt: new Date(),
            completedAt: new Date(),
            backendId: backendInspectionId
          }, ...prev].slice(0, 10));
        }

      } catch (error) {
        console.error(`Failed to inspect ${item.url}:`, error);
        
        // Update the queue item with failure status
        setQueue(prev => 
          prev.map(qItem => 
            qItem.id === item.id 
              ? { 
                  ...qItem, 
                  status: 'failed' as const, 
                  error: error instanceof Error ? error.message : String(error),
                  completedAt: new Date()
                }
              : qItem
          )
        );
        
        // Note: This catch block should rarely be reached now since failed inspections
        // are returned as successful responses with status: 'failed'
      }
    }

    // If we have a project and backend inspection IDs, update the project with the inspection IDs
    if (projectId && projectObject && backendInspectionIds.length > 0) {
      console.log('Updating project with backend inspection IDs:', backendInspectionIds);
      
      try {
        // Update the project object with the backend inspection IDs
        projectObject.inspectionIds = backendInspectionIds;
        
        // Update the project in Firebase with the inspection IDs
        const updatedProjectId = await saveProjectToDatabase(projectObject, backendInspectionIds);
        
        if (updatedProjectId) {
          console.log(`Project updated successfully with inspection IDs: ${updatedProjectId}`);
          
          // Update the project in our local state with the backend inspection IDs
          setProjects(prev => {
            return prev.map(project => 
              project.id === projectId 
                ? { ...project, inspectionIds: backendInspectionIds } 
                : project
            );
          });
        }
      } catch (error) {
        console.error('Error updating project with inspection IDs:', error);
      }
    }

    // Navigate to the project page only if we have a project with multiple URLs
    if (projectId && projectObject && urls.length > 1) {
      // Navigate to the project page after a short delay to ensure state is updated
      setTimeout(() => {
        console.log(`Navigating to project page: /project/${projectId}`);
        window.location.href = `/project/${projectId}`;
      }, 1000);
    }
  };

  // Get an inspection by ID
  const getInspectionById = (id: string) => {
    // Check queue first
    const queueItem = queue.find(item => item.id === id);
    if (queueItem) return queueItem;

    // Then check recent inspections
    return recentInspections.find(item => item.id === id);
  };

  // Get a project by ID
  const getProjectById = (id: string) => {
    const project = projects.find(project => project.id === id);
    
    // If not found in local state but looks like a Firebase ID (more flexible pattern),
    // try to fetch it from the backend
    if (!project) {
      // Fetch in the background and update state
      fetch(`/api/projects/${id}`)
        .then(response => {
          if (!response.ok) throw new Error('Project not found');
          return response.json();
        })
        .then(data => {
          // Convert backend project to our format and add to local state
          const newProject: Project = {
            id: data._id, // Store the Firebase ID directly as our id
            name: data.name,
            description: data.description || '',
            createdAt: new Date(data.createdAt),
            updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
            inspectionIds: data.inspections.map((insp: any) => insp._id) || []
          };
          setProjects(prev => [...prev, newProject]);
        })
        .catch(error => {
          console.error('Error fetching project from backend:', error);
        });
    }
    
    return project;
  };

  const getProjectInspections = (projectId: string) => {
    // Get inspections from both the queue and completed inspections
    const queuedInspections = queue.filter(item => item.projectId === projectId);
    const completedInspections = recentInspections.filter(item => item.projectId === projectId);
    
    // Combine both lists, giving priority to queue items
    const allInspectionIds = new Set([...queuedInspections, ...completedInspections].map(item => item.id));
    
    return [...queuedInspections, ...completedInspections.filter(item => !queuedInspections.some(q => q.id === item.id))];
  };

  // Delete an inspection
  const deleteInspection = (id: string) => {
    // Remove from queue if present
    setQueue(prev => prev.filter(item => item.id !== id));
    
    // Remove from recent inspections
    setRecentInspections(prev => prev.filter(item => item.id !== id));
    
    // If inspection is part of a project, remove it from the project's inspection list
    const inspection = getInspectionById(id);
    if (inspection?.projectId) {
      setProjects(prev => 
        prev.map(project => 
          project.id === inspection.projectId
            ? { ...project, inspectionIds: project.inspectionIds.filter(inspId => inspId !== id) }
            : project
        )
      );
    }
  };

  // Delete a project and all its inspections
  const deleteProject = (id: string) => {
    // Get all inspections for this project
    const projectInspections = getProjectInspections(id);
    
    // Delete each inspection
    projectInspections.forEach(inspection => {
      deleteInspection(inspection.id);
    });
    
    // Remove the project
    setProjects(prev => prev.filter(project => project.id !== id));
  };

  // Export inspection data to CSV
  const exportInspectionToCsv = (id: string) => {
    const inspection = getInspectionById(id);
    if (!inspection || inspection.status !== 'completed') return;

    const { result } = inspection;
    
    // Helper function to find font family from CSS @font-face declarations
    const findFontFamilyFromCSS = (fontUrl: string, fontFaceDeclarations: any[]) => {
      if (!fontFaceDeclarations?.length) {
        return 'Unknown';
      }
      
      // Try to match the font URL with @font-face declarations
      for (const declaration of fontFaceDeclarations) {
        if (declaration.source && declaration.family) {
          // Check if the font URL is referenced in the @font-face source
          const sourceUrls = declaration.source.match(/url\(['"]?([^'")\s]+)['"]?\)/gi);
          
          if (sourceUrls) {
            for (const sourceUrl of sourceUrls) {
              // Extract the actual URL from url() declaration
              const urlMatch = sourceUrl.match(/url\(['"]?([^'")\s]+)['"]?\)/i);
              if (urlMatch && urlMatch[1]) {
                const cssUrl = urlMatch[1];
                
                // Check if the font URL matches or ends with the CSS URL
                if (fontUrl === cssUrl || 
                    fontUrl.endsWith(cssUrl) || 
                    cssUrl.endsWith(fontUrl.split('/').pop() || '') ||
                    fontUrl.includes(cssUrl.split('/').pop() || '')) {
                  return declaration.family.replace(/["']/g, '').trim();
                }
              }
            }
          }
        }
      }
      
      return 'Unknown';
    };
    
    // Prepare data for downloadedFonts
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Headers for downloadedFonts - now includes Font Family
    csvContent += "Font Family,Font Name,Format,Size (KB),URL,Source\n";
    
    // Add downloaded fonts data
    if (result?.result?.downloadedFonts?.length) {
      result.result.downloadedFonts.forEach((font: any) => {
        const fontFamily = findFontFamilyFromCSS(font.url, result?.result?.fontFaceDeclarations || []);
        const row = [
          fontFamily,
          font.name || 'Unknown',
          font.format || 'Unknown',
          (font.size / 1024).toFixed(2) || '0',
          font.url || '',
          font.source || 'Unknown'
        ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(',');
        
        csvContent += row + "\n";
      });
    }
    
    // Add a separator if we have active fonts data too
    if (result?.result?.activeFonts?.length && result?.result?.downloadedFonts?.length) {
      csvContent += "\n";
      csvContent += "Active Fonts\n";
      csvContent += "Font Family,Element Count\n";
      
      result.result.activeFonts.forEach((font: any) => {
        const elementCount = font.elementCount || font.count || 0;
        const row = [
          font.family || 'Unknown',
          elementCount.toString()
        ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(',');
        
        csvContent += row + "\n";
      });
    }
    
    // Create and trigger download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `font-inspection-${inspection.url.replace(/[^a-z0-9]/gi, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export project data to CSV
  const exportProjectToCsv = (id: string) => {
    const project = getProjectById(id);
    if (!project) return;
    
    const projectInspections = getProjectInspections(id)
      .filter(insp => insp.status === 'completed');
    
    if (projectInspections.length === 0) return;
    
    // Helper function to find font family from CSS @font-face declarations
    const findFontFamilyFromCSS = (fontUrl: string, fontFaceDeclarations: any[]) => {
      if (!fontFaceDeclarations?.length) {
        return 'Unknown';
      }
      
      // Try to match the font URL with @font-face declarations
      for (const declaration of fontFaceDeclarations) {
        if (declaration.source && declaration.family) {
          // Check if the font URL is referenced in the @font-face source
          const sourceUrls = declaration.source.match(/url\(['"]?([^'")\s]+)['"]?\)/gi);
          
          if (sourceUrls) {
            for (const sourceUrl of sourceUrls) {
              // Extract the actual URL from url() declaration
              const urlMatch = sourceUrl.match(/url\(['"]?([^'")\s]+)['"]?\)/i);
              if (urlMatch && urlMatch[1]) {
                const cssUrl = urlMatch[1];
                
                // Check if the font URL matches or ends with the CSS URL
                if (fontUrl === cssUrl || 
                    fontUrl.endsWith(cssUrl) || 
                    cssUrl.endsWith(fontUrl.split('/').pop() || '') ||
                    fontUrl.includes(cssUrl.split('/').pop() || '')) {
                  return declaration.family.replace(/["']/g, '').trim();
                }
              }
            }
          }
        }
      }
      
      return 'Unknown';
    };
    
    // Prepare CSV data
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Headers - now includes Font Family
    csvContent += "Website URL,Font Family,Font Name,Format,Size (KB),Source\n";
    
    // Add data from all inspections
    projectInspections.forEach(inspection => {
      const { url, result } = inspection;
      
      if (result?.result?.downloadedFonts?.length) {
        result.result.downloadedFonts.forEach((font: any) => {
          const fontFamily = findFontFamilyFromCSS(font.url, result?.result?.fontFaceDeclarations || []);
          const row = [
            url,
            fontFamily,
            font.name || 'Unknown',
            font.format || 'Unknown',
            (font.size / 1024).toFixed(2) || '0',
            font.source || 'Unknown'
          ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(',');
          
          csvContent += row + "\n";
        });
      }
    });
    
    // Create and trigger download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `project-${project.name.replace(/[^a-z0-9]/gi, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Fetch recent inspections from the API
  const fetchRecentInspections = useCallback(async () => {
    try {
      const data = await apiClient.getHistory();
      
      if (Array.isArray(data)) {
        // Process inspection data
        const processedInspections = data
          .filter(item => !item.inspections) // Filter out projects
          .map(item => ({
            id: `inspection_${item._id}`,
            url: item.url,
            status: 'completed' as const,
            progress: 100,
            createdAt: new Date(item.timestamp || item.createdAt),
            completedAt: new Date(item.timestamp || item.createdAt),
            result: {
              url: item.url,
              result: {
                downloadedFonts: item.downloadedFonts || [],
                fontFaceDeclarations: item.fontFaceDeclarations || [],
                activeFonts: item.activeFonts || []
              }
            },
            projectId: item.projectId,
            backendId: item._id
          }));
        
        // Process project data
        const processedProjects = data
          .filter(item => item.inspections) // Only projects
          .map(data => {
            const project: Project = {
              id: data._id,
              name: data.name,
              description: data.description || '',
              createdAt: new Date(data.createdAt),
              updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
              inspectionIds: data.inspections.map((insp: any) => insp._id) || []
            };
            return project;
          });
        
        setRecentInspections(processedInspections);
        setProjects(processedProjects);
      }
    } catch (error) {
      console.error('Error fetching recent inspections:', error);
      // Handle authentication errors gracefully
      if (error instanceof Error && error.message.includes('Authentication required')) {
        console.log('User not authenticated, skipping recent inspections fetch');
      }
    }
  }, []);

  // Create a new project
  const createNewProject = (projectTitle: string, inspectionIds: string[] = []) => {
    const projectId = generateId('project');
    
    const newProject: Project = {
      id: projectId,
      name: projectTitle,
      description: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      inspectionIds: []
    };
    
    setProjects(prevProjects => [...prevProjects, newProject]);
    
    // If there are inspections, add them to the project
    if (inspectionIds.length > 0) {
      saveProjectToDatabase(newProject, inspectionIds)
        .then(savedId => {
          console.log(`Project saved with DB ID: ${savedId}`);
          
          // Update inspections with project reference
          if (savedId) {
            inspectionIds.forEach(inspId => {
              // Find this inspection in the queue or recent inspections
              const inspectionItem = [...queue, ...recentInspections].find(item => item.id === inspId);
              
              if (inspectionItem) {
                // Update the item with the project reference
                const updatedItem = {
                  ...inspectionItem,
                  projectId: savedId
                };
                
                // Update in the appropriate list
                if (queue.some(item => item.id === inspId)) {
                  setQueue(prev => prev.map(item => item.id === inspId ? updatedItem : item));
                } else {
                  setRecentInspections(prev => prev.map(item => item.id === inspId ? updatedItem : item));
                }
              }
            });
          }
        });
    }
    
    return projectId;
  };

  const value = {
    queue,
    recentInspections,
    projects,
    addToQueue,
    getInspectionById,
    getProjectById,
    getProjectInspections,
    deleteInspection,
    deleteProject,
    exportInspectionToCsv,
    exportProjectToCsv
  };

  return (
    <InspectionContext.Provider value={value}>
      {children}
    </InspectionContext.Provider>
  );
} 