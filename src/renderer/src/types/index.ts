// Account types
export interface Account {
  id: string
  email: string
  cookiesFile: string
  isActive: boolean
  lastUsed?: Date
  uploadedToday?: number
  monthlyQuota?: number
  credits?: number
}

// Settings types
export type DownloadMode = 'ffmpeg-chunks' | 'curl' | 'wget'

export interface Settings {
  autoReset: boolean
  downloadConcurrency: number
  uploadConcurrency: number
  videoCount: number
  nospeed: boolean
  addWatermark: boolean
  outputDir: string
  downloadMode: DownloadMode
  hqProcessing: boolean
}

// Download configuration
export interface DownloadConfig {
  maxConcurrent: number
  maxUpload: number
  addWatermark: boolean
  outputDir: string
}

// Video metadata from prehrajto.cz
export interface VideoMetadata {
  mp4Url: string
  fileSize: number
  title: string
  thumbnail?: string
}

// Video candidate from discovery
export interface VideoCandidate {
  url: string
  title: string
  duration?: string
  thumbnail?: string
}

// Discovery state
export interface DiscoveryState {
  isDiscovering: boolean
  candidates: VideoCandidate[]
  selectedCandidates: string[] // URLs
  progress: number
  message: string
}

// Video types
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
}

export type VideoStatus =
  | 'pending'
  | 'downloading'
  | 'processing'
  | 'uploading'
  | 'completed'
  | 'failed'
  | 'already-exists'
  | 'skipped'

// Queue types
export interface QueueItem {
  id: string
  type: 'download' | 'upload'
  video: Video
  accountId: string
  status: 'pending' | 'active' | 'completed' | 'failed' | 'paused'
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

// Log types
export interface LogMessage {
  id: string
  timestamp: Date
  level: 'info' | 'success' | 'warning' | 'error'
  message: string
  source?: string
}

// Stats types
export interface DailyStats {
  date: string
  uploadedCount: number
  downloadedCount: number
  totalSize: number
  earnings: number
}

export interface GlobalStats {
  totalUploaded: number
  totalDownloaded: number
  totalEarnings: number
  activeAccounts: number
  queueLength: number
}

// My Videos types
export interface MyVideo {
  id: string
  title: string
  thumbnail?: string
  views: number
  addedAt: string // ISO date string
  url: string
  size?: string
  downloadsPremium?: number
  downloadsTotal?: number
  likes?: number
  dislikes?: number
}

export interface MyVideosResponse {
  videos: MyVideo[]
  hasMore: boolean
  total: number
  page: number
}

// Platform types
export interface PlatformInfo {
  platform: string
  arch: string
  userDataPath: string
  appPath: string
}
