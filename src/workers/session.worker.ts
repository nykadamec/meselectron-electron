// Session Worker - centrální správa session pro prehrajto.cz
// Poskytuje login, refresh, validate a get-cookies operace
import { parentPort } from 'worker_threads'
import axios from 'axios'
import { chromium } from 'playwright'
import { readFile, writeFile, readdir } from 'fs/promises'
import path from 'path'
import { getProjectRoot } from './utils/paths.js'

interface SessionState {
  accountId: string
  email: string
  cookies: string
  expiresAt: number // timestamp
}

interface Credentials {
  email: string
  password: string
}

// In-memory session cache (single instance per worker)
const sessionCache = new Map<string, SessionState>()

/**
 * Parse Set-Cookie format to cookie header string
 * Format: name=value; Domain=...; Path=...; Secure; HttpOnly
 */
function parseCookieHeader(setCookieHeaders: string[]): string {
  const cookies: string[] = []
  for (const header of setCookieHeaders) {
    const cookiePart = header.split(';')[0]
    if (cookiePart && cookiePart.includes('=')) {
      cookies.push(cookiePart)
    }
  }
  return cookies.join('; ')
}

/**
 * Parse credentials file to get email and password
 */
async function readCredentials(accountsPath: string, emailKey: string): Promise<Credentials | null> {
  const credentialsPath = path.join(accountsPath, `credentials_${emailKey}.dat`)
  try {
    const content = await readFile(credentialsPath, 'utf-8')
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
  } catch {
    // File doesn't exist or invalid
  }
  return null
}

/**
 * Check if session is valid by making a test request
 */
async function isSessionValid(cookies: string): Promise<boolean> {
  try {
    const response = await axios.get('https://prehrajto.cz/profil', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': cookies
      },
      timeout: 10000
    })
    // Session is valid if response contains "Můj profil" or email
    const html = response.data
    return html.includes('Můj profil') || html.includes('function getCookie')
  } catch {
    return false
  }
}

/**
 * Perform login using Playwright browser
 * prehrajto.cz requires JavaScript redirect after login, which axios can't handle
 */
async function performLogin(email: string, password: string): Promise<string | null> {
  console.log(`[SESSION] Logging in as: ${email} (Playwright)`)

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null

  try {
    // Launch Playwright browser (headless)
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const context = await browser.newContext()
    const page = await context.newPage()

    // Step 1: Go to login page
    console.log('[SESSION] Navigating to login page...')
    await page.goto('https://prehrajto.cz/prihlaseni', { waitUntil: 'networkidle' })

    // Step 2: Fill in credentials
    console.log('[SESSION] Filling credentials...')
    await page.fill('#frm-login-loginForm-email', email)
    await page.fill('#frm-login-loginForm-password', password)

    // Step 3: Submit form
    console.log('[SESSION] Submitting login form...')
    await page.click('#frm-login-loginForm button[type="submit"]')

    // Step 4: Wait for success message (max 5 seconds)
    await page.waitForTimeout(5000)

    // Step 5: Check if login was successful using Playwright's text content method
    const pageContent = await page.content()
    const pageText = pageContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (!pageText.includes('Přihlášení proběhlo úspěšně')) {
      console.error('[SESSION] Login failed - no success message')
      return null
    }

    console.log('[SESSION] Login success detected, getting session cookies...')

    // Step 6: Navigate to homepage to establish session cookies
    await page.goto('https://prehrajto.cz/', { waitUntil: 'networkidle' })

    // Step 7: Get cookies
    const cookies = await context.cookies('https://prehrajto.cz')

    // Check for required tokens
    const hasRefreshToken = cookies.some(c => c.name === 'refresh_token')
    const hasAccessToken = cookies.some(c => c.name === 'access_token')

    if (!hasRefreshToken || !hasAccessToken) {
      console.error('[SESSION] Login failed - missing tokens')
      console.error('[SESSION] Has refresh_token:', hasRefreshToken)
      console.error('[SESSION] Has access_token:', hasAccessToken)
      return null
    }

    // Build cookie header string
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')

    console.log(`[SESSION] Login successful for: ${email}`)
    return cookieHeader

  } catch (error) {
    console.error('[SESSION] Login error:', error instanceof Error ? error.message : error)
    return null
  } finally {
    // Always close browser
    if (browser) {
      await browser.close()
    }
  }
}

/**
 * Update cookies file on disk
 */
async function updateCookiesFile(email: string, cookies: string): Promise<void> {
  try {
    const projectRoot = getProjectRoot()
    const accountsPath = path.join(projectRoot, 'DATA')

    // Find the cookie file for this email (format: login_email@domain.com.dat)
    const files = await readdir(accountsPath)
    const cookieFile = files.find(f => f === `login_${email}.dat`)

    if (cookieFile) {
      const cookiesPath = path.join(accountsPath, cookieFile)
      // Fetch fresh cookies from server
      const response = await axios.get('https://prehrajto.cz/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cookie': cookies
        },
        timeout: 15000
      })

      const allCookies = response.headers['set-cookie'] || []
      const cookieLines = allCookies.map(c => c.split(';')[0]).join('\n')

      await writeFile(cookiesPath, cookieLines, 'utf-8')
      console.log(`[SESSION] Cookies file updated: ${cookieFile}`)
    }
  } catch (error) {
    console.error('[SESSION] Failed to update cookies file:', error)
  }
}

/**
 * Save credentials to file (format: credentials_email@domain.com.dat)
 */
async function saveCredentials(email: string, password: string): Promise<void> {
  try {
    const projectRoot = getProjectRoot()
    const accountsPath = path.join(projectRoot, 'DATA')
    const credentialsPath = path.join(accountsPath, `credentials_${email}.dat`)

    const content = `email=${email}\npassword=${password}\n`
    await writeFile(credentialsPath, content, 'utf-8')
    console.log(`[SESSION] Credentials saved: ${email}.dat`)
  } catch (error) {
    console.error('[SESSION] Failed to save credentials:', error)
  }
}

// Helper to safely post messages
function sendResponse(data: unknown) {
  if (parentPort) {
    parentPort.postMessage(data)
  }
}

// Handle session requests
if (parentPort) {
parentPort.on('message', async (msg) => {
  const { type, accountId, email, password } = msg as {
    type: string
    accountId?: string
    email?: string
    password?: string
  }

  console.log(`[SESSION] Received: ${type}`)

  switch (type) {
    case 'login': {
      // Perform fresh login
      if (!email || !password) {
        sendResponse({ type: 'error', error: 'Email and password required' })
        return
      }

      const cookies = await performLogin(email, password)
      if (cookies) {
        // Calculate expiration (access_token typically expires in 30 days)
        const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000

        // Save credentials for future refresh
        await saveCredentials(email, password)

        // Cache session
        sessionCache.set(accountId || email, {
          accountId: accountId || email,
          email,
          cookies,
          expiresAt
        })

        sendResponse({ type: 'login-success', cookies, email })
      } else {
        sendResponse({ type: 'login-failed', error: 'Login failed' })
      }
      break
    }

    case 'refresh': {
      // Refresh session using stored credentials
      if (!accountId) {
        sendResponse({ type: 'error', error: 'Account ID required' })
        return
      }

      const cached = sessionCache.get(accountId)
      // Get email from cache, or try to get it from accountId
      // accountId can be "email@domain.com" or "account-X"
      let email: string
      if (cached?.email) {
        email = cached.email
      } else if (accountId.includes('@')) {
        email = accountId
      } else {
        // For account-X format, we need to get email from credentials file directly
        // Try reading all credentials files to find matching one
        const dataPath = path.join(getProjectRoot(), 'DATA')
        try {
          const files = await readdir(dataPath)
          const credFile = files.find(f => f.startsWith('credentials_') && f.endsWith('.dat'))
          if (credFile) {
            const credContent = await readFile(path.join(dataPath, credFile), 'utf-8')
            const emailMatch = credContent.match(/email=([^\n]+)/)
            email = emailMatch ? emailMatch[1].trim() : accountId
          } else {
            email = accountId
          }
        } catch {
          email = accountId
        }
      }

      const credentials = await readCredentials(path.join(getProjectRoot(), 'DATA'), email)

      if (!credentials) {
        sendResponse({ type: 'error', error: 'No credentials found' })
        return
      }

      const newCookies = await performLogin(credentials.email, credentials.password)
      if (newCookies) {
        const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000

        // Update cache
        sessionCache.set(accountId, {
          accountId,
          email: credentials.email,
          cookies: newCookies,
          expiresAt
        })

        // Update cookies file
        await updateCookiesFile(credentials.email, newCookies)

        sendResponse({ type: 'refresh-success', cookies: newCookies })
      } else {
        sendResponse({ type: 'refresh-failed', error: 'Refresh failed' })
      }
      break
    }

    case 'validate': {
      // Check if current session is still valid
      if (!accountId) {
        sendResponse({ type: 'error', error: 'Account ID required' })
        return
      }

      const cached = sessionCache.get(accountId)
      if (!cached) {
        // Try to read from file
        const cookiesPath = path.join(getProjectRoot(), 'DATA', `login_${accountId.replace('account-', '')}.dat`)
        try {
          const cookiesData = await readFile(cookiesPath, 'utf-8')
          const cookies = parseCookieHeader(cookiesData.split('\n'))
          const isValid = await isSessionValid(cookies)
          sendResponse({ type: 'validation', valid: isValid, cookies })
        } catch {
          sendResponse({ type: 'validation', valid: false })
        }
        return
      }

      // Check if expired
      if (Date.now() > cached.expiresAt) {
        console.log(`[SESSION] Session expired for: ${cached.email}`)
        sendResponse({ type: 'validation', valid: false, reason: 'expired' })
        return
      }

      // Verify with server
      const isValid = await isSessionValid(cached.cookies)
      if (isValid) {
        sendResponse({ type: 'validation', valid: true, cookies: cached.cookies })
      } else {
        sessionCache.delete(accountId)
        sendResponse({ type: 'validation', valid: false, reason: 'invalid' })
      }
      break
    }

    case 'get-cookies': {
      // Get cookies for an account (with auto-refresh if needed)
      if (!accountId) {
        sendResponse({ type: 'error', error: 'Account ID required' })
        return
      }

      const cached = sessionCache.get(accountId)
      if (cached && Date.now() < cached.expiresAt) {
        // Check if still valid
        const isValid = await isSessionValid(cached.cookies)
        if (isValid) {
          sendResponse({ type: 'cookies', cookies: cached.cookies, source: 'cache' })
          return
        }
      }

      // Try to refresh session
      // Get email from accountId (format: account-X or email@domain.com)
      const email = accountId.replace('account-', '')
      const credentials = await readCredentials(path.join(getProjectRoot(), 'DATA'), email)

      if (credentials) {
        const newCookies = await performLogin(credentials.email, credentials.password)
        if (newCookies) {
          const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000
          sessionCache.set(accountId, {
            accountId,
            email: credentials.email,
            cookies: newCookies,
            expiresAt
          })
          await updateCookiesFile(credentials.email, newCookies)
          sendResponse({ type: 'cookies', cookies: newCookies, source: 'refreshed' })
          return
        }
      }

      // Fallback to file
      const cookiesPath = path.join(getProjectRoot(), 'DATA', `login_${email}.dat`)
      try {
        const cookiesData = await readFile(cookiesPath, 'utf-8')
        const cookies = parseCookieHeader(cookiesData.split('\n'))
        sendResponse({ type: 'cookies', cookies, source: 'file' })
      } catch {
        sendResponse({ type: 'error', error: 'No cookies available' })
      }
      break
    }

    case 'save-credentials': {
      // Save credentials for auto-login
      if (!email || !password) {
        sendResponse({ type: 'error', error: 'Email and password required' })
        return
      }

      await saveCredentials(email, password)
      sendResponse({ type: 'credentials-saved' })
      break
    }

    case 'clear-cache': {
      // Clear session cache (e.g., on logout)
      sessionCache.clear()
      sendResponse({ type: 'cache-cleared' })
      break
    }

    default:
      sendResponse({ type: 'error', error: `Unknown message type: ${type}` })
  }
})
}
