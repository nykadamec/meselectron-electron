import type { Video, VideoCandidate } from '../types'

interface VideoCardProps {
  video: Video | VideoCandidate
  variant?: 'grid' | 'list'
  size?: number
  selected?: boolean
  processed?: boolean
  onClick?: () => void
}

const statusColors = {
  pending: 'badge-info',
  downloading: 'badge-warning',
  processing: 'badge-warning',
  uploading: 'badge-warning',
  completed: 'badge-success',
  failed: 'badge-error',
  'already-exists': 'badge-warning',
  skipped: 'badge-warning'
}

const statusLabels = {
  pending: 'Čeká',
  downloading: 'Stahuje',
  processing: 'Zpracovává',
  uploading: 'Nahrává',
  completed: 'Hotovo',
  failed: 'Chyba',
  'already-exists': 'Již existuje',
  skipped: 'Přeskočeno'
}

export function VideoCard({ video, variant = 'grid', size, selected, processed, onClick }: VideoCardProps) {
  const formatSize = (bytes?: number) => {
    if (!bytes) return 'N/A'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  const formatSpeed = (bytesPerSecond?: number) => {
    if (!bytesPerSecond) return '0 B/s'
    const k = 1024
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s']
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k))
    return `${parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  const formatETA = (seconds?: number) => {
    if (!seconds || seconds < 0) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}m ${secs}s`
  }

  const isVideoCandidate = !('status' in video)
  const videoStatus = 'status' in video ? video.status : 'pending'
  const videoSize = size ?? ('size' in video ? video.size : undefined)
  const videoProgress = 'progress' in video ? video.progress : 0
  const videoSpeed = 'speed' in video ? video.speed : undefined
  const videoEta = 'eta' in video ? video.eta : undefined
  const videoError = 'error' in video ? video.error : undefined

  // List view - compact horizontal layout for Discover (without thumbnail)
  if (variant === 'list') {
    return (
      <div
        className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors ${
          processed
            ? 'opacity-50 bg-bg-hover'
            : selected
              ? 'bg-accent/10 border border-accent'
              : 'hover:bg-bg-hover border border-transparent cursor-pointer'
        }`}
        onClick={processed ? undefined : onClick}
      >
        {!processed && (
          <input
            type="checkbox"
            checked={selected ?? false}
            onChange={onClick}
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{video.title}</p>
          {videoSize && (
            <p className="text-xs text-text-muted">{formatSize(videoSize)}</p>
          )}
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          {processed && (
            <span className="text-xs text-success">Hotovo</span>
          )}
          {!processed && (
            <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      </div>
    )
  }

  // Grid view - default card layout
  return (
    <div className={`card hover:border-accent transition-colors ${selected ? 'border-accent' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Thumbnail placeholder */}
        <div className="w-16 h-12 bg-bg-hover rounded-lg flex items-center justify-center flex-shrink-0">
          {video.thumbnail ? (
            <img
              src={video.thumbnail}
              alt={video.title}
              className="w-full h-full object-cover rounded-lg"
            />
          ) : (
            <svg className="w-6 h-6 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium truncate mb-1">{video.title}</h4>
          <div className="flex items-center gap-2 mb-2">
            {processed ? (
              <span className="badge badge-success">Hotovo</span>
            ) : isVideoCandidate ? (
              <span className="badge badge-info">Kandidát</span>
            ) : (
              <span className={`badge ${statusColors[videoStatus]}`}>
                {statusLabels[videoStatus]}
              </span>
            )}
            <span className="text-xs text-text-muted">{formatSize(videoSize)}</span>
          </div>

          {/* Progress bar - only for Video with status */}
          {!isVideoCandidate && videoStatus !== 'pending' && videoStatus !== 'completed' && videoStatus !== 'already-exists' && videoStatus !== 'skipped' && (
            <div className="space-y-1">
              <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: `${videoProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-text-muted">
                <span>{formatSpeed(videoSpeed)}</span>
                <span>ETA: {formatETA(videoEta)}</span>
              </div>
            </div>
          )}

          {videoError && (
            <p className="text-xs text-error mt-2">{videoError}</p>
          )}
        </div>
      </div>
    </div>
  )
}
