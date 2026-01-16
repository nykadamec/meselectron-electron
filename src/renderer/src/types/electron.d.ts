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
  }) => Promise<{ success: boolean }>

  // Upload
  uploadStart: (options: {
    filePath: string
    cookies?: string
  }) => Promise<{ success: boolean }>

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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
