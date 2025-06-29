import { app, BrowserWindow, Menu, shell, ipcMain, systemPreferences, dialog } from 'electron';
import { join } from 'path';
import { spawn, ChildProcess } from 'child_process';
import { createServer } from 'http';
import { parse } from 'url';
import { autoUpdater } from 'electron-updater';
import * as fs from 'fs';

// Load environment variables in production
if (!app.isPackaged) {
  // Development mode - dotenv loads automatically from .env.local
  console.log('Running in development mode');
} else {
  // Production mode - manually set Firebase environment variables
  console.log('Running in production mode - setting up Firebase environment');
  
  // Set Firebase client environment variables for Next.js
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'AIzaSyDVFwCYntEHUVV1Icu3BJJMKkY0FlJZC1c';
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'font-inspector.firebaseapp.com';
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'font-inspector';
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'font-inspector.firebasestorage.app';
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '528147961144';
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID = '1:528147961144:web:b027650af067ec5a49ddcd';
  
  // Set Firebase admin environment variables
  process.env.FIREBASE_DATABASE_URL = 'https://font-inspector.firebaseio.com';
  
  // Try to load service account from file for server-side operations
  try {
    const serviceAccountPath = join(process.resourcesPath || app.getAppPath(), 'firebase-service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccountData = fs.readFileSync(serviceAccountPath, 'utf8');
      process.env.FIREBASE_SERVICE_ACCOUNT = serviceAccountData;
      console.log('Firebase service account loaded from file for production');
    } else {
      console.warn('Firebase service account file not found at:', serviceAccountPath);
    }
  } catch (error) {
    console.error('Error loading Firebase service account in production:', error);
  }
  
  // Set Node environment
  process.env.NODE_ENV = 'production';
  
  console.log('Firebase environment variables configured for production');
}

// Set environment variable to indicate we're running in Electron
process.env.ELECTRON_APP = 'true';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const port = process.env.PORT || 3000;

// Get the correct app directory for both development and production
const getAppDirectory = (): string => {
  if (isDev) {
    return process.cwd();
  } else {
    // In production, the app files are in the same directory as the main process
    // which is inside the asar archive
    return app.getAppPath();
  }
};

const appDirectory = getAppDirectory();
console.log(`App directory: ${appDirectory}`);

// Auto-updater basic event handlers (will be set up properly in ElectronApp)
if (!isDev) {
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...');
  });
}

class ElectronApp {
  private mainWindow: BrowserWindow | null = null;
  private nextApp: any;
  private server: any;
  private expressServer: ChildProcess | null = null;
  private actualServerPort: number = Number(port); // Store the actual port the server starts on
  private isCheckingForUpdates: boolean = false; // Track update check state
  private isManualUpdateCheck: boolean = false; // Track if update check was manual

  constructor() {
    // Make sure app is ready before creating windows
    app.whenReady().then(() => {
      this.createWindow();
      
      // macOS specific: Re-create window when dock icon is clicked
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createWindow();
        }
      });
    });

    // Quit when all windows are closed (except on macOS)
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        this.cleanup();
        app.quit();
      }
    });

    // Cleanup before quitting
    app.on('before-quit', () => {
      this.cleanup();
    });

    // Set up IPC handlers for permissions
    this.setupIpcHandlers();
    
    // Initialize auto-updater (only in production)
    if (!isDev) {
      this.initializeAutoUpdater();
    }
  }

  private async createWindow(): Promise<void> {
    // Start Next.js and Express server
    let serverStarted = false;
    try {
      await this.startServers();
      serverStarted = true;
      console.log('Servers started successfully');
    } catch (error) {
      console.error('Failed to start servers:', error);
      // Continue with window creation even if servers fail
    }

    // Create the browser window
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      titleBarStyle: 'hiddenInset', // macOS style title bar
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, 'preload.js'),
        webSecurity: !isDev, // Disable web security in development
        allowRunningInsecureContent: isDev,
        experimentalFeatures: true,
      },
      icon: join(__dirname, 'assets', 'icon.png'),
      show: true, // Show window immediately
    });

    console.log('Window created and shown');

    // Load the Next.js app (always use localhost since we're running Next.js server)
    const appUrl = `http://localhost:${this.actualServerPort}`;
    
    console.log(`Loading Electron window with URL: ${appUrl}`);
    
    // Add better event handling for debugging
    this.mainWindow.webContents.on('did-start-loading', () => {
      console.log('Window started loading');
    });
    
    this.mainWindow.webContents.on('did-finish-load', () => {
      console.log('Window finished loading successfully');
      this.mainWindow?.focus();
      
      // Open DevTools in development
      if (isDev) {
        this.mainWindow?.webContents.openDevTools();
      }
    });

    this.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Window failed to load:', errorCode, errorDescription);
      // Show an error page or message
      this.showErrorPage(`Failed to load application: ${errorDescription} (Code: ${errorCode})`);
    });

    // Add console message handler for debugging
    this.mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`Console ${level}: ${message}`);
    });

    if (serverStarted) {
      try {
        await this.mainWindow.loadURL(appUrl);
        console.log('Successfully loaded URL in Electron window');
      } catch (error) {
        console.error('Failed to load URL:', error);
        this.showErrorPage(`Failed to load application: ${error}`);
      }
    } else {
      this.showErrorPage('Failed to start application servers. Please check the logs.');
    }

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Handle external links and authentication popups
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      // Allow Firebase auth popups to open in new window
      if (url.includes('accounts.google.com') || 
          url.includes('firebase') || 
          url.includes('google.com/oauth') ||
          url.includes('googleusercontent.com')) {
        console.log('Opening authentication popup:', url);
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 500,
            height: 600,
            modal: true,
            parent: this.mainWindow!,
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true,
              webSecurity: false, // Allow auth flow
            }
          }
        };
      }
      // For all other external links, open in default browser
      shell.openExternal(url);
      return { action: 'deny' };
    });

    // Set up menu
    this.createMenu();
  }

  private async startServers(): Promise<void> {
    try {
      // Validate that we can access the app directory
      console.log(`Checking app directory: ${appDirectory}`);
      
      if (!fs.existsSync(appDirectory)) {
        throw new Error(`App directory not found: ${appDirectory}`);
      }
      
      const nextConfigPath = join(appDirectory, 'next.config.ts');
      const packageJsonPath = join(appDirectory, 'package.json');
      
      console.log(`Next.js config exists: ${fs.existsSync(nextConfigPath)}`);
      console.log(`Package.json exists: ${fs.existsSync(packageJsonPath)}`);
      
      if (!isDev) {
        const nextBuildPath = join(appDirectory, '.next');
        console.log(`Next.js build exists: ${fs.existsSync(nextBuildPath)}`);
        
        if (!fs.existsSync(nextBuildPath)) {
          throw new Error(`Next.js build directory not found: ${nextBuildPath}`);
        }
      }

      // Try to find an available port if the default is taken
      const availablePort = await this.findAvailablePort(Number(port));
      
      // Store the actual port we'll use
      this.actualServerPort = availablePort;
      
      if (availablePort !== Number(port)) {
        console.log(`Port ${port} is busy, using port ${availablePort} instead`);
      }

      if (isDev) {
        // Development: Use Next.js dev server - import next dynamically
        const next = require('next');
        this.nextApp = next({ dev: true, dir: appDirectory });
        const handle = this.nextApp.getRequestHandler();
        
        console.log('Starting Next.js in development mode...');
        await this.nextApp.prepare();
        
        this.server = createServer((req, res) => {
          const parsedUrl = parse(req.url!, true);
          handle(req, res, parsedUrl);
        });

        await new Promise<void>((resolve, reject) => {
          this.server.listen(availablePort, (error: any) => {
            if (error) {
              console.error('Failed to start development server:', error);
              reject(error);
            } else {
              console.log(`Next.js ready on http://localhost:${availablePort}`);
              resolve();
            }
          });
        });
      } else {
        // Production: Run Next.js in production mode
        console.log('Starting Next.js in production mode...');
        console.log(`Using app directory: ${appDirectory}`);
        
        try {
          const next = require('next');
          this.nextApp = next({ dev: false, dir: appDirectory });
          const handle = this.nextApp.getRequestHandler();
          
          console.log('Preparing Next.js application...');
          await this.nextApp.prepare();
          console.log('Next.js application prepared successfully');
          
          this.server = createServer((req, res) => {
            const parsedUrl = parse(req.url!, true);
            handle(req, res, parsedUrl);
          });

          await new Promise<void>((resolve, reject) => {
            this.server.listen(availablePort, (error: any) => {
              if (error) {
                console.error('Failed to start production server:', error);
                reject(error);
              } else {
                console.log(`Next.js production server ready on http://localhost:${availablePort}`);
                resolve();
              }
            });
          });
        } catch (nextError: any) {
          console.error('Error initializing Next.js in production:', nextError);
          console.error('Next.js error details:', {
            message: nextError?.message,
            stack: nextError?.stack,
            code: nextError?.code
          });
          throw new Error(`Failed to start Next.js production server: ${nextError?.message || nextError}`);
        }
      }

      // Start Express server for API
      await this.startExpressServer();

    } catch (error: any) {
      console.error('Error starting servers:', error);
      console.error('Server startup error details:', {
        message: error?.message,
        stack: error?.stack,
        appDirectory,
        isDev,
        cwd: process.cwd(),
        appPath: app.getAppPath()
      });
      throw error;
    }
  }

  private async startExpressServer(): Promise<void> {
    if (isDev) {
      // Development: Use npm script
      const serverScript = 'server:dev';
      console.log(`Starting Express server with: npm run ${serverScript}`);
      
      this.expressServer = spawn('npm', ['run', serverScript], {
        stdio: 'pipe',
        shell: true,
        cwd: appDirectory,
        env: { 
          ...process.env, 
          ELECTRON_APP: 'true',
          NODE_ENV: 'development'
        }
      });
    } else {
      // Production: Start Express server directly
      console.log('Starting Express server in production mode...');
      
      try {
        // Import and start the Express server directly
        const serverPath = join(appDirectory, 'src', 'server', 'server.js');
        console.log(`Starting Express server from: ${serverPath}`);
        
        this.expressServer = spawn('node', [serverPath], {
          stdio: 'pipe',
          cwd: appDirectory,
          env: { 
            ...process.env, 
            NODE_ENV: 'production',
            ELECTRON_APP: 'true'
          }
        });
      } catch (error) {
        console.error('Failed to start Express server in production:', error);
        // Don't throw here - the app can work without the Express server for basic functionality
      }
    }

    // Set up Express server logging
    if (this.expressServer) {
      if (this.expressServer.stdout) {
        this.expressServer.stdout.on('data', (data) => {
          console.log(`Express server: ${data}`);
        });
      }
      
      if (this.expressServer.stderr) {
        this.expressServer.stderr.on('data', (data) => {
          console.error(`Express server error: ${data}`);
        });
      }

      this.expressServer.on('error', (error) => {
        console.error('Failed to start Express server:', error);
      });

      this.expressServer.on('exit', (code, signal) => {
        console.log(`Express server exited with code ${code} and signal ${signal}`);
      });
    }
  }

  private async findAvailablePort(startPort: number): Promise<number> {
    const net = require('net');
    
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.listen(startPort, () => {
        const port = server.address().port;
        server.close(() => {
          resolve(port);
        });
      });
      
      server.on('error', () => {
        // Port is busy, try the next one
        this.findAvailablePort(startPort + 1).then(resolve);
      });
    });
  }

  private createMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'Font Inspector',
        submenu: [
          { label: 'About Font Inspector', role: 'about' },
          { type: 'separator' },
          { 
            label: 'Check for Updates...', 
            click: () => this.checkForUpdatesManually(),
            enabled: !isDev // Only enable in production
          },
          { type: 'separator' },
          { label: 'Hide Font Inspector', accelerator: 'Command+H', role: 'hide' },
          { label: 'Hide Others', accelerator: 'Command+Shift+H', role: 'hideOthers' },
          { label: 'Show All', role: 'unhide' },
          { type: 'separator' },
          { label: 'Quit', accelerator: 'Command+Q', click: () => app.quit() }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
          { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
          { type: 'separator' },
          { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
          { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
          { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
          { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
          { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
          { label: 'Toggle Developer Tools', accelerator: 'F12', role: 'toggleDevTools' },
          { type: 'separator' },
          { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
          { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
          { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
          { type: 'separator' },
          { label: 'Toggle Fullscreen', accelerator: 'Ctrl+Command+F', role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { label: 'Minimize', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
          { label: 'Close', accelerator: 'CmdOrCtrl+W', role: 'close' }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  private setupIpcHandlers(): void {
    // Screenshot IPC handlers
    ipcMain.handle('get-screenshot', async (event, filepath: string) => {
      try {
        const fs = require('fs-extra');
        if (await fs.pathExists(filepath)) {
          const buffer = await fs.readFile(filepath);
          return buffer.toString('base64');
        }
        return null;
      } catch (error) {
        console.error('Error reading screenshot:', error);
        return null;
      }
    });

    ipcMain.handle('screenshot-exists', async (event, filepath: string) => {
      try {
        const fs = require('fs-extra');
        return await fs.pathExists(filepath);
      } catch (error) {
        console.error('Error checking screenshot existence:', error);
        return false;
      }
    });

    ipcMain.handle('delete-screenshots', async (event, directoryPath: string) => {
      try {
        const fs = require('fs-extra');
        if (await fs.pathExists(directoryPath)) {
          await fs.remove(directoryPath);
          console.log(`Deleted screenshots directory: ${directoryPath}`);
          return true;
        }
        return false;
      } catch (error) {
        console.error('Error deleting screenshots:', error);
        return false;
      }
    });

    ipcMain.handle('export-screenshots', async (event, sourcePath: string, exportPath: string) => {
      try {
        const fs = require('fs-extra');
        if (!await fs.pathExists(sourcePath)) {
          throw new Error('Screenshots not found');
        }
        await fs.copy(sourcePath, exportPath);
        return true;
      } catch (error) {
        console.error('Error exporting screenshots:', error);
        throw error;
      }
    });
    
    // Existing permission handlers
    // Permission checking handlers
    ipcMain.handle('permissions:checkScreenRecording', async () => {
      try {
        if (process.platform === 'darwin') {
          const hasPermission = systemPreferences.getMediaAccessStatus('screen');
          return hasPermission === 'granted';
        }
        return true; // Assume granted on non-macOS
      } catch (error) {
        console.error('Error checking screen recording permission:', error);
        return false;
      }
    });

    ipcMain.handle('permissions:checkAccessibility', async () => {
      try {
        if (process.platform === 'darwin') {
          return systemPreferences.isTrustedAccessibilityClient(false);
        }
        return true; // Assume granted on non-macOS
      } catch (error) {
        console.error('Error checking accessibility permission:', error);
        return false;
      }
    });

    // System settings opener
    ipcMain.handle('system:openSettings', async (event, settingsPath: string) => {
      try {
        if (process.platform === 'darwin') {
          const settingsUrl = settingsPath 
            ? `x-apple.systempreferences:com.apple.preference.security?Privacy_${settingsPath.replace(' ', '')}`
            : 'x-apple.systempreferences:com.apple.preference.security';
          
          await shell.openExternal(settingsUrl);
        } else {
          // For non-macOS, just log (could implement Windows/Linux equivalents)
          console.log(`Would open settings: ${settingsPath}`);
        }
      } catch (error) {
        console.error('Error opening system settings:', error);
        throw error;
      }
    });

    // Manual update check handler
    ipcMain.handle('app:checkForUpdates', async () => {
      try {
        await this.checkForUpdatesManually();
        return { success: true };
      } catch (error) {
        console.error('Manual update check failed:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // Get app version handler
    ipcMain.handle('app:getVersion', () => {
      return app.getVersion();
    });

    // Update control handlers
    ipcMain.handle('app:downloadUpdate', async () => {
      try {
        await autoUpdater.downloadUpdate();
        return { success: true };
      } catch (error) {
        console.error('Failed to download update:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('app:installUpdate', async () => {
      try {
        autoUpdater.quitAndInstall();
        return { success: true };
      } catch (error) {
        console.error('Failed to install update:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('app:dismissUpdate', async () => {
      // Just acknowledge the dismissal
      return { success: true };
    });
  }

  private initializeAutoUpdater(): void {
    // Set up auto-updater event listeners
    this.setupAutoUpdaterListeners();
    
    // Check for updates when app is ready
    app.whenReady().then(() => {
      // Wait a bit after startup to check for updates
      setTimeout(() => {
        autoUpdater.checkForUpdatesAndNotify();
      }, 5000);
    });
    
    // Check for updates every hour
    setInterval(() => {
      autoUpdater.checkForUpdatesAndNotify();
    }, 60 * 60 * 1000);
  }

  private async checkForUpdatesManually(): Promise<void> {
    if (isDev) {
      // Show dialog in development mode
      await dialog.showMessageBox(this.mainWindow!, {
        type: 'info',
        title: 'Development Mode',
        message: 'Update checking is disabled in development mode.',
        buttons: ['OK']
      });
      return;
    }

    if (this.isCheckingForUpdates) {
      console.log('Update check already in progress');
      return;
    }

    this.isCheckingForUpdates = true;
    this.isManualUpdateCheck = true; // Flag this as a manual check
    
    try {
      console.log('Starting manual update check...');
      // The regular auto-updater listeners will handle sending events to the renderer
      await autoUpdater.checkForUpdates();
    } catch (error) {
      console.error('Manual update check failed:', error);
      // Send error to renderer process
      this.mainWindow?.webContents.send('app:update-error', {
        message: error instanceof Error ? error.message : 'Unknown error occurred while checking for updates.'
      });
    } finally {
      this.isCheckingForUpdates = false;
      this.isManualUpdateCheck = false; // Reset manual check flag
    }
  }



  private setupAutoUpdaterListeners(): void {
    autoUpdater.on('update-available', (info) => {
      console.log('Update available:', info.version);
      // Send to renderer process for in-app notification
      this.mainWindow?.webContents.send('app:update-available', {
        version: info.version,
        currentVersion: app.getVersion(),
        releaseDate: info.releaseDate,
        files: info.files
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('Update not available:', info.version);
      // Only show notification for manual checks
      if (this.isManualUpdateCheck) {
        this.mainWindow?.webContents.send('app:update-not-available', {
          currentVersion: app.getVersion()
        });
      }
    });

    autoUpdater.on('error', (err) => {
      console.error('Error in auto-updater:', err);
      // Send error to renderer process
      this.mainWindow?.webContents.send('app:update-error', {
        message: err.message || 'Unknown update error'
      });
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const progress = {
        percent: Math.round(progressObj.percent),
        transferred: progressObj.transferred,
        total: progressObj.total,
        bytesPerSecond: progressObj.bytesPerSecond
      };
      
      console.log(`Download progress: ${progress.percent}% (${this.formatBytes(progress.transferred)}/${this.formatBytes(progress.total)}) at ${this.formatBytes(progress.bytesPerSecond)}/s`);
      
      // Send progress to renderer process
      this.mainWindow?.webContents.send('app:update-progress', progress);
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('Update downloaded:', info.version);
      // Send to renderer process instead of auto-installing
      this.mainWindow?.webContents.send('app:update-downloaded', {
        version: info.version
      });
    });
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private cleanup(): void {
    // Close Express server
    if (this.expressServer) {
      this.expressServer.kill();
      this.expressServer = null;
    }

    // Close Next.js server
    if (this.server) {
      this.server.close();
    }
  }

  private showErrorPage(message: string): void {
    if (!this.mainWindow) return;
    
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Font Inspector - Error</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background-color: #f5f5f5;
              color: #333;
            }
            .error-container {
              text-align: center;
              max-width: 500px;
              padding: 40px;
              background: white;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .error-icon {
              font-size: 48px;
              margin-bottom: 20px;
            }
            h1 {
              color: #e74c3c;
              margin-bottom: 20px;
            }
            p {
              margin-bottom: 20px;
              line-height: 1.5;
            }
            .retry-button {
              background-color: #3498db;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 5px;
              cursor: pointer;
              font-size: 16px;
              margin: 5px;
            }
            .retry-button:hover {
              background-color: #2980b9;
            }
            .quit-button {
              background-color: #95a5a6;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 5px;
              cursor: pointer;
              font-size: 16px;
              margin: 5px;
            }
            .quit-button:hover {
              background-color: #7f8c8d;
            }
          </style>
        </head>
        <body>
          <div class="error-container">
            <div class="error-icon">⚠️</div>
            <h1>Application Error</h1>
            <p>${message}</p>
            <p>This usually happens when the application server fails to start. Please try reloading the application.</p>
            <div>
              <button class="retry-button" onclick="location.reload()">Reload Application</button>
              <button class="quit-button" onclick="window.close()">Close</button>
            </div>
          </div>
        </body>
      </html>
    `;
    
    this.mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
  }
}

// Initialize the Electron app
new ElectronApp(); 