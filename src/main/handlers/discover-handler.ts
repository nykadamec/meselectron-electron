// Discover Handler - discover:start, myvideos:start, myvideos:delete
import { ipcMain, BrowserWindow } from 'electron'
import { createWorker, WorkerType } from '../utils/worker-factory'

ipcMain.handle('discover:start', async (_, options) => {
  const handle = createWorker({
    workerType: WorkerType.DISCOVER,
    type: 'discover',
    payload: options,
    onProgress: (progress) => {
      console.log('[IPC discover] Progress:', progress.type)
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('discover:progress', progress)
      })
    }
  })

  try {
    await handle.result
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('myvideos:start', async (_, options) => {
  console.log('[IPC myvideos:start] Starting with options:', options)
  const handle = createWorker({
    workerType: WorkerType.MYVIDEOS,
    type: 'myvideos',
    payload: options,
    onProgress: (progress) => {
      console.log('[IPC myvideos:start] Progress received:', progress.type, progress)
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('myvideos:progress', progress)
      })
    }
  })

  try {
    console.log('[IPC myvideos:start] Waiting for worker result...')
    await handle.result
    console.log('[IPC myvideos:start] Worker completed successfully')
    return { success: true }
  } catch (error) {
    console.log('[IPC myvideos:start] Worker error:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('myvideos:delete', async (_, options) => {
  const handle = createWorker({
    workerType: WorkerType.MYVIDEOS,
    type: 'myvideos-delete',
    payload: options,
    onProgress: (progress) => {
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('myvideos:progress', progress)
      })
    }
  })

  try {
    await handle.result
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})
