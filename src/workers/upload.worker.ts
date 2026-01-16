// Upload worker - handles video uploads to CDN with progress reporting
import { parentPort, workerData } from 'worker_threads'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'

// CDN URLs with fallback (matching Python upload.py pattern)
const CDN_URLS = [
  'https://api.premiumcdn.net/upload',  // Primary URL
  'https://premiumcdn.net/upload',       // Fallback URL (no 'api.' prefix)
] as const

type CDNUrl = typeof CDN_URLS[number]

// Helper to safely post messages (parentPort is always available in worker threads)
function postMessage(data: unknown) {
  if (parentPort) {
    parentPort.postMessage(data)
  }
}

interface UploadParams {
  response: string
  project: string
  nonce: string
  params: string
  signature: string
}

/**
 * ChunkedFileReader - mimics Python's ChunkReader for streaming file uploads
 * Uses synchronous file operations to avoid GC issues with FileHandle
 */
class ChunkedFileReader {
  private filePath: string
  private fd: number = -1
  private chunkSize: number
  private _totalSize: number
  private _position: number = 0
  private readonly throttleMs: number = 3 // Match Python's 3ms sleep
  private nochunk: boolean = false

  constructor(filePath: string, chunkSize: number = 2 * 1024 * 1024, nochunk: boolean = false) {
    this.filePath = filePath
    this.chunkSize = chunkSize
    this.nochunk = nochunk

    const stats = fs.statSync(filePath)
    this._totalSize = stats.size
  }

  open(): void {
    this.fd = fs.openSync(this.filePath, 'r')
    this._position = 0
  }

  read(size?: number): Buffer | null {
    if (this.fd < 0) {
      throw new Error('File not opened. Call open() first.')
    }

    const readSize = size && size > 0 ? Math.max(size, this.chunkSize) : this.chunkSize
    const remaining = this._totalSize - this._position

    if (remaining <= 0) {
      return null
    }

    const toRead = Math.min(readSize, remaining)
    const buffer = Buffer.alloc(toRead)
    const bytesRead = fs.readSync(this.fd, buffer, 0, toRead, this._position)

    this._position += bytesRead

    // Throttle for disk IO (matching Python behavior)
    if (!this.nochunk && this.throttleMs > 0) {
      // Use synchronous sleep to avoid timing issues
      const start = Date.now()
      while (Date.now() - start < this.throttleMs) {
        // busy wait
      }
    }

    if (bytesRead < toRead) {
      return buffer.subarray(0, bytesRead)
    }

    return buffer
  }

  close(): void {
    if (this.fd >= 0) {
      fs.closeSync(this.fd)
      this.fd = -1
    }
  }

  get position(): number {
    return this._position
  }

  set position(value: number) {
    this._position = value
  }

  get totalSize(): number {
    return this._totalSize
  }
}

/**
 * Calculate smoothed upload speed using moving average (matching Python pattern)
 */
function calculateSmoothedSpeed(
  currentSpeed: number,
  newMeasurement: number,
  alpha: number = 0.3
): number {
  // Exponential moving average for smoother speed values
  return alpha * newMeasurement + (1 - alpha) * currentSpeed
}

/**
 * Build multipart form data manually (matching Python's multipart construction)
 */
function buildMultipartForm(
  boundary: string,
  fileName: string,
  fileSize: number,
  uploadParams: UploadParams
): { preamble: Buffer; closing: Buffer; contentLength: number } {
  // Build preamble with form fields BEFORE file (matching Python pattern)
  const encoder = new TextEncoder()

  const parts: Buffer[] = []

  // Form fields (matching Python's part_text function)
  const fields = [
    { name: 'response', value: uploadParams.response },
    { name: 'project', value: String(uploadParams.project) },
    { name: 'nonce', value: uploadParams.nonce },
    { name: 'params', value: uploadParams.params },
    { name: 'signature', value: uploadParams.signature },
  ]

  for (const field of fields) {
    const part = `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${field.name}"\r\n\r\n` +
      `${field.value}\r\n`
    parts.push(Buffer.from(encoder.encode(part)))
  }

  // File header (matching Python's file_header)
  const fileHeader = `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="files"; filename="${fileName}"\r\n` +
    `Content-Type: video/mp4\r\n\r\n`
  parts.push(Buffer.from(encoder.encode(fileHeader)))

  const preamble = Buffer.concat(parts)

  // Closing boundary (matching Python's closing)
  const closing = Buffer.from(encoder.encode(`\r\n--${boundary}--\r\n`))

  const contentLength = preamble.length + fileSize + closing.length

  return { preamble, closing, contentLength }
}

async function getUploadParameters(cookies: string, filePath: string): Promise<UploadParams | null> {
  try {
    const fileSize = fs.statSync(filePath).size
    const fileName = path.basename(filePath).replace(/\.(avi|mp4|mkv)$/i, '')

    const formData = new URLSearchParams()
    formData.append('do', 'prepareVideo')
    formData.append('name', fileName)
    formData.append('size', String(fileSize))
    formData.append('type', 'video/mp4')
    formData.append('description', '')
    formData.append('erotic', 'false')
    formData.append('folder', '')
    formData.append('private', 'false')

    const response = await axios.post(
      'https://prehrajto.cz/profil/nahrat-soubor?do=prepareVideo',
      formData,
      {
        headers: {
          'Cookie': cookies,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8',
          'Origin': 'https://prehrajto.cz',
          'Referer': 'https://prehrajto.cz/profil/nahrat-soubor'
        }
      }
    )

    if (response.status === 200 && response.data) {
      postMessage({ type: 'status', status: 'getting_params', message: 'Získávám upload parametry...' })
      return response.data as UploadParams
    }

    console.error('[UPLOAD] Failed to get upload params:', response.status, response.data)
    return null
  } catch (error) {
    console.error('[UPLOAD] Error getting upload params:', error instanceof Error ? error.message : error)
    return null
  }
}

async function uploadToCDN(
  cookies: string,
  filePath: string,
  uploadParams: UploadParams,
  onProgress: (progress: number, uploaded: number, total: number, speedMBps: number) => void
): Promise<boolean> {
  const fileSize = fs.statSync(filePath).size
  const fileName = path.basename(filePath)

  // Try each CDN URL in order (with fallback)
  for (let urlIndex = 0; urlIndex < CDN_URLS.length; urlIndex++) {
    const cdnUrlStr = CDN_URLS[urlIndex as number]
    const isFallback = urlIndex > 0

    if (isFallback) {
      console.log(`[UPLOAD] Trying fallback URL: ${cdnUrlStr}`)
    }

    // Create boundary
    const boundary = '----WebKitFormBoundary' + crypto.randomUUID().replace(/-/g, '')

    // Build multipart form
    const { preamble, closing, contentLength } = buildMultipartForm(
      boundary,
      fileName,
      fileSize,
      uploadParams
    )

    const cdnUrl = new URL(cdnUrlStr)
    const protocol = cdnUrl.protocol === 'https:' ? https : http

    const options: http.RequestOptions = {
      hostname: cdnUrl.hostname,
      port: cdnUrl.port || 443,
      path: cdnUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(contentLength),
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9,cs;q=0.8',
        'Origin': 'https://prehrajto.cz',
        'Referer': 'https://prehrajto.cz/',
        'X-Requested-With': 'XMLHttpRequest',
        'Connection': 'keep-alive',
        'DNT': '1',
        'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not?A_Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
      }
    }

    console.log(`[UPLOAD] CDN URL: ${cdnUrl.href} (Content-Length=${contentLength})`)

    try {
      const result = await new Promise<boolean>((resolve) => {
        const req = protocol.request(options, (res) => {
          let body = ''
          res.on('data', (chunk) => { body += chunk })
          res.on('end', () => {
            console.log(`[UPLOAD] CDN response: ${res.statusCode}`)
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              console.log('[UPLOAD] File uploaded successfully to CDN')
              resolve(true)
            } else {
              console.error('[UPLOAD] CDN error:', res.statusCode, body.substring(0, 200))
              resolve(false)
            }
          })
        })

        req.on('error', (e) => {
          console.error('[UPLOAD] Request error:', e)
          resolve(false)
        })

        // Send preamble first
        req.write(preamble)

        // Stream file with ChunkedFileReader (async IIFE)
        const reader = new ChunkedFileReader(filePath, 2 * 1024 * 1024, false)
        let streamError: Error | null = null

        let bytesSent = 0
        let lastTime = Date.now()
        let lastBytes = 0
        let lastSpeed = 0

        // Use IIFE pattern for streaming (synchronous reader)
        ;(() => {
          try {
            reader.open()

            const sendChunk = () => {
              if (streamError) {
                req.destroy()
                resolve(false)
                return
              }

              const chunk = reader.read()
              if (!chunk) {
                // Send closing boundary
                req.write(closing)
                req.end()
                reader.close()
                return
              }

              req.write(chunk)
              bytesSent += chunk.length

              // Calculate progress
              const progress = Math.round((bytesSent / fileSize) * 100)

              // Calculate smoothed speed
              const now = Date.now()
              const timeDiff = (now - lastTime) / 1000

              if (timeDiff >= 0.5) {
                const bytesDiff = bytesSent - lastBytes
                const speedBytesPerSec = bytesDiff / timeDiff
                const newSpeedMBps = speedBytesPerSec / (1024 * 1024)
                lastSpeed = calculateSmoothedSpeed(lastSpeed, newSpeedMBps)
                lastBytes = bytesSent
                lastTime = now
              }

              onProgress(progress, bytesSent, fileSize, lastSpeed)

              // Continue reading
              sendChunk()
            }

            sendChunk()
          } catch (e) {
            console.error('[UPLOAD] File stream error:', e)
            streamError = e instanceof Error ? e : new Error(String(e))
            req.destroy()
            resolve(false)
          }
        })()
      })

      if (result) {
        return true
      }

      // If this URL failed and it's not the last one, try the next
      if (urlIndex < CDN_URLS.length - 1) {
        console.log(`[UPLOAD] Waiting 1s before trying fallback URL...`)
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      }

      return false

    } catch (error) {
      console.error(`[UPLOAD] Error with URL ${cdnUrlStr}:`, error instanceof Error ? error.message : error)

      // Try fallback URL
      if (urlIndex < CDN_URLS.length - 1) {
        console.log(`[UPLOAD] Waiting 1s before trying fallback URL...`)
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      }

      return false
    }
  }

  return false
}

async function uploadVideo(options: { filePath: string; cookies?: string }) {
  const { filePath, cookies } = options

  try {
    postMessage({ type: 'status', status: 'starting' })

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`)
    }

    const fileSize = fs.statSync(filePath).size

    // Validate cookies
    if (!cookies) {
      throw new Error('No cookies provided - please log in first')
    }

    console.log(`[UPLOAD] Starting upload: ${path.basename(filePath)} (${fileSize} bytes)`)

    // Step 1: Get upload parameters from prehrajto.cz
    postMessage({ type: 'status', status: 'getting_params', message: 'Získávám upload parametry...' })

    const uploadParams = await getUploadParameters(cookies, filePath)
    if (!uploadParams) {
      throw new Error('Failed to get upload parameters')
    }

    // Step 2: Upload to CDN
    postMessage({ type: 'status', status: 'uploading', message: 'Nahrávám na CDN...' })

    let uploadSuccess = false
    for (let attempt = 1; attempt <= 5; attempt++) {
      console.log(`[UPLOAD] Upload attempt ${attempt}/5...`)

      uploadSuccess = await uploadToCDN(cookies, filePath, uploadParams, (progress, uploaded, total, speed) => {
        postMessage({
          type: 'progress',
          progress,
          uploaded,
          total,
          speed,
          eta: speed > 0 ? Math.ceil((total - uploaded) / (speed * 1024 * 1024)) : -1
        })
      })

      if (uploadSuccess) break

      if (attempt < 5) {
        console.log(`[UPLOAD] Waiting 1s before retry...`)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    if (!uploadSuccess) {
      throw new Error('Failed to upload to CDN after 5 attempts')
    }

    postMessage({ type: 'status', status: 'completed' })
    postMessage({ type: 'complete', success: true })

  } catch (error) {
    console.error('[UPLOAD] Upload error:', error instanceof Error ? error.message : error)
    postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown upload error'
    })
  }
}

if (workerData.type === 'upload') {
  uploadVideo(workerData.payload)
}
