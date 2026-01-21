// File Handlers - files:select-upload, files:open-folder, file:*
import { ipcMain, dialog, shell } from 'electron'
import * as fs from 'fs/promises'

ipcMain.handle('files:select-upload', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Video Files', extensions: ['mp4', 'avi', 'mkv', 'mov', 'webm'] }]
  })
  return result.filePaths
})

ipcMain.handle('files:open-folder', async (_, folderPath: string) => {
  return await shell.openPath(folderPath)
})

ipcMain.handle('file:ensure-dir', async (_, dirPath: string) => {
  await fs.mkdir(dirPath, { recursive: true })
  return true
})

ipcMain.handle('file:select-output', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  })
  return result.filePaths[0] || null
})
