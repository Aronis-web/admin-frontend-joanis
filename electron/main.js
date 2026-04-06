console.log('[ELECTRON] 📂 Cargando electron.js...');
console.log('[ELECTRON] 🔧 NODE_ENV:', process.env.NODE_ENV);

const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const express = require('express');

console.log('[ELECTRON] ✅ Módulos básicos cargados');

const { autoUpdater } = require('electron-updater');

console.log('[ELECTRON] ✅ electron-updater cargado');

// Detectar modo desarrollo: por variable de entorno O si la app no está empaquetada
// También se puede forzar con el argumento --devtools
const forceDevTools = process.argv.includes('--devtools');
let isDev = process.env.NODE_ENV === 'development' || forceDevTools;
let isPackaged = false; // Se inicializará en app.whenReady()

console.log('[ELECTRON] 🎯 isDev:', isDev);

let mainWindow;
let server;
let logStream;

// Configurar auto-updater
autoUpdater.autoDownload = false; // No descargar automáticamente
autoUpdater.autoInstallOnAppQuit = true; // Instalar al cerrar la app
autoUpdater.allowDowngrade = false; // No permitir downgrades
autoUpdater.allowPrerelease = false; // No permitir pre-releases

// Configuración adicional para Windows
if (process.platform === 'win32') {
  autoUpdater.forceDevUpdateConfig = false;
}

// Token de GitHub para repositorios privados
// IMPORTANTE: Este token permite acceder a los releases del repositorio privado
const GITHUB_TOKEN = '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';
autoUpdater.requestHeaders = {
  Authorization: `token ${GITHUB_TOKEN}`
};

console.log('[ELECTRON] ✅ Auto-updater configurado para repositorio privado');

// Variable para almacenar el estado de la actualización
let updateInfo = null;
let updateDownloaded = false;

// Create embedded HTTP server
function startServer() {
  return new Promise((resolve, reject) => {
    const expressApp = express();
    // Use process.resourcesPath to get the correct path when packaged
    const webBuildPath = isPackaged
      ? path.join(process.resourcesPath, 'web-build')
      : path.join(__dirname, '../web-build');

    console.log('App is packaged:', isPackaged);
    console.log('__dirname:', __dirname);
    console.log('Resources path:', isPackaged ? process.resourcesPath : 'N/A');
    console.log('Web build path:', webBuildPath);
    console.log('Web build exists:', fs.existsSync(webBuildPath));

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

    server = expressApp.listen(8082, 'localhost', () => {
      console.log('Server running on http://localhost:8082');
      console.log('Serving from:', webBuildPath);
      resolve(8082);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log('Port 8082 already in use, trying another port...');
        // Intentar con otro puerto
        server = expressApp.listen(0, 'localhost', () => {
          const port = server.address().port;
          console.log(`Server running on http://localhost:${port}`);
          resolve(port);
        });
      } else {
        reject(err);
      }
    });
  });
}

function createWindow(port) {
  console.log('[ELECTRON] 🚀 Creando ventana de Electron...');
  console.log('[ELECTRON] 🔧 Modo desarrollo:', isDev);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: false, // Disable to allow loading local resources
      allowRunningInsecureContent: true,
    },
    icon: path.join(__dirname, 'build/icon.png'),
    title: 'ERP-aio - Panel de Administración',
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    show: false // Don't show until ready
  });

  console.log('[ELECTRON] ✅ Ventana creada');

  // Show window when ready to avoid visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Load the app
  const startUrl = `http://localhost:${port}`;
  mainWindow.loadURL(startUrl);

  // Open DevTools only in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Log any errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log('Console:', message);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[ELECTRON] ✅ Página cargada completamente');
  });

  // Create application menu
  createMenu();

  mainWindow.on('closed', () => {
    console.log('Ventana principal cerrada');
    mainWindow = null;
    if (server) {
      server.close(() => {
        console.log('Servidor cerrado después de cerrar ventana');
      });
    }
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
          label: 'Buscar Actualizaciones',
          click: () => {
            if (!isDev) {
              autoUpdater.checkForUpdates();
            } else {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Modo Desarrollo',
                message: 'Las actualizaciones no están disponibles en modo desarrollo'
              });
            }
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
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Acerca de',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Acerca de ERP-aio',
              message: `ERP-aio - Panel de Administración\nVersión: ${app.getVersion()}`,
              buttons: ['OK']
            });
          }
        }
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

// ===== HANDLERS IPC PARA ACTUALIZACIONES MANUALES =====

// Obtener versión de la app
ipcMain.handle('get-app-version', async () => {
  return {
    version: app.getVersion(),
    name: app.getName()
  };
});

// Verificar actualizaciones manualmente
ipcMain.handle('check-for-updates', async () => {
  if (isDev) {
    return {
      updateAvailable: false,
      currentVersion: app.getVersion(),
      message: 'Las actualizaciones no están disponibles en modo desarrollo'
    };
  }

  try {
    console.log('[UPDATE] Verificando actualizaciones manualmente...');
    const result = await autoUpdater.checkForUpdates();

    if (result && result.updateInfo) {
      updateInfo = result.updateInfo;
      const currentVersion = app.getVersion();
      const latestVersion = result.updateInfo.version;

      // Comparar versiones
      const updateAvailable = latestVersion !== currentVersion;

      return {
        updateAvailable,
        currentVersion,
        latestVersion,
        releaseDate: result.updateInfo.releaseDate,
        updateDownloaded
      };
    }

    return {
      updateAvailable: false,
      currentVersion: app.getVersion(),
      message: 'No se pudo obtener información de actualizaciones'
    };
  } catch (error) {
    console.error('[UPDATE] Error al verificar actualizaciones:', error);

    // Manejar error 404 (no hay releases) de forma amigable
    if (error.message && (error.message.includes('404') || error.message.includes('Not Found') || error.message.includes('no published releases'))) {
      return {
        updateAvailable: false,
        currentVersion: app.getVersion(),
        message: 'No hay releases publicados en GitHub aún. ¡Ya tienes la versión más reciente!'
      };
    }

    // Manejar errores de conexión
    if (error.message && (error.message.includes('net::') || error.message.includes('ENOTFOUND') || error.message.includes('ETIMEDOUT'))) {
      return {
        updateAvailable: false,
        currentVersion: app.getVersion(),
        message: 'No se pudo conectar al servidor. Verifica tu conexión a internet.'
      };
    }

    return {
      updateAvailable: false,
      currentVersion: app.getVersion(),
      error: error.message
    };
  }
});

// Descargar actualización
ipcMain.handle('download-update', async () => {
  if (isDev) {
    return { success: false, message: 'No disponible en modo desarrollo' };
  }

  try {
    console.log('[UPDATE] Iniciando descarga de actualización...');
    await autoUpdater.downloadUpdate();
    return { success: true, message: 'Descarga iniciada' };
  } catch (error) {
    console.error('[UPDATE] Error al descargar:', error);
    return { success: false, error: error.message };
  }
});

// Instalar actualización
ipcMain.handle('install-update', async () => {
  if (updateDownloaded) {
    console.log('[UPDATE] Instalando actualización...');
    autoUpdater.quitAndInstall(false, true);
    return { success: true };
  }
  return { success: false, message: 'No hay actualización descargada' };
});

// ===== SISTEMA DE ACTUALIZACIONES AUTOMÁTICAS =====

// Configurar eventos del auto-updater
function setupAutoUpdater() {
  // Solo verificar actualizaciones en producción
  if (isDev) {
    console.log('Auto-updater deshabilitado en modo desarrollo');
    return;
  }

  console.log('Configurando auto-updater...');

  // Cuando hay una actualización disponible
  autoUpdater.on('update-available', (info) => {
    console.log('Actualización disponible:', info.version);
    updateInfo = info;

    // Enviar evento al renderer
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update-status', {
        status: 'available',
        version: info.version,
        releaseDate: info.releaseDate
      });
    }

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Actualización Disponible',
      message: `Nueva versión ${info.version} disponible`,
      detail: '¿Deseas descargar e instalar la actualización ahora?',
      buttons: ['Descargar', 'Más tarde'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        // Usuario eligió descargar
        autoUpdater.downloadUpdate();

        // Mostrar progreso de descarga
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Descargando Actualización',
          message: 'La actualización se está descargando en segundo plano...',
          buttons: ['OK']
        });
      }
    });
  });

  // Cuando NO hay actualizaciones disponibles
  autoUpdater.on('update-not-available', (info) => {
    console.log('No hay actualizaciones disponibles');
  });

  // Error al verificar actualizaciones
  autoUpdater.on('error', (err) => {
    console.error('Error en auto-updater:', err);

    // Ignorar errores 404 (no hay releases publicados) - es normal en proyectos nuevos
    if (err.message && (err.message.includes('404') || err.message.includes('Not Found') || err.message.includes('no published releases'))) {
      console.log('[UPDATE] No hay releases publicados en GitHub - esto es normal para la primera versión');
      // Enviar estado "sin actualizaciones" al renderer en lugar de error
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('update-status', {
          status: 'no-releases',
          message: 'No hay releases publicados aún'
        });
      }
      return;
    }

    // Ignorar errores de conexión silenciosamente
    if (err.message && (err.message.includes('net::') || err.message.includes('ENOTFOUND') || err.message.includes('ETIMEDOUT'))) {
      console.log('[UPDATE] Error de conexión al verificar actualizaciones - ignorando silenciosamente');
      return;
    }

    // Mostrar error al usuario solo si es un error crítico durante la descarga
    if (err.message && err.message.includes('download')) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Error de Actualización',
        message: 'No se pudo descargar la actualización',
        detail: 'Por favor, intenta nuevamente más tarde o descarga la actualización manualmente desde GitHub.',
        buttons: ['OK']
      });
    }
  });

  // Progreso de descarga
  autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.round(progressObj.percent);
    console.log(`Descargando actualización: ${percent}%`);

    // Enviar progreso al renderer
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('download-progress', {
        percent,
        bytesPerSecond: progressObj.bytesPerSecond,
        transferred: progressObj.transferred,
        total: progressObj.total
      });
    }
  });

  // Actualización descargada y lista para instalar
  autoUpdater.on('update-downloaded', (info) => {
    console.log('Actualización descargada:', info.version);
    updateDownloaded = true;

    // Enviar evento al renderer
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update-status', {
        status: 'downloaded',
        version: info.version
      });
    }

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Actualización Lista',
      message: 'La actualización ha sido descargada',
      detail: 'La aplicación se cerrará e instalará la actualización automáticamente.',
      buttons: ['Instalar Ahora', 'Instalar al Cerrar'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        console.log('Usuario eligió instalar ahora');

        // Cerrar el servidor HTTP primero
        if (server) {
          server.close(() => {
            console.log('Servidor HTTP cerrado');
          });
        }

        // Cerrar todas las ventanas
        if (mainWindow) {
          mainWindow.removeAllListeners('close');
          mainWindow.close();
        }

        // Esperar un momento para asegurar que todo se cierre
        setTimeout(() => {
          console.log('Instalando actualización...');
          // isSilent = false (mostrar instalador), isForceRunAfter = true (ejecutar después)
          autoUpdater.quitAndInstall(false, true);
        }, 500);
      } else {
        console.log('Usuario eligió instalar al cerrar');
        // Si elige "Más tarde", se instalará al cerrar la app (autoInstallOnAppQuit = true)
      }
    });
  });

  // Verificar actualizaciones al iniciar (después de 3 segundos)
  setTimeout(() => {
    console.log('Verificando actualizaciones...');
    autoUpdater.checkForUpdates().catch(err => {
      console.error('Error al verificar actualizaciones:', err);
    });
  }, 3000);

  // Verificar actualizaciones cada 4 horas
  setInterval(() => {
    console.log('Verificación periódica de actualizaciones...');
    autoUpdater.checkForUpdates().catch(err => {
      console.error('Error al verificar actualizaciones:', err);
    });
  }, 4 * 60 * 60 * 1000); // 4 horas
}

// App lifecycle
app.on('ready', async () => {
  // Inicializar isPackaged ahora que app está listo
  isPackaged = app.isPackaged;

  // Si no está empaquetada, estamos en desarrollo - forzar isDev
  if (!isPackaged) {
    isDev = true;
  }

  console.log('[ELECTRON] 🚀 App ready event triggered');
  console.log('[ELECTRON] 📦 Is packaged:', isPackaged);
  console.log('[ELECTRON] 🔧 Is dev:', isDev);

  // Configurar logging después de que la app esté lista
  const logFile = path.join(app.getPath('userData'), 'electron-server.log');
  logStream = fs.createWriteStream(logFile, { flags: 'a' });
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args) => {
    const message = args.join(' ') + '\n';
    logStream.write(`[LOG] ${new Date().toISOString()} - ${message}`);
    originalLog.apply(console, args);
  };

  console.error = (...args) => {
    const message = args.join(' ') + '\n';
    logStream.write(`[ERROR] ${new Date().toISOString()} - ${message}`);
    originalError.apply(console, args);
  };

  console.log('=== Electron App Starting ===');
  console.log('Log file:', logFile);
  console.log('Is packaged:', isPackaged);
  console.log('Is dev:', isDev);

  // Iniciar servidor y crear ventana
  const port = await startServer();
  createWindow(port);

  // Inicializar sistema de actualizaciones automáticas
  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  console.log('Todas las ventanas cerradas');

  // Cerrar el servidor HTTP
  if (server) {
    server.close(() => {
      console.log('Servidor HTTP cerrado completamente');
    });
  }

  // Cerrar el stream de logs
  if (logStream) {
    logStream.end(() => {
      console.log('Stream de logs cerrado');
    });
  }

  // On macOS, keep app running until user quits explicitly
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    startServer().then(port => createWindow(port));
  }
});

app.on('before-quit', (event) => {
  console.log('Aplicación a punto de cerrarse');

  // Cerrar el servidor HTTP si existe
  if (server) {
    server.close(() => {
      console.log('Servidor HTTP cerrado en before-quit');
    });
  }

  // Cerrar el stream de logs
  if (logStream) {
    logStream.end();
  }
});

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});
