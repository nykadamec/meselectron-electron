import { useEffect, useRef, useState } from 'react'
import { useMyVideosStore, useAccountStore } from '../store'
import { useLocaleStore } from '../i18n'
import type { MyVideo } from '../types'
import { MyVideosCard as VideoCard } from './MyVideosCard'
import { DeleteConfirmationModal } from './DeleteConfirmationModal'
import { RefreshCw, ChevronLeft, ChevronRight, PlayCircle, Search, X } from 'lucide-react'

export function MyVideosList() {
  const { t } = useLocaleStore()
  const topRef = useRef<HTMLDivElement>(null)

  const myVideosStore = useMyVideosStore()
  const accountStore = useAccountStore()

  const {
    videos,
    page,
    hasMore,
    searchQuery,
    isLoading,
    error,
    setSearchQuery,
    loadVideos,
    clear,
    deleteVideo
  } = myVideosStore

  const { accounts } = accountStore

  const activeAccount = accounts.find(acc => acc.isActive)

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [videoToDelete, setVideoToDelete] = useState<MyVideo | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Filter videos based on search query
  const filteredVideos = videos.filter(video =>
    video.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleRefresh = async () => {
    if (!activeAccount || !window.electronAPI) return

    try {
      const cookies = await window.electronAPI.accountsReadCookies(activeAccount.id)
      if (cookies) {
        clear()
        await loadVideos(1, cookies)
      }
    } catch (err) {
      console.error('Failed to refresh videos:', err)
    }
  }

  const handlePageChange = async (newPage: number) => {
    if (!activeAccount || !window.electronAPI || newPage < 1) return

    try {
      const cookies = await window.electronAPI.accountsReadCookies(activeAccount.id)
      if (cookies) {
        await loadVideos(newPage, cookies)
      }
    } catch (err) {
      console.error('Failed to change page:', err)
    }
  }

  const handleJumpToPage = (e: React.ChangeEvent<HTMLSelectElement>) => {
    handlePageChange(parseInt(e.target.value, 10))
  }

  const handleDeleteClick = (video: MyVideo) => {
    setVideoToDelete(video)
    setDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!videoToDelete || !activeAccount) return

    setIsDeleting(true)
    try {
      const cookies = await window.electronAPI.accountsReadCookies(activeAccount.id)
      if (cookies) {
        await deleteVideo(videoToDelete.id, cookies)
      }
    } catch (err) {
      console.error('Failed to delete video:', err)
    } finally {
      setIsDeleting(false)
      setVideoToDelete(null)
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const handleSearchClear = () => {
    setSearchQuery('')
  }

  // Auto-load on mount if empty
  useEffect(() => {
    if (videos.length === 0 && !isLoading && activeAccount) {
      handleRefresh()
    }
  }, [activeAccount?.id])

  // Scroll to top when page changes or videos are loaded
  useEffect(() => {
    if (videos.length > 0 || isLoading) {
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [page, isLoading])

  return (
    <div data-elname="my-videos-list" className="flex flex-col gap-4">
      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        video={videoToDelete}
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />

      {/* Header */}
      <div data-elname="list-header" ref={topRef} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 data-elname="list-title" className="text-lg font-semibold flex items-center gap-2">
          <PlayCircle className="w-5 h-5 text-accent" />
          {t('nav.myVideos')}
        </h2>
        <button
          data-elname="refresh-button"
          onClick={handleRefresh}
          disabled={isLoading || !activeAccount}
          className="btn-primary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          {t('actions.refresh')}
        </button>
      </div>

      {/* Search Input */}
      <div data-elname="search-container" className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted" />
        <input
          data-elname="search-input"
          type="text"
          placeholder={t('search.placeholder')}
          value={searchQuery}
          onChange={handleSearchChange}
          className="input-base pl-12 pr-10"
        />
        {searchQuery && (
          <button
            data-elname="clear-search-btn"
            onClick={handleSearchClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {error && (
        <div data-elname="error-banner" className="p-4 bg-red-500/10 border border-red-500 rounded-lg">
          <p data-elname="error-text" className="text-red-500 text-sm">{error}</p>
        </div>
      )}

      {filteredVideos.length > 0 ? (
        <div data-elname="videos-container" className="bg-surface/50 rounded-xl overflow-hidden">
          <div data-elname="videos-list" className="flex flex-col">
            {filteredVideos.map((video) => (
              <div data-elname="video-item-wrapper" key={video.id} className="p-1.5">
                <VideoCard video={video} onDeleteClick={handleDeleteClick} />
              </div>
            ))}
          </div>
        </div>
      ) : videos.length === 0 && !isLoading ? (
        <div data-elname="empty-state" className="text-center py-12 bg-surface border border-dashed border-border rounded-xl">
          <PlayCircle data-elname="empty-icon" className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <p data-elname="empty-title" className="text-text-secondary">
            {searchQuery ? t('search.noResults') : t('empty.myVideos')}
          </p>
          <p data-elname="empty-help" className="text-xs text-text-muted mt-2">
            {searchQuery
              ? t('empty.myVideosHelp')
              : t('empty.myVideosHelp')}
          </p>
        </div>
      ) : null}

      {isLoading && (
        <div data-elname="loading-spinner" className="flex justify-center py-8">
          <div className="spinner" />
        </div>
      )}

      {/* Pagination */}
      {(videos.length > 0 || page > 1) && !isLoading && (
        <div data-elname="pagination" style={{backgroundColor: '#121212'}} className="flex justify-center items-center gap-4 mt-4 bg-surface p-3 rounded-lg shadow-sm">
          <button
            data-elname="prev-page-btn"
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            className="btn-secondary p-2 disabled:opacity-30 flex items-center justify-center min-w-[40px]"
            title={t('actions.back')}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <span data-elname="page-label" className="text-sm font-medium text-text-muted">{t('pagination.page')}</span>
            <select
              data-elname="page-selector"
              value={page}
              onChange={handleJumpToPage}
              className="bg-bg-hover border border-border rounded px-2 py-1 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
            >
              {Array.from({ length: Math.max(page + 20, 20) }, (_, i) => i + 1).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <span data-elname="page-info" className="text-sm text-text-muted">{t('pagination.of')}</span>
          </div>

          <button
            data-elname="next-page-btn"
            onClick={() => handlePageChange(page + 1)}
            disabled={!hasMore}
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
