// Session Handler - session:*, auto-login
import { ipcMain } from 'electron'
import path from 'path'
import { Worker } from 'worker_threads'
import * as fs from 'fs/promises'
import { existsSync } from 'fs'
import { getProjectRoot } from '../utils/paths'

// Session worker singleton
let sessionWorker: Worker | null = null

function getSessionWorker(): Worker {
  if (!sessionWorker) {
    const workerPath = path.join(__dirname, '../workers/session.worker.js')
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

ipcMain.handle('session:get-cookies', async (_, accountId: string) => {
  try {
    const result = await sendToSessionWorker({ type: 'get-cookies', accountId })
    if (result && typeof result === 'object' && 'cookies' in result) {
      return result
    }
    return null
  } catch (error) {
    console.error('[IPC] session:get-cookies error:', error)
    return null
  }
})

ipcMain.handle('session:validate', async (_, accountId: string) => {
  try {
    return await sendToSessionWorker({ type: 'validate', accountId })
  } catch (error) {
    console.error('[IPC] session:validate error:', error)
    return { type: 'validation', valid: false, reason: 'error' }
  }
})

ipcMain.handle('session:refresh', async (_, accountId: string) => {
  try {
    return await sendToSessionWorker({ type: 'refresh', accountId })
  } catch (error) {
    console.error('[IPC] session:refresh error:', error)
    return { type: 'refresh-failed', error: String(error) }
  }
})

ipcMain.handle('session:login', async (_, email: string, password: string) => {
  try {
    return await sendToSessionWorker({ type: 'login', email, password })
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

// Auto-login for accounts with credentials but no cookies
ipcMain.handle('accounts:auto-login', async () => {
  const projectRoot = getProjectRoot()
  const accountsPath = path.join(projectRoot, 'DATA')

  try {
    const files = await fs.readdir(accountsPath)
    const credentialsFiles = files.filter(f => f.startsWith('credentials_') && f.endsWith('.dat'))
    const results: { email: string; success: boolean; error?: string }[] = []

    for (const credFile of credentialsFiles) {
      const loginFile = credFile.replace('credentials_', 'login_')
      const loginPath = path.join(accountsPath, loginFile)

      if (existsSync(loginPath)) {
        continue
      }

      const credPath = path.join(accountsPath, credFile)
      const credContent = await fs.readFile(credPath, 'utf-8')
      const emailMatch = credContent.match(/email=([^\n]+)/)
      const passwordMatch = credContent.match(/password=([^\n]+)/)

      if (!emailMatch || !passwordMatch) {
        results.push({ email: credFile, success: false, error: 'Invalid format' })
        continue
      }

      const email = emailMatch[1].trim()
      const password = passwordMatch[1].trim()

      try {
        const result = await sendToSessionWorker({ type: 'login', email, password })
        if (result && typeof result === 'object' && 'cookies' in result) {
          const cookies = (result as { cookies: string }).cookies
          const cookieLines = cookies.split(';').map(c => {
            const parts = c.trim().split('=')
            return parts[0] + '=' + parts.slice(1).join('=')
          })
          await fs.writeFile(loginPath, cookieLines.join('\n'), 'utf-8')
          results.push({ email, success: true })
        } else {
          results.push({ email, success: false, error: 'Login failed' })
        }
      } catch (err) {
        results.push({ email, success: false, error: String(err) })
      }
    }

    return results
  } catch (error) {
    console.error('[IPC] Auto-login error:', error)
    return []
  }
})
