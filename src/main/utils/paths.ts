/**
 * Path utilities for the application
 * Handles OS-specific path resolution for user data and app data
 */

import path from 'path'

/**
 * Get user data path (OS-specific)
 * Windows: %APPDATA%
 * macOS: ~/Library/Application Support
 * Linux: ~/.config
 */
export function getUserDataPath(): string {
  return process.env.APPDATA || path.join(process.env.HOME || '', 'Library/Application Support')
}

/**
 * Get app-specific data path for persistence
 * Creates a subdirectory within user data path
 */
export function getAppDataPath(): string {
  return path.join(getUserDataPath(), 'prehrajto-autopilot')
}

/**
 * Get the path to the project root (where DATA folder is located)
 * Uses OS-specific user data path: %APPDATA%\prehrajto-autopilot (Windows) or ~/Library/Application Support/prehrajto-autopilot (macOS)
 */
export function getProjectRoot(): string {
  return getAppDataPath()
}
