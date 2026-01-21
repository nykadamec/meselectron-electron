/**
 * Settings Store - Manages application settings with persistence
 */

import { create } from 'zustand'
import type { DownloadMode } from '../types'

export interface Settings {
  autoReset: boolean
  downloadConcurrency: number
  uploadConcurrency: number
  videoCount: number
  nospeed: boolean
  addWatermark: boolean
  outputDir: string
  downloadMode: DownloadMode
  hqProcessing: boolean
}

interface SettingsState {
  settings: Settings
  isLoading: boolean
  error: string | null

  // Settings operations
  setSettings: (settings: Partial<Settings>) => void
  loadSettings: () => Promise<void>
  saveSettings: () => Promise<void>
  resetSettings: () => void

  // Individual settings setters for convenience
  setDownloadMode: (mode: DownloadMode) => void
  setDownloadConcurrency: (value: number) => void
  setOutputDir: (dir: string) => void
  setAddWatermark: (value: boolean) => void
  setHqProcessing: (value: boolean) => void
}

// Default settings
const DEFAULT_SETTINGS: Settings = {
  autoReset: true,
  downloadConcurrency: 2,
  uploadConcurrency: 2,
  videoCount: 20,
  nospeed: false,
  addWatermark: true,
  outputDir: '',
  downloadMode: 'ffmpeg-chunks',
  hqProcessing: true
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isLoading: false,
  error: null,

  setSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings }
    })),

  loadSettings: async () => {
    set({ isLoading: true, error: null })
    try {
      const settings = await window.electronAPI.settingsRead() as Partial<Settings>
      set((state) => ({
        settings: { ...state.settings, ...settings },
        isLoading: false
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load settings',
        isLoading: false
      })
    }
  },

  saveSettings: async () => {
    const { settings } = get()
    try {
      await window.electronAPI.settingsWrite(settings)
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to save settings'
      })
    }
  },

  resetSettings: () =>
    set({ settings: DEFAULT_SETTINGS }),

  setDownloadMode: (downloadMode) =>
    set((state) => ({
      settings: { ...state.settings, downloadMode }
    })),

  setDownloadConcurrency: (downloadConcurrency) =>
    set((state) => ({
      settings: { ...state.settings, downloadConcurrency }
    })),

  setOutputDir: (outputDir) =>
    set((state) => ({
      settings: { ...state.settings, outputDir }
    })),

  setAddWatermark: (addWatermark) =>
    set((state) => ({
      settings: { ...state.settings, addWatermark }
    })),

  setHqProcessing: (hqProcessing) =>
    set((state) => ({
      settings: { ...state.settings, hqProcessing }
    }))
}))
