import { useEffect, useState } from 'react'
import { useAppStore } from '../store'
import { VideoListItem } from './VideoListItem'

export function VideoList() {
  const {
    videoCandidates,
    selectedCandidates,
    isDiscovering,
    isProcessing,
    discoverProgress,
    discoverMessage,
    processedVideoUrls,
    toggleCandidate,
    selectAllCandidates,
    setDiscovering,
    clearCandidates
  } = useAppStore()

  // Separate processed vs available videos
  const processedVideos = videoCandidates.filter(c => processedVideoUrls.has(c.url))
  const availableVideos = videoCandidates.filter(c => !processedVideoUrls.has(c.url))

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
    const accounts = useAppStore.getState().accounts
    if (accounts.length === 0) return

    const cookies = await window.electronAPI.accountsReadCookies(accounts[0].id)
    if (!cookies) return

    // Start discover
    setDiscovering(true, 0, 'Hledám videa...')
    try {
      await window.electronAPI.discoverStart({
        cookies,
        count: useAppStore.getState().settings.videoCount
      })
    } catch (error) {
      console.error('Discover failed:', error)
      setDiscovering(false, 0, '')
    }
  }

  // Select all available (non-processed) videos
  const handleSelectAllAvailable = () => {
    availableVideos.forEach(video => {
      if (!selectedCandidates.includes(video.url)) {
        toggleCandidate(video.url)
      }
    })
  }

  // Deselect all selected candidates
  const handleDeselectAll = () => {
    selectedCandidates.forEach(url => {
      if (selectedCandidates.includes(url)) {
        toggleCandidate(url)
      }
    })
  }

  // Process selected videos - uses existing download logic from App.tsx
  const handleProcessSelected = async () => {
    if (selectedCandidates.length === 0) return

    // Clear candidates to hide the video list and show queue
    clearCandidates()

    // Get account cookies
    const accounts = useAppStore.getState().accounts
    if (accounts.length === 0) return

    const cookies = await window.electronAPI.accountsReadCookies(accounts[0].id)
    if (!cookies) return

    // Get addToQueue from store
    const { addToQueue, addVideo } = useAppStore.getState()

    // Add each selected video to the queue
    for (const url of selectedCandidates) {
      const candidate = videoCandidates.find(c => c.url === url)
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
          priority: useAppStore.getState().queue.length + 1,
          cookies: cookies || '',
          addedAt: new Date()
        })
      }
    }

    // Clear selection
    selectAllCandidates()

    // Trigger queue processing
    useAppStore.getState().triggerQueueProcess?.()
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
            {!isProcessedCollapsed && processedVideos.map(video => (
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
            {availableVideos.map(video => (
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
