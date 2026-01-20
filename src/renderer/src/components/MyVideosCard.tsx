import type { MyVideo } from '../types'
import { ThumbsUp, ThumbsDown, Download, ExternalLink, Trash2 } from 'lucide-react'
import { useAppStore } from '../store'

interface MyVideosCardProps {
  video: MyVideo
}

export function MyVideosCard({ video }: MyVideosCardProps) {
  const { deleteMyVideo, accounts } = useAppStore()
  
  const formatViews = (views: number): string => {
    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M`
    }
    if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`
    }
    return views.toString()
  }

  const handleDelete = async () => {
    const confirmed = confirm(`Opravdu chcete smazat video: ${video.title}?`)
    if (!confirmed) return

    const activeAccount = accounts.find(acc => acc.isActive)
    if (!activeAccount) return

    try {
      const cookies = await window.electronAPI.accountsReadCookies(activeAccount.id)
      if (cookies) {
        await deleteMyVideo(video.id, cookies)
      }
    } catch (err) {
      console.error('Failed to delete video:', err)
    }
  }

  const isProcessing = video.title.includes('Zpracovává se')

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-bg-hover transition-colors group">
      {/* Thumbnail */}
      <div className="w-32 h-18 bg-bg-hover rounded overflow-hidden flex-shrink-0">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isProcessing ? (
              <div className="flex flex-col items-center gap-1">
                <div className="w-6 h-6 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
            )}
          </div>
        )}
      </div>

      {/* Video Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-sm truncate">{video.title}</h4>
          {isProcessing && (
            <span className="text-xs text-yellow-500 flex items-center gap-1 flex-shrink-0">
              <div className="w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
              Zpracovávání...
            </span>
          )}
        </div>

        {/* Size */}
        {video.size && !isProcessing && (
          <p className="text-xs text-text-muted mb-1">
            <span className="font-medium">{video.size}</span>
          </p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-text-muted">
          {/* Downloads */}
          {!isProcessing && (
            <span className="flex items-center gap-1" title={`Premium: ${video.downloadsPremium || 0}, Celkem: ${video.downloadsTotal || 0}`}>
              <Download className="w-3.5 h-3.5" />
              {formatViews(video.views)}
            </span>
          )}

          {/* Likes */}
          {video.likes !== undefined && !isProcessing && (
            <span className="flex items-center gap-1" title={`${video.likes} like`}>
              <ThumbsUp className="w-3.5 h-3.5 text-green-500" />
              {video.likes}
            </span>
          )}

          {/* Dislikes */}
          {video.dislikes !== undefined && !isProcessing && (
            <span className="flex items-center gap-1" title={`${video.dislikes} dislike`}>
              <ThumbsDown className="w-3.5 h-3.5 text-red-500" />
              {video.dislikes}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Open Link */}
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-lg hover:bg-bg-hover transition-colors text-text-muted hover:text-accent"
          title="Otevřít na prehrajto.cz"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-4.5 h-4.5" />
        </a>

        {/* Delete */}
        <button
          onClick={handleDelete}
          className="p-2 rounded-lg hover:bg-red-500/10 transition-colors text-text-muted hover:text-red-500"
          title="Smazat video"
        >
          <Trash2 className="w-4.5 h-4.5" />
        </button>
      </div>
    </div>
  )
}
