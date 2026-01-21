/**
 * Video Store - Manages video discovery, candidates, and video list
 */

import { create } from 'zustand'
import type { Video, VideoCandidate } from './types'

interface VideoState {
  // Video list
  videos: Video[]
  setVideos: (videos: Video[]) => void
  addVideo: (video: Video) => void
  updateVideo: (videoId: string, updates: Partial<Video>) => void
  removeVideo: (videoId: string) => void
  clearVideos: () => void

  // Video discovery candidates
  videoCandidates: VideoCandidate[]
  selectedCandidates: string[]
  isDiscovering: boolean
  discoverProgress: number
  discoverMessage: string

  // Discovery operations
  setVideoCandidates: (candidates: VideoCandidate[]) => void
  toggleCandidate: (url: string) => void
  selectAllCandidates: () => void
  clearCandidates: () => void
  setDiscovering: (isDiscovering: boolean, progress?: number, message?: string) => void
}

export const useVideoStore = create<VideoState>((set) => ({
  // Video list
  videos: [],
  setVideos: (videos) => set({ videos }),
  addVideo: (video) =>
    set((state) => ({ videos: [...state.videos, video] })),
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

  // Video discovery candidates
  videoCandidates: [],
  selectedCandidates: [],
  isDiscovering: false,
  discoverProgress: 0,
  discoverMessage: '',

  // Discovery operations
  setVideoCandidates: (candidates) =>
    set({ videoCandidates: candidates }),

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
    set({ isDiscovering, discoverProgress: progress, discoverMessage: message })
}))
