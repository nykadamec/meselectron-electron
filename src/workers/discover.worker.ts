// Video Discovery Worker - scrapes prehrajto.cz for video links
import { parentPort, workerData } from 'worker_threads'
import axios from 'axios'
import { parseCookieFile } from './utils/cookie.js'

// Helper to safely post messages (parentPort is always available in worker threads)
function sendProgress(data: unknown) {
  if (parentPort) {
    parentPort.postMessage(data)
  }
}

interface VideoCandidate {
  url: string
  title: string
  duration?: string
  thumbnail?: string
  size?: number  // Velikost v bytes
}

interface DiscoverOptions {
  accountId: string
  count: number
  cookies?: string  // Backwards compatibility
  videoId?: string
  processedUrls?: string[]
}

/**
 * Parse file size from video card in listing page
 * Looks for: <div class="video__tag video__tag--size">1.37 GB</div>
 */
function parseSizeFromContext(context: string): string | null {
  const sizePattern = /<div[^>]*class="video__tag video__tag--size"[^>]*>([^<]+)<\/div>/i
  const match = context.match(sizePattern)
  if (match && match[1]) {
    return match[1].trim() // "1.37 GB"
  }
  return null
}

/**
 * Convert and format file size to GB with fixed width
 * Examples: "2.76 GB" → "  2.76 GB", "711.13 MB" → "  0.69 GB"
 */
function formatSize(size: string): string {
  // Parse size and unit
  const match = size.match(/^([\d.]+)\s*([GMK]B)$/i)
  if (!match) return size // Return as-is if parsing fails

  const value = parseFloat(match[1])
  const unit = match[2].toUpperCase()

  // Convert to GB
  let gbValue: number
  switch (unit) {
    case 'GB':
      gbValue = value
      break
    case 'MB':
      gbValue = value / 1024
      break
    case 'KB':
      gbValue = value / (1024 * 1024)
      break
    default:
      gbValue = value
  }

  // Format: "2.76 GB" and pad to centered width (e.g., "  2.76 GB  ")
  const formatted = `${gbValue.toFixed(2)} GB`  // "2.76 GB" = 7 chars
  return formatted.padEnd(9, ' ').padStart(11, ' ') // Center in 11 chars
}

/**
 * Convert size string to bytes
 * Examples: "2.76 GB" → 2963527372, "1.37 GB" → 1471274905
 */
function parseSizeToBytes(size: string): number | undefined {
  if (!size) return undefined

  const match = size.match(/^([\d.]+)\s*([GMK]B)$/i)
  if (!match) return undefined

  const value = parseFloat(match[1])
  const unit = match[2].toUpperCase()

  switch (unit) {
    case 'GB':
      return Math.round(value * 1024 * 1024 * 1024)
    case 'MB':
      return Math.round(value * 1024 * 1024)
    case 'KB':
      return Math.round(value * 1024)
    default:
      return undefined
  }
}

/**
 * Extract video links from a prehrajto.cz listing page
 * NEW APPROACH: Parse each video-wrapper section independently
 * This ensures href and size are extracted from the same context
 */
async function extractVideoLinksFromPage(url: string, cookies: string): Promise<VideoCandidate[]> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Origin': 'https://prehrajto.cz',
        'Referer': 'https://prehrajto.cz/',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Dest': 'document',
        'Cookie': cookies || ''
      },
      timeout: 15000
    })

    const html = response.data

    // Debug logging
    console.log(`[DEBUG] Response status: ${response.status}`)
    console.log(`[DEBUG] HTML length: ${html.length} chars`)
    console.log(`[DEBUG] HTML sample: ${html.substring(0, 800)}`)

    // Check if we got a login page or error page
    if (response.status !== 200) {
      console.error(`[DEBUG] Got error status: ${response.status}`)
      return []
    }

    // Check for actual login page (form with email/password)
    const isLoginPage = url.includes('/prihlaseni') || url.includes('/registrace')
    if (isLoginPage && (html.includes('frm-login-loginForm') || html.includes('type="password"'))) {
      console.error(`[DEBUG] Got login page`)
      return []
    }

    // NEW APPROACH: Parse video-wrapper sections first, then extract from each section
    // This ensures href and size are always from the same video card
    const videoWrapperPattern = /<div[^>]*class="[^"]*video-wrapper[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/a>/gi
    const linkPattern = /href="\/([^\/]+)\/([a-f0-9]+)"[^>]*>/i
    const sizePattern = /<div[^>]*class="video__tag video__tag--size"[^>]*>([^<]+)<\/div>/i
    const thumbPattern = /src="([^"]*thumb\.prehrajto\.cz[^"]*)"/i

    let match
    const linksFound = new Map<string, VideoCandidate>()
    let wrapperCount = 0

    while ((match = videoWrapperPattern.exec(html)) !== null) {
      wrapperCount++
      const sectionHtml = match[1]  // Content inside video-wrapper

      // Extract href from this section
      const hrefMatch = sectionHtml.match(linkPattern)
      if (!hrefMatch) continue

      const title = hrefMatch[1]
      const videoId = hrefMatch[2]
      const href = `/${title}/${videoId}`

      // Skip non-video links
      if (title === 'video' || title === 'profil' || title === 'genre' || title === 'category') continue
      if (linksFound.has(href)) continue

      // Extract size from this section (NOW GUARANTEED to be from same wrapper!)
      const sizeMatch = sectionHtml.match(sizePattern)
      const size = sizeMatch ? sizeMatch[1].trim() : null  // "2.4 GB" or null

      // Extract thumbnail
      const thumbMatch = sectionHtml.match(thumbPattern)
      const thumbnail = thumbMatch ? thumbMatch[1] : undefined

      // Build full URL
      const fullUrl = `https://prehrajto.cz${href}`

      // Clean up title
      const cleanTitle = title.replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
      const formattedTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1)

      // Format title with size prefix
      const titleWithSize = size ? `[${formatSize(size)}] - ${formattedTitle}` : formattedTitle

      // Convert size string to bytes
      const sizeBytes = size ? parseSizeToBytes(size) : undefined

      // Debug: log what we found
      if (size) {
        console.log(`[DEBUG] Found video: "${formattedTitle}" size="${size}" bytes=${sizeBytes}`)
      }

      linksFound.set(href, {
        url: fullUrl,
        title: titleWithSize,
        thumbnail: thumbnail?.startsWith('//') ? `https:${thumbnail}` : thumbnail,
        size: sizeBytes
      })
    }

    console.log(`[DEBUG] Found ${linksFound.size} video links from ${wrapperCount} video-wrapper sections`)
    return Array.from(linksFound.values())

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`Error extracting links from ${url}:`, errorMessage)
    return []
  }
}

/**
 * Main discovery function - scrapes multiple pages to find video candidates
 * Matches Python implementation in message.py:main() -> download_videos_for_admin_with_gui()
 */
async function discoverVideos(options: DiscoverOptions) {
  // Get cookies - already retrieved from session worker via IPC handler
  const cookies = options.cookies || ''

  // Parse cookies from Netscape format if needed (detect by #HttpOnly_ or Domain= prefix)
  const validCookies = cookies.includes('#HttpOnly_') || cookies.includes('Domain=')
    ? parseCookieFile(cookies)
    : cookies

  const { count, processedUrls = [] } = options
  const processedSet = new Set(processedUrls)

  const availableCandidates: VideoCandidate[] = []
  const seenUrls = new Set<string>()

  // Higher buffer for skipping processed videos
  const BUFFER_MULTIPLIER = 6
  const targetCount = count * BUFFER_MULTIPLIER

  // Report progress
  sendProgress({
    type: 'status',
    status: 'discovering',
    message: 'Začínám vyhledávání videí...',
    videoId: options.videoId
  })

  // Page URLs to scrape - same as Python implementation
  const pageConfigs = [
    { baseUrl: 'https://prehrajto.cz/nejsledovanejsi-online-videa', name: 'všechny' },
    { baseUrl: 'https://prehrajto.cz/nejsledovanejsi-online-videa?filteredPastTime=7days', name: '7 dní' },
    { baseUrl: 'https://prehrajto.cz/nejsledovanejsi-online-videa?filteredPastTime=14days', name: '14 dní' }
   
  ]

  let totalScanned = 0
  const totalPages = pageConfigs.length * 10

  for (const config of pageConfigs) {
    for (let page = 1; page <= 10; page++) {
      // Check if we have enough available candidates
      if (availableCandidates.length >= count) {
        break
      }

      // Also stop if we've scanned enough for the buffer
      if (availableCandidates.length >= targetCount) {
        break
      }

      // Build URL - use ? for first param, & for additional params
      const separator = config.baseUrl.includes('?') ? '&' : '?'
      const url = `${config.baseUrl}${separator}currentViewingVideoListing-visualPaginator-page=${page}`
      totalScanned++

      sendProgress({
        type: 'progress',
        progress: (totalScanned / totalPages) * 100,
        message: `Prohledávám stránku ${page}/10 (${config.name})...`,
        scanned: totalScanned,
        total: totalPages,
        found: availableCandidates.length,
        videoId: options.videoId
      })

      // Rate limiting - same as Python (0.5s between requests)
      await new Promise(resolve => setTimeout(resolve, 500))

      // Debug logging for URL structure
      console.log(`[DEBUG] Fetching: ${url}`)

      // Extract links from this page
      const pageLinks = await extractVideoLinksFromPage(url, validCookies)

      // Filter out duplicates and processed videos, add only available to results
      for (const link of pageLinks) {
        if (!seenUrls.has(link.url)) {
          seenUrls.add(link.url)
          // Skip already processed videos
          if (!processedSet.has(link.url)) {
            availableCandidates.push(link)
          }
        }
      }

      console.log(`[Discover] Page ${page} (${config.name}): ${pageLinks.length} links, available: ${availableCandidates.length}`)
    }

    if (availableCandidates.length >= count) {
      break
    }
  }

  sendProgress({
    type: 'status',
    status: 'complete',
    message: `Nalezeno ${availableCandidates.length} dostupných videí`,
    videoId: options.videoId
  })

  // Send final result - only available candidates
  const finalCandidates = availableCandidates.slice(0, count)
  sendProgress({
    type: 'complete',
    success: true,
    candidates: finalCandidates,
    videoId: options.videoId
  })

  return finalCandidates
}

// Handle discovery request
if (workerData.type === 'discover') {
  discoverVideos(workerData.payload)
    .catch((error) => {
      sendProgress({
        type: 'error',
        error: error.message,
        videoId: workerData.payload.videoId
      })
      sendProgress({
        type: 'complete',
        success: false,
        error: error.message,
        videoId: workerData.payload.videoId
      })
    })
}
