/**
 * My Videos Store - Manages My Videos page state and loading
 */

import { create } from 'zustand'
import type { MyVideo } from '../types'

interface MyVideosState {
  videos: MyVideo[]
  page: number
  hasMore: boolean
  searchQuery: string
  isLoading: boolean
  error: string | null

  setVideos: (videos: MyVideo[], hasMore: boolean) => void
  addVideos: (videos: MyVideo[], hasMore: boolean) => void
  setSearchQuery: (query: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clear: () => void
  incrementPage: () => void

  // Async operations
  loadVideos: (page: number, cookies: string) => Promise<void>
  deleteVideo: (videoId: string, cookies: string) => Promise<void>
}

export const useMyVideosStore = create<MyVideosState>((set, get) => ({
  videos: [],
  page: 1,
  hasMore: true,
  searchQuery: '',
  isLoading: false,
  error: null,

  setVideos: (videos, hasMore) =>
    set({ videos, hasMore, isLoading: false, error: null }),

  addVideos: (videos, hasMore) =>
    set((state) => ({
      videos: [...state.videos, ...videos],
      hasMore,
      isLoading: false,
      error: null
    })),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  clear: () =>
    set({
      videos: [],
      page: 1,
      hasMore: true,
      searchQuery: '',
      isLoading: false,
      error: null
    }),

  incrementPage: () => set((state) => ({ page: state.page + 1 })),

  loadVideos: async (page, cookies) => {
    console.log('[MyVideosStore] Loading page:', page)
    set({ isLoading: true, error: null })

    const progressHandler = (_event: unknown, data: unknown) => {
      const progressData = data as {
        type: string
        videos?: MyVideo[]
        hasMore?: boolean
        error?: string
        message?: string
        success?: boolean
      }

      if (progressData.type === 'complete' && progressData.success) {
        console.log('[MyVideosStore] Complete! videos:', progressData.videos?.length)
        if (page === 1) {
          set({ videos: progressData.videos || [], hasMore: progressData.hasMore || false, isLoading: false })
        } else {
          set((state) => ({
            videos: [...state.videos, ...(progressData.videos || [])],
            hasMore: progressData.hasMore || false,
            isLoading: false
          }))
        }
      } else if (progressData.type === 'error') {
        console.log('[MyVideosStore] Error:', progressData.error)
        set({ isLoading: false, error: progressData.error || 'Chyba při načítání' })
      }
    }

    window.electronAPI.onMyVideosProgress(progressHandler)

    try {
      await window.electronAPI.myVideosLoad({ cookies, page })
    } catch (error) {
      console.log('[MyVideosStore] IPC error:', error)
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Chyba při načítání'
      })
    } finally {
      window.electronAPI.removeListener('myvideos:progress', progressHandler)
      const state = get()
      if (state.isLoading) {
        set({ isLoading: false, error: 'Worker neodpověděl' })
      }
    }
  },

  deleteVideo: async (videoId, cookies) => {
    set({ isLoading: true, error: null })
    try {
      await window.electronAPI.myVideosDelete({ cookies, videoId })
      const currentPage = get().page
      await get().loadVideos(currentPage, cookies)
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Chyba při mazání videa'
      })
    }
  }
}))
