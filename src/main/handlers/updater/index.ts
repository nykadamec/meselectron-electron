/**
 * Updater Handler - Modular IPC handlers for app updates
 */
import { ipcMain } from 'electron'
import * as fs from 'fs/promises'
import { existsSync } from 'fs'
import { app } from 'electron'
import path from 'path'
import {
  getUpdaterState,
  setUpdaterState,
  notifyStateChange,
  getUpdateDir,
  setDownloadCancellation,
  getDownloadCancellation,
  resetToIdle,
  clearReleaseInfo,
  ReleaseInfo
} from './state'
import { getAppVersion } from '../../utils/version'
import { checkForUpdate } from '../../github-releases'
import { verifyDownload } from '../../verification'
import { downloadFile } from '../../download-manager'

/**
 * Check for updates
 */
ipcMain.handle('updater:get-current-version', async () => {
  return await getAppVersion()
})

ipcMain.handle('updater:check', async () => {
  try {
    setUpdaterState({ status: 'checking', error: null })

    const currentVersion = await getAppVersion()
    setUpdaterState({ currentVersion })

    const result = await checkForUpdate(currentVersion)

    if (result.updateAvailable && result.release && result.asset) {
      const releaseInfo: ReleaseInfo = {
        version: result.latestVersion!,
        name: result.release.name,
        publishedAt: result.release.published_at,
        body: result.release.body,
        downloadUrl: result.asset.browser_download_url,
        fileSize: result.asset.size
      }

      setUpdaterState({
        status: 'idle',
        latestVersion: result.latestVersion,
        releaseInfo
      })

      return {
        updateAvailable: true,
        currentVersion,
        latestVersion: result.latestVersion,
        release: releaseInfo
      }
    }

    setUpdaterState({
      status: 'idle',
      latestVersion: currentVersion
    })

    return { updateAvailable: false, currentVersion, latestVersion: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    setUpdaterState({ status: 'error', error: message })
    return { updateAvailable: false, error: message }
  }
})

/**
 * Download update
 */
ipcMain.handle('updater:download', async () => {
  try {
    const state = getUpdaterState()

    if (!state.releaseInfo) {
      throw new Error('No update available')
    }

    if (state.status === 'downloading') {
      return { success: false, error: 'Download already in progress' }
    }

    setUpdaterState({
      status: 'downloading',
      downloadProgress: 0,
      downloadedBytes: 0,
      totalBytes: state.releaseInfo.fileSize,
      speed: 0,
      eta: 0,
      error: null
    })

    const updateDir = getUpdateDir()
    const fileName = path.basename(state.releaseInfo.downloadUrl)
    const destination = path.join(updateDir, fileName)

    await fs.mkdir(updateDir, { recursive: true })

    await downloadFile({
      url: state.releaseInfo.downloadUrl,
      destination,
      onProgress: (progress) => {
        setUpdaterState({
          downloadProgress: progress.percentage,
          downloadedBytes: progress.downloadedBytes,
          speed: progress.speedBytesPerSecond,
          eta: progress.etaSeconds
        })
      }
    })

    // Verify download
    setUpdaterState({ status: 'verifying' })

    const checksumsUrl = state.releaseInfo.downloadUrl.replace(/\.(dmg|exe|zip)$/i, '-checksums.txt')
    const checksumsDestination = path.join(updateDir, 'checksums.txt')

    try {
      await downloadFile({
        url: checksumsUrl,
        destination: checksumsDestination,
        onProgress: (progress) => {
          setUpdaterState({ downloadProgress: progress.percentage })
        }
      })

      const verifyResult = await verifyDownload(destination, checksumsDestination)
      if (!verifyResult.valid) {
        throw new Error(`Verification failed: ${verifyResult.error}`)
      }
    } catch (verifyError) {
      console.warn(`[UPDATER] Checksum verification failed (may be optional): ${verifyError}`)
    }

    setUpdaterState({
      status: 'ready',
      downloadProgress: 100
    })

    return { success: true, filePath: destination, fileSize: state.totalBytes }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    setUpdaterState({ status: 'error', error: message })
    return { success: false, error: message }
  }
})

/**
 * Get current progress
 */
ipcMain.handle('updater:get-progress', () => {
  const state = getUpdaterState()
  return {
    status: state.status,
    progress: state.downloadProgress,
    downloadedBytes: state.downloadedBytes,
    totalBytes: state.totalBytes,
    speed: state.speed,
    eta: state.eta,
    error: state.error
  }
})

/**
 * Install update on macOS
 */
ipcMain.handle('updater:install-macos', async () => {
  try {
    const state = getUpdaterState()

    if (state.status !== 'ready') {
      throw new Error('No downloaded update ready')
    }

    setUpdaterState({ status: 'installing' })

    const { spawn } = await import('child_process')
    const updateDir = getUpdateDir()
    const files = await fs.readdir(updateDir)
    const dmgFile = files.find(f => f.endsWith('.dmg'))

    if (!dmgFile) {
      throw new Error('No DMG file found')
    }

    const dmgPath = path.join(updateDir, dmgFile)

    // Mount DMG
    const mountResult = await new Promise<{ mountPoint: string }>((resolve, reject) => {
      const proc = spawn('hdiutil', ['attach', '-plist', '-nobrowse', dmgPath])
      let output = ''
      proc.stdout.on('data', (data) => { output += data.toString() })
      proc.on('close', (code) => {
        if (code === 0) {
          const mountMatch = output.match(/<string>\/Volumes\/([^<]+)<\/string>/)
          if (mountMatch) {
            resolve({ mountPoint: `/Volumes/${mountMatch[1]}` })
          } else {
            reject(new Error('Failed to find mount point'))
          }
        } else {
          reject(new Error(`hdiutil failed with code ${code}`))
        }
      })
    })

    const appSource = path.join(mountResult.mountPoint, 'Prehraj.to AutoPilot.app')
    const appsFolder = '/Applications'
    const appDest = path.join(appsFolder, 'Prehraj.to AutoPilot.app')
    const backupDest = path.join(appsFolder, 'Prehraj.to AutoPilot.app.backup')

    try {
      await fs.rm(backupDest, { recursive: true, force: true })
    } catch { /* ignore */ }

    try {
      await fs.rename(appDest, backupDest)
    } catch (err) {
      console.warn(`[UPDATER] Could not backup current app: ${err}`)
    }

    await fs.cp(appSource, appDest, { recursive: true })

    // Unmount DMG
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('hdiutil', ['detach', mountResult.mountPoint])
      proc.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`hdiutil detach failed with code ${code}`))
      })
    })

    try {
      await fs.rm(backupDest, { recursive: true, force: true })
    } catch { /* ignore */ }

    app.relaunch({ args: process.argv.slice(1).concat(['--updated']) })
    app.exit(0)

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    setUpdaterState({ status: 'error', error: message })
    return { success: false, error: message }
  }
})

/**
 * Cancel download
 */
ipcMain.handle('updater:cancel', async () => {
  const cancel = getDownloadCancellation()
  if (cancel) {
    cancel()
    setDownloadCancellation(null)
  }
  resetToIdle()
  return { success: true }
})

/**
 * Clear update files
 */
ipcMain.handle('updater:clear', async () => {
  try {
    const updateDir = getUpdateDir()
    await fs.rm(updateDir, { recursive: true, force: true })
    resetToIdle()
    clearReleaseInfo()
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

/**
 * Verify update file
 */
ipcMain.handle('updater:verify', async () => {
  try {
    const updateDir = getUpdateDir()
    const updatePath = path.join(updateDir, 'update.zip')

    if (!existsSync(updatePath)) {
      return { valid: false, error: 'Update file not found' }
    }

    const fileBuffer = await fs.readFile(updatePath)
    const crypto = await import('crypto')
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex')

    const stats = await fs.stat(updatePath)
    const isValid = stats.size > 0

    return {
      valid: isValid,
      size: stats.size,
      hash,
      error: isValid ? null : 'File is empty or corrupted'
    }
  } catch (error) {
    return { valid: false, error: String(error) }
  }
})
