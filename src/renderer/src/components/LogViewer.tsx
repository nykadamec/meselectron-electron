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
    <div className="space-y-4">
      {/* Filter controls */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'info', 'success', 'warning', 'error'] as const).map((level) => (
          <button
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
      <div className="bg-bg-card rounded-xl border border-border p-4 font-mono text-sm">
        <div className="space-y-1 max-h-[500px] overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <p className="text-text-muted">Žádné logy</p>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="flex gap-2">
                <span className="text-text-muted flex-shrink-0">
                  [{formatTime(log.timestamp)}]
                </span>
                <span className={logLevelColors[log.level]}>
                  {logLevelIcons[log.level]}
                </span>
                <span className="text-text-primary break-all">
                  {log.message}
                </span>
                {log.source && (
                  <span className="text-text-muted flex-shrink-0">
                    [{log.source}]
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <p className="text-xs text-text-muted">
        Zobrazeno {filteredLogs.length} z {logs.length} logů
      </p>
    </div>
  )
}
