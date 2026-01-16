// Upload worker - handles video uploads to CDN with progress reporting
import { parentPort, workerData } from 'worker_threads'
import axios, { AxiosInstance } from 'axios'
import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'
import yaml from 'js-yaml'

// CDN URL from app.yaml config
const CDN_URL = 'https://api.premiumcdn.net/upload'

/**
 * Load configuration from app.yaml
 */
function loadConfig(): { MAX_SSL_CHUNK_SIZE: number } {
  try {
    const appYamlPath = path.resolve(process.cwd(), 'app.yaml')
    const appYamlContent = fs.readFileSync(appYamlPath, 'utf-8')
    const appConfig = yaml.load(appYamlContent) as { config?: { MAX_SSL_CHUNK_SIZE?: number } }
    return {
      MAX_SSL_CHUNK_SIZE: appConfig.config?.MAX_SSL_CHUNK_SIZE || 8 * 1024  // Default 8KB
    }
  } catch (error) {
    console.warn('[UPLOAD] Failed to load app.yaml config, using defaults')
    return { MAX_SSL_CHUNK_SIZE: 8 * 1024 }
  }
}

const config = loadConfig()

/**
 * Create axios session with cookies (matching Python requests.Session pattern)
 */
function createUploadSession(cookies: string): AxiosInstance {
  return axios.create({
    baseURL: 'https://prehrajto.cz',
    headers: {
      'Cookie': cookies,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Origin': 'https://prehrajto.cz',
      'Referer': 'https://prehrajto.cz/',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty',
      'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    validateStatus: status => status < 500, // Accept 3xx without following redirect
    withCredentials: true, // Send cookies for cross-origin requests
  })
}

// Helper to safely post messages (parentPort is always available in worker threads)
function postMessage(data: unknown) {
  if (parentPort) {
    parentPort.postMessage(data)
  }
}

interface UploadOptions {
  filePath: string
  accountId?: string  // New: get cookies from session worker
  cookies?: string    // Backwards compatibility
  videoId?: string    // For real-time progress tracking
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

async function getUploadParameters(session: AxiosInstance, filePath: string): Promise<UploadParams | null> {
  try {
    const fileSize = fs.statSync(filePath).size
    const fileName = path.basename(filePath).replace(/\.(avi|mp4|mkv)$/i, '')

    console.log(`[UPLOAD] getUploadParameters: fileSize=${fileSize}, fileName=${fileName}`)

    const formData = new URLSearchParams()
    formData.append('do', 'prepareVideo')
    formData.append('name', fileName)
    formData.append('size', String(fileSize))
    formData.append('type', 'video/mp4')
    formData.append('description', '')
    formData.append('erotic', 'false')
    formData.append('folder', '')
    formData.append('private', 'false')

    // Use axios session (thread-local session pattern from Python)
    const response = await session.post(
      '/profil/nahrat-soubor?do=prepareVideo',
      formData
    )

    // Log Content-Type for debugging (helps identify HTML vs JSON responses)
    const contentType = response.headers['content-type']
    console.log(`[UPLOAD] getUploadParameters response: status=${response.status}, Content-Type=${contentType}`)

    // Check Content-Type to detect HTML (login page) vs JSON (actual response)
    if (!contentType?.includes('application/json')) {
      console.error(`[UPLOAD] Server vrátil ${contentType || 'neznámý typ'} místo JSON - pravděpodobně vyžaduje přihlášení`)
      console.error(`[UPLOAD] Obsah odpovědi: ${String(response.data).substring(0, 300)}`)
      console.error('[UPLOAD] Zkontrolujte platnost cookies a přihlaste se znovu na prehrajto.cz')
      return null
    }

    // Safely parse JSON response (handles both string and object)
    let data: unknown
    try {
      data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
    } catch (parseError) {
      console.error(`[UPLOAD] Nepodařilo se parsovat JSON: ${parseError}`)
      return null
    }

    // Check for upload params in response
    if (response.status === 200 && data && typeof data === 'object' && 'response' in data && 'project' in data) {
      postMessage({ type: 'status', status: 'getting_params', message: 'Získávám upload parametry...' })
      return data as UploadParams
    }

    // Check for redirect in response
    if (data && typeof data === 'object' && 'redirect' in data) {
      console.log(`[UPLOAD] Server returned redirect URL: ${(data as { redirect: string }).redirect}`)
    }

    console.error(`[UPLOAD] Failed to get upload params: status=${response.status}, data=${JSON.stringify(data).substring(0, 200)}`)
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

  // Create boundary
  const boundary = '----WebKitFormBoundary' + crypto.randomUUID().replace(/-/g, '')

  // Build multipart form
  const { preamble, closing, contentLength } = buildMultipartForm(
    boundary,
    fileName,
    fileSize,
    uploadParams
  )

  const cdnUrl = new URL(CDN_URL)
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
    // Promise resolver for upload completion (declared BEFORE callbacks)
    let uploadResolve: ((success: boolean) => void) | undefined

    // Create the HTTP request
    const req = protocol.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        console.log(`[UPLOAD] CDN response: ${res.statusCode}`)
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          console.log('[UPLOAD] File uploaded successfully to CDN')
          uploadResolve?.(true)
        } else {
          console.error('[UPLOAD] CDN error:', res.statusCode, body.substring(0, 200))
          uploadResolve?.(false)
        }
      })
    })

    req.on('error', (e) => {
      console.error('[UPLOAD] Request error:', e)
      uploadResolve?.(false)
    })

    // Write preamble FIRST (before file data)
    req.write(preamble)

    // Stream file with ChunkedFileReader (configurable SSL chunk size from app.yaml)
    const reader = new ChunkedFileReader(filePath, config.MAX_SSL_CHUNK_SIZE, false)
    let bytesSent = 0
    let lastTime = Date.now()
    let lastBytes = 0
    let lastSpeedBps = 0  // Store speed in B/s for onProgress

    // Async function to stream file chunks with proper drain handling
    const sendChunk = async (): Promise<boolean> => {
      const chunk = reader.read()

      if (!chunk) {
        // Send closing boundary
        req.write(closing)
        req.end()
        reader.close()
        return true
      }

      // Wait for buffer to drain if full
      while (!req.write(chunk)) {
        await new Promise(resolve => req.once('drain', resolve))
      }

      bytesSent += chunk.length

      // Calculate progress
      const progress = Math.round((bytesSent / fileSize) * 100)

      // Calculate smoothed speed in B/s
      const now = Date.now()
      const timeDiff = (now - lastTime) / 1000

      if (timeDiff >= 0.5) {
        const bytesDiff = bytesSent - lastBytes
        const currentSpeedBps = bytesDiff / timeDiff
        lastSpeedBps = calculateSmoothedSpeed(lastSpeedBps, currentSpeedBps)
        lastBytes = bytesSent
        lastTime = now
      }

      onProgress(progress, bytesSent, fileSize, lastSpeedBps)

      // Continue with next chunk
      return sendChunk()
    }

    // Open reader and start streaming
    reader.open()
    await sendChunk()

    // Wait for response
    return await new Promise<boolean>((resolve) => {
      uploadResolve = resolve
    })

  } catch (error) {
    console.error(`[UPLOAD] Error with CDN URL:`, error instanceof Error ? error.message : error)
    return false
  }
}

async function uploadVideo(options: UploadOptions) {
  const { filePath, cookies, videoId } = options

  try {
    postMessage({ type: 'status', status: 'starting', videoId })

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`)
    }

    const fileSize = fs.statSync(filePath).size

    // Validate cookies
    if (!cookies) {
      throw new Error('No cookies provided - please log in first')
    }

    // Log cookie info (without sensitive values)
    const cookieNames = cookies.split(';').map(c => c.trim().split('=')[0])
    console.log(`[UPLOAD] Cookies received: ${cookieNames.length} cookies, keys: ${cookieNames.join(', ')}`)
    const hasAccessToken = cookieNames.includes('access_token')
    const hasRefreshToken = cookieNames.includes('refresh_token')
    const hasNss = cookieNames.includes('_nss')
    console.log(`[UPLOAD] Cookie validation: access_token=${hasAccessToken}, refresh_token=${hasRefreshToken}, _nss=${hasNss}`)

    console.log(`[UPLOAD] Starting upload: ${path.basename(filePath)} (${fileSize} bytes)`)

    // Step 1: Create session and get upload parameters from prehrajto.cz
    postMessage({ type: 'status', status: 'getting_params', message: 'Získávám upload parametry...', videoId })

    const session = createUploadSession(cookies)
    const uploadParams = await getUploadParameters(session, filePath)
    if (!uploadParams) {
      throw new Error('Failed to get upload parameters')
    }

    // Step 2: Upload to CDN
    postMessage({ type: 'status', status: 'uploading', message: 'Nahrávám na CDN...', videoId })

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
          eta: speed > 0 ? Math.ceil((total - uploaded) / speed) : -1,  // speed is in B/s
          videoId
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

    postMessage({ type: 'status', status: 'completed', videoId })
    postMessage({ type: 'complete', success: true, videoId })

  } catch (error) {
    console.error('[UPLOAD] Upload error:', error instanceof Error ? error.message : error)
    postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown upload error',
      videoId
    })
  }
}

if (workerData.type === 'upload') {
  uploadVideo(workerData.payload)
}
