const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: (filters) => ipcRenderer.invoke('open-file-dialog', filters),
  readSqliteDb: (filePath) => ipcRenderer.invoke('read-sqlite-db', filePath),
  readCsvFile: (filePath) => ipcRenderer.invoke('read-csv-file', filePath),
  getFileInfo: (filePath) => ipcRenderer.invoke('get-file-info', filePath),
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  onMenuOpenDb: (callback) => ipcRenderer.on('menu-open-db', callback),
  onMenuOpenCsv: (callback) => ipcRenderer.on('menu-open-csv', callback),
  onMenuClear: (callback) => ipcRenderer.on('menu-clear', callback),
  onUpdateChecking: (callback) => ipcRenderer.on('update-checking', callback),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', callback),
  onUpdateError: (callback) => ipcRenderer.on('update-error', callback),
  onUpdateDownloading: (callback) => ipcRenderer.on('update-downloading', callback),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});