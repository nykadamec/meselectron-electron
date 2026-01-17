/**
 * Download Manager for app updates
 * Handles downloading files with progress reporting
 */

import axios from 'axios'
import * as fs from 'fs'
import * as fsPromises from 'fs/promises'
import * as path from 'path'
import { existsSync } from 'fs'

// Ensure directory exists synchronously
function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

export interface DownloadProgress {
  downloadedBytes: number
  totalBytes: number
  percentage: number
  speedBytesPerSecond: number
  etaSeconds: number
}

export interface DownloadOptions {
  url: string
  destination: string
  onProgress?: (progress: DownloadProgress) => void
  timeout?: number
}

/**
 * Download a file with progress reporting
 */
export async function downloadFile(options: DownloadOptions): Promise<string> {
  const { url, destination, onProgress, timeout = 300000 } = options

  // Ensure destination directory exists
  const destDir = path.dirname(destination)
  ensureDir(destDir)

  console.log(`[UPDATER] Starting download: ${url}`)
  console.log(`[UPDATER] Destination: ${destination}`)

  const response = await axios.get(url, {
    responseType: 'stream',
    timeout,
    headers: {
      'User-Agent': 'Prehrajto-AutoPilot-Updater',
      'Accept': 'application/octet-stream'
    }
  })

  if (response.status !== 200) {
    throw new Error(`Download failed with status ${response.status}`)
  }

  const contentLength = response.headers['content-length']
  const totalBytes = contentLength ? parseInt(contentLength, 10) : 0

  const writer = fs.createWriteStream(destination)

  let downloadedBytes = 0
  let lastTime = Date.now()
  let lastBytes = 0

  return new Promise((resolve, reject) => {
    response.data.on('data', (chunk: Buffer) => {
      downloadedBytes += chunk.length

      if (onProgress && totalBytes > 0) {
        const now = Date.now()
        const timeDiff = (now - lastTime) / 1000

        // Update progress every 100ms or so
        if (timeDiff >= 0.1) {
          const bytesDiff = downloadedBytes - lastBytes
          const speed = bytesDiff / timeDiff
          const eta = speed > 0 ? (totalBytes - downloadedBytes) / speed : -1

          onProgress({
            downloadedBytes,
            totalBytes,
            percentage: (downloadedBytes / totalBytes) * 100,
            speedBytesPerSecond: speed,
            etaSeconds: eta
          })

          lastTime = now
          lastBytes = downloadedBytes
        }
      }
    })

    response.data.pipe(writer)

    writer.on('finish', () => {
      console.log(`[UPDATER] Download complete: ${destination}`)
      resolve(destination)
    })

    writer.on('error', (err: Error) => {
      console.error(`[UPDATER] Write error: ${err.message}`)
      reject(err)
    })

    response.data.on('error', (err: Error) => {
      console.error(`[UPDATER] Download error: ${err.message}`)
      reject(err)
    })
  })
}

/**
 * Download multiple files sequentially
 */
export async function downloadFiles(
  files: Array<{ url: string; destination: string }>,
  onFileProgress?: (fileIndex: number, progress: DownloadProgress) => void
): Promise<string[]> {
  const downloadedPaths: string[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]

    const progressCallback = onFileProgress
      ? (progress: DownloadProgress) => onFileProgress(i, progress)
      : undefined

    const downloadedPath = await downloadFile({
      url: file.url,
      destination: file.destination,
      onProgress: progressCallback
    })

    downloadedPaths.push(downloadedPath)
  }

  return downloadedPaths
}

/**
 * Get human-readable file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`
}

/**
 * Get human-readable speed
 */
export function formatSpeed(bytesPerSecond: number): string {
  return `${formatFileSize(bytesPerSecond)}/s`
}

/**
 * Get human-readable ETA
 */
export function formatEta(seconds: number): string {
  if (seconds < 0 || seconds === Infinity) return 'Unknown'

  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  }

  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
  }

  return `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`
}

/**
 * Check if file exists and is valid size
 */
export async function isDownloadValid(
  filePath: string,
  expectedSize?: number
): Promise<boolean> {
  if (!existsSync(filePath)) {
    return false
  }

  if (expectedSize) {
    const stats = await fsPromises.stat(filePath)
    return stats.size >= expectedSize * 0.95 // Allow 5% tolerance
  }

  return true
}

/**
 * Remove downloaded files (cleanup)
 */
export async function cleanupDownloads(filePaths: string[]): Promise<void> {
  for (const filePath of filePaths) {
    try {
      if (existsSync(filePath)) {
        await fsPromises.unlink(filePath)
        console.log(`[UPDATER] Cleaned up: ${filePath}`)
      }
    } catch (error) {
      console.error(`[UPDATER] Failed to cleanup ${filePath}: ${error}`)
    }
  }
}
