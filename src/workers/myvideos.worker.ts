// My Videos Worker - scrapes prehrajto.cz/profile/nahrana-videa
import { parentPort, workerData } from 'worker_threads'
import axios from 'axios'
import { parseCookieFile } from './utils/cookie.js'

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
 * Extract video metadata from profile page
 * Parses the actual HTML structure from prehrajto.cz/profile/nahrana-videa
 */
async function extractVideosFromProfilePage(url: string, cookies: string): Promise<MyVideo[]> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': cookies || '',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Referer': 'https://prehrajto.cz/'
      },
      timeout: 15000
    })

    const html = response.data
    const videos: MyVideo[] = []
    
    // Check if we are actually logged in
    const isLoggedIn = html.includes('Odhlásit se') || html.includes('Přihlášený uživatel')
    console.log(`[MyVideos] Fetched HTML length: ${html.length} bytes | Logged in: ${isLoggedIn}`)

    if (!isLoggedIn) {
      console.warn('[MyVideos] Warning: Not logged in. Cookies might be invalid.')
    }

    // Robust regex to find video item containers
    const itemRegex = /id="snippet-uploadedVideoListing-video-(\d+)"/gi
    let match: RegExpExecArray | null
    const seenIds = new Set<string>()

    while ((match = itemRegex.exec(html)) !== null) {
      const id = match[1]
      const idPos = match.index
      
      if (seenIds.has(id)) continue
      seenIds.add(id)

      // Find the start of the div container
      const startPos = html.lastIndexOf('<div', idPos)
      if (startPos === -1) continue

      // Find the end of this video item container using depth counting
      let depth = 0
      let pos = startPos
      let contentEnd = -1

      while (pos < html.length) {
        const nextOpen = html.indexOf('<div', pos)
        const nextClose = html.indexOf('</div', pos)

        if (nextClose === -1) break

        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth++
          pos = nextOpen + 4
        } else {
          depth--
          if (depth === 0) {
            contentEnd = nextClose
            break
          }
          pos = nextClose + 5
        }
      }

      if (contentEnd === -1) continue

      const itemHtml = html.substring(startPos, contentEnd + 6)

      // 1. Extract Title from snippet-uploadedVideoListing-videoName-{ID}
      const titleMatch = itemHtml.match(/id="snippet-uploadedVideoListing-videoName-\d+"[^>]*>\s*([\s\S]*?)\s*<\/h3>/i)
      const title = titleMatch ? titleMatch[1].trim() : 'Unknown'

      // 2. Extract Thumbnail
      const thumbMatch = itemHtml.match(/src="(https:\/\/thumb\.prehrajto\.cz\/[^"]+)"/i)
      const thumbnail = thumbMatch ? thumbMatch[1] : undefined

      // 3. Extract Size: "2.96 GB"
      const sizeMatch = itemHtml.match(/(\d+(?:\.\d+)?)\s*(GB|MB|KB|B)/i)
      const size = sizeMatch ? `${sizeMatch[1]} ${sizeMatch[2]}` : undefined

      // 4. Extract Video URL: href="/slunce-seno-a-par-facek-cz-dabing/3b52b269c5155d68"
      const urlMatch = itemHtml.match(/href="(\/[^"]+\/[\da-f]{16})"/i)
      const videoUrl = urlMatch ? `https://prehrajto.cz${urlMatch[1]}` : `https://prehrajto.cz/video/${id}`

      // 5. Stats (Downloads) - rating rating--text">0 / 0</div>
      const statsMatch = itemHtml.match(/rating--text">\s*(\d+)\s*\/\s*(\d+)\s*<\/div>/i)
      const downloadsPremium = statsMatch ? parseInt(statsMatch[1], 10) : 0
      const downloadsTotal = statsMatch ? parseInt(statsMatch[2], 10) : 0

      // 6. Rating (Likes/Dislikes)
      const likesMatch = itemHtml.match(/color-green[^>]*>\s*<strong>\s*(\d+)/i)
      const dislikesMatch = itemHtml.match(/color-primary[^>]*>\s*<strong>\s*(\d+)/i)
      const likes = likesMatch ? parseInt(likesMatch[1], 10) : 0
      const dislikes = dislikesMatch ? parseInt(dislikesMatch[1], 10) : 0

      videos.push({
        id,
        title,
        thumbnail,
        views: downloadsPremium + downloadsTotal,
        addedAt: new Date().toISOString(),
        url: videoUrl,
        size,
        downloadsPremium,
        downloadsTotal,
        likes,
        dislikes
      })

      if (videos.length >= 50) break
    }

    if (videos.length === 0 && isLoggedIn) {
      console.log('[MyVideos] No videos found even though logged in. HTML sample:', html.substring(0, 1000).replace(/\s+/g, ' '))
    }
    
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

/**
 * Delete a video using the Nette snippet URL
 */
async function deleteVideo(options: { cookies: string; videoId: string }) {
  const parsedCookies = parseCookieFile(options.cookies || '')
  
  // The delete URL pattern from the user's example
  const deleteUrl = `https://prehrajto.cz/profil/nahrana-videa?uploadedVideoListing-videoId=${options.videoId}&do=uploadedVideoListing-deleteVideo`
  
  console.log(`[MyVideos] Deleting video ${options.videoId} using URL: ${deleteUrl}`)

  sendProgress({
    type: 'status',
    status: 'deleting',
    message: `Mažu video ${options.videoId}...`
  })

  try {
    const response = await axios.get(deleteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Cookie': parsedCookies,
        'Referer': 'https://prehrajto.cz/profil/nahrana-videa'
      }
    })

    // If request was successful, send complete
    sendProgress({
      type: 'complete',
      success: true,
      action: 'delete'
    })
  } catch (error) {
    console.error(`[MyVideos] Error deleting video:`, error instanceof Error ? error.message : error)
    sendProgress({
      type: 'complete',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      action: 'delete'
    })
  }
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
} else if (workerData.type === 'myvideos-delete') {
  deleteVideo(workerData.payload)
}
