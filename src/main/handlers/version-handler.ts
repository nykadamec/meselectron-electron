// Version Handlers - version:*, build:get, name:get, platform:info
import { ipcMain } from 'electron'
import path from 'path'
import { getUserDataPath, getProjectRoot } from '../utils/paths'
import { getAppVersion, getBuildNumber, getAppName } from '../utils/version'

// Declare __nonWebpack_require__ for asar module loading (used in production only)
declare const __nonWebpack_require__: (modulePath: string) => unknown

// Version check (remote)
ipcMain.handle('version:check', async () => {
  const axios = (await import('axios')).default
  try {
    const response = await axios.get('https://cemada.me/program/version.txt')
    return { remoteVersion: response.data.trim(), needsUpdate: true }
  } catch {
    return { remoteVersion: null, error: 'Failed to check version' }
  }
})

// Get local version from package.json
ipcMain.handle('version:get', async () => {
  return await getAppVersion()
})

// Get build number from package.json
ipcMain.handle('build:get', async () => {
  return await getBuildNumber()
})

// Get app name from package.json
ipcMain.handle('name:get', async () => {
  return await getAppName()
})

// Platform info
ipcMain.handle('platform:info', () => {
  return {
    platform: process.platform,
    arch: process.arch,
    userDataPath: getUserDataPath(),
    appPath: getProjectRoot()
  }
})
