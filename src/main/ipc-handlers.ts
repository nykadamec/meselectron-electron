import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import axios from 'axios'
import { Worker } from 'worker_threads'
import os from 'os'

// Types
interface Account {
  id: string
  email: string
  cookiesFile: string
  isActive: boolean
  lastUsed?: Date
}

interface Settings {
  autoReset: boolean
  downloadConcurrency: number
  uploadConcurrency: number
  videoCount: number
  nospeed: boolean
  addWatermark: boolean
  outputDir: string
}

// Get user data path for settings
const getUserDataPath = () => process.env.APPDATA || path.join(process.env.HOME || '', 'Library/Application Support')

// Get the path to the project root (where DATA folder is located)
const getProjectRoot = () => {
  const cwd = process.cwd()
  const dataPath = path.join(cwd, 'DATA')
  if (existsSync(dataPath)) {
    return cwd
  }
  const parentDataPath = path.join(cwd, '..', 'DATA')
  if (existsSync(parentDataPath)) {
    return path.join(cwd, '..')
  }
  return cwd
}

// Settings handlers
ipcMain.handle('settings:read', async () => {
  const settingsPath = path.join(getUserDataPath(), 'prehrajto-autopilot', 'settings.json')
  try {
    const data = await fs.readFile(settingsPath, 'utf-8')
    return JSON.parse(data) as Settings
  } catch {
    const defaultDir = path.join(os.homedir(), 'Videos', 'meselectron')
    return {
      autoReset: true,
      downloadConcurrency: 2,
      uploadConcurrency: 2,
      videoCount: 20,
      nospeed: false,
      addWatermark: true,
      outputDir: defaultDir
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

// Account handlers
ipcMain.handle('accounts:list', async () => {
  const projectRoot = getProjectRoot()
  const accountsPath = path.join(projectRoot, 'DATA')
  console.log('[IPC] Looking for accounts in:', accountsPath)
  console.log('[IPC] DATA folder exists:', existsSync(accountsPath))

  try {
    const files = await fs.readdir(accountsPath)
    console.log('[IPC] Files in DATA:', files)
    const cookieFiles = files.filter(f => f.startsWith('login_') && f.endsWith('.dat'))
    console.log('[IPC] Cookie files found:', cookieFiles)

    const accounts: Account[] = await Promise.all(cookieFiles.map(async (file, index) => {
      const cookiesPath = path.join(accountsPath, file)

      // Parse cookies
      let cookieHeader = ''
      try {
        const cookiesData = await fs.readFile(cookiesPath, 'utf-8')
        const cookies: string[] = []
        const lines = cookiesData.trim().split('\n')
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('#')) continue
          const cookiePart = trimmed.split(';')[0]
          if (cookiePart && cookiePart.includes('=')) {
            cookies.push(cookiePart)
          }
        }
        cookieHeader = cookies.join('; ')
      } catch {
        cookieHeader = ''
      }

      // Fetch credits for this account
      let credits = 0
      if (cookieHeader) {
        try {
          const response = await axios.get('https://prehrajto.cz/provize/', {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              'Cookie': cookieHeader
            },
            timeout: 15000
          })

          const html = response.data
          const tableMatch = html.match(/<table[^>]*class="table"[^>]*>([\s\S]*?)<\/table>/i)
          if (tableMatch) {
            const tableHtml = tableMatch[1]
            const rowMatch = tableHtml.match(/<tr[^>]*>[\s]*<td[^>]*>\s*Aktuální stav vašich bodů\s*<\/td>[\s]*<td[^>]*>\s*(\d+)\s*<\/td>/i)
            if (rowMatch) {
              credits = parseInt(rowMatch[1], 10) || 0
            }
          }
        } catch (error) {
          console.log('[IPC] Error fetching credits for account:', file, error)
        }
      }

      return {
        id: `account-${index}`,
        email: file.replace('login_', '').replace('.dat', ''),
        cookiesFile: cookiesPath,
        isActive: true,
        credits
      }
    }))

    console.log('[IPC] Accounts with credits:', accounts.map(a => ({ id: a.id, email: a.email, credits: a.credits })))
    return accounts
  } catch (error) {
    console.log('[IPC] Error reading accounts:', error)
    return []
  }
})

ipcMain.handle('accounts:read-cookies', async (_, accountId: string) => {
  const accountsPath = path.join(getProjectRoot(), 'DATA')
  try {
    const files = await fs.readdir(accountsPath)
    const cookieFiles = files.filter(f => f.startsWith('login_') && f.endsWith('.dat'))

    const account = cookieFiles.find((_, index) => `account-${index}` === accountId)
    if (!account) return null

    const cookiesPath = path.join(accountsPath, account)
    const data = await fs.readFile(cookiesPath, 'utf-8')
    return data
  } catch {
    return null
  }
})

// Get account credits from prehrajto.cz/provize
ipcMain.handle('accounts:get-credits', async (_, accountId: string) => {
  const accountsPath = path.join(getProjectRoot(), 'DATA')
  try {
    const files = await fs.readdir(accountsPath)
    const cookieFiles = files.filter(f => f.startsWith('login_') && f.endsWith('.dat'))

    const account = cookieFiles.find((_, index) => `account-${index}` === accountId)
    if (!account) return null

    const cookiesPath = path.join(accountsPath, account)
    const cookiesData = await fs.readFile(cookiesPath, 'utf-8')

    // Parse cookies
    const cookies: string[] = []
    const lines = cookiesData.trim().split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const cookiePart = trimmed.split(';')[0]
      if (cookiePart && cookiePart.includes('=')) {
        cookies.push(cookiePart)
      }
    }
    const cookieHeader = cookies.join('; ')

    // Fetch credits page
    const response = await axios.get('https://prehrajto.cz/provize/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Cookie': cookieHeader
      },
      timeout: 15000
    })

    // Parse credits from table
    const html = response.data
    const tableMatch = html.match(/<table[^>]*class="table"[^>]*>([\s\S]*?)<\/table>/i)
    if (!tableMatch) return 0

    const tableHtml = tableMatch[1]
    // Look for "Aktuální stav vašich bodů" row
    const rowMatch = tableHtml.match(/<tr[^>]*>[\s]*<td[^>]*>\s*Aktuální stav vašich bodů\s*<\/td>[\s]*<td[^>]*>\s*(\d+)\s*<\/td>/i)
    if (rowMatch) {
      return parseInt(rowMatch[1], 10) || 0
    }

    return 0
  } catch {
    return null
  }
})

// File handlers
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

// Version check (remote)
ipcMain.handle('version:check', async () => {
  try {
    const response = await axios.get('https://cemada.me/program/version.txt')
    return { remoteVersion: response.data.trim(), needsUpdate: true }
  } catch {
    return { remoteVersion: null, error: 'Failed to check version' }
  }
})

// Get local version from package.json
ipcMain.handle('version:get', async () => {
  try {
    const packageJsonPath = path.join(getProjectRoot(), 'package.json')
    const data = await fs.readFile(packageJsonPath, 'utf-8')
    const packageJson = JSON.parse(data)
    return packageJson.version || null
  } catch {
    return null
  }
})

// Get app name from package.json
ipcMain.handle('name:get', async () => {
  try {
    const packageJsonPath = path.join(getProjectRoot(), 'package.json')
    const data = await fs.readFile(packageJsonPath, 'utf-8')
    const packageJson = JSON.parse(data)
    return packageJson.appName || 'Prehrajto AutoPilot'
  } catch {
    return 'Prehrajto AutoPilot'
  }
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

// Download handler using worker
ipcMain.handle('download:start', async (_, options: { url: string; outputPath?: string; cookies?: string; videoId?: string; maxConcurrent?: number; addWatermark?: boolean; ffmpegPath?: string }) => {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, '../workers/download.worker.cjs')

    // Generate outputPath if not provided
    const outputPath = options.outputPath || path.join(getProjectRoot(), 'VIDEOS', `video_${Date.now()}.mp4`)

    // Get ffmpeg path if not provided
    const ffmpegPath = options.ffmpegPath || (() => {
      try {
        const projectRoot = getProjectRoot()
        const ffmpeg = path.join(projectRoot, 'node_modules', '@ffmpeg-installer', 'ffmpeg', 'dist', 'ffmpeg')
        return existsSync(ffmpeg) ? ffmpeg : null
      } catch {
        return null
      }
    })()

    // Read current settings to get downloadMode
    const settingsPath = path.join(getUserDataPath(), 'prehrajto-autopilot', 'settings.json')
    let downloadMode = 'ffmpeg-chunks'
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const settingsData = require('fs').readFileSync(settingsPath, 'utf-8')
      const settings = JSON.parse(settingsData)
      downloadMode = settings.downloadMode || 'ffmpeg-chunks'
    } catch {
      // Use default
    }

    const workerPayload = {
      ...options,
      outputPath,
      ffmpegPath,
      downloadMode
    }

    const worker = new Worker(workerPath, {
      workerData: { type: 'download', payload: workerPayload }
    })

    worker.on('message', (update) => {
      // Handle IPC calls from worker
      if (update.type === 'ipc:call') {
        const { channel, args, callbackId } = update
        console.log('[IPC] Worker calling:', channel)

        // For download:extract-metadata, use axios directly
        if (channel === 'download:extract-metadata') {
          const { url, cookies } = args
          console.log('[IPC] [DEBUG] Extracting metadata for:', url)
          console.log('[IPC] [DEBUG] Cookies present:', !!cookies, '| Length:', cookies?.length || 0)

          // Step 1: Get video PAGE to extract size (without ?do=download)
          // Size is in <div class="video__tag video__tag--size">X.XX GB</div>
          const videoPageUrl = url.includes('?do=download')
            ? url.replace('?do=download', '')
            : url

          axios.get(videoPageUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              'Cookie': cookies || ''
            },
            timeout: 15000
          }).then(response => {
            console.log('[IPC] [DEBUG] Video page response status:', response.status)

            const html = response.data
            console.log('[IPC] [DEBUG] HTML length:', html.length)
            console.log('[IPC] [DEBUG] Fetched from:', videoPageUrl)

            // DEBUG: Show HTML sample to find size element structure
            const htmlSample = html.substring(0, 1500).replace(/\s+/g, ' ')
            console.log('[IPC] [DEBUG] HTML sample:', htmlSample)

            // DEBUG: Search for any GB/MB patterns in the HTML
            const sizePatterns = html.match(/[\d.,]+\s*(GB|MB)/gi) || []
            console.log('[IPC] [DEBUG] Size patterns found:', sizePatterns.slice(0, 10))

            // Extract size from <div class="video__tag video__tag--size">X.XX GB</div>
            const sizeMatch = html.match(/<div[^>]*class="[^"]*video__tag[^"]*video__tag--size[^"]*"[^>]*>([\d.,]+)\s*(GB|MB)<\/div>/i)

            let fileSize = 0
            if (sizeMatch) {
              const sizeValue = parseFloat(sizeMatch[1].replace(',', '.'))
              const sizeUnit = sizeMatch[2].toUpperCase()
              fileSize = sizeUnit === 'GB' ? sizeValue * 1024 * 1024 * 1024 : sizeValue * 1024 * 1024
              console.log('[IPC] [DEBUG] ✅ Size found:', sizeValue, sizeUnit, '=', fileSize, 'bytes')
            } else {
              // Try alternative patterns for video__tag--size
              const altPatterns = [
                /video__tag--size[^>]*>([\d.,]+)\s*(GB|MB)/i,
                />\s*([\d.,]+)\s*(GB|MB)\s*<\//i,
                /Velikost[:\s]*([\d.,]+)\s*(GB|MB)/i,
                /class="[^"]*size[^"]*"[^>]*>([\d.,]+)\s*(GB|MB)/i
              ]

              for (const pattern of altPatterns) {
                const altMatch = html.match(pattern)
                if (altMatch) {
                  const sizeValue = parseFloat(altMatch[1].replace(',', '.'))
                  const sizeUnit = altMatch[2].toUpperCase()
                  fileSize = sizeUnit === 'GB' ? sizeValue * 1024 * 1024 * 1024 : sizeValue * 1024 * 1024
                  console.log('[IPC] [DEBUG] ✅ Size found (alt):', sizeValue, sizeUnit, '=', fileSize, 'bytes')
                  break
                }
              }

              if (fileSize === 0) {
                console.log('[IPC] [DEBUG] Size not found in HTML, will try HEAD request')
              }
            }

            // Step 2: Return download URL with ?do=download
            const downloadUrl = `${url}${url.includes('?') ? '&' : '?'}do=download`
            console.log('[IPC] [DEBUG] Download URL:', downloadUrl)

            // Step 3: If no size from HTML, try GET with Range header
            if (fileSize === 0) {
              console.log('[IPC] [DEBUG] Trying GET with Range for size...')
              return axios.get(downloadUrl, {
                headers: {
                  'Range': 'bytes=0-1',
                  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                  'Cookie': cookies || ''
                },
                timeout: 15000
              }).then(rangeResponse => {
                // Check Content-Range header for file size
                const contentRange = rangeResponse.headers['content-range']
                console.log('[IPC] [DEBUG] Content-Range:', contentRange)
                console.log('[IPC] [DEBUG] Status:', rangeResponse.status)

                if (contentRange) {
                  // Format: "bytes 0-1/1234567890"
                  const sizeMatch = contentRange.match(/\/(\d+)$/)
                  if (sizeMatch) {
                    fileSize = parseInt(sizeMatch[1], 10)
                    console.log('[IPC] [DEBUG] ✅ Size from Content-Range:', fileSize, 'bytes')
                  }
                }

                // Also check content-length as fallback
                if (fileSize === 0 && rangeResponse.headers['content-length']) {
                  fileSize = parseInt(String(rangeResponse.headers['content-length']), 10)
                  console.log('[IPC] [DEBUG] ✅ Size from Content-Length:', fileSize, 'bytes')
                }

                worker.postMessage({ type: 'ipc:result', callbackId, result: { mp4Url: downloadUrl, fileSize } })
              }).catch(err => {
                console.log('[IPC] [DEBUG] Range request failed:', err.code || err.message)
                // Fallback: return without size
                worker.postMessage({ type: 'ipc:result', callbackId, result: { mp4Url: downloadUrl, fileSize: 0 } })
              })
            } else {
              worker.postMessage({ type: 'ipc:result', callbackId, result: { mp4Url: downloadUrl, fileSize } })
            }
          }).catch(err => {
            console.log('[IPC] [DEBUG] Request failed:', err.code, '-', err.message)
            worker.postMessage({ type: 'ipc:result', callbackId, error: err.message })
          })
          return
        }

        // For other channels, try to use ipcMain
        try {
          // @ts-ignore - ipcMain.invoke exists
          ipcMain.invoke(channel, args)
            .then((result: unknown) => {
              worker.postMessage({ type: 'ipc:result', callbackId, result })
            })
            .catch((error: Error) => {
              worker.postMessage({ type: 'ipc:result', callbackId, error: error.message })
            })
        } catch {
          worker.postMessage({ type: 'ipc:result', callbackId, error: 'Unknown channel' })
        }
        return
      }

      // Forward download progress to renderer
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('download:progress', update)
      })
    })

    worker.on('error', reject)
    worker.on('exit', (code) => {
      if (code === 0) resolve({ success: true })
      else reject(new Error(`Worker exited with code ${code}`))
    })
  })
})

// Extract video metadata (called from worker to avoid thread network issues)
ipcMain.handle('download:extract-metadata', async (_, { url, cookies }) => {
  console.log('[IPC] Extracting metadata from:', url.substring(0, 60))

  try {
    const downloadUrl = url.includes('?') ? `${url}&do=download` : `${url}?do=download`

    const response = await axios.get(downloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Cookie': cookies || ''
      },
      timeout: 15000
    })

    const html = response.data
    console.log('[IPC] Got HTML, length:', html.length)

    const contentUrlMatch = html.match(/<meta\s+itemprop="contentUrl"\s+content="([^"]+)"/)
    if (!contentUrlMatch) {
      throw new Error('Nepodařilo se najít video URL na stránce')
    }

    const mp4Url = decodeURIComponent(contentUrlMatch[1])
    console.log('[IPC] Found MP4 URL')

    // HEAD request pro velikost
    const headResponse = await axios.head(mp4Url, {
      headers: {
        'Range': 'bytes=0-1',
        'Cookie': cookies || ''
      },
      timeout: 15000
    })

    const contentLength = headResponse.headers['content-length']
    const fileSize = contentLength ? parseInt(contentLength, 10) : 0

    if (fileSize === 0) {
      throw new Error('Nepodařilo se zjistit velikost souboru')
    }

    const fileSizeMB = fileSize / (1024 * 1024)
    console.log('[IPC] File size:', fileSizeMB.toFixed(1), 'MB')

    return { mp4Url, fileSize }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.log('[IPC] Metadata extraction failed:', errorMessage)
    throw new Error(`Chyba při extrakci metadat: ${errorMessage}`)
  }
})

// Upload handler using worker
ipcMain.handle('upload:start', async (_, options: { filePath: string; cookies?: string }) => {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, '../workers/upload.worker.cjs')

    const worker = new Worker(workerPath, {
      workerData: { type: 'upload', payload: options }
    })

    worker.on('message', (update) => {
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('upload:progress', update)
      })
    })

    worker.on('error', reject)
    worker.on('exit', (code) => {
      if (code === 0) resolve({ success: true })
      else reject(new Error(`Worker exited with code ${code}`))
    })
  })
})

// Video Discovery handler
ipcMain.handle('discover:start', async (_, options: { cookies: string; count: number }) => {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, '../workers/discover.worker.cjs')

    const worker = new Worker(workerPath, {
      workerData: { type: 'discover', payload: options }
    })

    worker.on('message', (update) => {
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('discover:progress', update)
      })
    })

    worker.on('error', reject)
    worker.on('exit', (code) => {
      if (code === 0) resolve({ success: true })
      else reject(new Error(`Worker exited with code ${code}`))
    })
  })
})

// My Videos handler
ipcMain.handle('myvideos:start', async (_, options: { cookies: string; page: number }) => {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, '../workers/myvideos.worker.cjs')

    const worker = new Worker(workerPath, {
      workerData: { type: 'myvideos', payload: options }
    })

    worker.on('message', (update) => {
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('myvideos:progress', update)
      })
    })

    worker.on('error', reject)
    worker.on('exit', (code) => {
      if (code === 0) resolve({ success: true })
      else reject(new Error(`Worker exited with code ${code}`))
    })
  })
})

// FFmpeg handler
ipcMain.handle('ffmpeg:get-path', async () => {
  try {
    // Try to find ffmpeg in node_modules
    const projectRoot = getProjectRoot()
    const ffmpegPath = path.join(projectRoot, 'node_modules', '@ffmpeg-installer', 'ffmpeg', 'dist', 'ffmpeg')
    if (existsSync(ffmpegPath)) {
      return ffmpegPath
    }
    return null
  } catch {
    return null
  }
})

// File utility handlers
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
