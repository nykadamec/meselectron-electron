// Upload Handler - upload:start, upload:stop
import { ipcMain, BrowserWindow } from 'electron'
import { createWorker, WorkerType } from '../utils/worker-factory'

// Global active upload worker handle
let activeUploadHandle: ReturnType<typeof createWorker> | null = null

ipcMain.handle('upload:start', async (_, options) => {
  const handle = createWorker({
    workerType: WorkerType.UPLOAD,
    type: 'upload',
    payload: options,
    onProgress: (progress) => {
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('upload:progress', progress)
      })
    },
    onError: (error) => {
      console.error('[IPC] Upload worker error:', error)
    }
  })

  activeUploadHandle = handle

  try {
    await handle.result
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('upload:stop', () => {
  if (activeUploadHandle) {
    activeUploadHandle.terminate()
    activeUploadHandle = null
  }
  return { success: true }
})
