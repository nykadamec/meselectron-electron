import { useState } from 'react'
import type { LogMessage } from '../types'

interface LogViewerProps {
  logs: LogMessage[]
}

const logLevelColors = {
  info: 'text-blue-400',
  success: 'text-green-400',
  warning: 'text-yellow-400',
  error: 'text-red-400'
}

const logLevelIcons = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌'
}

export function LogViewer({ logs }: LogViewerProps) {
  const [filter, setFilter] = useState<'all' | 'info' | 'success' | 'warning' | 'error'>('all')

  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter(log => log.level === filter)

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('cs-CZ', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div data-elname="log-viewer" className="space-y-4">
      {/* Filter controls */}
      <div data-elname="filter-controls" className="flex gap-2 flex-wrap">
        {(['all', 'info', 'success', 'warning', 'error'] as const).map((level) => (
          <button
            data-elname="filter-btn"
            key={level}
            onClick={() => setFilter(level)}
            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
              filter === level
                ? 'bg-accent text-white'
                : 'bg-bg-hover text-text-secondary hover:text-text-primary'
            }`}
          >
            {level === 'all' ? 'Vše' : level.charAt(0).toUpperCase() + level.slice(1)}
          </button>
        ))}
      </div>

      {/* Log output */}
      <div data-elname="log-output" className="bg-bg-card rounded-xl border border-border p-4 font-mono text-sm">
        <div data-elname="log-entries" className="space-y-1 max-h-[500px] overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <p data-elname="empty-logs" className="text-text-muted">Žádné logy</p>
          ) : (
            filteredLogs.map((log) => (
              <div data-elname="log-entry" key={log.id} className="flex gap-2">
                <span data-elname="log-timestamp" className="text-text-muted flex-shrink-0">
                  [{formatTime(log.timestamp)}]
                </span>
                <span data-elname="log-level-icon" className={logLevelColors[log.level]}>
                  {logLevelIcons[log.level]}
                </span>
                <span data-elname="log-message" className="text-text-primary break-all">
                  {log.message}
                </span>
                {log.source && (
                  <span data-elname="log-source" className="text-text-muted flex-shrink-0">
                    [{log.source}]
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <p data-elname="log-count" className="text-xs text-text-muted">
        Zobrazeno {filteredLogs.length} z {logs.length} logů
      </p>
    </div>
  )
}
