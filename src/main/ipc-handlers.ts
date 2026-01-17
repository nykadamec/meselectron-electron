import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import axios from 'axios'
import { Worker } from 'worker_threads'
import os from 'os'

// Global variable to track active download worker for cancellation
let activeDownloadWorker: Worker | null = null

// Types
interface Account {
  id: string
  email: string
  cookiesFile: string
  isActive: boolean
  lastUsed?: Date
  credits?: number
  hasCredentials?: boolean
  needsLogin?: boolean
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

// Get app-specific data path for persistence
const getAppDataPath = () => path.join(getUserDataPath(), 'prehrajto-autopilot')

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

// Processed videos persistence handlers
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

    // Find both cookie files and credentials files
    const cookieFiles = files.filter(f => f.startsWith('login_') && f.endsWith('.dat'))
    const credentialsFiles = files.filter(f => f.startsWith('credentials_') && f.endsWith('.dat'))

    console.log('[IPC] Cookie files found:', cookieFiles)
    console.log('[IPC] Credentials files found:', credentialsFiles)

    // Build a map of email -> credentials
    const credentialsMap = new Map<string, { file: string; email: string; password?: string }>()
    for (const credFile of credentialsFiles) {
      // Format: credentials_email@domain.com.dat
      const email = credFile.replace('credentials_', '').replace('.dat', '')
      credentialsMap.set(email, { file: credFile, email })
    }

    // Create accounts from cookie files
    const accounts: Account[] = await Promise.all(cookieFiles.map(async (file, index) => {
      const cookiesPath = path.join(accountsPath, file)

      // Parse cookies
      let cookieHeader = ''
      let cookieCount = 0
      let cookieNames: string[] = []
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
            cookieNames.push(cookiePart.split('=')[0])
          }
        }
        cookieCount = cookies.length
        cookieHeader = cookies.join('; ')
        console.log(`[IPC] ${file}: ${cookieCount} cookies loaded: ${cookieNames.slice(0, 5).join(', ')}${cookieNames.length > 5 ? '...' : ''}`)
      } catch (err) {
        console.error(`[IPC] ${file}: Error reading cookies: ${err}`)
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

      // Format: login_email@domain.com.dat
      const emailFromFile = file.replace('login_', '').replace('.dat', '')

      return {
        id: `account-${index}`,
        email: emailFromFile,
        cookiesFile: cookiesPath,
        isActive: true,
        credits,
        hasCredentials: credentialsMap.has(emailFromFile)
      }
    }))

    // Add accounts that have credentials but no cookie file (need login)
    for (const credFile of credentialsFiles) {
      try {
        const credPath = path.join(accountsPath, credFile)
        const credContent = await fs.readFile(credPath, 'utf-8')
        const emailMatch = credContent.match(/email=([^\n]+)/)
        const emailFromFile = emailMatch ? emailMatch[1].trim() : credFile

        const alreadyExists = accounts.some(a => a.email === emailFromFile)

        if (!alreadyExists) {
          console.log(`[IPC] Adding account with credentials only: ${emailFromFile}`)
          accounts.push({
            id: `account-${accounts.length}`,
            email: emailFromFile,
            cookiesFile: path.join(accountsPath, `login_${credFile.replace('credentials_', '')}`),
            isActive: true,
            credits: 0,
            hasCredentials: true,
            needsLogin: true
          })
        }
      } catch (err) {
        console.error(`[IPC] Error reading credentials file ${credFile}:`, err)
      }
    }

    console.log('[IPC] Accounts with credits:', accounts.map(a => ({ id: a.id, email: a.email, credits: a.credits, needsLogin: (a as unknown as { needsLogin?: boolean }).needsLogin })))
    return accounts
  } catch (error) {
    console.log('[IPC] Error reading accounts:', error)
    return []
  }
})

// Auto-login for accounts that have credentials but no cookies file
ipcMain.handle('accounts:auto-login', async () => {
  const projectRoot = getProjectRoot()
  const accountsPath = path.join(projectRoot, 'DATA')
  console.log('[IPC] Running auto-login for accounts without cookies...')

  try {
    const files = await fs.readdir(accountsPath)
    const credentialsFiles = files.filter(f => f.startsWith('credentials_') && f.endsWith('.dat'))

    console.log(`[IPC] Found ${credentialsFiles.length} credentials file(s)`)

    const results: { email: string; success: boolean; error?: string }[] = []

    for (const credFile of credentialsFiles) {
      const loginFile = credFile.replace('credentials_', 'login_')
      const loginPath = path.join(accountsPath, loginFile)

      // Skip if login file already exists
      if (existsSync(loginPath)) {
        console.log(`[IPC] Skipping ${credFile} - login file already exists`)
        continue
      }

      console.log(`[IPC] Auto-login for: ${credFile}`)

      // Read credentials
      const credPath = path.join(accountsPath, credFile)
      const credContent = await fs.readFile(credPath, 'utf-8')
      const emailMatch = credContent.match(/email=([^\n]+)/)
      const passwordMatch = credContent.match(/password=([^\n]+)/)

      if (!emailMatch || !passwordMatch) {
        console.error(`[IPC] Invalid credentials file: ${credFile}`)
        results.push({ email: credFile, success: false, error: 'Invalid format' })
        continue
      }

      const email = emailMatch[1].trim()
      const password = passwordMatch[1].trim()

      // Perform login via session worker
      try {
        console.log(`[IPC] Logging in as: ${email}`)
        const result = await sendToSessionWorker({ type: 'login', email, password })

        if (result && typeof result === 'object' && 'cookies' in result) {
          const cookies = (result as { cookies: string }).cookies

          // Save cookies to file
          const cookieLines = cookies.split(';').map(c => c.trim().split('=')[0] + '=' + c.trim().split('=').slice(1).join('='))
          await fs.writeFile(loginPath, cookieLines.join('\n'), 'utf-8')

          console.log(`[IPC] ✅ Auto-login successful for: ${email}`)
          results.push({ email, success: true })
        } else {
          console.error(`[IPC] ❌ Auto-login failed for: ${email}`)
          results.push({ email, success: false, error: 'Login failed' })
        }
      } catch (err) {
        console.error(`[IPC] Auto-login error for ${email}:`, err)
        results.push({ email, success: false, error: String(err) })
      }
    }

    console.log(`[IPC] Auto-login complete: ${results.filter(r => r.success).length}/${results.length} successful`)
    return results

  } catch (error) {
    console.error('[IPC] Auto-login error:', error)
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
    const cookiesData = await fs.readFile(cookiesPath, 'utf-8')

    // Parse cookies from Netscape format
    const cookies: string[] = []
    const lines = cookiesData.trim().split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const cookiePart = trimmed.split(';')[0]  // Pouze "name=value", bez atributů
      if (cookiePart && cookiePart.includes('=')) {
        cookies.push(cookiePart)
      }
    }
    const cookieHeader = cookies.join('; ')
    console.log(`[IPC] accounts:read-cookies: ${cookies.length} cookies parsed`)
    return cookieHeader
  } catch (err) {
    console.error(`[IPC] accounts:read-cookies error: ${err}`)
    return null
  }
})

// Save account credentials (email + password)
ipcMain.handle('accounts:save-credentials', async (_, accountId: string, credentials: { email: string; password: string }) => {
  const accountsPath = path.join(getProjectRoot(), 'DATA')
  try {
    const files = await fs.readdir(accountsPath)
    const cookieFiles = files.filter(f => f.startsWith('login_') && f.endsWith('.dat'))

    const account = cookieFiles.find((_, index) => `account-${index}` === accountId)
    if (!account) return false

    // Create credentials filename from email (format: credentials_email@domain.com.dat)
    const credentialsPath = path.join(accountsPath, `credentials_${credentials.email}.dat`)

    // Save credentials
    const content = `email=${credentials.email}\npassword=${credentials.password}\n`
    await fs.writeFile(credentialsPath, content, 'utf-8')

    console.log(`[IPC] Credentials saved for: ${credentials.email}`)
    return true
  } catch (err) {
    console.error(`[IPC] accounts:save-credentials error: ${err}`)
    return false
  }
})

// Get account credentials
ipcMain.handle('accounts:get-credentials', async (_, accountId: string) => {
  const accountsPath = path.join(getProjectRoot(), 'DATA')
  try {
    const files = await fs.readdir(accountsPath)
    const credentialFiles = files.filter(f => f.startsWith('credentials_') && f.endsWith('.dat'))

    const credentialFile = credentialFiles.find((_, index) => `account-${index}` === accountId)
    if (!credentialFile) return null

    const credentialsPath = path.join(accountsPath, credentialFile)
    const content = await fs.readFile(credentialsPath, 'utf-8')

    // Parse credentials
    const lines = content.trim().split('\n')
    const credentials: Record<string, string> = {}
    for (const line of lines) {
      const [key, value] = line.split('=')
      if (key && value) {
        credentials[key.trim()] = value.trim()
      }
    }

    if (credentials.email && credentials.password) {
      return { email: credentials.email, password: credentials.password }
    }
    return null
  } catch (err) {
    console.error(`[IPC] accounts:get-credentials error: ${err}`)
    return null
  }
})

// Login and refresh cookies (for when session expires)
ipcMain.handle('accounts:refresh-session', async (_, accountId: string) => {
  const accountsPath = path.join(getProjectRoot(), 'DATA')
  try {
    // Read credentials file directly
    const files = await fs.readdir(accountsPath)
    const credentialFiles = files.filter(f => f.startsWith('credentials_') && f.endsWith('.dat'))
    const credentialFile = credentialFiles.find((_, index) => `account-${index}` === accountId)

    if (!credentialFile) {
      console.error('[IPC] No credentials found for account:', accountId)
      return null
    }

    const credentialsPath = path.join(accountsPath, credentialFile)
    const credContent = await fs.readFile(credentialsPath, 'utf-8')

    // Parse credentials
    const credLines = credContent.trim().split('\n')
    const credData: Record<string, string> = {}
    for (const line of credLines) {
      const [key, value] = line.split('=')
      if (key && value) {
        credData[key.trim()] = value.trim()
      }
    }

    if (!credData.email || !credData.password) {
      console.error('[IPC] Missing email or password in credentials')
      return null
    }

    console.log(`[IPC] Re-logging in as: ${credData.email}`)

    // Perform login
    const loginUrl = 'https://prehrajto.cz/?frm=homepageLoginForm-loginForm'
    const loginData = new URLSearchParams()
    loginData.append('email', credData.email)
    loginData.append('password', credData.password)
    loginData.append('_do', 'homepageLoginForm-loginForm-submit')
    loginData.append('login', 'Přihlásit se')

    const loginResponse = await axios.post(loginUrl, loginData, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://prehrajto.cz',
        'Referer': 'https://prehrajto.cz/',
      },
      maxRedirects: 5
    })

    // Extract cookies from response
    const setCookieHeader = loginResponse.headers['set-cookie']
    if (!setCookieHeader) {
      console.error('[IPC] No cookies in login response')
      return null
    }

    // Parse Set-Cookie header
    const newCookies: string[] = []
    for (const cookie of setCookieHeader) {
      const cookiePart = cookie.split(';')[0]
      if (cookiePart && cookiePart.includes('=')) {
        newCookies.push(cookiePart)
      }
    }

    // Also get remaining cookies from the session by making a follow-up request
    const cookieHeader = newCookies.join('; ')

    // Verify login worked by fetching profile
    const profileResponse = await axios.get('https://prehrajto.cz/profil', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': cookieHeader
      },
      timeout: 15000
    })

    if (!profileResponse.data.includes(credData.email) && !profileResponse.data.includes('Můj profil')) {
      console.error('[IPC] Login verification failed')
      return null
    }

    // Update cookies file
    const cookieFiles = files.filter(f => f.startsWith('login_') && f.endsWith('.dat'))
    const cookieFile = cookieFiles.find((_, index) => `account-${index}` === accountId)

    if (cookieFile) {
      const cookiesPath = path.join(accountsPath, cookieFile)
      // Fetch full cookies from profile page
      const fullCookiesResponse = await axios.get('https://prehrajto.cz/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cookie': cookieHeader
        },
        timeout: 15000
      })

      // Get all cookies from jar
      const allCookies = fullCookiesResponse.headers['set-cookie'] || []
      const cookieLines = allCookies.map(c => c.split(';')[0]).join('\n')

      await fs.writeFile(cookiesPath, cookieLines, 'utf-8')
      console.log(`[IPC] Cookies updated for: ${credData.email}`)
    }

    return cookieHeader
  } catch (err) {
    console.error(`[IPC] accounts:refresh-session error: ${err}`)
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
ipcMain.handle('download:start', async (_, options: { url: string; outputPath?: string; cookies?: string; videoId?: string; maxConcurrent?: number; addWatermark?: boolean; ffmpegPath?: string; hqProcessing?: boolean }) => {
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

    // Read current settings to get downloadMode and hqProcessing
    const settingsPath = path.join(getUserDataPath(), 'prehrajto-autopilot', 'settings.json')
    let downloadMode = 'ffmpeg-chunks'
    let hqProcessing = true
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const settingsData = require('fs').readFileSync(settingsPath, 'utf-8')
      const settings = JSON.parse(settingsData)
      downloadMode = settings.downloadMode || 'ffmpeg-chunks'
      hqProcessing = settings.hqProcessing !== false
    } catch {
      // Use defaults
    }

    const workerPayload = {
      ...options,
      outputPath,
      ffmpegPath,
      downloadMode,
      hqProcessing
    }

    const worker = new Worker(workerPath, {
      workerData: { type: 'download', payload: workerPayload }
    })

    // Store reference to active worker for cancellation
    activeDownloadWorker = worker

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
      // Clear active worker reference if this was the active worker
      if (activeDownloadWorker === worker) {
        activeDownloadWorker = null
      }
      if (code === 0) resolve({ success: true })
      else reject(new Error(`Worker exited with code ${code}`))
    })
  })
})

// Extract video metadata (called from worker to avoid thread network issues)
ipcMain.handle('download:extract-metadata', async (_, { url, cookies, hqProcessing }) => {
  console.log('[IPC] Extracting metadata from:', url.substring(0, 60), '| HQ:', hqProcessing)

  try {
    // HQ Processing (default): use ?do=download URL
    // LQ Processing: use original URL directly
    const fetchUrl = hqProcessing !== false
      ? (url.includes('?') ? `${url}&do=download` : `${url}?do=download`)
      : url

    const response = await axios.get(fetchUrl, {
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
ipcMain.handle('upload:start', async (_, options: { filePath: string; accountId?: string; cookies?: string; videoId?: string }) => {
  console.log('[IPC] uploadStart called:', {
    videoId: options.videoId,
    filePath: options.filePath?.substring(0, 50)
  })

  // Get cookies from session worker if accountId is provided
  let cookies = options.cookies || ''

  if (options.accountId && !cookies) {
    try {
      const sessionResult = await sendToSessionWorker({ type: 'get-cookies', accountId: options.accountId })
      if (sessionResult && typeof sessionResult === 'object' && 'cookies' in sessionResult) {
        cookies = (sessionResult as { cookies: string }).cookies
        console.log(`[IPC] Got cookies for upload, source: ${(sessionResult as { source?: string }).source || 'unknown'}`)
      }
    } catch (error) {
      console.error('[IPC] Failed to get session cookies for upload:', error)
    }
  }

  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, '../workers/upload.worker.cjs')

    const workerPayload = {
      ...options,
      cookies  // Include resolved cookies
    }

    const worker = new Worker(workerPath, {
      workerData: { type: 'upload', payload: workerPayload }
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
ipcMain.handle('discover:start', async (_, options: { accountId?: string; cookies?: string; count: number; videoId?: string }) => {
  // Get cookies from session worker if accountId is provided
  let cookies = options.cookies || ''

  if (options.accountId && !cookies) {
    try {
      const sessionResult = await sendToSessionWorker({ type: 'get-cookies', accountId: options.accountId })
      if (sessionResult && typeof sessionResult === 'object' && 'cookies' in sessionResult) {
        cookies = (sessionResult as { cookies: string }).cookies
        console.log(`[IPC] Got cookies for discover, source: ${(sessionResult as { source?: string }).source || 'unknown'}`)
      }
    } catch (error) {
      console.error('[IPC] Failed to get session cookies for discover:', error)
    }
  }

  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, '../workers/discover.worker.cjs')

    const workerPayload = {
      ...options,
      cookies  // Include resolved cookies
    }

    const worker = new Worker(workerPath, {
      workerData: { type: 'discover', payload: workerPayload }
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

// ============================================================================
// Session Worker Communication
// ============================================================================

/**
 * Get session worker instance (singleton per process)
 */
let sessionWorker: Worker | null = null

function getSessionWorker(): Worker {
  if (!sessionWorker) {
    const workerPath = path.join(__dirname, '../workers/session.worker.cjs')
    sessionWorker = new Worker(workerPath, {
      workerData: { type: 'session' }
    })

    sessionWorker.on('error', (error) => {
      console.error('[IPC] Session worker error:', error)
    })

    sessionWorker.on('exit', (code) => {
      console.log('[IPC] Session worker exited:', code)
      sessionWorker = null
    })
  }
  return sessionWorker
}

/**
 * Send message to session worker and wait for response
 */
async function sendToSessionWorker(message: Record<string, unknown>, timeoutMs: number = 30000): Promise<unknown> {
  const worker = getSessionWorker()

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Session worker timeout (${timeoutMs}ms)`))
    }, timeoutMs)

    const handler = (response: unknown) => {
      clearTimeout(timeout)
      worker.off('message', handler)
      resolve(response)
    }

    worker.on('message', handler)
    worker.postMessage(message)
  })
}

// Session handlers
ipcMain.handle('session:get-cookies', async (_, accountId: string) => {
  try {
    console.log(`[IPC] session:get-cookies for account: ${accountId}`)
    const result = await sendToSessionWorker({ type: 'get-cookies', accountId })

    if (result && typeof result === 'object' && 'cookies' in result) {
      console.log(`[IPC] Got cookies, source: ${(result as { source?: string }).source || 'unknown'}`)
      return result
    }

    console.error('[IPC] session:get-cookies failed:', result)
    return null
  } catch (error) {
    console.error('[IPC] session:get-cookies error:', error)
    return null
  }
})

ipcMain.handle('session:validate', async (_, accountId: string) => {
  try {
    console.log(`[IPC] session:validate for account: ${accountId}`)
    const result = await sendToSessionWorker({ type: 'validate', accountId })
    return result
  } catch (error) {
    console.error('[IPC] session:validate error:', error)
    return { type: 'validation', valid: false, reason: 'error' }
  }
})

ipcMain.handle('session:refresh', async (_, accountId: string) => {
  try {
    console.log(`[IPC] session:refresh for account: ${accountId}`)
    const result = await sendToSessionWorker({ type: 'refresh', accountId })
    return result
  } catch (error) {
    console.error('[IPC] session:refresh error:', error)
    return { type: 'refresh-failed', error: String(error) }
  }
})

ipcMain.handle('session:login', async (_, email: string, password: string) => {
  try {
    console.log(`[IPC] session:login for: ${email}`)
    const result = await sendToSessionWorker({ type: 'login', email, password })
    return result
  } catch (error) {
    console.error('[IPC] session:login error:', error)
    return { type: 'login-failed', error: String(error) }
  }
})

ipcMain.handle('session:save-credentials', async (_, email: string, password: string) => {
  try {
    await sendToSessionWorker({ type: 'save-credentials', email, password })
    return { success: true }
  } catch (error) {
    console.error('[IPC] session:save-credentials error:', error)
    return { success: false, error: String(error) }
  }
})

// Download stop handler - terminates active download worker
ipcMain.on('download:stop', () => {
  if (activeDownloadWorker) {
    console.log('[IPC] Terminating active download worker...')
    activeDownloadWorker.terminate()
    activeDownloadWorker = null
    console.log('[IPC] Download worker terminated')
  } else {
    console.log('[IPC] No active download worker to terminate')
  }
})
