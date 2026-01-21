/**
 * Zustand Store Index
 * Exports all store slices for modular state management
 *
 * useAppStore - Main store for App.tsx coordination (tabs, logs, stats, discovery, accounts, settings)
 * useQueueStore - Queue state and operations
 * useVideoStore - Video discovery state
 * useAccountStore - Accounts state
 * useSettingsStore - Settings state
 * useProcessedStore - Processed videos tracking
 * useMyVideosStore - My videos list
 */

// Import types first
export * from './types'

// Main app store (coordinates UI state, discovery, accounts, settings)
export { useAppStore } from './useAppStore'

// Legacy alias - useUIStore points to useAppStore
export { useAppStore as useUIStore } from './useAppStore'

// Queue store - manages download/upload queue
export { useQueueStore, createQueueItem, createVideo } from './useQueueStore'

// Settings store - manages application settings
export { useSettingsStore } from './useSettingsStore'

// Video store - manages video discovery state
export { useVideoStore } from './useVideoStore'

// Account store - manages user accounts
export { useAccountStore } from './useAccountStore'

// My Videos store - manages uploaded videos list
export { useMyVideosStore } from './useMyVideosStore'

// Processed store - tracks already processed video URLs
export { useProcessedStore } from './useProcessedStore'

// Processed video persistence helpers
let saveTimeout: ReturnType<typeof setTimeout> | null = null
let autosaveUnsubscribe: (() => void) | null = null

async function saveProcessedToDisk() {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }
  saveTimeout = setTimeout(async () => {
    // Lazy import to avoid circular dependency issues
    const { useAppStore } = await import('./useAppStore')
    const { processedVideoUrls } = useAppStore.getState()
    const items: { url: string; status: string; timestamp: string }[] = []
    processedVideoUrls.forEach(url => {
      items.push({
        url,
        status: 'completed',
        timestamp: new Date().toISOString()
      })
    })
    try {
      await window.electronAPI.processedWrite(items)
    } catch (err) {
      console.error('[Store] Failed to save processed videos:', err)
    }
  }, 500)
}

export async function loadProcessedFromDisk() {
  try {
    // Lazy import to avoid circular dependency issues
    const { useAppStore } = await import('./useAppStore')
    const { useProcessedStore } = await import('./useProcessedStore')
    const items = await window.electronAPI.processedRead()
    const newSet = new Set<string>()
    items.forEach(item => newSet.add(item.url))
    useAppStore.getState().setProcessedVideos(newSet)
    useProcessedStore.getState().setUrls(newSet)
  } catch (err) {
    console.error('[Store] Failed to load processed videos:', err)
  }
}

// Export saveProcessedToDisk for calling after addProcessedUrl
export { saveProcessedToDisk }

export async function setOnQueueChange(callback: () => void) {
  console.warn('[Store] setOnQueueChange is deprecated. Use useQueueStore.setProcessQueueCallback instead.')
  const { useQueueStore } = await import('./useQueueStore')
  useQueueStore.getState().setProcessQueueCallback(callback)
}
