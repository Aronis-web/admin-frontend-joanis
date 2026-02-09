const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Platform detection
  platform: process.platform,

  // App version
  appVersion: require('../package.json').version,

  // Future: Add IPC communication methods here
  // send: (channel, data) => {
  //   ipcRenderer.send(channel, data);
  // },
  // receive: (channel, func) => {
  //   ipcRenderer.on(channel, (event, ...args) => func(...args));
  // }
});

// Expose a flag to detect if running in Electron
contextBridge.exposeInMainWorld('isElectron', true);
