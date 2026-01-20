import type { MyVideo } from '../types'
import { Eye, ThumbsUp, ThumbsDown, ExternalLink, Trash2 } from 'lucide-react'

interface MyVideosCardProps {
  video: MyVideo
  onDeleteClick: (video: MyVideo) => void
}

export function MyVideosCard({ video, onDeleteClick }: MyVideosCardProps) {
  const formatViews = (views: number): string => {
    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M`
    }
    if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`
    }
    return views.toString()
  }

  const isProcessing = video.title.includes('Zpracovává se')

  return (
    <div className="video-card-container group">
      {/* Thumbnail - elegantní s jemným hover efektem */}
      <div className="video-thumbnail-wrapper w-36 h-20">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="video-thumbnail w-full h-full object-cover"
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
        {/* Jemné ztmavení při hover */}
        <div className="video-thumbnail-overlay" />
      </div>

      {/* Video Info */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          {/* Nadpis - výrazná typografie */}
          <h4 className="video-title pr-4">
            {video.title}
          </h4>
          {isProcessing && (
            <span className="video-processing-badge flex-shrink-0">
              <div className="w-3 h-3 border-2 border-warning border-t-transparent rounded-full animate-spin" />
              Zpracovávání...
            </span>
          )}
        </div>

        {/* Metadata row: added date, file size */}
        {!isProcessing && (
          <div className="flex items-center gap-2 text-xs text-text-muted/80">
            {video.addedAt && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {new Date(video.addedAt).toLocaleDateString('cs-CZ')}
              </span>
            )}
            {video.addedAt && video.size && (
              <span className="video-meta-dot" />
            )}
            {video.size && <span className="font-medium">{video.size}</span>}
          </div>
        )}

        {/* Stats row */}
        {!isProcessing && (
          <div className="video-stats">
            <span className="video-stats-item">
              <Eye className="w-4 h-4" />
              {formatViews(video.views)}
            </span>
            <span className="video-stats-item">
              <ThumbsUp className="w-4 h-4 text-green-500" />
              {video.likes}
            </span>
            <span className="video-stats-item">
              <ThumbsDown className="w-4 h-4 text-red-500" />
              {video.dislikes}
            </span>
          </div>
        )}
      </div>

      {/* Actions - glassmorphism buttons s rychlým enter animation */}
      <div className="video-actions">
        {/* Open Link */}
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-icon-glass"
          title="Otevřít na prehrajto.cz"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-3 h-3" />
        </a>

        {/* Delete */}
        <button
          onClick={() => onDeleteClick(video)}
          className="btn-icon-glass-danger"
          title="Smazat video"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}
