// Preload script para inyectar polyfills antes de cargar la aplicación
const { contextBridge, ipcRenderer } = require('electron');

// Este script se ejecuta en un contexto aislado antes de que se cargue la página
// Podemos usar contextBridge para exponer APIs seguras al renderer

console.log('Preload script ejecutándose...');

// Exponer información del entorno
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: process.versions,
  isElectron: true,

  // Funciones para actualizaciones
  getAppVersion: () => {
    return ipcRenderer.invoke('get-app-version');
  },
  checkForUpdates: () => {
    return ipcRenderer.invoke('check-for-updates');
  },
  downloadUpdate: () => {
    return ipcRenderer.invoke('download-update');
  },
  installUpdate: () => {
    return ipcRenderer.invoke('install-update');
  },

  // Escuchar eventos de actualización
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, status) => callback(status));
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, progress) => callback(progress));
  }
});

// Mantener compatibilidad con el código anterior
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  appVersion: '1.0.0'
});

// Exponer flag para detectar si estamos en Electron
contextBridge.exposeInMainWorld('isElectron', true);

console.log('Preload script completado');
