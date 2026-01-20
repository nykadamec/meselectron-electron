import { useEffect, useRef } from 'react'
import { useAppStore } from '../store'
import { useLocaleStore } from '../i18n'
import { MyVideosCard as VideoCard } from './MyVideosCard'
import { RefreshCw, ChevronLeft, ChevronRight, PlayCircle } from 'lucide-react'

export function MyVideosList() {
  const { t } = useLocaleStore()
  const topRef = useRef<HTMLDivElement>(null)
  const {
    myVideos,
    myVideosPage,
    myVideosHasMore,
    isLoadingMyVideos,
    myVideosError,
    loadMyVideos,
    clearMyVideos,
    accounts
  } = useAppStore()

  const activeAccount = accounts.find(acc => acc.isActive)

  const handleRefresh = async () => {
    if (!activeAccount || !window.electronAPI) return
    
    try {
      const cookies = await window.electronAPI.accountsReadCookies(activeAccount.id)
      if (cookies) {
        clearMyVideos()
        await loadMyVideos(1, cookies)
      }
    } catch (error) {
      console.error('Failed to refresh videos:', error)
    }
  }

  const handlePageChange = async (newPage: number) => {
    if (!activeAccount || !window.electronAPI || newPage < 1) return
    
    try {
      const cookies = await window.electronAPI.accountsReadCookies(activeAccount.id)
      if (cookies) {
        // Clear current videos to show loading state for the new page
        useAppStore.setState({ myVideos: [] })
        await loadMyVideos(newPage, cookies)
      }
    } catch (error) {
      console.error('Failed to change page:', error)
    }
  }

  const handleJumpToPage = (e: React.ChangeEvent<HTMLSelectElement>) => {
    handlePageChange(parseInt(e.target.value, 10))
  }

  // Auto-load on mount if empty
  useEffect(() => {
    if (myVideos.length === 0 && !isLoadingMyVideos && activeAccount) {
      handleRefresh()
    }
  }, [activeAccount?.id])

  // Scroll to top when page changes or videos are loaded
  useEffect(() => {
    if (myVideos.length > 0 || isLoadingMyVideos) {
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [myVideosPage, isLoadingMyVideos])

  return (
    <div className="flex flex-col gap-4">
      <div ref={topRef} className="flex justify-between items-center">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <PlayCircle className="w-5 h-5 text-accent" />
          {t('nav.myVideos')}
        </h2>
        <button
          onClick={handleRefresh}
          disabled={isLoadingMyVideos || !activeAccount}
          className="btn-primary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoadingMyVideos ? 'animate-spin' : ''}`} />
          {t('actions.refresh')}
        </button>
      </div>

      {myVideosError && (
        <div className="p-4 bg-red-500/10 border border-red-500 rounded-lg">
          <p className="text-red-500 text-sm">{myVideosError}</p>
        </div>
      )}

      {myVideos.length > 0 ? (
        <div className="card-base">
          <div className="flex flex-col divide-y divide-border">
            {myVideos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        </div>
      ) : (
        !isLoadingMyVideos && (
          <div className="text-center py-12 bg-surface border border-dashed border-border rounded-xl">
            <PlayCircle className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-secondary">{t('empty.myVideos')}</p>
            <p className="text-xs text-text-muted mt-2">{t('empty.myVideosHelp')}</p>
          </div>
        )
      )}

      {isLoadingMyVideos && (
        <div className="flex justify-center py-8">
          <div className="spinner" />
        </div>
      )}

      {/* Improved Paginator */}
      {(myVideos.length > 0 || myVideosPage > 1) && !isLoadingMyVideos && (
        <div className="flex justify-center items-center gap-4 mt-4 bg-surface p-3 rounded-lg border border-border shadow-sm">
          <button
            onClick={() => handlePageChange(myVideosPage - 1)}
            disabled={myVideosPage <= 1}
            className="btn-secondary p-2 disabled:opacity-30 flex items-center justify-center min-w-[40px]"
            title={t('actions.back')}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-muted">Stránka</span>
            <select 
              value={myVideosPage} 
              onChange={handleJumpToPage}
              className="bg-bg-hover border border-border rounded px-2 py-1 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
            >
              {/* Generate page options - show up to current + 20 pages */}
              {Array.from({ length: Math.max(myVideosPage + 20, 20) }, (_, i) => i + 1).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => handlePageChange(myVideosPage + 1)}
            disabled={!myVideosHasMore}
            className="btn-secondary p-2 disabled:opacity-30 flex items-center justify-center min-w-[40px]"
            title={t('actions.next')}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  )
}