// CommonJS preload script for Electron
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  settingsRead: function() {
    return ipcRenderer.invoke('settings:read')
  },
  settingsWrite: function(settings) {
    return ipcRenderer.invoke('settings:write', settings)
  },
  accountsList: function() {
    return ipcRenderer.invoke('accounts:list')
  },
  accountsReadCookies: function(accountId) {
    return ipcRenderer.invoke('accounts:read-cookies', accountId)
  },
  accountsGetCredits: function(accountId) {
    return ipcRenderer.invoke('accounts:get-credits', accountId)
  },
  accountsAutoLogin: function() {
    return ipcRenderer.invoke('accounts:auto-login')
  },
  filesSelectUpload: function() {
    return ipcRenderer.invoke('files:select-upload')
  },
  filesOpenFolder: function(folderPath) {
    return ipcRenderer.invoke('files:open-folder', folderPath)
  },
  versionCheck: function() {
    return ipcRenderer.invoke('version:check')
  },
  versionGet: function() {
    return ipcRenderer.invoke('version:get')
  },
  nameGet: function() {
    return ipcRenderer.invoke('name:get')
  },
  platformInfo: function() {
    return ipcRenderer.invoke('platform:info')
  },
  downloadStart: function(options) {
    return ipcRenderer.invoke('download:start', options)
  },
  uploadStart: function(options) {
    return ipcRenderer.invoke('upload:start', options)
  },
  discoverStart: function(options) {
    return ipcRenderer.invoke('discover:start', options)
  },
  ffmpegGetPath: function() {
    return ipcRenderer.invoke('ffmpeg:get-path')
  },
  fileEnsureDir: function(dirPath) {
    return ipcRenderer.invoke('file:ensure-dir', dirPath)
  },
  fileSelectOutput: function() {
    return ipcRenderer.invoke('file:select-output')
  },
  onDownloadProgress: function(callback) {
    ipcRenderer.on('download:progress', callback)
  },
  onUploadProgress: function(callback) {
    ipcRenderer.on('upload:progress', callback)
  },
  onDiscoverProgress: function(callback) {
    ipcRenderer.on('discover:progress', callback)
  },
  onMyVideosProgress: function(callback) {
    ipcRenderer.on('myvideos:progress', callback)
  },
  myVideosLoad: function(options) {
    return ipcRenderer.invoke('myvideos:start', options)
  },
  onLogMessage: function(callback) {
    ipcRenderer.on('log:message', callback)
  },
  removeListener: function(channel, callback) {
    ipcRenderer.removeListener(channel, callback)
  }
})
