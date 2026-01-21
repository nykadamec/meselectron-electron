/**
 * Application constants
 * Centralizes magic numbers and configuration values used throughout the application
 */

// Window dimensions
export const WINDOW_WIDTH = 1280
export const WINDOW_HEIGHT = 800
export const WINDOW_MIN_WIDTH = 1024
export const WINDOW_MIN_HEIGHT = 600

// Timeouts (in milliseconds)
export const TIMEOUT_SHORT = 5000
export const TIMEOUT_MEDIUM = 15000
export const TIMEOUT_LONG = 30000
export const TIMEOUT_EXTRA_LONG = 60000
export const TIMEOUT_SESSION_WORKER = 30000

// Download settings
export const DEFAULT_DOWNLOAD_CONCURRENCY = 2
export const DEFAULT_UPLOAD_CONCURRENCY = 2
export const DEFAULT_VIDEO_COUNT = 20

// Chunk settings
export const CHUNK_SIZE = 1024 * 1024 // 1MB chunks
export const MIN_VIDEO_SIZE_MB = 300
export const MAX_VIDEO_SIZE_MB = 20480 // 20GB

// Credits configuration
export const CREDITS_TO_CZK_RATIO = 0.1 // 1 credit = 0.10 CZK
export const CREDITS_EARNINGS_RATIO = 300 / 1000 // 1000 credits = 300 Kč

// Discovery settings
export const DISCOVERY_BUFFER_MULTIPLIER = 3
export const DISCOVERY_PAGES_PER_CATEGORY = 10
export const DISCOVERY_RATE_LIMIT_MS = 500

// Worker paths (relative to build output)
export const WORKER_DOWNLOAD_PATH = '../workers/download.worker.js'
export const WORKER_UPLOAD_PATH = '../workers/upload.worker.js'
export const WORKER_DISCOVER_PATH = '../workers/discover.worker.js'
export const WORKER_MYVIDEOS_PATH = '../workers/myvideos.worker.js'
export const WORKER_SESSION_PATH = '../workers/session.worker.js'

// File extensions
export const VIDEO_EXTENSIONS = ['mp4', 'avi', 'mkv', 'mov', 'webm']
export const COOKIE_FILE_EXTENSION = '.dat'

// Update download settings
export const UPDATE_DIR = 'updates'
export const CHECKSUMS_SUFFIX = '-checksums.txt'

// File naming
export const DEFAULT_VIDEO_DIR = 'meselectron'
export const MAX_FILENAME_LENGTH = 100
export const MAX_COOKIE_NAME_LENGTH = 50

// Session settings
export const SESSION_EXPIRY_DAYS = 30
export const SESSION_EXPIRY_MS = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000 // 30 days

// Size constants
export const GB_TO_BYTES = 1024 * 1024 * 1024
export const MB_TO_BYTES = 1024 * 1024
export const KB_TO_BYTES = 1024

// API URLs
export const PREHRAJTO_BASE_URL = 'https://prehrajto.cz'
export const PREHRAJTO_PROVIZE_URL = `${PREHRAJTO_BASE_URL}/provize/`

// Worker timeout settings (in milliseconds)
export const IPC_TIMEOUT_MS = 30000
export const DOWNLOAD_TIMEOUT_MS = 120000
export const STREAMING_TIMEOUT_MS = 600000 // 10 minutes
export const WORKER_GENERIC_TIMEOUT_MS = 120000
