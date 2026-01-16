// Download worker - handles video downloads from prehrajto.cz with progress reporting
import { parentPort, workerData } from 'worker_threads'
import { spawn } from 'child_process'
import axios from 'axios'
import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'

// Helper to safely post messages (parentPort is always available in worker threads)
function sendProgress(data: unknown) {
  if (parentPort) {
    parentPort.postMessage(data)
  }
}

// Constants matching Python implementation
const CHUNK_SIZE = 2 * 1024 * 1024 // 2MB chunks
const MIN_VIDEO_SIZE_MB = 300
const MAX_VIDEO_SIZE_MB = 20480 // 20GB

/**
 * Parse Set-Cookie format to cookie header string
 * Format: name=value; Domain=...; Path=...; Secure; HttpOnly
 */
function parseCookieFile(content) {
  const cookies = []
  const lines = content.trim().split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    // Set-Cookie format: first part before semicolon is name=value
    const cookiePart = trimmed.split(';')[0]
    if (cookiePart && cookiePart.includes('=')) {
      cookies.push(cookiePart)
    }
  }

  return cookies.join('; ')
}

/**
 * Call IPC handler from worker (returns a promise)
 */
function callIpcHandler<T>(channel: string, args: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const callbackId = Math.random().toString(36).substring(7)
    console.log('[Download] [IPC-CALL] channel:', channel, '| callbackId:', callbackId)

    // Store callback
    const timeout = setTimeout(() => {
      console.log('[Download] [IPC-CALL] TIMEOUT for callbackId:', callbackId)
      reject(new Error('IPC timeout after 30s'))
    }, 30000)

    // Listen for result
    const handler = (message: unknown) => {
      const msg = message as { type: string; callbackId: string; result?: T; error?: string }
      if (msg.type === 'ipc:result' && msg.callbackId === callbackId) {
        console.log('[Download] [IPC-RESULT] callbackId:', callbackId, '| hasError:', !!msg.error)
        clearTimeout(timeout)
        parentPort?.off('message', handler)
        if (msg.error) {
          console.log('[Download] [IPC-RESULT] Error:', msg.error)
          reject(new Error(msg.error))
        } else {
          console.log('[Download] [IPC-RESULT] Success, result:', JSON.stringify(msg.result).substring(0, 100))
          resolve(msg.result as T)
        }
      }
    }

    parentPort?.on('message', handler)
    console.log('[Download] [IPC-SEND] Sending to main process:', { type: 'ipc:call', channel, callbackId })
    parentPort?.postMessage({ type: 'ipc:call', channel, args, callbackId })
  })
}

/**
 * Extract video metadata from prehrajto.cz page (via IPC to main process)
 * Simply appends ?do=download to the URL and gets file size
 */
async function extractVideoMetadata(url, cookies) {
  const videoId = workerData.payload.videoId
  sendProgress({ type: 'status', status: 'extracting', videoId })

  try {
    console.log('[Download] [', videoId.substring(0, 8), '] Extracting metadata via IPC...')

    // Call IPC handler in main process - it appends ?do=download and gets file size
    const result = await callIpcHandler<{ mp4Url: string; fileSize: number }>('download:extract-metadata', { url, cookies })

    const { mp4Url, fileSize } = result
    const fileSizeMB = fileSize / (1024 * 1024)

    console.log('[Download] [', videoId.substring(0, 8), '] Download URL:', mp4Url)
    console.log('[Download] [', videoId.substring(0, 8), '] File size:', fileSize > 0 ? fileSizeMB.toFixed(1) + ' MB' : 'unknown')

    if (fileSize > 0) {
      if (fileSizeMB < MIN_VIDEO_SIZE_MB) {
        throw new Error(`Video je příliš malé (${fileSizeMB.toFixed(1)}MB, minimum je ${MIN_VIDEO_SIZE_MB}MB)`)
      }
      if (fileSizeMB > MAX_VIDEO_SIZE_MB) {
        throw new Error(`Video je příliš velké (${fileSizeMB.toFixed(1)}MB, maximum je ${MAX_VIDEO_SIZE_MB}MB)`)
      }
    }

    console.log('[Download] [', videoId.substring(0, 8), '] Metadata extraction successful')

    // Return with URL as title (extracted from URL path)
    const urlParts = url.split('/')
    const title = urlParts[urlParts.length - 2] || 'video'

    return { mp4Url, fileSize, title, thumbnail: undefined }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.log('[Download] [', videoId.substring(0, 8), '] Extraction failed:', errorMessage)
    throw new Error(`Chyba při extrakci metadat: ${errorMessage}`)
  }
}

/**
 * Download video using parallel connections
 */
async function downloadVideo(metadata: { mp4Url: string; fileSize: number; title?: string }, outputPath: string, cookies: string) {
  const { mp4Url, fileSize } = metadata
  const startTime = Date.now()
  let downloadedBytes = 0

  // Create output directory
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // Create file handle for streaming
  const fileHandle = await fsp.open(outputPath, 'w')

  sendProgress({ type: 'status', status: 'downloading', videoId: workerData.payload.videoId })

  // Handle case when fileSize is unknown (0)
  if (fileSize === 0 || fileSize === undefined) {
    console.log('[Download] [', workerData.payload.videoId.substring(0, 8), '] File size unknown, streaming download without chunks')
    return downloadStreaming(mp4Url, outputPath, cookies)
  }

  // Check download mode
  const downloadMode = workerData.payload.downloadMode || 'ffmpeg-chunks'
  console.log('[Download] [', workerData.payload.videoId.substring(0, 8), '] Download mode:', downloadMode)

  // Use curl or wget if selected
  if (downloadMode === 'curl') {
    await fileHandle.close()
    return downloadWithCurl(mp4Url, outputPath, cookies, fileSize)
  }
  if (downloadMode === 'wget') {
    await fileHandle.close()
    return downloadWithWget(mp4Url, outputPath, cookies, fileSize)
  }

  // Calculate number of chunks
  const safeFileSize = Math.floor(fileSize) // Ensure integer
  const numChunks = Math.max(1, Math.ceil(safeFileSize / CHUNK_SIZE))

  console.log('[Download] [', workerData.payload.videoId.substring(0, 8), '] File size:', safeFileSize, 'bytes, chunks:', numChunks)

  // Create chunks array with ranges
  const chunks: Array<{ id: number; start: number; end: number }> = []
  for (let i = 0; i < numChunks; i++) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE - 1, safeFileSize - 1)
    chunks.push({ id: i, start, end })
  }

  // Download chunks with controlled concurrency (matching Python CONCURRENCY_LIMIT)
  const CONCURRENCY_LIMIT = workerData.payload.maxConcurrent || 2

  async function downloadWithSemaphore(chunks: Array<{ id: number; start: number; end: number }>) {
    const semaphore = new Semaphore(CONCURRENCY_LIMIT)
    const chunkData = new Map<number, { data: Buffer; start: number }>()

    const downloadChunkWithRetry = async (chunk: { id: number; start: number; end: number }, retries: number = 2): Promise<Buffer | null> => {
      let serverSupportsRange = true

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          // Adjust end byte if this is a retry (might be beyond file size)
          let adjustedEnd = chunk.end
          if (attempt > 0) {
            adjustedEnd = Math.min(chunk.end, safeFileSize - 1)
            console.log('[Download] [', workerData.payload.videoId.substring(0, 8), '] Retry chunk', chunk.id, 'attempt', attempt, 'start:', chunk.start, 'end:', adjustedEnd, '(fileSize:', safeFileSize, ')')
          }

          const response = await axios.get(mp4Url, {
            headers: {
              'Range': `bytes=${chunk.start}-${adjustedEnd}`,
              'Cookie': cookies || '',
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            },
            responseType: 'arraybuffer',
            timeout: 120000
          })

          const contentRange = response.headers['content-range']
          console.log('[Download] [', workerData.payload.videoId.substring(0, 8), '] Chunk', chunk.id, 'downloaded, content-range:', contentRange)

          return Buffer.from(response.data)
        } catch (err: any) {
          const is416 = err.response?.status === 416
          console.log('[Download] [', workerData.payload.videoId.substring(0, 8), '] Chunk', chunk.id, 'attempt', attempt + 1, 'error:', is416 ? '416 Range Not Satisfiable' : err.message)

          if (is416) {
            // Server doesn't support Range requests - fail immediately and use streaming fallback
            serverSupportsRange = false
            break
          }

          if (attempt >= retries) {
            throw err
          }
        }
      }

      // Server doesn't support Range requests - throw special error for streaming fallback
      if (!serverSupportsRange) {
        throw new Error('RANGE_NOT_SUPPORTED')
      }
      return null
    }

    const promises = chunks.map((chunk) =>
      semaphore.acquire().then(async () => {
        try {
          const data = await downloadChunkWithRetry(chunk)
          if (data) {
            chunkData.set(chunk.id, { data, start: chunk.start })

            downloadedBytes += data.length

            // Calculate speed and ETA
            const elapsed = (Date.now() - startTime) / 1000
            const speed = elapsed > 0 ? downloadedBytes / elapsed : 0
            const remainingBytes = safeFileSize - downloadedBytes
            const eta = speed > 0 ? remainingBytes / speed : -1

            sendProgress({
              type: 'progress',
              progress: (downloadedBytes / safeFileSize) * 100,
              speed: speed,
              eta: eta,
              downloaded: downloadedBytes,
              total: safeFileSize,
              size: safeFileSize,
              videoId: workerData.payload.videoId
            })
          }
        } finally {
          semaphore.release()
        }
      })
    )

    await Promise.all(promises)
    return chunkData
  }

  try {
    const chunkData = await downloadWithSemaphore(chunks)

    // Write chunks to file in order (this is the only time data is in memory)
    sendProgress({ type: 'status', status: 'assembling', videoId: workerData.payload.videoId })

    for (let i = 0; i < numChunks; i++) {
      if (chunkData.has(i)) {
        const chunk = chunkData.get(i)!
        await fileHandle.write(chunk.data, 0, chunk.data.length, chunk.start)
      } else {
        throw new Error(`Chybí chunk ${i}`)
      }
    }

    await fileHandle.close()
    return fileSize
  } catch (err) {
    // Close file handle before fallback
    await fileHandle.close().catch(() => {})

    // Check if Range requests are not supported
    const errorMsg = err instanceof Error ? err.message : String(err)
    if (errorMsg === 'RANGE_NOT_SUPPORTED') {
      console.log('[Download] [', workerData.payload.videoId.substring(0, 8), '] Server nepodporuje stahování po částech, přepínám na streaming...')
      sendProgress({ type: 'status', status: 'downloading', videoId: workerData.payload.videoId })
      // Fallback to streaming download
      return downloadStreaming(mp4Url, outputPath, cookies)
    }
    throw err
  }
}

/**
 * Stream download without knowing file size (fallback when size extraction fails)
 */
async function downloadStreaming(mp4Url: string, outputPath: string, cookies: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    let downloadedBytes = 0
    const writeStream = fs.createWriteStream(outputPath)

    console.log('[Download] [', workerData.payload.videoId.substring(0, 8), '] Streaming download from:', mp4Url)

    axios.get(mp4Url, {
      headers: {
        'Cookie': cookies || '',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      responseType: 'stream',
      timeout: 600000 // 10 minutes timeout for streaming
    }).then(response => {
      const totalBytes = parseInt(response.headers['content-length'] || '0', 10)
      console.log('[Download] [', workerData.payload.videoId.substring(0, 8), '] Total size from header:', totalBytes > 0 ? (totalBytes / 1024 / 1024).toFixed(1) + ' MB' : 'unknown')

      response.data.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length

        // Calculate speed and ETA
        const elapsed = (Date.now() - startTime) / 1000
        const speed = elapsed > 0 ? downloadedBytes / elapsed : 0

        sendProgress({
          type: 'progress',
          progress: totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0,
          speed: speed,
          eta: -1, // Unknown ETA when total size is unknown
          downloaded: downloadedBytes,
          total: totalBytes || downloadedBytes,
          size: totalBytes || downloadedBytes,
          videoId: workerData.payload.videoId
        })
      })

      response.data.pipe(writeStream)

      writeStream.on('finish', () => {
        console.log('[Download] [', workerData.payload.videoId.substring(0, 8), '] Streaming complete:', downloadedBytes, 'bytes')
        resolve(downloadedBytes)
      })

      writeStream.on('error', (err: Error) => {
        console.log('[Download] [', workerData.payload.videoId.substring(0, 8), '] Write error:', err.message)
        reject(err)
      })

      response.data.on('error', (err: Error) => {
        console.log('[Download] [', workerData.payload.videoId.substring(0, 8), '] Download error:', err.message)
        reject(err)
      })
    }).catch((err: Error) => {
      console.log('[Download] [', workerData.payload.videoId.substring(0, 8), '] Request error:', err.message)
      reject(err)
    })
  })
}

/**
 * Download video using curl
 */
async function downloadWithCurl(mp4Url: string, outputPath: string, cookies: string, fileSize: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    let downloadedBytes = 0

    console.log('[Download] [', workerData.payload.videoId.substring(0, 8), '] Downloading with curl:', mp4Url)

    // Build curl command with progress bar on stderr
    const curlArgs = [
      '-L',           // Follow redirects
      '-o', outputPath,
      '-C', '-',      // Continue partial downloads
      '--progress-bar',
      '--cookie', cookies || '',
      '--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      mp4Url
    ]

    const curl = spawn('curl', curlArgs)

    curl.stderr.on('data', (data: Buffer) => {
      const line = data.toString()

      // Parse curl progress bar output
      // Format: "#  10.5%   0:00:15   0:00:25   5.25M/s"
      const percentMatch = line.match(/(\d+\.?\d*)%/)
      if (percentMatch) {
        downloadedBytes = (parseFloat(percentMatch[1]) / 100) * fileSize

        const elapsed = (Date.now() - startTime) / 1000
        const speed = elapsed > 0 ? downloadedBytes / elapsed : 0
        const remainingBytes = fileSize - downloadedBytes
        const eta = speed > 0 ? remainingBytes / speed : -1

        sendProgress({
          type: 'progress',
          progress: (downloadedBytes / fileSize) * 100,
          speed: speed,
          eta: eta,
          downloaded: downloadedBytes,
          total: fileSize,
          size: fileSize,
          videoId: workerData.payload.videoId
        })
      }
    })

    curl.on('close', (code: number) => {
      if (code === 0) {
        console.log('[Download] [', workerData.payload.videoId.substring(0, 8), '] curl complete:', downloadedBytes, 'bytes')
        resolve(downloadedBytes)
      } else {
        reject(new Error(`curl exited with code ${code}`))
      }
    })

    curl.on('error', (err: Error) => {
      console.log('[Download] [', workerData.payload.videoId.substring(0, 8), '] curl error:', err.message)
      reject(err)
    })
  })
}

/**
 * Download video using wget
 */
async function downloadWithWget(mp4Url: string, outputPath: string, cookies: string, fileSize: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    let downloadedBytes = 0

    console.log('[Download] [', workerData.payload.videoId.substring(0, 8), '] Downloading with wget:', mp4Url)

    // Build wget command
    const wgetArgs = [
      '-O', outputPath,
      '--progress=dot:mega',
      '--cookie', cookies || '',
      '--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      mp4Url
    ]

    const wget = spawn('wget', wgetArgs)

    wget.stderr.on('data', (data: Buffer) => {
      const line = data.toString()

      // Parse wget progress output
      // Format: " 0K .......... .......... .......... .......... ..........  5%  5.2M/s 0:00:15 ETA"
      const percentMatch = line.match(/(\d+)%\s/)
      if (percentMatch) {
        const percent = parseInt(percentMatch[1], 10)
        downloadedBytes = (percent / 100) * fileSize

        const elapsed = (Date.now() - startTime) / 1000
        const speed = elapsed > 0 ? downloadedBytes / elapsed : 0
        const remainingBytes = fileSize - downloadedBytes
        const eta = speed > 0 ? remainingBytes / speed : -1

        sendProgress({
          type: 'progress',
          progress: (downloadedBytes / fileSize) * 100,
          speed: speed,
          eta: eta,
          downloaded: downloadedBytes,
          total: fileSize,
          size: fileSize,
          videoId: workerData.payload.videoId
        })
      }
    })

    wget.on('close', (code: number) => {
      if (code === 0) {
        console.log('[Download] [', workerData.payload.videoId.substring(0, 8), '] wget complete:', downloadedBytes, 'bytes')
        resolve(downloadedBytes)
      } else {
        reject(new Error(`wget exited with code ${code}`))
      }
    })

    wget.on('error', (err: Error) => {
      console.log('[Download] [', workerData.payload.videoId.substring(0, 8), '] wget error:', err.message)
      reject(err)
    })
  })
}

/**
 * Add watermark using FFmpeg
 */
async function addWatermark(inputPath, outputPath, ffmpegPath) {
  sendProgress({ type: 'status', status: 'watermarking', videoId: workerData.payload.videoId })

  return new Promise((resolve, reject) => {
    const ffmpeg = require('fluent-ffmpeg')

    if (ffmpegPath) {
      ffmpeg.setFfmpegPath(ffmpegPath)
    }

    ffmpeg(inputPath)
      .videoFilters([
        // Draw watermark text in bottom-right corner
        `drawtext=text='prehrajto.cz':fontsize=24:fontcolor=white@0.8:x=10:y=h-th-10`,
        // Add subtle shadow for better visibility
        `shadowcolor=black@0.5:shadowx=2:shadowy=2`
      ])
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log('FFmpeg command:', commandLine)
      })
      .on('progress', (progress) => {
        sendProgress({
          type: 'progress',
          progress: progress.percent || 0,
          speed: 0,
          phase: 'watermarking',
          videoId: workerData.payload.videoId
        })
      })
      .on('end', () => {
        // Clean up temporary file
        try {
          fs.unlinkSync(inputPath)
        } catch (e) {
          console.warn('Could not remove temp file:', (e as Error).message)
        }
        resolve(undefined)
      })
      .on('error', (err) => {
        reject(new Error(`FFmpeg error: ${err.message}`))
      })
      .run()
  })
}

/**
 * Semaphore implementation for concurrency control
 */
class Semaphore {
  maxConcurrency: number
  currentCount: number
  waitQueue: (() => void)[]

  constructor(maxConcurrency: number) {
    this.maxConcurrency = maxConcurrency
    this.currentCount = 0
    this.waitQueue = []
  }

  async acquire() {
    if (this.currentCount < this.maxConcurrency) {
      this.currentCount++
      return
    }

    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve)
    })
  }

  release() {
    this.currentCount--
    if (this.waitQueue.length > 0) {
      this.currentCount++
      const next = this.waitQueue.shift()
      if (next) next()
    }
  }
}

/**
 * Main download function
 */
async function downloadVideoHandler(options) {
  const { url, outputPath, cookies: rawCookies, videoId, addWatermark: shouldWatermark } = options

  // Parse cookies from Set-Cookie format to Cookie header format
  const cookies = parseCookieFile(rawCookies || '')

  try {
    // Send initial status
    sendProgress({ type: 'status', status: 'starting', videoId })

    // Check if file already exists before downloading
    if (fs.existsSync(outputPath)) {
      console.log(`[Download] [${videoId.substring(0, 8)}] File already exists: ${outputPath}`)
      sendProgress({ type: 'status', status: 'already-exists', videoId })
      sendProgress({ type: 'complete', success: false, videoId, error: 'Video již existuje', skipped: true })
      return
    }

    // Step 1: Extract video metadata
    const metadata = await extractVideoMetadata(url, cookies)

    // Step 2: Download video
    const tempPath = outputPath + '.tmp'
    await downloadVideo(metadata, tempPath, cookies)

    // Step 3: Add watermark if requested
    if (shouldWatermark) {
      await addWatermark(tempPath, outputPath, workerData.payload.ffmpegPath)
    } else {
      // Just rename temp file
      fs.renameSync(tempPath, outputPath)
    }

    sendProgress({ type: 'status', status: 'completed', videoId })
    sendProgress({ type: 'complete', success: true, videoId, path: outputPath, size: metadata.fileSize })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Map common errors to user-friendly messages
    let userMessage = errorMessage
    let status = 'error'
    let skipped = false

    if (errorMessage.includes('already exist') || errorMessage.includes('duplicate')) {
      userMessage = 'Video již existuje'
      status = 'already-exists'
      skipped = true
    } else if (errorMessage.includes('too large') || errorMessage.includes('maximum is')) {
      userMessage = 'Video je příliš velké'
      status = 'skipped'
      skipped = true
    } else if (errorMessage.includes('too small') || errorMessage.includes('minimum is')) {
      userMessage = 'Video je příliš malé'
      status = 'skipped'
      skipped = true
    } else if (errorMessage.includes('416') || errorMessage.includes('Range Not Satisfiable')) {
      userMessage = 'Server nepodporuje stahování po částech'
      status = 'error'
      skipped = false
    }

    console.log(`[Download] [${videoId.substring(0, 8)}] Error: ${userMessage} (status: ${status})`)
    sendProgress({ type: 'status', status, videoId })
    sendProgress({ type: 'complete', success: false, videoId, error: userMessage, skipped })
  }
}

// Start download if this is a download worker
if (workerData.type === 'download') {
  downloadVideoHandler(workerData.payload)
}
