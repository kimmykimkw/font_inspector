'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

interface UpdateResult {
  success: boolean;
  error?: string;
}

export function UpdateChecker() {
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckResult, setLastCheckResult] = useState<UpdateResult | null>(null);
  const [appVersion, setAppVersion] = useState<string>('');

  // Check if we're in Electron environment
  const isElectron = typeof window !== 'undefined' && window.electronAPI;

  const handleCheckForUpdates = async () => {
    if (!isElectron) {
      console.log('Not in Electron environment - update checking not available');
      return;
    }

    setIsChecking(true);
    setLastCheckResult(null);

    try {
      const result = await window.electronAPI.checkForUpdates();
      setLastCheckResult(result);
    } catch (error) {
      setLastCheckResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsChecking(false);
    }
  };

  const getAppVersion = async () => {
    if (!isElectron) return;

    try {
      const version = await window.electronAPI.getAppVersion();
      setAppVersion(version);
    } catch (error) {
      console.error('Failed to get app version:', error);
    }
  };

  // Get app version on component mount
  React.useEffect(() => {
    if (isElectron) {
      getAppVersion();
    }
  }, [isElectron]);

  if (!isElectron) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50">
        <p className="text-sm text-gray-600">
          Update checking is only available in the desktop app.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-semibold mb-3">Update Checker</h3>
      
      {appVersion && (
        <p className="text-sm text-gray-600 mb-3">
          Current version: {appVersion}
        </p>
      )}

      <Button 
        onClick={handleCheckForUpdates}
        disabled={isChecking}
        className="mb-3"
      >
        {isChecking ? 'Checking for Updates...' : 'Check for Updates'}
      </Button>

      {lastCheckResult && (
        <div className={`p-3 rounded text-sm ${
          lastCheckResult.success 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {lastCheckResult.success 
            ? 'Update check completed successfully!'
            : `Update check failed: ${lastCheckResult.error}`
          }
        </div>
      )}

      <p className="text-xs text-gray-500 mt-3">
        Note: Update dialogs will appear from the main application menu. 
        This is just for testing the IPC communication.
      </p>
    </div>
  );
} 