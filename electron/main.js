const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const express = require('express');

// Check if we're in development mode
const isDev = !app.isPackaged;

let mainWindow;
let server;

// Create embedded HTTP server
function startServer() {
  return new Promise((resolve, reject) => {
    const expressApp = express();
    // Use process.resourcesPath to get the correct path when packaged
    const webBuildPath = isDev
      ? path.join(__dirname, '../web-build')
      : path.join(process.resourcesPath, 'web-build');

    // Serve static files with proper MIME types and CORS
    expressApp.use(express.static(webBuildPath, {
      setHeaders: (res, filePath) => {
        // Set CORS headers for all files
        res.setHeader('Access-Control-Allow-Origin', '*');

        // Set proper MIME types
        if (filePath.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript');
        } else if (filePath.endsWith('.ttf')) {
          res.setHeader('Content-Type', 'font/ttf');
        } else if (filePath.endsWith('.woff')) {
          res.setHeader('Content-Type', 'font/woff');
        } else if (filePath.endsWith('.woff2')) {
          res.setHeader('Content-Type', 'font/woff2');
        }
      }
    }));

    server = expressApp.listen(8081, 'localhost', () => {
      console.log('Server running on http://localhost:8081');
      console.log('Serving from:', webBuildPath);
      resolve();
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log('Port 8081 already in use, using existing server');
        resolve();
      } else {
        reject(err);
      }
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: false, // Disable to allow loading local resources
      allowRunningInsecureContent: true,
      // Temporarily disable preload to test
      // preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'build/icon.png'),
    title: 'ERP-aio',
    backgroundColor: '#ffffff',
    show: false // Don't show until ready
  });

  // Show window when ready to avoid visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Load the app
  // Always use HTTP server because Expo bundles use absolute paths
  const startUrl = 'http://localhost:8081';

  mainWindow.loadURL(startUrl);

  // Open DevTools in development (always open to debug)
  mainWindow.webContents.openDevTools();

  // Log any errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log('Console:', message);
  });

  // Create application menu
  createMenu();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
}

function createMenu() {
  const template = [
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Recargar',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) mainWindow.reload();
          }
        },
        { type: 'separator' },
        {
          label: 'Salir',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { label: 'Deshacer', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Rehacer', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cortar', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copiar', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Pegar', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Seleccionar todo', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { label: 'Pantalla completa', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Acercar', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Alejar', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: 'Restablecer zoom', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' }
      ]
    }
  ];

  // Add DevTools menu in development
  if (isDev) {
    template.push({
      label: 'Desarrollo',
      submenu: [
        { label: 'Herramientas de desarrollo', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Recargar', accelerator: 'F5', role: 'reload' },
        { label: 'Forzar recarga', accelerator: 'Shift+F5', role: 'forceReload' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App lifecycle
app.whenReady().then(async () => {
  // Don't start server if running in dev mode (serve is already running)
  if (app.isPackaged) {
    await startServer();
  }
  createWindow();
});

app.on('window-all-closed', () => {
  // On macOS, keep app running until user quits explicitly
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (server) {
    server.close();
  }
});

// Handle app updates (for future implementation)
app.on('ready', () => {
  // TODO: Implement auto-updater
  // const { autoUpdater } = require('electron-updater');
  // autoUpdater.checkForUpdatesAndNotify();
});
