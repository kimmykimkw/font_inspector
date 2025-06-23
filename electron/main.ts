import { app, BrowserWindow, Menu, shell, ipcMain, systemPreferences } from 'electron';
import { join } from 'path';
import { spawn, ChildProcess } from 'child_process';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';

// Set environment variable to indicate we're running in Electron
process.env.ELECTRON_APP = 'true';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const port = process.env.PORT || 3000;

class ElectronApp {
  private mainWindow: BrowserWindow | null = null;
  private nextApp: any;
  private server: any;
  private expressServer: ChildProcess | null = null;

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
  }

  private async createWindow(): Promise<void> {
    // Start Next.js and Express server
    await this.startServers();

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
        preload: join(__dirname, 'preload.js'), // We'll create this next
        webSecurity: !isDev, // Disable web security in development
        allowRunningInsecureContent: isDev,
        experimentalFeatures: true,
      },
      icon: join(__dirname, 'assets', 'icon.png'), // We'll add this later
      show: false, // Don't show until ready
    });

    // Load the Next.js app (always use localhost since we're running Next.js server)
    const appUrl = `http://localhost:${port}`;
    
    console.log(`Loading Electron window with URL: ${appUrl}`);
    
    // Add better event handling for debugging
    this.mainWindow.webContents.on('did-start-loading', () => {
      console.log('Window started loading');
    });
    
    this.mainWindow.webContents.on('did-finish-load', () => {
      console.log('Window finished loading');
      // Force show the window after loading completes
      this.mainWindow?.show();
      this.mainWindow?.focus();
      
      // Open DevTools in development
      if (isDev) {
        this.mainWindow?.webContents.openDevTools();
      }
    });

    this.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Window failed to load:', errorCode, errorDescription);
      // Show window anyway so user can see the error
      this.mainWindow?.show();
    });

    await this.mainWindow.loadURL(appUrl);
    console.log('Successfully loaded URL in Electron window');

    // Fallback: Show window after a delay if it hasn't shown yet
    setTimeout(() => {
      if (this.mainWindow && !this.mainWindow.isVisible()) {
        console.log('Window not visible after timeout, forcing show');
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    }, 5000);

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
      // Always use Next.js server (both dev and production)
      this.nextApp = next({ dev: isDev, dir: process.cwd() });
      const handle = this.nextApp.getRequestHandler();
      
      console.log(`Starting Next.js in ${isDev ? 'development' : 'production'} mode...`);
      await this.nextApp.prepare();
      
      this.server = createServer((req, res) => {
        const parsedUrl = parse(req.url!, true);
        handle(req, res, parsedUrl);
      });

      await new Promise<void>((resolve, reject) => {
        this.server.listen(port, (error: any) => {
          if (error) {
            reject(error);
          } else {
            console.log(`Next.js ready on http://localhost:${port}`);
            resolve();
          }
        });
      });

      // Start Express server for API
      const serverScript = isDev ? 'server:dev' : 'server';
      console.log(`Starting Express server with: npm run ${serverScript}`);
      this.expressServer = spawn('npm', ['run', serverScript], {
        stdio: 'inherit',
        shell: true,
        cwd: process.cwd(),
      });
    } catch (error) {
      console.error('Error starting servers:', error);
      throw error;
    }
  }

  private createMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'Font Inspector',
        submenu: [
          { label: 'About Font Inspector', role: 'about' },
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
}

// Initialize the Electron app
new ElectronApp(); 