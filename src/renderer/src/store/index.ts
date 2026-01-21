import { create } from 'zustand'
import type { Account, Settings, Video, QueueItem, LogMessage, GlobalStats, VideoCandidate, MyVideo } from '../types'

// Processed video persistence helpers
let saveTimeout: ReturnType<typeof setTimeout> | null = null

function saveProcessedToDisk() {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }
  saveTimeout = setTimeout(async () => {
    const state = useAppStore.getState()
    const items: { url: string; status: string; timestamp: string }[] = []
    state.processedVideoUrls.forEach(url => {
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
  }, 500) // Debounce - wait 500ms after last change
}

export async function loadProcessedFromDisk() {
  try {
    const items = await window.electronAPI.processedRead()
    const state = useAppStore.getState()
    const newSet = new Set<string>()
    items.forEach(item => newSet.add(item.url))
    state.setProcessedVideos(newSet)
  } catch (err) {
    console.error('[Store] Failed to load processed videos:', err)
  }
}

// Global callback for queue changes - set by App.tsx
let onQueueChangeCallback: (() => void) | null = null
export const setOnQueueChange = (callback: () => void) => {
  onQueueChangeCallback = callback
}

interface AppState {
  // Accounts
  accounts: Account[]
  activeAccountId: string | null
  setAccounts: (accounts: Account[]) => void
  setActiveAccount: (accountId: string) => void
  updateAccount: (accountId: string, updates: Partial<Account>) => void

  // Settings
  settings: Settings
  setSettings: (settings: Settings) => void

  // Videos
  videos: Video[]
  setVideos: (videos: Video[]) => void
  addVideo: (video: Video) => void
  updateVideo: (videoId: string, updates: Partial<Video>) => void
  removeVideo: (videoId: string) => void
  clearVideos: () => void

  // Video Discovery
  videoCandidates: VideoCandidate[]
  selectedCandidates: string[]
  isDiscovering: boolean
  discoverProgress: number
  discoverMessage: string
  setVideoCandidates: (candidates: VideoCandidate[]) => void
  toggleCandidate: (url: string) => void
  selectAllCandidates: () => void
  clearCandidates: () => void
  setDiscovering: (isDiscovering: boolean, progress?: number, message?: string) => void

  // Queue
  queue: QueueItem[]
  addToQueue: (item: QueueItem) => void
  updateQueueItem: (itemId: string, updates: Partial<QueueItem>) => void
  removeFromQueue: (itemId: string) => void
  removeFromQueueByVideoId: (videoId: string) => void
  deleteFromQueue: (itemId: string) => Promise<void>
  reorderQueue: (newQueue: QueueItem[]) => void
  clearQueue: () => void
  getNextPendingItem: () => QueueItem | null
  getPendingCount: () => number
  getActiveItem: () => QueueItem | null
  isQueuePaused: boolean
  pauseQueue: () => void
  resumeQueue: () => void
  retryFailedItems: () => void

  // Logs
  logs: LogMessage[]
  addLog: (log: LogMessage) => void
  clearLogs: () => void

  // Stats
  stats: GlobalStats
  updateStats: (updates: Partial<GlobalStats>) => void

  // UI State
  activeTab: 'videos' | 'downloads' | 'logs' | 'settings' | 'myvideos'
  setActiveTab: (tab: 'videos' | 'downloads' | 'logs' | 'settings' | 'myvideos') => void

  // My Videos
  myVideos: MyVideo[]
  myVideosPage: number
  myVideosHasMore: boolean
  myVideosSearchQuery: string
  setMyVideosSearchQuery: (query: string) => void
  isLoadingMyVideos: boolean
  myVideosError: string | null
  setMyVideos: (videos: MyVideo[], hasMore: boolean) => void
  addMyVideos: (videos: MyVideo[], hasMore: boolean) => void
  loadMyVideos: (page: number, cookies: string) => Promise<void>
  clearMyVideos: () => void
  deleteMyVideo: (videoId: string, cookies: string) => Promise<void>
  isProcessing: boolean
  setIsProcessing: (processing: boolean) => void

  // Processed Videos Tracking
  processedVideoUrls: Set<string>
  addProcessedUrl: (url: string) => void
  setProcessedVideos: (urls: Set<string>) => void
  isVideoProcessed: (url: string) => boolean
  clearProcessedVideos: () => void
}

export const useAppStore = create<AppState>((set) => ({
  // Video Discovery - default values and actions
  videoCandidates: [],
  selectedCandidates: [],
  isDiscovering: false,
  discoverProgress: 0,
  discoverMessage: '',
  setVideoCandidates: (candidates) => set({ videoCandidates: candidates }),
  toggleCandidate: (url) =>
    set((state) => ({
      selectedCandidates: state.selectedCandidates.includes(url)
        ? state.selectedCandidates.filter((u) => u !== url)
        : [...state.selectedCandidates, url]
    })),
  selectAllCandidates: () =>
    set((state) => ({
      selectedCandidates: state.videoCandidates.map((c) => c.url)
    })),
  clearCandidates: () =>
    set({
      videoCandidates: [],
      selectedCandidates: [],
      discoverProgress: 0,
      discoverMessage: ''
    }),
  setDiscovering: (isDiscovering, progress = 0, message = '') =>
    set({ isDiscovering, discoverProgress: progress, discoverMessage: message }),

  // Accounts
  accounts: [],
  activeAccountId: null,
  setAccounts: (accounts) => set({ accounts }),
  setActiveAccount: (accountId) => set({ activeAccountId: accountId }),
  updateAccount: (accountId, updates) =>
    set((state) => ({
      accounts: state.accounts.map((acc) =>
        acc.id === accountId ? { ...acc, ...updates } : acc
      )
    })),

  // Settings - will be overwritten by IPC settings:read on init
  settings: {
    autoReset: true,
    downloadConcurrency: 2,
    uploadConcurrency: 2,
    videoCount: 20,
    nospeed: false,
    addWatermark: true,
    outputDir: '',
    downloadMode: 'ffmpeg-chunks',
    hqProcessing: true
  },
  setSettings: (settings) => set({ settings }),

  // Videos
  videos: [],
  setVideos: (videos: Video[]) => set({ videos }),
  addVideo: (video) => set((state) => ({ videos: [...state.videos, video] })),
  updateVideo: (videoId, updates) =>
    set((state) => ({
      videos: state.videos.map((vid) =>
        vid.id === videoId ? { ...vid, ...updates } : vid
      )
    })),
  removeVideo: (videoId) =>
    set((state) => ({
      videos: state.videos.filter((vid) => vid.id !== videoId)
    })),
  clearVideos: () => set({ videos: [] }),

  // Queue
  queue: [],
  addToQueue: (item) => set((state) => ({ queue: [...state.queue, item] })),
  updateQueueItem: (itemId, updates) =>
    set((state) => ({
      queue: state.queue.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      )
    })),
  removeFromQueue: (itemId) =>
    set((state) => ({
      queue: state.queue.filter((item) => item.id !== itemId)
    })),
  removeFromQueueByVideoId: (videoId) =>
    set((state) => ({
      queue: state.queue.filter((item) => item.video.id !== videoId)
    })),
  deleteFromQueue: async (itemId) => {
    const state = useAppStore.getState()
    const item = state.queue.find((i) => i.id === itemId)

    if (!item) return

    // Pokud existuje cesta k souboru, smazat fyzický soubor
    if (item.video.path && window.electronAPI) {
      try {
        const fs = await import('fs/promises')
        await fs.unlink(item.video.path)
        state.addLog({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          level: 'info',
          message: `Soubor smazán: ${item.video.title}`,
          source: 'queue'
        })
      } catch (error) {
        state.addLog({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          level: 'warning',
          message: `Nepodařilo se smazat soubor ${item.video.title}: ${error}`,
          source: 'queue'
        })
      }
    }

    // Odebrat z fronty
    state.removeFromQueue(itemId)
  },
  reorderQueue: (newQueue) =>
    set({ queue: newQueue }),
  clearQueue: () => set({ queue: [] }),
  getNextPendingItem: () => {
    const state = useAppStore.getState()
    return state.queue.find(item => item.status === 'pending') || null
  },
  getPendingCount: () => {
    const state = useAppStore.getState()
    return state.queue.filter(item => item.status === 'pending').length
  },
  getActiveItem: () => {
    const state = useAppStore.getState()
    return state.queue.find(item => item.status === 'active') || null
  },
  isQueuePaused: false,
  pauseQueue: () => set({ isQueuePaused: true }),
  resumeQueue: () => set({ isQueuePaused: false }),
  retryFailedItems: () =>
    set((state) => ({
      queue: state.queue.map(item =>
        item.status === 'failed' ? { ...item, status: 'pending' } : item
      )
    })),
  triggerQueueProcess: () => {
    // Call the global callback set by App.tsx
    if (onQueueChangeCallback) {
      onQueueChangeCallback()
    }
  },

  // Logs
  logs: [],
  addLog: (log) => set((state) => ({ logs: [log, ...state.logs].slice(0, 1000) })),
  clearLogs: () => set({ logs: [] }),

  // Stats
  stats: {
    totalUploaded: 0,
    totalDownloaded: 0,
    totalEarnings: 0,
    activeAccounts: 0,
    queueLength: 0
  },
  updateStats: (updates) =>
    set((state) => ({ stats: { ...state.stats, ...updates } })),

  // UI State
  activeTab: 'downloads',
  setActiveTab: (tab) => set({ activeTab: tab }),
  isProcessing: false,
  setIsProcessing: (processing) => set({ isProcessing: processing }),

  // My Videos
  myVideos: [],
  myVideosPage: 1,
  myVideosHasMore: true,
  myVideosSearchQuery: '',
  setMyVideosSearchQuery: (query) => set({ myVideosSearchQuery: query }),
  isLoadingMyVideos: false,
  myVideosError: null,
  setMyVideos: (videos, hasMore) =>
    set({
      myVideos: videos,
      myVideosHasMore: hasMore,
      isLoadingMyVideos: false,
      myVideosError: null
    }),
  addMyVideos: (videos, hasMore) =>
    set((state) => ({
      myVideos: [...state.myVideos, ...videos],
      myVideosHasMore: hasMore,
      isLoadingMyVideos: false,
      myVideosError: null
    })),
  clearMyVideos: () =>
    set({
      myVideos: [],
      myVideosPage: 1,
      myVideosHasMore: true,
      myVideosSearchQuery: '',
      isLoadingMyVideos: false,
      myVideosError: null
    }),
  loadMyVideos: async (page, cookies) => {
    set({ isLoadingMyVideos: true, myVideosError: null })

    // Set up progress listener
    const progressHandler = (_event: unknown, data: unknown) => {
      const progressData = data as {
        type: string
        videos?: MyVideo[]
        hasMore?: boolean
        error?: string
      }

      if (progressData.type === 'complete' && progressData.success) {
        if (page === 1) {
          useAppStore.getState().setMyVideos(progressData.videos || [], progressData.hasMore || false)
          useAppStore.setState({ myVideosPage: 1 })
        } else {
          useAppStore.getState().setMyVideos(progressData.videos || [], progressData.hasMore || false)
          useAppStore.setState({ myVideosPage: page })
        }
      } else if (progressData.type === 'error') {
        set({ isLoadingMyVideos: false, myVideosError: progressData.error || 'Chyba při načítání' })
      }
    }

    window.electronAPI.onMyVideosProgress(progressHandler)

    try {
      await window.electronAPI.myVideosLoad({ cookies, page })
    } catch (error) {
      set({
        isLoadingMyVideos: false,
        myVideosError: error instanceof Error ? error.message : 'Chyba při načítání'
      })
    } finally {
      window.electronAPI.removeListener('myvideos:progress', progressHandler)
    }
  },
  deleteMyVideo: async (videoId, cookies) => {
    set({ isLoadingMyVideos: true })
    try {
      await window.electronAPI.myVideosDelete({ cookies, videoId })
      // After deletion, refresh the current page
      const currentPage = useAppStore.getState().myVideosPage
      await useAppStore.getState().loadMyVideos(currentPage, cookies)
    } catch (error) {
      set({
        isLoadingMyVideos: false,
        myVideosError: error instanceof Error ? error.message : 'Chyba při mazání videa'
      })
    }
  },

  // Processed Videos Tracking
  processedVideoUrls: new Set(),
  addProcessedUrl: (url) =>
    set((state) => {
      const newSet = new Set(state.processedVideoUrls)
      newSet.add(url)
      // Trigger persistence save
      saveProcessedToDisk()
      return { processedVideoUrls: newSet }
    }),
  setProcessedVideos: (urls) => set({ processedVideoUrls: urls }),
  isVideoProcessed: (url) => {
    const state = useAppStore.getState()
    return state.processedVideoUrls.has(url)
  },
  clearProcessedVideos: () => {
    set({ processedVideoUrls: new Set() })
    // Trigger persistence save
    saveProcessedToDisk()
  }
}))
