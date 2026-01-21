/**
 * App Store - Main application state (tabs, logs, stats, processing state)
 * This is the primary store for App.tsx coordination
 */

import { create } from 'zustand'
import type { AppTab, LogMessage, GlobalStats, VideoCandidate, Account, Settings, Video } from './types'

interface AppState {
  // Active tab
  activeTab: AppTab
  setActiveTab: (tab: AppTab) => void

  // Logs
  logs: LogMessage[]
  addLog: (log: LogMessage) => void
  clearLogs: () => void

  // Stats
  stats: GlobalStats
  updateStats: (updates: Partial<GlobalStats>) => void

  // Processing state
  isProcessing: boolean
  setIsProcessing: (processing: boolean) => void

  // Videos (downloaded/uploaded videos list)
  videos: Video[]
  addVideo: (video: Video) => void
  updateVideo: (videoId: string, updates: Partial<Video>) => void
  removeVideo: (videoId: string) => void
  clearVideos: () => void

  // Video Discovery (synced with useVideoStore)
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

  // Accounts (synced with useAccountStore)
  accounts: Account[]
  setAccounts: (accounts: Account[]) => void
  setActiveAccount: (accountId: string) => void
  updateAccount: (accountId: string, updates: Partial<Account>) => void

  // Settings (synced with useSettingsStore)
  settings: Settings
  setSettings: (settings: Settings) => void

  // Processed videos tracking
  processedVideoUrls: Set<string>
  addProcessedUrl: (url: string) => void
  setProcessedVideos: (urls: Set<string>) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // Active tab
  activeTab: 'downloads',
  setActiveTab: (activeTab) => set({ activeTab }),

  // Logs
  logs: [],
  addLog: (log) =>
    set((state) => ({ logs: [log, ...state.logs].slice(0, 1000) })),
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

  // Processing state
  isProcessing: false,
  setIsProcessing: (isProcessing) => set({ isProcessing }),

  // Videos
  videos: [],
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

  // Video Discovery
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
  setAccounts: (accounts) => set({ accounts }),
  setActiveAccount: (accountId) =>
    set((state) => ({
      accounts: state.accounts.map((acc) =>
        acc.id === accountId ? { ...acc, isActive: true } : { ...acc, isActive: false }
      )
    })),
  updateAccount: (accountId, updates) =>
    set((state) => ({
      accounts: state.accounts.map((acc) =>
        acc.id === accountId ? { ...acc, ...updates } : acc
      )
    })),

  // Settings
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

  // Processed videos
  processedVideoUrls: new Set(),
  addProcessedUrl: (url) =>
    set((state) => {
      const newSet = new Set(state.processedVideoUrls)
      newSet.add(url)
      return { processedVideoUrls: newSet }
    }),
  setProcessedVideos: (urls) => set({ processedVideoUrls: urls })
}))

// Keep useUIStore as alias for backward compatibility during migration
export { useAppStore as useUIStore }
