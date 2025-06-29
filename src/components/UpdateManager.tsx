'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, X, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react';

interface UpdateInfo {
  version: string;
  currentVersion: string;
  releaseDate?: string;
  files?: any[];
}

interface DownloadProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

type UpdateState = 'none' | 'available' | 'downloading' | 'downloaded' | 'error' | 'up-to-date';

export function UpdateManager() {
  const [updateState, setUpdateState] = useState<UpdateState>('none');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Check if we're in Electron environment
    const electronAvailable = typeof window !== 'undefined' && !!window.electronAPI;
    setIsElectron(electronAvailable);
    
    if (!electronAvailable) return;

    // Set up event listeners for update events
    const handleUpdateAvailable = (event: any, info: UpdateInfo) => {
      console.log('Update available:', info);
      setUpdateInfo(info);
      setUpdateState('available');
    };

    const handleUpdateProgress = (event: any, progress: DownloadProgress) => {
      console.log('Download progress:', progress);
      setDownloadProgress(progress);
      setUpdateState('downloading');
    };

    const handleUpdateDownloaded = (event: any, info: { version: string }) => {
      console.log('Update downloaded:', info);
      setUpdateState('downloaded');
      setDownloadProgress(null);
    };

    const handleUpdateError = (event: any, error: { message: string }) => {
      console.error('Update error:', error);
      setErrorMessage(error.message);
      setUpdateState('error');
      setDownloadProgress(null);
    };

    const handleUpdateNotAvailable = (event: any, info: { currentVersion: string }) => {
      console.log('No updates available:', info);
      setUpdateInfo({ version: info.currentVersion, currentVersion: info.currentVersion });
      setUpdateState('up-to-date');
    };

    // Add event listeners
    window.electronAPI.on('app:update-available', handleUpdateAvailable);
    window.electronAPI.on('app:update-not-available', handleUpdateNotAvailable);
    window.electronAPI.on('app:update-progress', handleUpdateProgress);
    window.electronAPI.on('app:update-downloaded', handleUpdateDownloaded);
    window.electronAPI.on('app:update-error', handleUpdateError);

    // Cleanup function
    return () => {
      window.electronAPI.removeAllListeners('app:update-available');
      window.electronAPI.removeAllListeners('app:update-not-available');
      window.electronAPI.removeAllListeners('app:update-progress');
      window.electronAPI.removeAllListeners('app:update-downloaded');
      window.electronAPI.removeAllListeners('app:update-error');
    };
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownloadUpdate = async () => {
    try {
      await window.electronAPI.downloadUpdate();
      setUpdateState('downloading');
    } catch (error) {
      console.error('Failed to start download:', error);
      setErrorMessage('Failed to start download');
      setUpdateState('error');
    }
  };

  const handleInstallUpdate = async () => {
    try {
      await window.electronAPI.installUpdate();
      // App will restart after this
    } catch (error) {
      console.error('Failed to install update:', error);
      setErrorMessage('Failed to install update');
      setUpdateState('error');
    }
  };

  const handleDismissUpdate = async () => {
    try {
      await window.electronAPI.dismissUpdate();
      setUpdateState('none');
      setUpdateInfo(null);
      setDownloadProgress(null);
      setErrorMessage('');
    } catch (error) {
      console.error('Failed to dismiss update:', error);
    }
  };

  // Don't render anything if not in Electron or no update state
  if (!isElectron || updateState === 'none') {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 w-96">
      <Card className="bg-white border-2 border-blue-200 shadow-lg">
        <CardContent className="p-4">
          {updateState === 'available' && updateInfo && (
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <Download className="h-5 w-5 text-blue-600" />
                  <div>
                    <h3 className="font-semibold text-sm">Update Available</h3>
                    <p className="text-xs text-gray-600">
                      Version {updateInfo.version} is ready
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismissUpdate}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="text-xs text-gray-500">
                Current: {updateInfo.currentVersion} → New: {updateInfo.version}
              </div>
              
              <div className="flex space-x-2">
                <Button
                  onClick={handleDownloadUpdate}
                  size="sm"
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
                <Button
                  onClick={handleDismissUpdate}
                  variant="outline"
                  size="sm"
                >
                  Later
                </Button>
              </div>
            </div>
          )}

          {updateState === 'downloading' && downloadProgress && (
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <Download className="h-5 w-5 text-blue-600 animate-pulse" />
                  <div>
                    <h3 className="font-semibold text-sm">Downloading Update</h3>
                    <p className="text-xs text-gray-600">
                      {downloadProgress.percent}% complete
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${downloadProgress.percent}%` }}
                  />
                </div>
                
                <div className="flex justify-between text-xs text-gray-500">
                  <span>
                    {formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)}
                  </span>
                  <span>
                    {formatBytes(downloadProgress.bytesPerSecond)}/s
                  </span>
                </div>
              </div>
            </div>
          )}

          {updateState === 'downloaded' && updateInfo && (
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-sm">Update Ready</h3>
                    <p className="text-xs text-gray-600">
                      Version {updateInfo.version} downloaded
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismissUpdate}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <p className="text-xs text-gray-500">
                The app will restart to complete the installation.
              </p>
              
              <div className="flex space-x-2">
                <Button
                  onClick={handleInstallUpdate}
                  size="sm"
                  className="flex-1"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Restart & Install
                </Button>
                <Button
                  onClick={handleDismissUpdate}
                  variant="outline"
                  size="sm"
                >
                  Later
                </Button>
              </div>
            </div>
          )}

          {updateState === 'error' && (
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <h3 className="font-semibold text-sm">Update Error</h3>
                    <p className="text-xs text-gray-600">
                      {errorMessage || 'Failed to check for updates'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismissUpdate}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <Button
                onClick={handleDismissUpdate}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Dismiss
              </Button>
            </div>
          )}

          {updateState === 'up-to-date' && updateInfo && (
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-sm">App is Up to Date</h3>
                    <p className="text-xs text-gray-600">
                      You're running the latest version
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismissUpdate}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="text-xs text-gray-500">
                Current version: {updateInfo.currentVersion}
              </div>
              
              <Button
                onClick={handleDismissUpdate}
                variant="outline"
                size="sm"
                className="w-full"
              >
                OK
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 