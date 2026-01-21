/**
 * Queue Store - Manages download/upload queue state and operations
 */

import { create } from 'zustand'
import type { QueueItem, Video, LogMessage } from './types'

interface QueueState {
  queue: QueueItem[]
  isQueuePaused: boolean

  // Queue operations
  addToQueue: (item: QueueItem) => void
  updateQueueItem: (itemId: string, updates: Partial<QueueItem>) => void
  removeFromQueue: (itemId: string) => void
  removeFromQueueByVideoId: (videoId: string) => void
  reorderQueue: (newQueue: QueueItem[]) => void
  clearQueue: () => void

  // Queue query helpers
  getNextPendingItem: () => QueueItem | null
  getPendingCount: () => number
  getActiveItem: () => QueueItem | null
  getCompletedCount: () => number
  getFailedCount: () => number

  // Queue control
  pauseQueue: () => void
  resumeQueue: () => void
  retryFailedItems: () => void

  // File deletion with logging
  deleteFromQueue: (itemId: string, addLog: (log: LogMessage) => void) => Promise<void>

  // Process queue callback (registered by App.tsx)
  processQueueCallback: (() => void) | null
  setProcessQueueCallback: (callback: (() => void) | null) => void
  triggerQueueProcess: () => void
}

// Helper to create a video object
export function createVideo(
  id: string,
  title: string,
  url: string,
  status: QueueItem['status'] = 'pending'
): Video {
  return {
    id,
    title,
    url,
    status: status === 'active' ? 'pending' : status === 'completed' ? 'completed' : status === 'failed' ? 'failed' : 'pending',
    progress: 0
  }
}

// Helper to create a queue item
export function createQueueItem(
  video: Video,
  accountId: string,
  type: 'download' | 'upload' = 'download'
): QueueItem {
  return {
    id: crypto.randomUUID(),
    type,
    video,
    accountId,
    status: 'pending',
    priority: Date.now(),
    addedAt: new Date()
  }
}

export const useQueueStore = create<QueueState>((set, get) => ({
  queue: [],
  isQueuePaused: false,
  processQueueCallback: null,

  addToQueue: (item) =>
    set((state) => ({ queue: [...state.queue, item] })),

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

  reorderQueue: (newQueue) =>
    set({ queue: newQueue }),

  clearQueue: () =>
    set({ queue: [] }),

  getNextPendingItem: () => {
    const { queue, isQueuePaused } = get()
    if (isQueuePaused) return null
    return queue.find((item) => item.status === 'pending') || null
  },

  getPendingCount: () => {
    const { queue } = get()
    return queue.filter((item) => item.status === 'pending').length
  },

  getActiveItem: () => {
    const { queue } = get()
    return queue.find((item) => item.status === 'active') || null
  },

  getCompletedCount: () => {
    const { queue } = get()
    return queue.filter((item) => item.status === 'completed').length
  },

  getFailedCount: () => {
    const { queue } = get()
    return queue.filter((item) => item.status === 'failed').length
  },

  pauseQueue: () =>
    set({ isQueuePaused: true }),

  resumeQueue: () =>
    set({ isQueuePaused: false }),

  retryFailedItems: () =>
    set((state) => ({
      queue: state.queue.map((item) =>
        item.status === 'failed' ? { ...item, status: 'pending' } : item
      )
    })),

  deleteFromQueue: async (itemId, addLog) => {
    const { queue, removeFromQueue } = get()
    const item = queue.find((i) => i.id === itemId)

    if (!item) return

    // Delete file if it exists
    if (item.video.path && window.electronAPI) {
      try {
        const fs = await import('fs/promises')
        await fs.unlink(item.video.path)
        addLog({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          level: 'info',
          message: `Soubor smazán: ${item.video.title}`,
          source: 'queue'
        })
      } catch (error) {
        addLog({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          level: 'warning',
          message: `Nepodařilo se smazat soubor ${item.video.title}: ${error}`,
          source: 'queue'
        })
      }
    }

    removeFromQueue(itemId)
  },

  setProcessQueueCallback: (callback) =>
    set({ processQueueCallback: callback }),

  triggerQueueProcess: () => {
    const { processQueueCallback } = get()
    if (processQueueCallback) {
      processQueueCallback()
    }
  }
}))
