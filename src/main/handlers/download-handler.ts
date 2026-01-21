// Download Handler - download:start, download:stop, download:extract-metadata
import { ipcMain, BrowserWindow } from 'electron'
import path from 'path'
import { existsSync, readFileSync } from 'fs'
import axios from 'axios'
import { Worker } from 'worker_threads'
import { getProjectRoot, getUserDataPath } from '../utils/paths'
import { TIMEOUT_MEDIUM, MAX_FILENAME_LENGTH } from '../constants'

// Global active download worker
let activeDownloadWorker: Worker | null = null

// Helper: Generate sanitized filename from video title
function generateFileName(videoTitle?: string): string {
  if (videoTitle) {
    // Remove size prefix pattern like "[5.09 GB] - "
    const sizePrefixPattern = /^\[\s*[\d.,]+\s*(GB|MB)\s*\]\s*-\s*/i
    const normalized = videoTitle.replace(/_/g, ' ')
    const cleanTitle = normalized.replace(sizePrefixPattern, '')
    const sanitized = cleanTitle
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
      .replace(/\s+/g, '_')
      .trim()
      .slice(0, MAX_FILENAME_LENGTH)
    if (sanitized.length > 0) {
      return `${sanitized}.mp4`
    }
  }
  return `video_${Date.now()}.mp4`
}

// Helper: Find ffmpeg path
function findFfmpegPath(): string | null {
  try {
    const projectRoot = getProjectRoot()
    const ffmpeg = path.join(projectRoot, 'node_modules', '@ffmpeg-installer', 'ffmpeg', 'dist', 'ffmpeg')
    return existsSync(ffmpeg) ? ffmpeg : null
  } catch {
    return null
  }
}

// Helper: Extract video metadata
async function extractVideoMetadata(url: string, cookies: string, hqProcessing?: boolean) {
  const fetchUrl = hqProcessing !== false
    ? (url.includes('?') ? `${url}&do=download` : `${url}?do=download`)
    : url

  console.log('[Download-Handler] extractVideoMetadata START')
  console.log('[Download-Handler] url:', url)
  console.log('[Download-Handler] fetchUrl:', fetchUrl)
  console.log('[Download-Handler] hqProcessing:', hqProcessing)
  console.log('[Download-Handler] cookies length:', cookies?.length)

  const response = await axios.get(fetchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Cookie': cookies || ''
    },
    timeout: TIMEOUT_MEDIUM
  })

  console.log('[Download-Handler] response status:', response.status)
  console.log('[Download-Handler] response headers:', JSON.stringify(response.headers, null, 2))

  const html = response.data
  console.log('[Download-Handler] html length:', html.length)

  // Log sample of HTML to debug
  const htmlSample = html.substring(0, 3000)
  console.log('[Download-Handler] html sample:', htmlSample)

  // Search for any .mp4 URLs in the HTML
  const mp4Matches = html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/gi) || []
  console.log('[Download-Handler] mp4 URLs found in HTML:', mp4Matches.length)
  if (mp4Matches.length > 0) {
    console.log('[Download-Handler] sample mp4 URLs:', mp4Matches.slice(0, 5))
  }

  // Search for any data-src, data-url, data-video patterns
  const dataSrcMatches = html.match(/data-(src|url|video)="([^"]+)"/gi) || []
  console.log('[Download-Handler] data-* patterns found:', dataSrcMatches.length)
  if (dataSrcMatches.length > 0) {
    console.log('[Download-Handler] sample data-* patterns:', dataSrcMatches.slice(0, 5))
  }

  // Search for any source elements
  const sourceMatches = html.match(/<source[^>]*>/gi) || []
  console.log('[Download-Handler] <source> elements found:', sourceMatches.length)

  // Search for any video elements
  const videoMatches = html.match(/<video[^>]*>/gi) || []
  console.log('[Download-Handler] <video> elements found:', videoMatches.length)

  let mp4Url: string | null = null

  // Always try HQ pattern first (regardless of hqProcessing flag)
  const contentUrlMatch = html.match(/<meta\s+itemprop="contentUrl"\s+content="([^"]+)"/)
  console.log('[Download-Handler] contentUrlMatch:', contentUrlMatch)
  if (contentUrlMatch) {
    // Decode HTML entities first (&amp; -> &), then URL decode
    const decodedHtml = contentUrlMatch[1].replace(/&amp;/g, '&')
    mp4Url = decodeURIComponent(decodedHtml)
    console.log('[Download-Handler] found mp4Url (HQ meta):', mp4Url)
  }

  // Try alternative patterns if HQ mode fails
  if (!mp4Url) {
    console.log('[Download-Handler] Trying alternative patterns...')

    // First, try direct .mp4 URLs (these are most reliable)
    const directMp4Match = html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i)
    if (directMp4Match) {
      mp4Url = directMp4Match[1]  // Keep URL encoded (CDN signature depends on it)
      console.log('[Download-Handler] found mp4Url (direct mp4):', mp4Url)
    }

    // If no direct mp4 found, try data-* patterns (filtering out thumbnails)
    if (!mp4Url) {
      console.log('[Download-Handler] No direct mp4, trying filtered data-* patterns...')
      const dataSrcPattern = /data-src="([^"]+)"/g
      let match
      while ((match = dataSrcPattern.exec(html)) !== null) {
        const urlCandidate = match[1]
        // Skip thumbnails and images
        if (urlCandidate.includes('thumb.prehrajto.cz') ||
            urlCandidate.includes('.jpg') ||
            urlCandidate.includes('.webp') ||
            urlCandidate.includes('.png')) {
          continue
        }
        // Found a non-thumbnail URL
        mp4Url = urlCandidate
        console.log('[Download-Handler] found mp4Url (filtered data-src):', mp4Url)
        break
      }
    }

    // Try remaining patterns
    if (!mp4Url) {
      const altPatterns = [
        /data-url="([^"]+)"/,
        /video[^>]*src="([^"]+)"/i,
        /source[^>]*src="([^"]+)"[^>]*>/i,
        // JavaScript patterns - video players often embed URLs in JS
        /videoUrl\s*[=:]\s*["']([^"']+)["']/i,
        /file\s*[=:]\s*["']([^"']+\.mp4[^"']*)["']/i,
        /"url"\s*:\s*["']([^"']+\.mp4[^"']*)["']/i,
        /data-video="([^"]*)"/,
        // Player configuration
        /player\.src\([^)]*["']([^"']+)["']/i,
        /src:\s*["']([^"']+\.mp4[^"']*)["']/i
      ]
      for (const pattern of altPatterns) {
        const match = html.match(pattern)
        if (match) {
          mp4Url = match[1]  // Keep URL encoded (CDN signature depends on it)
          console.log('[Download-Handler] found mp4Url (pattern):', mp4Url)
          break
        }
      }
    }
  }

  if (!mp4Url) {
    console.error('[Download-Handler] FAILED to find mp4Url')
    // Debug: save HTML to file for analysis
    const debugPath = '/tmp/prehrajto-debug.html'
    try {
      const fs = await import('fs')
      fs.writeFileSync(debugPath, html)
      console.log('[Download-Handler] Saved HTML to', debugPath, 'for analysis')
    } catch (e) {
      console.error('[Download-Handler] Failed to save debug HTML:', e)
    }
    throw new Error('Nepodařilo se najít video URL na stránce')
  }

  // GET request for file size (HEAD with Range doesn't work well with CDN)
  console.log('[Download-Handler] doing GET Range request to:', mp4Url)
  const sizeResponse = await axios.get(mp4Url, {
    headers: {
      'Range': 'bytes=0-0',  // Request just 1 byte to get content-length
      'Cookie': cookies || ''
    },
    timeout: TIMEOUT_MEDIUM,
    maxRedirects: 5
  })

  // Content-Range header format: "bytes 0-0/TOTAL" or use content-length from partial response
  const contentRange = sizeResponse.headers['content-range']
  let fileSize = 0

  if (contentRange) {
    // Parse "bytes 0-0/1234567"
    const match = contentRange.match(/\/(\d+)$/)
    if (match) {
      fileSize = parseInt(match[1], 10)
    }
  } else {
    // Fallback to content-length
    const contentLength = sizeResponse.headers['content-length']
    fileSize = contentLength ? parseInt(contentLength, 10) : 0
  }

  console.log('[Download-Handler] fileSize:', fileSize, 'bytes')
  console.log('[Download-Handler] content-range:', sizeResponse.headers['content-range'])

  if (fileSize === 0) {
    throw new Error('Nepodařilo se zjistit velikost souboru')
  }

  console.log('[Download-Handler] extractVideoMetadata SUCCESS')
  return { mp4Url, fileSize }
}

ipcMain.handle('download:start', async (_, options) => {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, '../workers/download.worker.js')
    const outputPath = options.outputPath || path.join(getProjectRoot(), 'VIDEOS', generateFileName(options.videoTitle))
    const ffmpegPath = options.ffmpegPath || findFfmpegPath()

    // Read settings for download mode
    const settingsPath = path.join(getUserDataPath(), 'prehrajto-autopilot', 'settings.json')
    let downloadMode = 'ffmpeg-chunks'
    let hqProcessing = true
    try {
      const settingsData = readFileSync(settingsPath, 'utf-8')
      const settings = JSON.parse(settingsData)
      downloadMode = settings.downloadMode || 'ffmpeg-chunks'
      hqProcessing = settings.hqProcessing !== false
    } catch {
      // Use defaults
    }

    const worker = new Worker(workerPath, {
      workerData: {
        type: 'download',
        payload: {
          ...options,
          outputPath,
          ffmpegPath,
          downloadMode,
          hqProcessing: options.hqProcessing ?? hqProcessing
        }
      }
    })

    activeDownloadWorker = worker

    worker.on('message', (update) => {
      if (update.type === 'ipc:call') {
        const { channel, args, callbackId } = update

        if (channel === 'download:extract-metadata') {
          extractVideoMetadata(args.url, args.cookies, args.hqProcessing)
            .then(res => worker.postMessage({ type: 'ipc:result', callbackId, result: res }))
            .catch(err => worker.postMessage({ type: 'ipc:result', callbackId, error: err.message }))
          return
        }
        return
      }

      // Forward progress to renderer
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('download:progress', update)
      })
    })

    worker.on('error', reject)
    worker.on('exit', (code) => {
      if (activeDownloadWorker === worker) {
        activeDownloadWorker = null
      }
      if (code === 0) resolve({ success: true })
      else reject(new Error(`Worker exited with code ${code}`))
    })
  })
})

ipcMain.handle('download:extract-metadata', async (_, { url, cookies, hqProcessing }) => {
  try {
    return await extractVideoMetadata(url, cookies, hqProcessing)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Chyba při extrakci metadat: ${message}`)
  }
})

ipcMain.on('download:stop', () => {
  if (activeDownloadWorker) {
    activeDownloadWorker.postMessage('terminate')
    setTimeout(() => {
      if (activeDownloadWorker) {
        activeDownloadWorker!.terminate()
        activeDownloadWorker = null
      }
    }, 1000)
  }
})

ipcMain.handle('ffmpeg:get-path', async () => {
  return findFfmpegPath()
})
