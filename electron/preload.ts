import { contextBridge, ipcRenderer } from 'electron';

// Expose safe APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // System information
  platform: process.platform,
  version: process.versions,
  
  // App information
  isElectron: true,
  
  // Permission checking methods
  checkScreenRecordingPermission: () => ipcRenderer.invoke('permissions:checkScreenRecording'),
  checkAccessibilityPermission: () => ipcRenderer.invoke('permissions:checkAccessibility'),
  openSystemSettings: (path: string) => ipcRenderer.invoke('system:openSettings', path),
  
  // Update checking methods
  checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  
  // Screenshot methods
  getScreenshot: (filepath: string) => ipcRenderer.invoke('get-screenshot', filepath),
  screenshotExists: (filepath: string) => ipcRenderer.invoke('screenshot-exists', filepath),
  deleteScreenshots: (directoryPath: string) => ipcRenderer.invoke('delete-screenshots', directoryPath),
  exportScreenshots: (sourcePath: string, exportPath: string) => ipcRenderer.invoke('export-screenshots', sourcePath, exportPath),
  
  // File system operations (if needed in the future)
  // We can add more APIs here as needed
  
  // IPC communication helpers
  invoke: (channel: string, ...args: any[]) => {
    // Whitelist of allowed IPC channels
    const validChannels = [
      'app:getVersion',
      'app:checkForUpdates',
      'app:downloadUpdate',
      'app:installUpdate',
      'app:dismissUpdate',
      'app:quit',
      'window:minimize',
      'window:maximize',
      'window:close',
      'permissions:checkScreenRecording',
      'permissions:checkAccessibility',
      'system:openSettings',
      'get-screenshot',
      'screenshot-exists',
      'delete-screenshots',
      'export-screenshots'
    ];
    
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw new Error(`Invalid IPC channel: ${channel}`);
  },
  
  // One-way message sending
  send: (channel: string, ...args: any[]) => {
    const validChannels = [
      'app:log',
      'app:error'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    } else {
      throw new Error(`Invalid IPC channel: ${channel}`);
    }
  },
  
  // Event listeners
  on: (channel: string, callback: (...args: any[]) => void) => {
    const validChannels = [
      'app:update-available',
      'app:update-not-available',
      'app:update-downloaded',
      'app:update-progress',
      'app:update-error'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, callback);
    } else {
      throw new Error(`Invalid IPC channel: ${channel}`);
    }
  },
  
  // Remove event listeners
  removeAllListeners: (channel: string) => {
    const validChannels = [
      'app:update-available',
      'app:update-not-available',
      'app:update-downloaded',
      'app:update-progress',
      'app:update-error'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },

  // Update control methods
  downloadUpdate: () => ipcRenderer.invoke('app:downloadUpdate'),
  installUpdate: () => ipcRenderer.invoke('app:installUpdate'),
  dismissUpdate: () => ipcRenderer.invoke('app:dismissUpdate')
});

// Type declaration for TypeScript
declare global {
  interface Window {
    electronAPI: {
      platform: string;
      version: NodeJS.ProcessVersions;
      isElectron: boolean;
      checkScreenRecordingPermission: () => Promise<boolean>;
      checkAccessibilityPermission: () => Promise<boolean>;
      openSystemSettings: (path: string) => Promise<void>;
      checkForUpdates: () => Promise<{ success: boolean; error?: string }>;
      getAppVersion: () => Promise<string>;
      getScreenshot: (filepath: string) => Promise<string | null>;
      screenshotExists: (filepath: string) => Promise<boolean>;
      deleteScreenshots: (directoryPath: string) => Promise<boolean>;
      exportScreenshots: (sourcePath: string, exportPath: string) => Promise<boolean>;
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      send: (channel: string, ...args: any[]) => void;
      on: (channel: string, callback: (...args: any[]) => void) => void;
      removeAllListeners: (channel: string) => void;
      downloadUpdate: () => Promise<void>;
      installUpdate: () => Promise<void>;
      dismissUpdate: () => Promise<void>;
    };
  }
} 