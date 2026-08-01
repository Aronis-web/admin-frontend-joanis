const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('release', {
  getProjects: () => ipcRenderer.invoke('get-projects'),
  getInfo: (projectKey) => ipcRenderer.invoke('get-info', projectKey),
  previewVersion: (projectKey, bumpType) => ipcRenderer.invoke('preview-version', { projectKey, bumpType }),
  run: (opts) => ipcRenderer.invoke('run-release', opts),
  cancel: () => ipcRenderer.invoke('cancel-release'),
  onLog: (cb) => ipcRenderer.on('release-log', (_e, payload) => cb(payload)),
  onDone: (cb) => ipcRenderer.on('release-done', (_e, payload) => cb(payload)),
});
