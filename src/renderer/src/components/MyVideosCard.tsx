import type { MyVideo } from '../types'
import { Eye, ThumbsUp, ThumbsDown, ExternalLink, Trash2, Play } from 'lucide-react'

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
    <div className="flex items-center gap-4 p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:bg-slate-800/70 transition-all duration-200 group">
      {/* Thumbnail */}
      <div className="relative w-36 h-20 flex-shrink-0 rounded-lg overflow-hidden group-hover:shadow-lg transition-shadow">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-700/50">
            {isProcessing ? (
              <div className="w-6 h-6 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
            )}
          </div>
        )}

        {/* Overlay s play ikonkou při hoveru */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
          </div>
        </div>

        {/* Processing badge */}
        {isProcessing && (
          <div className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-warning/90 text-white text-[10px] font-medium">
            <div className="w-2.5 h-2.5 border border-white/50 border-t-transparent rounded-full animate-spin" />
            Zpracovává se
          </div>
        )}
      </div>

      {/* Video Info */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Název - 2-line clamp */}
        <h4 className="text-[0.95rem] font-semibold text-slate-100 line-clamp-2 leading-snug">
          {video.title}
        </h4>

        {/* Metadata: datum + velikost */}
        {!isProcessing && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {video.addedAt && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {new Date(video.addedAt).toLocaleDateString('cs-CZ')}
              </span>
            )}
            <span className="w-1 h-1 rounded-full bg-slate-500" />
            {video.size && <span className="font-medium">{video.size}</span>}
          </div>
        )}

        {/* Statistiky */}
        {!isProcessing && (
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              {formatViews(video.views)}
            </span>
            <span className="flex items-center gap-1.5">
              <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" />
              {video.likes}
            </span>
            <span className="flex items-center gap-1.5">
              <ThumbsDown className="w-3.5 h-3.5 text-red-500" />
              {video.dislikes}
            </span>
          </div>
        )}
      </div>

      {/* Akční tlačítka */}
      <div className="flex items-center gap-2 flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 text-slate-400 hover:text-slate-100 hover:bg-white/10 hover:border-white/20 transition-all duration-200"
          title="Otevřít na prehrajto.cz"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-4 h-4" />
        </a>
        <button
          onClick={() => onDeleteClick(video)}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all duration-200"
          title="Smazat video"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
