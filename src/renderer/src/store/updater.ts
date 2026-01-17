/**
 * Updater Store - Zustand store for app update management
 * Manages update state, download progress, and user interactions
 */

import { create } from 'zustand'

export type UpdaterStatus =
  | 'idle'           // No update check in progress
  | 'checking'       // Currently checking for updates
  | 'downloading'    // Downloading update
  | 'verifying'      // Verifying checksum/GPG
  | 'ready'          // Downloaded and ready to install
  | 'installing'     // Installing update
  | 'error'          // Error occurred

export interface DownloadProgress {
  downloadedBytes: number
  totalBytes: number
  percentage: number
  speedBytesPerSecond: number
  etaSeconds: number
}

export interface UpdaterState {
  // Status
  status: UpdaterStatus

  // Version info
  currentVersion: string
  latestVersion: string | null
  releaseNotes: string | null
  downloadUrl: string | null
  downloadSize: number | null  // in bytes

  // Progress
  downloadProgress: DownloadProgress | null
  verificationProgress: string | null

  // Error
  error: string | null

  // Settings
  autoCheck: boolean
  autoDownload: boolean  // Auto-download when update found

  // Actions
  setStatus: (status: UpdaterStatus) => void
  setLatestVersion: (version: string | null, releaseNotes: string | null, downloadUrl: string | null, downloadSize: number | null) => void
  setDownloadProgress: (progress: DownloadProgress | null) => void
  setVerificationProgress: (message: string | null) => void
  setError: (error: string | null) => void
  setAutoCheck: (enabled: boolean) => void
  setAutoDownload: (enabled: boolean) => void
  reset: () => void
}

const initialState = {
  status: 'idle' as UpdaterStatus,
  currentVersion: '',
  latestVersion: null as string | null,
  releaseNotes: null as string | null,
  downloadUrl: null as string | null,
  downloadSize: null as number | null,
  downloadProgress: null as DownloadProgress | null,
  verificationProgress: null as string | null,
  error: null as string | null,
  autoCheck: true,
  autoDownload: false
}

export const useUpdaterStore = create<UpdaterState>((set) => ({
  ...initialState,

  setStatus: (status) => set({ status, error: status === 'error' ? null : undefined }),

  setLatestVersion: (version, releaseNotes, downloadUrl, downloadSize) =>
    set({
      latestVersion: version,
      releaseNotes,
      downloadUrl,
      downloadSize,
      status: version ? 'ready' : 'idle'
    }),

  setDownloadProgress: (progress) =>
    set({ downloadProgress: progress, status: progress ? 'downloading' : 'ready' }),

  setVerificationProgress: (message) =>
    set({ verificationProgress: message, status: message ? 'verifying' : 'ready' }),

  setError: (error) => set({ error, status: error ? 'error' : 'idle' }),

  setAutoCheck: (enabled) => set({ autoCheck: enabled }),

  setAutoDownload: (enabled) => set({ autoDownload: enabled }),

  reset: () => set({
    ...initialState,
    currentVersion: useUpdaterStore.getState().currentVersion
  })
}))

// Helper functions for IPC communication
export async function checkForUpdates(): Promise<void> {
  const store = useUpdaterStore.getState()
  store.setStatus('checking')
  store.setError(null)

  try {
    const result = await window.electronAPI.updaterCheck()

    if (result.updateAvailable && result.asset) {
      store.setLatestVersion(
        result.latestVersion,
        result.release?.body || null,
        result.asset.browser_download_url,
        result.asset.size
      )

      // Auto-download if enabled
      if (store.autoDownload) {
        downloadUpdate()
      }
    } else {
      store.setStatus('idle')
      store.setLatestVersion(null, null, null, null)
    }
  } catch (err) {
    store.setError(err instanceof Error ? err.message : 'Failed to check for updates')
  }
}

export async function downloadUpdate(): Promise<void> {
  const store = useUpdaterStore.getState()

  if (!store.downloadUrl) {
    store.setError('No update URL available')
    return
  }

  store.setStatus('downloading')
  store.setError(null)

  // Set up progress listener
  const progressHandler = (_event: unknown, data: unknown) => {
    const progress = data as DownloadProgress
    store.setDownloadProgress(progress)
  }

  window.electronAPI.onUpdaterProgress(progressHandler)

  try {
    await window.electronAPI.updaterDownload(store.downloadUrl)

    // Download complete, start verification
    store.setDownloadProgress(null)
    store.setVerificationProgress('Verifying SHA-256 checksum...')

    const verifyResult = await window.electronAPI.updaterVerify()

    if (verifyResult.valid) {
      store.setVerificationProgress('Verification successful!')
      store.setStatus('ready')
    } else {
      store.setError(verifyResult.error || 'Verification failed')
    }
  } catch (err) {
    store.setError(err instanceof Error ? err.message : 'Download failed')
  } finally {
    window.electronAPI.removeListener('updater:progress', progressHandler)
  }
}

export async function installUpdate(): Promise<void> {
  const store = useUpdaterStore.getState()
  store.setStatus('installing')
  store.setError(null)

  try {
    await window.electronAPI.updaterInstall()
    // App will restart automatically
  } catch (err) {
    store.setError(err instanceof Error ? err.message : 'Installation failed')
    store.setStatus('ready')
  }
}

export function cancelUpdate(): Promise<void> {
  const store = useUpdaterStore.getState()
  window.electronAPI.updaterCancel()
  store.reset()
  return Promise.resolve()
}

export function dismissUpdate(): Promise<void> {
  const store = useUpdaterStore.getState()
  store.reset()
  return Promise.resolve()
}

// Initialize store with current version
export async function initUpdaterStore(): Promise<void> {
  try {
    const version = await window.electronAPI.updaterGetCurrentVersion()
    useUpdaterStore.setState({ currentVersion: version })

    // Auto-check on init if enabled
    if (useUpdaterStore.getState().autoCheck) {
      checkForUpdates()
    }
  } catch (err) {
    console.error('[Updater] Failed to initialize:', err)
  }
}
