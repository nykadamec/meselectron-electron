/**
 * Formatting utilities for the renderer
 * Provides consistent formatting functions for size, speed, ETA, etc.
 */

/**
 * Format bytes to human-readable size string
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "2.50 GB")
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes) return 'N/A'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Format bytes per second to human-readable speed string
 * @param bytesPerSecond - Speed in bytes per second
 * @returns Formatted string (e.g., "5.25 MB/s")
 */
export function formatSpeed(bytesPerSecond?: number): string {
  if (!bytesPerSecond) return '0 B/s'
  const k = 1024
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s']
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k))
  return `${parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Format seconds to ETA string
 * @param seconds - Time in seconds
 * @returns Formatted string (e.g., "5m 30s")
 */
export function formatEta(seconds?: number): string {
  if (!seconds || seconds < 0) return 'N/A'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}m ${secs}s`
}

/**
 * Strip size prefix from video title
 * Format: "[  2.62 GB  ] - Some Title" -> "Some Title"
 * @param title - Video title with optional size prefix
 * @returns Cleaned title without size prefix
 */
export function stripSizePrefix(title: string): string {
  // Pattern: [  XX.XX GB  ] - or [  XX.XX MB  ] - or [  X.XX GB  ] -
  const sizePrefixPattern = /^\[\s*[\d.]+\s*(GB|MB|KB)\s*\]\s*-\s*/
  return title.replace(sizePrefixPattern, '').trim()
}

/**
 * Format credits to CZK
 * @param credits - Number of credits
 * @returns Formatted string (e.g., "15.50 CZK")
 */
export function formatCreditsToCzk(credits: number): string {
  const czk = credits * 0.1 // 1 credit = 0.10 CZK
  return `${czk.toFixed(2)} CZK`
}
