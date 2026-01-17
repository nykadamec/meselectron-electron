// Type declarations for electron API exposed via preload
interface ElectronAPI {
  // Settings
  settingsRead: () => Promise<{
    autoReset: boolean
    downloadConcurrency: number
    uploadConcurrency: number
    videoCount: number
    nospeed: boolean
    addWatermark: boolean
    outputDir: string
    downloadMode: string
    hqProcessing: boolean
  }>
  settingsWrite: (settings: Record<string, unknown>) => Promise<boolean>

  // Accounts
  accountsList: () => Promise<Array<{
    id: string
    email: string
    cookiesFile: string
    isActive: boolean
    lastUsed?: Date
  }>>
  accountsReadCookies: (accountId: string) => Promise<string | null>
  accountsGetCredits: (accountId: string) => Promise<number | null>

  // Files
  filesSelectUpload: () => Promise<string[]>
  filesOpenFolder: (folderPath: string) => Promise<string>
  fileSelectOutput: () => Promise<string | null>
  fileEnsureDir: (dirPath: string) => Promise<boolean>

  // FFmpeg
  ffmpegGetPath: () => Promise<string | null>

  // Version
  versionCheck: () => Promise<{
    remoteVersion: string | null
    needsUpdate?: boolean
    error?: string
  }>
  versionGet: () => Promise<string | null>
  nameGet: () => Promise<string>

  // Platform
  platformInfo: () => Promise<{
    platform: string
    arch: string
    userDataPath: string
    appPath: string
  }>

  // Download
  downloadStart: (options: {
    url: string
    outputPath?: string
    cookies?: string
    videoId?: string
    maxConcurrent?: number
    addWatermark?: boolean
    ffmpegPath?: string
    hqProcessing?: boolean
  }) => Promise<{ success: boolean }>
  downloadStop: () => void

  // Processed videos persistence
  processedRead: () => Promise<Array<{ url: string; status: string; timestamp: string }>>
  processedWrite: (items: Array<{ url: string; status: string; timestamp: string }>) => Promise<boolean>

  // Upload
  uploadStart: (options: {
    filePath: string
    cookies?: string
  }) => Promise<{ success: boolean }>
  uploadStop: () => void

  // Video Discovery
  discoverStart: (options: {
    cookies: string
    count: number
  }) => Promise<{ success: boolean }>

  // My Videos
  myVideosLoad: (options: {
    cookies: string
    page: number
  }) => Promise<{ success: boolean }>
  onMyVideosProgress: (callback: (event: unknown, data: unknown) => void) => void

  // Event listeners
  onDownloadProgress: (callback: (event: unknown, data: unknown) => void) => void
  onUploadProgress: (callback: (event: unknown, data: unknown) => void) => void
  onDiscoverProgress: (callback: (event: unknown, data: unknown) => void) => void
  onLogMessage: (callback: (event: unknown, data: unknown) => void) => void

  // Remove listeners
  removeListener: (channel: string, callback: (...args: unknown[]) => void) => void

  // Updater
  updaterCheck: () => Promise<{
    updateAvailable: boolean
    latestVersion: string | null
    release: {
      tag_name: string
      name: string
      published_at: string
      body: string
      html_url: string
      assets: Array<{
        name: string
        browser_download_url: string
        size: number
        content_type: string
      }>
    } | null
    asset: {
      name: string
      browser_download_url: string
      size: number
      content_type: string
    } | null
  }>
  updaterDownload: (url: string) => Promise<void>
  updaterInstall: () => Promise<void>
  updaterCancel: () => void
  updaterClear: () => Promise<void>
  updaterGetCurrentVersion: () => Promise<string>
  updaterGetProgress: () => Promise<{
    downloadedBytes: number
    totalBytes: number
    percentage: number
    speedBytesPerSecond: number
    etaSeconds: number
  } | null>
  onUpdaterProgress: (callback: (event: unknown, data: unknown) => void) => void

  // i18n
  readLocaleFile: (locale: 'en' | 'cz') => Promise<string>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
