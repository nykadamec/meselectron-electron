/**
 * Processed Store - Tracks processed video URLs to avoid duplicates
 */

import { create } from 'zustand'

interface ProcessedState {
  urls: Set<string>

  addUrl: (url: string) => void
  hasUrl: (url: string) => boolean
  clear: () => void
  setUrls: (urls: Set<string>) => void
}

export const useProcessedStore = create<ProcessedState>((set, get) => ({
  urls: new Set(),

  addUrl: (url) =>
    set((state) => {
      const newSet = new Set(state.urls)
      newSet.add(url)
      return { urls: newSet }
    }),

  hasUrl: (url) => get().urls.has(url),

  clear: () => set({ urls: new Set() }),

  setUrls: (urls) => set({ urls })
}))
