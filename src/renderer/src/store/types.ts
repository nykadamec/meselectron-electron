/**
 * Shared types for Zustand stores
 */

// Video status type - shared across all stores
export type VideoStatus =
  | 'pending'
  | 'downloading'
  | 'processing'
  | 'uploading'
  | 'completed'
  | 'failed'
  | 'already-exists'
  | 'skipped'

// Queue status type
export type QueueStatus = 'pending' | 'active' | 'completed' | 'failed' | 'paused'

// Task status for any background operation
export type TaskStatus = 'idle' | 'running' | 'completed' | 'failed'

// Common video interface
export interface Video {
  id: string
  title: string
  url: string
  thumbnail?: string
  size?: number
  duration?: number
  status: VideoStatus
  progress: number
  speed?: number
  eta?: number
  accountId?: string
  error?: string
  path?: string
}

// Common queue item interface
export interface QueueItem {
  id: string
  type: 'download' | 'upload'
  video: Video
  accountId: string
  status: QueueStatus
  priority: number
  cookies?: string
  error?: string
  size?: number
  speed?: number
  eta?: number
  progress?: number
  phase?: 'download' | 'upload'
  subPhase?: 'downloading' | 'assembling' | 'watermarking'
  uploadProgress?: number
  statusMessage?: string
  addedAt: Date
  startedAt?: Date
  completedAt?: Date
}

// Video candidate from discovery
export interface VideoCandidate {
  url: string
  title: string
  duration?: string
  thumbnail?: string
  size?: number
}

// Common log interface
export interface LogMessage {
  id: string
  timestamp: Date
  level: 'info' | 'success' | 'warning' | 'error'
  message: string
  source?: string
}

// UI tab types
export type AppTab = 'videos' | 'downloads' | 'logs' | 'settings' | 'myvideos'

// Global stats interface
export interface GlobalStats {
  totalUploaded: number
  totalDownloaded: number
  totalEarnings: number
  activeAccounts: number
  queueLength: number
}
