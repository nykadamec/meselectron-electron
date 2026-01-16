// Video Discovery Worker - scrapes prehrajto.cz for video links
import { parentPort, workerData } from 'worker_threads'
import axios from 'axios'

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
}

/**
 * Parse Set-Cookie format to cookie header string
 * Format: name=value; Domain=...; Path=...; Secure; HttpOnly
 */
function parseCookieFile(content: string): string {
  const cookies: string[] = []
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
 * Extract video links from a prehrajto.cz listing page
 * Matches Python implementation in download.py:extract_video_links()
 */
async function extractVideoLinksFromPage(url: string, cookies: string): Promise<VideoCandidate[]> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Cookie': cookies || ''
      },
      timeout: 15000
    })

    const html = response.data
    const videoCandidates: VideoCandidate[] = []

    // Parse HTML using regex (similar to Python BeautifulSoup)
    // Looking for: <a class="video video--small video--link" href="/video/xxx">
    const linkPattern = /<a[^>]*class="video[^"]*video--small[^"]*video--link"[^>]*href="([^"]*)"[^>]*>/gi
    const thumbnailPattern = /<img[^>]*src="([^"]*)"[^>]*>/i

    let match
    const linksFound = new Map<string, VideoCandidate>()

    while ((match = linkPattern.exec(html)) !== null) {
      const href = match[1]
      // Skip if already found
      if (linksFound.has(href)) continue

      // Get the surrounding context for thumbnail
      const startIdx = Math.max(0, match.index - 500)
      const endIdx = Math.min(html.length, match.index + 500)
      const context = html.substring(startIdx, endIdx)

      // Extract thumbnail
      const thumbMatch = thumbnailPattern.exec(context)
      const thumbnail = thumbMatch ? thumbMatch[1] : undefined

      // Build full URL
      const fullUrl = href.startsWith('http') ? href : `https://prehrajto.cz${href}`

      // Extract title from URL (like Python implementation)
      // Format: https://prehrajto.cz/video-name/ID
      let title = fullUrl
      if (fullUrl.includes('prehrajto.cz/')) {
        const path = fullUrl.split('prehrajto.cz/')[1]
        if (path.includes('/')) {
          title = path.split('/')[0]
        } else {
          title = path
        }
      }

      // Clean up title
      title = title.replace(/<[^>]*>/g, '').trim()
      title = title.substring(0, 100) // Limit title length

      linksFound.set(href, {
        url: fullUrl,
        title,
        thumbnail
      })
    }

    return Array.from(linksFound.values())

  } catch (error) {
    console.error(`Error extracting links from ${url}:`, error.message)
    return []
  }
}

/**
 * Main discovery function - scrapes multiple pages to find video candidates
 * Matches Python implementation in message.py:main() -> download_videos_for_admin_with_gui()
 */
async function discoverVideos(options: { cookies: string; count: number; videoId?: string }) {
  // Parse cookies from Set-Cookie format to Cookie header format
  const parsedCookies = parseCookieFile(options.cookies || '')
  const { cookies, count } = { cookies: parsedCookies, count: options.count }
  const videoCandidates: VideoCandidate[] = []
  const seenUrls = new Set<string>()
  const BUFFER_MULTIPLIER = 3 // Get 3x more candidates to account for size filtering
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
    { baseUrl: 'https://prehrajto.cz/nejsledovanejsi-online-videa?filteredPastTime=7days', name: '7 dní' },
    { baseUrl: 'https://prehrajto.cz/nejsledovanejsi-online-videa?filteredPastTime=14days', name: '14 dní' },
    { baseUrl: 'https://prehrajto.cz/nejsledovanejsi-online-videa', name: 'všechny' }
  ]

  let totalScanned = 0
  const totalPages = pageConfigs.length * 10

  for (const config of pageConfigs) {
    for (let page = 1; page <= 10; page++) {
      // Check if we have enough candidates
      if (videoCandidates.length >= targetCount) {
        break
      }

      const url = `${config.baseUrl}&currentViewingVideoListing-visualPaginator-page=${page}`
      totalScanned++

      sendProgress({
        type: 'progress',
        progress: (totalScanned / totalPages) * 100,
        message: `Prohledávám stránku ${page}/10 (${config.name})...`,
        scanned: totalScanned,
        total: totalPages,
        found: videoCandidates.length,
        videoId: options.videoId
      })

      // Rate limiting - same as Python (0.5s between requests)
      await new Promise(resolve => setTimeout(resolve, 500))

      // Extract links from this page
      const pageLinks = await extractVideoLinksFromPage(url, cookies)

      // Filter out duplicates and add to results
      for (const link of pageLinks) {
        if (!seenUrls.has(link.url)) {
          seenUrls.add(link.url)
          videoCandidates.push(link)
        }
      }

      console.log(`[Discover] Page ${page} (${config.name}): ${pageLinks.length} links, total: ${videoCandidates.length}`)
    }

    if (videoCandidates.length >= targetCount) {
      break
    }
  }

  sendProgress({
    type: 'status',
    status: 'complete',
    message: `Nalezeno ${videoCandidates.length} video kandidátů`,
    videoId: options.videoId
  })

  // Send final result
  sendProgress({
    type: 'complete',
    success: true,
    candidates: videoCandidates,
    videoId: options.videoId
  })

  return videoCandidates
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
