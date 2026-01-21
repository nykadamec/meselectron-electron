/**
 * Path utilities for workers
 */

import path from 'path'

/**
 * Get project root directory
 * Uses OS-specific user data path: %APPDATA%\prehrajto-autopilot (Windows) or ~/Library/Application Support/prehrajto-autopilot (macOS)
 */
export function getProjectRoot(): string {
  const userDataPath = process.env.APPDATA || path.join(process.env.HOME || '', 'Library/Application Support')
  return path.join(userDataPath, 'prehrajto-autopilot')
}
