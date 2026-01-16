// My Videos Worker - scrapes prehrajto.cz/profile/nahrana-videa
import { parentPort, workerData } from 'worker_threads'
import axios from 'axios'

// Helper to safely post messages (parentPort is always available in worker threads)
function sendProgress(data: unknown) {
  if (parentPort) {
    parentPort.postMessage(data)
  }
}

interface MyVideo {
  id: string
  title: string
  thumbnail?: string
  views: number
  addedAt: string
  url: string
  size?: string
  downloadsPremium?: number
  downloadsTotal?: number
  likes?: number
  dislikes?: number
}

interface MyVideosResponse {
  videos: MyVideo[]
  hasMore: boolean
  total: number
  page: number
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

    const cookiePart = trimmed.split(';')[0]
    if (cookiePart && cookiePart.includes('=')) {
      cookies.push(cookiePart)
    }
  }

  return cookies.join('; ')
}

/**
 * Extract video metadata from profile page
 * Parses the actual HTML structure from prehrajto.cz/profile/nahrana-videa
 */
async function extractVideosFromProfilePage(url: string, cookies: string): Promise<MyVideo[]> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Cookie': cookies || ''
      },
      timeout: 15000
    })

    const html = response.data
    const videos: MyVideo[] = []

    // Parse video items using index-based approach (more reliable than regex for nested HTML)
    const videoItemStart = 'class="margin-bottom-1" id="snippet-uploadedVideoListing-video-'

    let searchIndex = 0
    const seenIds = new Set<string>()

    while (true) {
      const startPos = html.indexOf(videoItemStart, searchIndex)
      if (startPos === -1) break

      // Extract ID
      const idStart = startPos + videoItemStart.length
      const idEnd = html.indexOf('"', idStart)
      if (idEnd === -1) break
      const id = html.substring(idStart, idEnd)

      // Find the end of this video item - look for the closing div
      // We need to find where this specific margin-bottom-1 div ends
      // Strategy: find the position after the opening tag, then count nested divs
      const contentStart = html.indexOf('>', startPos) + 1
      if (contentStart === 0) break

      let depth = 1
      let contentEnd = contentStart
      let pos = contentStart

      while (depth > 0 && pos < html.length) {
        const nextOpen = html.indexOf('<div', pos)
        const nextClose = html.indexOf('</div', pos)

        if (nextClose === -1) break

        if (nextOpen !== -1 && nextOpen < nextClose) {
          // Opening div found first
          depth++
          pos = nextOpen + 4
        } else {
          // Closing div found first
          depth--
          if (depth === 0) {
            contentEnd = nextClose
            break
          }
          pos = nextClose + 5
        }
      }

      searchIndex = contentEnd + 6 // move past </div>

      if (seenIds.has(id)) continue
      seenIds.add(id)

      const itemHtml = html.substring(contentStart, contentEnd)

      // Extract title: <h3 class="title margin-bottom-1 margin-right-1 word-break" id="snippet-uploadedVideoListing-videoName-{ID}">TITLE</h3>
      const titleMatch = itemHtml.match(/<h3[^>]*id="snippet-uploadedVideoListing-videoName-\d+"[^>]*>([^<]+)<\/h3>/i)
      const title = titleMatch ? titleMatch[1].trim() : 'Unknown'

      // Debug: show all img src found in itemHtml
      const allImgMatches: string[] = (itemHtml.match(/<img[^>]+src="([^"]*)"[^>]*>/gi) || [])
      console.log(`[MyVideos] Debug for ${id}: found ${allImgMatches.length} img tags`)
      allImgMatches.forEach((img, i) => {
        console.log(`[MyVideos]   img[${i}]: ${img}`)
      })

      // Extract thumbnail directly from img src with thumb.prehrajto.cz
      const thumbnailMatch = itemHtml.match(/<img[^>]+src="(https:\/\/thumb\.prehrajto\.cz\/[^"]+)"[^>]*>/i)
      console.log(`[MyVideos] Thumbnail match for ${id}:`, thumbnailMatch ? `FOUND: ${thumbnailMatch[1]}` : 'NOT FOUND')
      const thumbnail = thumbnailMatch ? thumbnailMatch[1] : undefined

      // Extract size: <strong style="font-size:13px">699.71 MB</strong>
      const sizeMatch = itemHtml.match(/<strong[^>]*>\s*(\d+\.?\d*)\s*(MB|GB|KB|B)\s*<\/strong>/i)
      const size = sizeMatch ? `${sizeMatch[1]} ${sizeMatch[2]}` : undefined

      // Extract video URL for linking: href="/parchanti-2010-cz-dabing/ef0c1d91e9497fbb"
      const urlMatch = itemHtml.match(/href="(\/[^"]+\/[\da-f]+)"/i)
      const videoUrl = urlMatch ? `https://prehrajto.cz${urlMatch[1]}` : `https://prehrajto.cz/video/${id}`

      // Extract download stats: Počet stažení (PREMIUM / CELKEM) followed by <div class="rating rating--text">0 / 0</div>
      // First find the stats section
      const statsSectionMatch = itemHtml.match(/Počet stažení[^<]*<[^>]*>(\d+)\s*\/s*(\d+)<\/div>/i)
      const downloadsPremium = statsSectionMatch ? parseInt(statsSectionMatch[1], 10) : 0
      const downloadsTotal = statsSectionMatch ? parseInt(statsSectionMatch[2], 10) : 0

      // Extract rating: Look for the rate section
      // Pattern: <div class="rate rate--stats">...<span class="text-medium color-green"><strong>0</strong>...<span class="text-medium color-primary"><strong>0</strong>
      const likesMatch = itemHtml.match(/color-green[^>]*>\s*<strong>\s*(\d+)/i)
      const dislikesMatch = itemHtml.match(/color-primary[^>]*>\s*<strong>\s*(\d+)/i)
      const likes = likesMatch ? parseInt(likesMatch[1], 10) : 0
      const dislikes = dislikesMatch ? parseInt(dislikesMatch[1], 10) : 0

      // Count total views as premium + total downloads
      const views = downloadsPremium + downloadsTotal

      console.log(`[MyVideos] Parsed video ${id}: "${title}" - ${size || 'N/A'}`)

      videos.push({
        id,
        title,
        thumbnail: thumbnail?.startsWith('//') ? `https:${thumbnail}` : thumbnail,
        views,
        addedAt: new Date().toISOString(), // Would need to extract from another field if available
        url: videoUrl,
        size,
        downloadsPremium,
        downloadsTotal,
        likes,
        dislikes
      })

      // Limit results per page
      if (videos.length >= 20) break
    }

    console.log(`[MyVideos] Total videos parsed: ${videos.length}`)
    return videos

  } catch (error) {
    console.error(`[MyVideos] Error extracting videos:`, error instanceof Error ? error.message : error)
    return []
  }
}

/**
 * Check if there are more pages available
 */
async function checkHasMorePages(cookies: string, currentPage: number): Promise<boolean> {
  try {
    const nextPageUrl = currentPage === 1
      ? 'https://prehrajto.cz/profil/nahrana-videa?uploadedVideoListing-visualPaginator-page=2'
      : `https://prehrajto.cz/profil/nahrana-videa?uploadedVideoListing-visualPaginator-page=${currentPage + 1}`
    const response = await axios.get(nextPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Cookie': cookies || ''
      },
      timeout: 10000
    })

    // Check if page has any video content
    const html = response.data
    const hasContent = /snippet-uploadedVideoListing-video-\d+/i.test(html)
    console.log(`[MyVideos] Page ${currentPage + 1} has more content: ${hasContent}`)
    return hasContent

  } catch (error) {
    console.error(`[MyVideos] Error checking next page:`, error instanceof Error ? error.message : error)
    return false
  }
}

/**
 * Main function to load user's uploaded videos
 */
async function loadMyVideos(options: { cookies: string; page: number; accountId?: string }) {
  const parsedCookies = parseCookieFile(options.cookies || '')
  const page = options.page || 1

  sendProgress({
    type: 'status',
    status: 'loading',
    message: `Načítám videa (stránka ${page})...`,
    page
  })

  // Rate limiting
  await new Promise(resolve => setTimeout(resolve, 300))

  const url = page === 1
    ? 'https://prehrajto.cz/profil/nahrana-videa'
    : `https://prehrajto.cz/profil/nahrana-videa?uploadedVideoListing-visualPaginator-page=${page}`
  console.log(`[MyVideos] Fetching URL: ${url}`)

  // Extract videos from page
  const videos = await extractVideosFromProfilePage(url, parsedCookies)

  // Check if there are more pages
  const hasMore = await checkHasMorePages(parsedCookies, page)

  sendProgress({
    type: 'progress',
    progress: hasMore ? 50 : 100,
    message: `Nalezeno ${videos.length} videí`,
    page,
    found: videos.length,
    hasMore
  })

  const response: MyVideosResponse = {
    videos,
    hasMore,
    total: videos.length,
    page
  }

  // Send complete message
  sendProgress({
    type: 'complete',
    success: true,
    ...response
  })

  return response
}

// Handle request
if (workerData.type === 'myvideos') {
  loadMyVideos(workerData.payload)
    .catch((error) => {
      sendProgress({
        type: 'error',
        error: error instanceof Error ? error.message : String(error)
      })
      sendProgress({
        type: 'complete',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
    })
}
