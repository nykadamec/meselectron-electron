import { app, BrowserWindow, nativeTheme, ipcMain } from 'electron'
import path from 'path'
import { initAnalytics, trackAppLaunch, trackAppClose, flushAnalytics } from './analytics.js'
import { WINDOW_WIDTH, WINDOW_HEIGHT, WINDOW_MIN_WIDTH, WINDOW_MIN_HEIGHT } from './constants.js'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: WINDOW_MIN_WIDTH,
    minHeight: WINDOW_MIN_HEIGHT,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    },
    titleBarStyle: 'customButtonsOnHover',
    titleBarOverlay: {
      color: '#121212',
      symbolColor: '#ffffff',
      height: 40
    },
    backgroundColor: '#0b0b0b',
    show: false
  })

  nativeTheme.themeSource = 'dark'

  // Auto Hide traffic lights
  // mainWindow.setWindowButtonVisibility(false)

  // Load the app
  const preloadPath = path.join(__dirname, '../preload/index.cjs')
  const rendererPath = path.join(__dirname, '../renderer/index.html')

  console.log('Preload path:', preloadPath)
  console.log('Renderer path:', rendererPath)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(rendererPath)
  }

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription)
  })

  mainWindow.webContents.on('console-message', (_event, level, message) => {
    console.log('[Renderer]', message)
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Initialize analytics
initAnalytics()

// Track app launch when ready
app.whenReady().then(() => {
  createWindow()
  trackAppLaunch()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Track app close
app.on('before-quit', () => {
  trackAppClose()
  flushAnalytics()
})

// IPC Handlers
import './handlers/index.js'
