import { useEffect, useState } from 'react'
import { useVideoStore, useProcessedStore, useAppStore, useQueueStore, useAccountStore, useSettingsStore } from '../store'
import { VideoListItem } from './VideoListItem'
import type { VideoCandidate } from '../types'

export function VideoList() {
  const videoStore = useVideoStore()
  const processedStore = useProcessedStore()
  const accountStore = useAccountStore()
  const settingsStore = useSettingsStore()

  // Get queue from useQueueStore (queue operations)
  const queueStore = useQueueStore()
  const { queue, addToQueue } = queueStore

  // Get other state from useAppStore
  const {
    addVideo,
    clearCandidates,
    selectedCandidates,
    isDiscovering,
    discoverProgress,
    discoverMessage,
    toggleCandidate,
    selectAllCandidates,
    setDiscovering,
    videoCandidates,
    setActiveTab,
    accounts
  } = useAppStore()

  const { urls: processedUrls } = processedStore

  const { settings } = settingsStore

  const { isProcessing } = useAppStore.getState()

  // Separate processed vs available videos
  const processedVideos = videoCandidates.filter((c: VideoCandidate) => processedUrls.has(c.url))
  const availableVideos = videoCandidates.filter((c: VideoCandidate) => !processedUrls.has(c.url))

  // Collapsible state for processed section
  const [isProcessedCollapsed, setIsProcessedCollapsed] = useState(false)

  // Auto-trigger discover when tab is opened and no candidates
  useEffect(() => {
    if (videoCandidates.length === 0 && !isDiscovering) {
      handleRefresh()
    }
  }, [])

  const handleRefresh = async () => {
    if (!window.electronAPI) return

    // Clear previous candidates
    clearCandidates()

    // Get account cookies
    if (accounts.length === 0) return

    const cookies = await window.electronAPI.accountsReadCookies(accounts[0].id)
    if (!cookies) return

    // Start discover
    setDiscovering(true, 0, 'Hledám videa...')
    try {
      await window.electronAPI.discoverStart({
        cookies,
        count: settings.videoCount
      })
    } catch (error) {
      console.error('Discover failed:', error)
      setDiscovering(false, 0, '')
    }
  }

  // Select all available (non-processed) videos
  const handleSelectAllAvailable = () => {
    availableVideos.forEach((video: VideoCandidate) => {
      if (!selectedCandidates.includes(video.url)) {
        toggleCandidate(video.url)
      }
    })
  }

  // Deselect all selected candidates
  const handleDeselectAll = () => {
    selectedCandidates.forEach((url: string) => {
      if (selectedCandidates.includes(url)) {
        toggleCandidate(url)
      }
    })
  }

  // Process selected videos - uses existing download logic from App.tsx
  const handleProcessSelected = async () => {
    console.log('[ProcessButton] clicked, selectedCandidates:', selectedCandidates.length)
    console.log('[ProcessButton] accounts:', accounts.length)

    if (selectedCandidates.length === 0) {
      console.log('[ProcessButton] early exit - no selected candidates')
      return
    }

    // Get account cookies first - fail early with feedback
    if (accounts.length === 0) {
      console.log('[ProcessButton] no accounts found')
      alert('Žádné účty nejsou k dispozici. Přidejte účet v nastavení.')
      return
    }

    console.log('[ProcessButton] reading cookies for account:', accounts[0].id)
    const cookies = await window.electronAPI.accountsReadCookies(accounts[0].id)
    console.log('[ProcessButton] cookies:', cookies ? 'found' : 'null')

    if (!cookies) {
      alert('Účet není přihlášený. Přihlaste se na prehrajto.cz.')
      return
    }

    // Get queue length before adding
    const currentQueueLength = queue.length

    // Now clear candidates and add to queue
    clearCandidates()

    // Add each selected video to the queue
    let addedCount = 0
    for (const url of selectedCandidates) {
      const candidate = videoCandidates.find((c: VideoCandidate) => c.url === url)
      if (candidate) {
        const videoId = crypto.randomUUID()

        // Create video entry
        addVideo({
          id: videoId,
          title: candidate.title,
          url: candidate.url,
          status: 'pending',
          progress: 0,
          size: 0
        })

        // Add to queue
        addToQueue({
          id: crypto.randomUUID(),
          type: 'download',
          video: {
            id: videoId,
            title: candidate.title,
            url: candidate.url,
            status: 'pending',
            progress: 0,
            size: 0
          },
          accountId: accounts[0].id,
          status: 'pending',
          priority: currentQueueLength + addedCount + 1,
          cookies: cookies || '',
          addedAt: new Date()
        })
        addedCount++
      }
    }

    // Clear selection
    selectAllCandidates()

    // Switch to downloads tab and trigger queue processing
    if (addedCount > 0) {
      console.log('[ProcessButton] success - added', addedCount, 'items to queue')
      setActiveTab('downloads')
      // Trigger the queue to start processing
      queueStore.triggerQueueProcess()
    }
  }

  return (
    <div data-elname="video-list" className="h-full flex flex-col">
      {/* Header */}
      <div data-elname="video-list-header" className="flex justify-between items-center mb-4 flex-shrink-0">
        <h2 data-elname="video-list-title" className="text-lg font-medium">Videa</h2>
        <div data-elname="list-controls" className="flex gap-2">
          <button
            data-elname={selectedCandidates.length > 0 ? 'deselect-all-button' : 'select-all-button'}
            onClick={selectedCandidates.length > 0 ? handleDeselectAll : handleSelectAllAvailable}
            disabled={availableVideos.length === 0 || isDiscovering}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            {selectedCandidates.length > 0 ? 'Odebrat vše' : 'Vybrat vše'}
          </button>
          <button
            data-elname="process-button"
            onClick={handleProcessSelected}
            disabled={selectedCandidates.length === 0 || isProcessing || isDiscovering}
            className="btn-primary text-sm disabled:opacity-50"
          >
            Process ({selectedCandidates.length})
          </button>
          <button
            data-elname="refresh-button"
            onClick={handleRefresh}
            disabled={isDiscovering}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            {isDiscovering ? 'Hledám...' : 'Obnovit'}
          </button>
        </div>
      </div>

      {/* Discovery progress bar */}
      {isDiscovering && (
        <div data-elname="discover-progress" className="mb-4 flex-shrink-0">
          <div className="flex justify-between text-sm mb-1">
            <span data-elname="progress-label">{discoverMessage}</span>
            <span data-elname="progress-percent">{Math.round(discoverProgress)}%</span>
          </div>
          <div data-elname="progress-track" className="w-full bg-bg-hover rounded-full h-2">
            <div
              data-elname="progress-fill"
              className="bg-accent h-2 rounded-full transition-all"
              style={{ width: `${discoverProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Scrollable video list */}
      <div data-elname="video-scroll" className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
        {/* No videos state */}
        {!isDiscovering && videoCandidates.length === 0 && (
          <div data-elname="no-videos-state" className="text-center py-12">
            <p data-elname="empty-title" className="text-text-muted">Žádná videa</p>
            <p data-elname="empty-help" className="text-xs text-text-muted mt-2">Klikněte na "Obnovit" pro načtení videí</p>
          </div>
        )}

        {/* Processed videos section */}
        {processedVideos.length > 0 && (
          <>
            <h3
              data-elname="processed-section-title"
              className="flex items-center gap-2 text-sm text-text-muted uppercase tracking-wider mt-4 mb-2 cursor-pointer hover:text-text-primary sticky top-0 bg-bg-main py-1"
              onClick={() => setIsProcessedCollapsed(!isProcessedCollapsed)}
            >
              <svg
                className={`w-4 h-4 transition-transform ${isProcessedCollapsed ? '-rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              Již zpracovaná ({processedVideos.length})
            </h3>
            {!isProcessedCollapsed && processedVideos.map((video: VideoCandidate) => (
              <VideoListItem
                key={video.url}
                video={video}
                processed={true}
              />
            ))}
          </>
        )}

        {/* Available videos section */}
        {availableVideos.length > 0 && (
          <>
            <h3 data-elname="section-title" className={`text-sm text-text-muted uppercase tracking-wider mt-4 mb-2 sticky top-0 bg-bg-main py-1 ${processedVideos.length > 0 ? '' : ''}`}>
              K dispozici ({availableVideos.length})
            </h3>
            {availableVideos.map((video: VideoCandidate) => (
              <VideoListItem
                key={video.url}
                video={video}
                selected={selectedCandidates.includes(video.url)}
                onClick={() => toggleCandidate(video.url)}
              />
            ))}
          </>
        )}

        {/* Empty available section */}
        {!isDiscovering && processedVideos.length > 0 && availableVideos.length === 0 && (
          <div data-elname="no-available-videos" className="text-center py-8">
            <p className="text-text-muted">Žádná nová videa</p>
          </div>
        )}
      </div>

      {/* CSS for hidden scrollbar - functional but invisible */}
      <style>{`
        .custom-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .custom-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  )
}
