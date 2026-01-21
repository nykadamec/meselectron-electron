// Settings Handlers - settings:read/write, processed:read/write
import { ipcMain } from 'electron'
import path from 'path'
import * as fs from 'fs/promises'
import { getUserDataPath, getAppDataPath } from '../utils/paths'
import os from 'os'
import { DEFAULT_VIDEO_DIR } from '../constants'

interface Settings {
  autoReset: boolean
  downloadConcurrency: number
  uploadConcurrency: number
  videoCount: number
  nospeed: boolean
  addWatermark: boolean
  outputDir: string
  hqProcessing?: boolean
}

ipcMain.handle('settings:read', async () => {
  const settingsPath = path.join(getUserDataPath(), 'prehrajto-autopilot', 'settings.json')
  try {
    const data = await fs.readFile(settingsPath, 'utf-8')
    return JSON.parse(data) as Settings
  } catch {
    const defaultDir = path.join(os.homedir(), 'Videos', DEFAULT_VIDEO_DIR)
    return {
      autoReset: true,
      downloadConcurrency: 2,
      uploadConcurrency: 2,
      videoCount: 20,
      nospeed: false,
      addWatermark: true,
      outputDir: defaultDir,
      hqProcessing: true
    } as Settings
  }
})

ipcMain.handle('settings:write', async (_, settings: Settings) => {
  const appPath = path.join(getUserDataPath(), 'prehrajto-autopilot')
  await fs.mkdir(appPath, { recursive: true })
  const settingsPath = path.join(appPath, 'settings.json')
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2))
  return true
})

ipcMain.handle('processed:read', async () => {
  const dataPath = path.join(getAppDataPath(), 'processed.json')
  try {
    const data = await fs.readFile(dataPath, 'utf-8')
    return JSON.parse(data) as { url: string; status: string; timestamp: string }[]
  } catch {
    return []
  }
})

ipcMain.handle('processed:write', async (_, items: { url: string; status: string; timestamp: string }[]) => {
  const appPath = getAppDataPath()
  await fs.mkdir(appPath, { recursive: true })
  const dataPath = path.join(appPath, 'processed.json')
  await fs.writeFile(dataPath, JSON.stringify(items, null, 2))

  // Notify all windows that processed.json was updated
  const { BrowserWindow } = await import('electron')
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('processed:updated')
  })

  return true
})
