/**
 * Updater State Management
 * Centralized state for the updater module
 */

import { BrowserWindow } from 'electron'

export interface ReleaseInfo {
  version: string
  name: string
  publishedAt: string
  body: string
  downloadUrl: string
  fileSize: number
}

export type UpdaterStatus =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'verifying'
  | 'ready'
  | 'installing'
  | 'error'

export interface UpdaterState {
  status: UpdaterStatus
  currentVersion: string
  latestVersion: string | null
  downloadProgress: number
  downloadedBytes: number
  totalBytes: number
  speed: number
  eta: number
  error: string | null
  releaseInfo: ReleaseInfo | null
}

// Singleton state
let state: UpdaterState = {
  status: 'idle',
  currentVersion: '0.0.0',
  latestVersion: null,
  downloadProgress: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  speed: 0,
  eta: 0,
  error: null,
  releaseInfo: null
}

// Download cancellation callback
let downloadCancellation: (() => void) | null = null

/**
 * Get current updater state
 */
export function getUpdaterState(): UpdaterState {
  return state
}

/**
 * Update state and notify all windows
 */
export function setUpdaterState(updates: Partial<UpdaterState>): void {
  Object.assign(state, updates)
  notifyStateChange()
}

/**
 * Broadcast state change to all renderer windows
 */
export function notifyStateChange(): void {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('updater:state', state)
  })
}

/**
 * Get the update directory path
 */
export function getUpdateDir(): string {
  // Lazy import to avoid circular dependencies
  const { getUserDataPath } = require('../../utils/paths')
  const path = require('path')
  return path.join(getUserDataPath(), 'prehrajto-autopilot', 'updates')
}

/**
 * Set download cancellation callback
 */
export function setDownloadCancellation(cancel: (() => void) | null): void {
  downloadCancellation = cancel
}

/**
 * Get download cancellation callback
 */
export function getDownloadCancellation(): (() => void) | null {
  return downloadCancellation
}

/**
 * Reset state to idle
 */
export function resetToIdle(): void {
  state.status = 'idle'
  state.downloadProgress = 0
  state.downloadedBytes = 0
  state.error = null
  notifyStateChange()
}

/**
 * Clear release info
 */
export function clearReleaseInfo(): void {
  state.releaseInfo = null
  state.latestVersion = null
}
