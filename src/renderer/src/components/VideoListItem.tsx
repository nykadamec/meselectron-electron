import type { VideoCandidate } from '../types'

interface VideoListItemProps {
  video: VideoCandidate
  processed?: boolean
  selected?: boolean
  onClick?: () => void
}

/**
 * Format size always in GB
 * Converts any size to GB format (e.g., "512 MB" -> "0.50 GB")
 */
function formatSize(bytes?: number): string {
  if (!bytes) return 'N/A'
  const gbValue = bytes / (1024 * 1024 * 1024)
  return `${parseFloat(gbValue.toFixed(2))} GB`
}

/**
 * Strip size prefix from title
 * Format: "[  2.62 GB  ] - Some Title" -> "Some Title"
 */
function stripSizePrefix(title: string): string {
  const sizePrefixPattern = /^\[\s*[\d.]+\s*(?:GB|MB|KB)\s*\]\s*-\s*/
  return title.replace(sizePrefixPattern, '').trim()
}

export function VideoListItem({ video, processed, selected, onClick }: VideoListItemProps) {
  return (
    <div
      data-elname="video-item"
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
      <span data-elname="size-badge" className="text-xs text-text-muted whitespace-nowrap min-w-[60px]">
        {formatSize(video.size)}
      </span>

      {/* Title */}
      <span data-elname="video-title" className="flex-1 truncate font-medium text-sm">
        {stripSizePrefix(video.title)}
      </span>

      {/* Status indicator */}
      <div className="flex-shrink-0">
        {processed ? (
          <span data-elname="status-text" className="text-xs text-success">Hotovo</span>
        ) : (
          <svg data-elname="chevron-icon" className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </div>
    </div>
  )
}
