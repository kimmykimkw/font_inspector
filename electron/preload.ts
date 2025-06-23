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
  
  // File system operations (if needed in the future)
  // We can add more APIs here as needed
  
  // IPC communication helpers
  invoke: (channel: string, ...args: any[]) => {
    // Whitelist of allowed IPC channels
    const validChannels = [
      'app:getVersion',
      'app:quit',
      'window:minimize',
      'window:maximize',
      'window:close',
      'permissions:checkScreenRecording',
      'permissions:checkAccessibility',
      'system:openSettings'
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
      'app:update-downloaded'
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
      'app:update-downloaded'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  }
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
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      send: (channel: string, ...args: any[]) => void;
      on: (channel: string, callback: (...args: any[]) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
} 