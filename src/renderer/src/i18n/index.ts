// i18n Engine - Custom internationalization without external dependencies
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Locale = 'en' | 'cz'

interface LocaleState {
  locale: Locale
  translations: Record<string, string>
  loading: boolean
  error: string | null
  setLocale: (locale: Locale) => Promise<void>
  t: (key: string, params?: Record<string, string | number>) => string
  loadTranslations: (locale: Locale) => Promise<void>
}

// Simple YAML parser for flat key-value pairs
function parseYAML(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue

    // Parse key: value
    const colonIndex = trimmed.indexOf(':')
    if (colonIndex > 0) {
      const key = trimmed.slice(0, colonIndex).trim()
      let value = trimmed.slice(colonIndex + 1).trim()

      // Strip quotes from value if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }

      if (key && value) {
        result[key] = value
      }
    }
  }

  return result
}

// Detect system language
export function detectLocale(): Locale {
  const lang = navigator.language.toLowerCase()
  if (lang.startsWith('cs') || lang.startsWith('cz')) {
    return 'cz'
  }
  return 'en'
}

// Get locale file path based on environment
function getLocalePath(locale: Locale): string {
  // In production, locales are bundled with the app
  // In development, they're in the project root
  if (process.env.NODE_ENV === 'production') {
    // Use the app's resources path
    return `locales/${locale}.yaml`
  }
  // In development, use relative path from renderer
  return `../../locales/${locale}.yaml`
}

// Default fallback translations (English)
const fallbackTranslations: Record<string, string> = {
  // Header
  'header.title': 'Prehraj.to AutoPilot',
  'header.subtitle': 'Automated downloading and uploading',
  'header.processing': 'Processing...',
  'header.checkUpdates': 'Checking for updates',
  'header.settings': 'Settings',
  'header.minimize': 'Minimize',

  // Footer
  'footer.lang': 'LANG : {lang} | BUILD : {build}',

  // Stats
  'stats.totalUploaded': 'Total uploaded',
  'stats.totalDownloaded': 'Total downloaded',
  'stats.activeAccounts': 'Active accounts',
  'stats.queueLength': 'In queue',
  'stats.earnings': 'Earnings',

  // Video Status
  'video.pending': 'Pending',
  'video.downloading': 'Downloading',
  'video.processing': 'Processing',
  'video.uploading': 'Uploading',
  'video.completed': 'Completed',
  'video.failed': 'Failed',
  'video.alreadyExists': 'Already exists',
  'video.skipped': 'Skipped',

  // Queue Status
  'queue.active': 'Processing',
  'queue.completed': 'Completed',
  'queue.failed': 'Failed',
  'queue.paused': 'Paused',
  'queue.pending': 'Pending',
  'queue.downloadPhase': '↓ Downloading',
  'queue.uploadPhase': '↑ Uploading',
  'queue.assembling': '↓ Assembling chunks',

  // Settings
  'settings.title': 'Settings',
  'settings.subtitle': 'Application configuration',
  'settings.general': 'General',
  'settings.parallelism': 'Parallelism',
  'settings.download': 'Download',
  'settings.speed': 'Speed',
  'settings.updates': 'Updates',
  'settings.autoRestart': 'Auto restart',
  'settings.autoRestartDesc': 'Restart app after completing all tasks',
  'settings.downloadConcurrency': 'Download concurrency: {count}',
  'settings.uploadConcurrency': 'Upload concurrency: {count}',
  'settings.videoCount': 'Videos to download: {count}',
  'settings.addWatermark': 'Add watermark',
  'settings.addWatermarkDesc': 'Add "prehrajto.cz" text to video',
  'settings.hqProcessing': 'HQ Processing',
  'settings.hqProcessingDesc': 'If HQ Processing is on, process will prioritize original video links + quality',
  'settings.downloadMode': 'Download mode',
  'settings.ffmpegChunks': 'FFmpeg Chunks (parallel)',
  'settings.curl': 'cURL',
  'settings.wget': 'wget',
  'settings.downloadModeDesc': 'cURL/wget will download the entire file at once',
  'settings.outputDir': 'Output folder',
  'settings.browse': 'Browse',
  'settings.outputDirDesc': 'Downloaded videos will be saved here',
  'settings.noSpeedLimit': 'No speed limit',
  'settings.noSpeedLimitDesc': 'Faster downloads on fast disks',
  'settings.autoCheck': 'Auto check',
  'settings.autoCheckDesc': 'Check for new versions on app startup',
  'settings.autoDownload': 'Auto download',
  'settings.autoDownloadDesc': 'Download update immediately when found',
  'settings.version': 'App version',
  'settings.checkUpdates': 'Check for updates',
  'settings.save': 'Save settings',
  'settings.saved': 'Saved!',
  'settings.resetDefaults': 'Reset to defaults',

  // Errors
  'error.generic': 'Error',
  'error.loading': 'Error loading',
  'error.noCookies': 'No cookies provided - please log in first',
  'error.loginFailed': 'Login failed',
  'error.noCredentials': 'Email and password required',
  'error.noAccountId': 'Account ID required',
  'error.noCredentialsFound': 'No credentials found',
  'error.refreshFailed': 'Refresh failed',
  'error.noCookiesAvailable': 'No cookies available',
  'error.videoTooSmall': 'Video is too small ({size}MB, minimum is {min}MB)',
  'error.videoTooLarge': 'Video is too large ({size}MB, maximum is {max}MB)',
  'error.metadataExtract': 'Metadata extraction error: {error}',
  'error.noVideoUrl': 'Could not find video URL on page',
  'error.noFileSize': 'Could not determine file size',
  'error.rangeNotSupported': 'Server does not support chunked downloading',
  'error.videoExists': 'Video already exists',
  'error.uploadFailed': 'Failed to upload to CDN after 5 attempts',
  'error.unknownUpload': 'Unknown upload error',
  'error.nonJsonResponse': 'Server returned {type} instead of JSON - probably requires login',
  'error.checkCookies': 'Check cookie validity and log in again on prehrajto.cz',
  'error.sessionExpired': 'Session expired',
  'error.sessionInvalid': 'Session invalid',

  // Progress
  'progress.checkingUpdates': 'Checking for updates...',
  'progress.downloading': 'Downloading update...',
  'progress.verifying': 'Verifying...',
  'progress.verifyingChecksum': 'Verifying SHA-256 checksum...',
  'progress.verificationSuccess': 'Verification successful!',
  'progress.downloadingUpdate': 'Downloading...',
  'progress.downloaded': 'Downloaded',
  'progress.speed': 'Speed',
  'progress.remaining': 'Remaining: {eta}',
  'progress.updateReady': 'Update ready',
  'progress.installing': 'Installing update...',
  'progress.install': 'Install and restart',
  'progress.later': 'Later',
  'progress.retry': 'Retry',

  // Discover
  'progress.discoverStart': 'Starting video search...',
  'progress.scanning': 'Scanning page {page}/10 ({name})...',
  'progress.foundCandidates': 'Found {count} video candidates',
  'progress.loadingVideos': 'Loading videos (page {page})...',

  // Queue
  'queue.title': 'Queue',
  'queue.empty': 'Empty queue',
  'queue.addFromVideos': 'Add videos from "Videos" tab',
  'queue.cancel': 'Cancel download',
  'queue.remove': 'Remove from queue',
  'queue.pause': 'Pause',
  'queue.resume': 'Resume',
  'queue.retry': 'Retry ({count})',
  'queue.retryFailed': 'Retry ({count})',
  'queue.cancelQueue': 'Cancel queue',
  'queue.stats': '{pending} pending | {failed} failed',

  // Actions
  'actions.refresh': 'Refresh',
  'actions.selectAll': 'Select all',
  'actions.deselectAll': 'Deselect all',
  'actions.process': 'Process ({count})',
  'actions.back': 'Back',
  'actions.next': 'Load more',
  'actions.endOfList': 'End of list',

  // Empty states
  'empty.videos': 'No videos',
  'empty.loadVideos': 'Click "Refresh" to load videos',
  'empty.noNewVideos': 'No new videos',
  'empty.logs': 'No logs',
  'empty.myVideos': 'No videos to display',
  'empty.myVideosHelp': 'Click "Load videos" button to display your uploaded videos',

  // Accounts
  'accounts.addAccount': 'Add account',
  'accounts.email': 'Email',
  'accounts.password': 'Password',
  'accounts.login': 'Login',
  'accounts.logout': 'Logout',
  'accounts.active': 'Active',
  'accounts.inactive': 'Inactive',
  'accounts.status': 'Status',
  'accounts.connected': 'Connected',
  'accounts.disconnected': 'Disconnected',
}

// Load translations from file
async function loadTranslationsFromFile(locale: Locale): Promise<Record<string, string>> {
  try {
    // Try to load via window.electronAPI if available (Electron environment)
    if (typeof window !== 'undefined' && window.electronAPI?.readLocaleFile) {
      const content = await window.electronAPI.readLocaleFile(locale)
      if (content) {
        return parseYAML(content)
      }
    }
  } catch {
    // Fall through to next method
  }

  try {
    // Try to load via fetch
    const path = getLocalePath(locale)
    const response = await fetch(path)
    if (response.ok) {
      const content = await response.text()
      return parseYAML(content)
    }
  } catch {
    // Fall through to fallback
  }

  // Return fallback translations
  console.warn(`[i18n] Failed to load ${locale}.yaml, using fallback`)
  return fallbackTranslations
}

// Zustand store for i18n
export const useLocaleStore = create<LocaleState>()(
  persist(
    (set, get) => ({
      locale: 'en',
      translations: fallbackTranslations,
      loading: false,
      error: null,

      setLocale: async (locale: Locale) => {
        set({ loading: true, error: null })
        try {
          const translations = await loadTranslationsFromFile(locale)
          set({ locale, translations, loading: false })
          console.log(`[i18n] Switched to ${locale}`)
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Unknown error', loading: false })
        }
      },

      t: (key: string, params?: Record<string, string | number>) => {
        const { translations } = get()
        let text = translations[key] || fallbackTranslations[key] || key

        // Replace parameters
        if (params) {
          for (const [param, value] of Object.entries(params)) {
            text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), String(value))
          }
        }

        return text
      },

      loadTranslations: async (locale: Locale) => {
        set({ loading: true, error: null })
        try {
          const translations = await loadTranslationsFromFile(locale)
          set({ locale, translations, loading: false })
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Unknown error', loading: false })
        }
      },
    }),
    {
      name: 'locale-storage',
      partialize: (state) => ({ locale: state.locale }),
    }
  )
)

// Initialize i18n with system language
export async function initI18n(): Promise<void> {
  const locale = detectLocale()
  await useLocaleStore.getState().loadTranslations(locale)
}

// Get current locale
export function getCurrentLocale(): Locale {
  return useLocaleStore.getState().locale
}

// Translation helper for use outside React components
export function t(key: string, params?: Record<string, string | number>): string {
  return useLocaleStore.getState().t(key, params)
}
