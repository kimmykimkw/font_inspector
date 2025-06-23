import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface UserPermissionStatus {
  canCreateInspection: boolean;
  canCreateProject: boolean;
  inspectionMessage?: string;
  projectMessage?: string;
  inspectionCount?: number;
  inspectionLimit?: number;
  projectCount?: number;
  projectLimit?: number;
  isLoading: boolean;
  error?: string;
}

// Hook to check user permissions
export const useUserPermissions = (): UserPermissionStatus => {
  const { user } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState<UserPermissionStatus>({
    canCreateInspection: true,
    canCreateProject: true,
    isLoading: true
  });

  useEffect(() => {
    if (!user) {
      setPermissionStatus({
        canCreateInspection: false,
        canCreateProject: false,
        inspectionMessage: 'Please sign in to use this feature',
        projectMessage: 'Please sign in to use this feature',
        isLoading: false
      });
      return;
    }

    const checkPermissions = async () => {
      try {
        setPermissionStatus(prev => ({ ...prev, isLoading: true }));

        // Get user's ID token for API calls
        const idToken = await user.getIdToken();

        // Make a test call to check inspection limits
        const inspectionResponse = await fetch('/api/inspect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            urls: ['https://example.com'], // Dummy URL for testing
            permissionCheck: true // Add a flag to indicate this is a permission check
          })
        });

        // Make a test call to check project limits
        const projectResponse = await fetch('/api/projects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            name: 'Permission Check', // Dummy name for testing
            permissionCheck: true // Add a flag to indicate this is a permission check
          })
        });

        const inspectionData = await inspectionResponse.json();
        const projectData = await projectResponse.json();

        let canCreateInspection = inspectionResponse.ok;
        let canCreateProject = projectResponse.ok;
        let inspectionMessage = '';
        let projectMessage = '';

        // Handle inspection permission errors
        if (!inspectionResponse.ok) {
          if (inspectionResponse.status === 403) {
            inspectionMessage = inspectionData.message || 'Access denied';
          } else if (inspectionResponse.status === 429) {
            const current = inspectionData.currentCount || 0;
            const limit = inspectionData.limit || 0;
            inspectionMessage = `Monthly limit reached (${current}/${limit})`;
          } else {
            inspectionMessage = inspectionData.message || 'Permission check failed';
          }
        }

        // Handle project permission errors
        if (!projectResponse.ok) {
          if (projectResponse.status === 403) {
            projectMessage = projectData.message || 'Access denied';
          } else if (projectResponse.status === 429) {
            const current = projectData.currentCount || 0;
            const limit = projectData.limit || 0;
            projectMessage = `Monthly limit reached (${current}/${limit})`;
          } else {
            projectMessage = projectData.message || 'Permission check failed';
          }
        }

        setPermissionStatus({
          canCreateInspection,
          canCreateProject,
          inspectionMessage,
          projectMessage,
          inspectionCount: inspectionData.currentCount,
          inspectionLimit: inspectionData.limit,
          projectCount: projectData.currentCount,
          projectLimit: projectData.limit,
          isLoading: false
        });

      } catch (error) {
        console.error('Error checking permissions:', error);
        setPermissionStatus({
          canCreateInspection: false,
          canCreateProject: false,
          inspectionMessage: 'Error checking permissions',
          projectMessage: 'Error checking permissions',
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };

    checkPermissions();
  }, [user]);

  return permissionStatus;
}; 