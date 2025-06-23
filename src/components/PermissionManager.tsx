'use client';

import React, { useEffect, useState } from 'react';
import { PermissionDialog, PermissionSummaryDialog } from './PermissionDialog';
import { MacPermissions, PermissionStatus, PermissionResult } from '@/lib/permissions';
import { toast } from 'sonner';

interface PermissionManagerProps {
  children: React.ReactNode;
  autoCheck?: boolean;
  showOnStartup?: boolean;
}

export function PermissionManager({ 
  children, 
  autoCheck = true, 
  showOnStartup = true 
}: PermissionManagerProps) {
  const [permissions, setPermissions] = useState<PermissionResult | null>(null);
  const [currentPermissionDialog, setCurrentPermissionDialog] = useState<PermissionStatus | null>(null);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [hasCheckedOnStartup, setHasCheckedOnStartup] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Check if we're in Electron environment
    setIsElectron(typeof window !== 'undefined' && !!window.electronAPI);
    
    if (autoCheck && showOnStartup && !hasCheckedOnStartup) {
      checkPermissions();
      setHasCheckedOnStartup(true);
    }
  }, [autoCheck, showOnStartup, hasCheckedOnStartup]);

  const checkPermissions = async () => {
    try {
      console.log('Permission Manager: Checking permissions...');
      const result = await MacPermissions.checkAllPermissions();
      setPermissions(result);

      // Only show dialogs in Electron environment
      if (!isElectron) {
        console.log('Permission Manager: Not in Electron, skipping permission dialogs');
        return;
      }

      // Find critical permissions that are missing
      const criticalPermissions = MacPermissions.getCriticalPermissions();
      const missingCritical = criticalPermissions
        .map(key => result[key])
        .filter(permission => permission && !permission.granted);

      // Find all missing permissions for summary
      const allMissingPermissions = Object.values(result)
        .filter(permission => permission && !permission.granted);

      console.log('Permission Manager: Missing critical permissions:', missingCritical.length);
      console.log('Permission Manager: Total missing permissions:', allMissingPermissions.length);

      if (missingCritical.length > 0 && missingCritical[0]) {
        // Show critical permission dialog first
        setCurrentPermissionDialog(missingCritical[0]);
      } else if (allMissingPermissions.length > 0 && showOnStartup) {
        // Show summary dialog for optional permissions
        setShowSummaryDialog(true);
      } else {
        console.log('Permission Manager: All permissions granted!');
        toast.success('All permissions are configured correctly!', {
          description: 'Font Inspector has all necessary permissions.',
          duration: 3000
        });
      }
    } catch (error) {
      console.error('Permission Manager: Error checking permissions:', error);
      toast.error('Permission check failed', {
        description: 'Could not verify app permissions. Some features may not work correctly.',
        duration: 5000
      });
    }
  };

  const handlePermissionDialogClose = () => {
    setCurrentPermissionDialog(null);
    
    // After closing a critical permission dialog, check if there are more
    if (permissions) {
      const criticalPermissions = MacPermissions.getCriticalPermissions();
      const missingCritical = criticalPermissions
        .map(key => permissions[key])
        .filter(permission => permission && !permission.granted);

      const currentIndex = missingCritical.findIndex(p => p === currentPermissionDialog);
      if (currentIndex >= 0 && currentIndex < missingCritical.length - 1) {
        // Show next critical permission
        const nextPermission = missingCritical[currentIndex + 1];
        if (nextPermission) {
          setCurrentPermissionDialog(nextPermission);
        }
      } else {
        // No more critical permissions, check for optional ones
        const allMissingPermissions = Object.values(permissions)
          .filter(permission => permission && !permission.granted);
        
        if (allMissingPermissions.length > 0) {
          setShowSummaryDialog(true);
        }
      }
    }
  };

  const handlePermissionSettingsOpened = () => {
    toast.info('Settings opened', {
      description: 'Please grant the permission and return to Font Inspector.',
      duration: 4000
    });
    
    // Optionally recheck permissions after a delay
    setTimeout(async () => {
      const result = await MacPermissions.checkAllPermissions();
      setPermissions(result);
    }, 2000);
  };

  const handleSummaryDialogAction = (permission: PermissionStatus) => {
    setShowSummaryDialog(false);
    setCurrentPermissionDialog(permission);
  };

  // Expose a method to manually trigger permission check
  const triggerPermissionCheck = () => {
    checkPermissions();
  };

  // Add global permission check function to window for debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).checkPermissions = triggerPermissionCheck;
    }
  }, []);

  return (
    <>
      {children}
      
      {/* Individual permission dialog for critical permissions */}
      {currentPermissionDialog && (
        <PermissionDialog
          permission={currentPermissionDialog}
          isOpen={true}
          onClose={handlePermissionDialogClose}
          onSettingsOpened={handlePermissionSettingsOpened}
          severity={MacPermissions.getCriticalPermissions().some(key => 
            permissions?.[key] === currentPermissionDialog
          ) ? 'critical' : 'optional'}
        />
      )}

      {/* Summary dialog for multiple permissions */}
      {showSummaryDialog && permissions && (
        <PermissionSummaryDialog
          permissions={Object.values(permissions).filter(p => p && !p.granted)}
          isOpen={true}
          onClose={() => setShowSummaryDialog(false)}
          onPermissionAction={handleSummaryDialogAction}
        />
      )}
    </>
  );
}

// Export a hook for manually checking permissions
export function usePermissions() {
  const [permissions, setPermissions] = useState<PermissionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkPermissions = async () => {
    setIsLoading(true);
    try {
      const result = await MacPermissions.checkAllPermissions();
      setPermissions(result);
      return result;
    } catch (error) {
      console.error('Error checking permissions:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const openSettings = async (settingsPath: string) => {
    try {
      await MacPermissions.openSystemSettings(settingsPath);
    } catch (error) {
      console.error('Error opening settings:', error);
      throw error;
    }
  };

  return {
    permissions,
    isLoading,
    checkPermissions,
    openSettings,
    isElectron: typeof window !== 'undefined' && !!window.electronAPI
  };
} 