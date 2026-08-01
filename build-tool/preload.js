const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('release', {
  getInfo: () => ipcRenderer.invoke('get-info'),
  previewVersion: (bumpType) => ipcRenderer.invoke('preview-version', bumpType),
  run: (opts) => ipcRenderer.invoke('run-release', opts),
  cancel: () => ipcRenderer.invoke('cancel-release'),
  onLog: (cb) => ipcRenderer.on('release-log', (_e, payload) => cb(payload)),
  onDone: (cb) => ipcRenderer.on('release-done', (_e, payload) => cb(payload)),
});
