// Accounts Handlers - accounts:*, accounts:credits, accounts:refresh-session
import { ipcMain } from 'electron'
import path from 'path'
import * as fs from 'fs/promises'
import axios from 'axios'
import { getProjectRoot } from '../utils/paths'
import { TIMEOUT_MEDIUM, MAX_COOKIE_NAME_LENGTH } from '../constants'

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

function parseCookiesFromFile(cookiesData: string): { header: string; count: number; names: string[] } {
  const cookies: string[] = []
  const names: string[] = []
  const lines = cookiesData.trim().split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const cookiePart = trimmed.split(';')[0]
    if (cookiePart && cookiePart.includes('=')) {
      cookies.push(cookiePart)
      names.push(cookiePart.split('=')[0].slice(0, MAX_COOKIE_NAME_LENGTH))
    }
  }
  return { header: cookies.join('; '), count: cookies.length, names }
}

async function fetchAccountCredits(cookieHeader: string): Promise<number> {
  try {
    const response = await axios.get('https://prehrajto.cz/provize/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Cookie': cookieHeader
      },
      timeout: TIMEOUT_MEDIUM
    })

    const html = response.data
    const tableMatch = html.match(/<table[^>]*class="table"[^>]*>([\s\S]*?)<\/table>/i)
    if (tableMatch) {
      const tableHtml = tableMatch[1]
      const rowMatch = tableHtml.match(
        /<tr[^>]*>[\s]*<td[^>]*>\s*Aktuální stav vašich bodů\s*<\/td>[\s]*<td[^>]*>\s*(\d+)\s*<\/td>/i
      )
      if (rowMatch) {
        return parseInt(rowMatch[1], 10) || 0
      }
    }
  } catch {
    // Silently fail, credits will show as 0
  }
  return 0
}

ipcMain.handle('accounts:list', async () => {
  const projectRoot = getProjectRoot()
  const accountsPath = path.join(projectRoot, 'DATA')

  try {
    const files = await fs.readdir(accountsPath)
    const cookieFiles = files.filter(f => f.startsWith('login_') && f.endsWith('.dat'))
    const credentialsFiles = files.filter(f => f.startsWith('credentials_') && f.endsWith('.dat'))

    // Build credentials map
    const credentialsMap = new Map<string, { file: string; email: string }>()
    for (const credFile of credentialsFiles) {
      const email = credFile.replace('credentials_', '').replace('.dat', '')
      credentialsMap.set(email, { file: credFile, email })
    }

    // Build accounts from cookie files
    const accounts: Account[] = await Promise.all(cookieFiles.map(async (file, index) => {
      const cookiesPath = path.join(accountsPath, file)
      let cookieHeader = ''

      try {
        const cookiesData = await fs.readFile(cookiesPath, 'utf-8')
        const parsed = parseCookiesFromFile(cookiesData)
        cookieHeader = parsed.header
      } catch {
        // Continue without cookies
      }

      // Fetch credits
      let credits = 0
      if (cookieHeader) {
        credits = await fetchAccountCredits(cookieHeader)
      }

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

    // Add accounts with credentials but no cookies
    for (const credFile of credentialsFiles) {
      const credPath = path.join(accountsPath, credFile)
      const credContent = await fs.readFile(credPath, 'utf-8')
      const emailMatch = credContent.match(/email=([^\n]+)/)
      const emailFromFile = emailMatch ? emailMatch[1].trim() : credFile

      if (!accounts.some(a => a.email === emailFromFile)) {
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
    }

    return accounts
  } catch (error) {
    console.error('[IPC] Error reading accounts:', error)
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
    const { header } = parseCookiesFromFile(cookiesData)

    return header
  } catch (error) {
    console.error(`[IPC] accounts:read-cookies error: ${error}`)
    return null
  }
})

ipcMain.handle('accounts:save-credentials', async (_, accountId: string, credentials: { email: string; password: string }) => {
  const accountsPath = path.join(getProjectRoot(), 'DATA')
  try {
    const files = await fs.readdir(accountsPath)
    const cookieFiles = files.filter(f => f.startsWith('login_') && f.endsWith('.dat'))

    const account = cookieFiles.find((_, index) => `account-${index}` === accountId)
    if (!account) return false

    const credentialsPath = path.join(accountsPath, `credentials_${credentials.email}.dat`)
    const content = `email=${credentials.email}\npassword=${credentials.password}\n`
    await fs.writeFile(credentialsPath, content, 'utf-8')

    return true
  } catch (error) {
    console.error(`[IPC] accounts:save-credentials error: ${error}`)
    return false
  }
})

ipcMain.handle('accounts:get-credentials', async (_, accountId: string) => {
  const accountsPath = path.join(getProjectRoot(), 'DATA')
  try {
    const files = await fs.readdir(accountsPath)
    const credentialFiles = files.filter(f => f.startsWith('credentials_') && f.endsWith('.dat'))

    const credentialFile = credentialFiles.find((_, index) => `account-${index}` === accountId)
    if (!credentialFile) return null

    const credentialsPath = path.join(accountsPath, credentialFile)
    const content = await fs.readFile(credentialsPath, 'utf-8')

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
  } catch (error) {
    console.error(`[IPC] accounts:get-credentials error: ${error}`)
    return null
  }
})

ipcMain.handle('accounts:get-credits', async (_, accountId: string) => {
  const accountsPath = path.join(getProjectRoot(), 'DATA')
  try {
    const files = await fs.readdir(accountsPath)
    const cookieFiles = files.filter(f => f.startsWith('login_') && f.endsWith('.dat'))

    const account = cookieFiles.find((_, index) => `account-${index}` === accountId)
    if (!account) return null

    const cookiesPath = path.join(accountsPath, account)
    const cookiesData = await fs.readFile(cookiesPath, 'utf-8')
    const { header } = parseCookiesFromFile(cookiesData)

    return fetchAccountCredits(header)
  } catch {
    return null
  }
})
