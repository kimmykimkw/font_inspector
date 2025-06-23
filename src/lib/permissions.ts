// Permissions utility for macOS-specific permission handling
export interface PermissionStatus {
  granted: boolean;
  canRequest: boolean;
  name: string;
  description: string;
  settingsPath: string;
}

export interface PermissionResult {
  screenRecording: PermissionStatus;
  accessibility: PermissionStatus;
  camera?: PermissionStatus;
  microphone?: PermissionStatus;
}

export class MacPermissions {
  /**
   * Check screen recording permission status
   */
  static async checkScreenRecording(): Promise<PermissionStatus> {
    if (typeof window === 'undefined' || !window.electronAPI) {
      return {
        granted: true, // Assume granted in non-Electron environment
        canRequest: false,
        name: 'Screen Recording',
        description: 'Required for capturing website content and fonts',
        settingsPath: 'ScreenCapture'
      };
    }

    try {
      const hasPermission = await window.electronAPI.checkScreenRecordingPermission();
      return {
        granted: hasPermission,
        canRequest: !hasPermission,
        name: 'Screen Recording',
        description: 'Required for capturing website content and analyzing fonts',
        settingsPath: 'ScreenCapture'
      };
    } catch (error) {
      console.warn('Could not check screen recording permission:', error);
      return {
        granted: false,
        canRequest: true,
        name: 'Screen Recording',
        description: 'Required for capturing website content and analyzing fonts',
        settingsPath: 'ScreenCapture'
      };
    }
  }

  /**
   * Check accessibility permission status
   */
  static async checkAccessibility(): Promise<PermissionStatus> {
    if (typeof window === 'undefined' || !window.electronAPI) {
      return {
        granted: true,
        canRequest: false,
        name: 'Accessibility',
        description: 'Required for enhanced font detection',
        settingsPath: 'Accessibility'
      };
    }

    try {
      const hasPermission = await window.electronAPI.checkAccessibilityPermission();
      return {
        granted: hasPermission,
        canRequest: !hasPermission,
        name: 'Accessibility',
        description: 'Required for enhanced font detection and UI automation',
        settingsPath: 'Accessibility'
      };
    } catch (error) {
      console.warn('Could not check accessibility permission:', error);
      return {
        granted: false,
        canRequest: true,
        name: 'Accessibility',
        description: 'Required for enhanced font detection and UI automation',
        settingsPath: 'Accessibility'
      };
    }
  }

  /**
   * Check all permissions
   */
  static async checkAllPermissions(): Promise<PermissionResult> {
    const [screenRecording, accessibility] = await Promise.all([
      this.checkScreenRecording(),
      this.checkAccessibility()
    ]);

    return {
      screenRecording,
      accessibility
    };
  }

  /**
   * Open macOS System Settings to specific permission page
   */
  static async openSystemSettings(settingsPath: string): Promise<void> {
    if (typeof window === 'undefined' || !window.electronAPI) {
      // Fallback for non-Electron environment
      console.log(`Would open System Settings > Privacy & Security > ${settingsPath}`);
      return;
    }

    try {
      await window.electronAPI.openSystemSettings(settingsPath);
    } catch (error) {
      console.error('Failed to open system settings:', error);
      // Fallback: try to open general System Settings
      try {
        await window.electronAPI.openSystemSettings('');
      } catch (fallbackError) {
        console.error('Failed to open system settings fallback:', fallbackError);
      }
    }
  }

  /**
   * Get critical permissions that are required for basic functionality
   */
  static getCriticalPermissions(): Array<keyof PermissionResult> {
    return ['screenRecording'];
  }

  /**
   * Get optional permissions that enhance functionality
   */
  static getOptionalPermissions(): Array<keyof PermissionResult> {
    return ['accessibility'];
  }
}

// Type declarations are in the preload.ts file - no need to redeclare here 

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface UserPermissions {
  canUseApp: boolean;
  maxInspectionsPerMonth: number;
  maxProjectsPerMonth: number;
  suspendedUntil?: Date;
  suspensionReason?: string;
}

interface UserStats {
  inspectionsThisMonth: number;
  projectsThisMonth: number;
}

interface PermissionStatus {
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
export const useUserPermissions = (): PermissionStatus => {
  const { user, idToken } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>({
    canCreateInspection: true,
    canCreateProject: true,
    isLoading: true
  });

  useEffect(() => {
    if (!user || !idToken) {
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

        // Make a test call to check inspection limits
        const inspectionResponse = await fetch('/api/inspect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            urls: ['https://example.com'], // Dummy URL for testing
            test: true // Add a test flag
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
            name: 'Test Project', // Dummy name for testing
            test: true // Add a test flag
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
  }, [user, idToken]);

  return permissionStatus;
}; 