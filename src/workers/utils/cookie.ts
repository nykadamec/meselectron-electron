/**
 * Cookie parsing utilities for workers
 */

/**
 * Parse Set-Cookie format or Netscape cookie file to cookie header string
 */
export function parseCookieFile(content: string): string {
  if (!content) return ''

  // If it already looks like a cookie header (multiple semicolons, no newlines), return as is
  if (content.includes(';') && !content.includes('\n') && content.includes('=')) {
    return content
  }

  const cookies: string[] = []
  const lines = content.trim().split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    // Netscape format has tabs between fields, Set-Cookie has semicolons
    const cookiePart = trimmed.split('\t').pop()?.split(';')[0] || trimmed.split(';')[0]
    if (cookiePart && cookiePart.includes('=')) {
      cookies.push(cookiePart)
    }
  }

  return cookies.join('; ')
}

/**
 * Parse Set-Cookie headers array to cookie header string
 */
export function parseSetCookieHeaders(headers: string[]): string {
  const cookies: string[] = []
  for (const header of headers) {
    const cookiePart = header.split(';')[0]
    if (cookiePart && cookiePart.includes('=')) {
      cookies.push(cookiePart)
    }
  }
  return cookies.join('; ')
}
