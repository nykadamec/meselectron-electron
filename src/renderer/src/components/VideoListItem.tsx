import type { VideoCandidate } from '../types'

interface VideoListItemProps {
  video: VideoCandidate
  processed?: boolean
  selected?: boolean
  onClick?: () => void
}

function formatSize(bytes?: number): string {
  if (!bytes) return 'N/A'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function VideoListItem({ video, processed, selected, onClick }: VideoListItemProps) {
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
      {/* Size badge */}
      <span className="text-xs text-text-muted whitespace-nowrap min-w-[60px]">
        {formatSize(video.size)}
      </span>

      {/* Title */}
      <span className="flex-1 truncate font-medium text-sm">
        {video.title}
      </span>

      {/* Status indicator */}
      <div className="flex-shrink-0">
        {processed ? (
          <span className="text-xs text-success">Hotovo</span>
        ) : (
          <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </div>
    </div>
  )
}
