'use client';

import React from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Shield, Settings, AlertTriangle, Info } from 'lucide-react';
import { PermissionStatus, MacPermissions } from '@/lib/permissions';

interface PermissionDialogProps {
  permission: PermissionStatus;
  isOpen: boolean;
  onClose: () => void;
  onSettingsOpened?: () => void;
  severity?: 'critical' | 'optional';
}

export function PermissionDialog({ 
  permission, 
  isOpen, 
  onClose, 
  onSettingsOpened,
  severity = 'optional' 
}: PermissionDialogProps) {
  
  const handleOpenSettings = async () => {
    try {
      await MacPermissions.openSystemSettings(permission.settingsPath);
      onSettingsOpened?.();
    } catch (error) {
      console.error('Failed to open settings:', error);
    }
  };

  const isCritical = severity === 'critical';
  const Icon = isCritical ? AlertTriangle : Info;
  const iconColor = isCritical ? 'text-red-500' : 'text-blue-500';

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-3">
            <div className={`p-2 rounded-full bg-gray-100 ${iconColor}`}>
              <Icon className="h-5 w-5" />
            </div>
            <span>
              {isCritical ? 'Permission Required' : 'Enhanced Features Available'}
            </span>
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900 mb-1">
                  {permission.name}
                </p>
                <p className="text-sm text-gray-600">
                  {permission.description}
                </p>
              </div>
            </div>
            
            {isCritical ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">
                  <strong>This permission is required</strong> for Font Inspector to function properly. 
                  Without it, website inspections may fail or produce incomplete results.
                </p>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>This permission is optional</strong> but will enhance the accuracy and 
                  completeness of font detection.
                </p>
              </div>
            )}

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-sm text-gray-700 mb-2">
                <strong>To grant this permission:</strong>
              </p>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>Click "Open Settings" below</li>
                <li>Find "Font Inspector" or "Electron" in the list</li>
                <li>Toggle the switch to enable the permission</li>
                <li>Return to Font Inspector</li>
              </ol>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex gap-2">
          {!isCritical && (
            <Button 
              variant="outline" 
              onClick={onClose}
              className="flex-1"
            >
              Continue Without
            </Button>
          )}
          <AlertDialogAction asChild>
            <Button 
              onClick={handleOpenSettings}
              className={`flex items-center gap-2 ${isCritical ? 'flex-1' : 'flex-1'}`}
            >
              <Settings className="h-4 w-4" />
              Open Settings
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Bulk permission dialog for multiple permissions
interface PermissionSummaryDialogProps {
  permissions: PermissionStatus[];
  isOpen: boolean;
  onClose: () => void;
  onPermissionAction: (permission: PermissionStatus) => void;
}

export function PermissionSummaryDialog({ 
  permissions, 
  isOpen, 
  onClose, 
  onPermissionAction 
}: PermissionSummaryDialogProps) {
  const criticalPermissions = permissions.filter(p => !p.granted);
  const hasCritical = criticalPermissions.length > 0;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-3">
            <div className={`p-2 rounded-full bg-gray-100 ${hasCritical ? 'text-orange-500' : 'text-blue-500'}`}>
              <Shield className="h-5 w-5" />
            </div>
            <span>Font Inspector Permissions</span>
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p className="text-gray-600">
              Font Inspector needs certain permissions to provide the best experience. 
              Here's what we found:
            </p>

            <div className="space-y-3">
              {permissions.map((permission, index) => (
                <div 
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    permission.granted 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-yellow-50 border-yellow-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      permission.granted ? 'bg-green-500' : 'bg-yellow-500'
                    }`} />
                    <div>
                      <p className="font-medium text-gray-900">
                        {permission.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {permission.granted ? 'Granted' : 'Not granted'}
                      </p>
                    </div>
                  </div>
                  {!permission.granted && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onPermissionAction(permission)}
                      className="flex items-center gap-1"
                    >
                      <Settings className="h-3 w-3" />
                      Grant
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {hasCritical && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm text-orange-800">
                  <strong>Some permissions are missing.</strong> The app will work, but you may 
                  experience limited functionality or errors during inspections.
                </p>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction asChild>
            <Button onClick={onClose} className="w-full">
              {hasCritical ? 'Continue Anyway' : 'Got It'}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
} 