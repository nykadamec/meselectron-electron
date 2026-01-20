/**
 * UpdaterNotification - Shows update available/download/install notifications
 */

import { useUpdaterStore, checkForUpdates, downloadUpdate, installUpdate, dismissUpdate } from '../store/updater'
import { Download, RefreshCw, Check, X, AlertCircle, Clock, HardDrive } from 'lucide-react'

function formatFileSize(bytes: number): string {
  if (!bytes) return 'Unknown'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatSpeed(bytesPerSecond: number): string {
  return `${formatFileSize(bytesPerSecond)}/s`
}

function formatEta(seconds: number): string {
  if (seconds < 0 || seconds === Infinity) return 'Unknown'
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
  return `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`
}

export function UpdaterNotification() {
  const store = useUpdaterStore()

  // Don't show anything in idle state
  if (store.status === 'idle' || store.status === 'checking') {
    return null
  }

  const isDownloading = store.status === 'downloading'
  const isVerifying = store.status === 'verifying'
  const isReady = store.status === 'ready'
  const isInstalling = store.status === 'installing'
  const isError = store.status === 'error'

  const handleInstall = () => {
    installUpdate()
  }

  const handleDismiss = () => {
    dismissUpdate()
  }

  const handleRetry = () => {
    checkForUpdates()
  }

  return (
    <div data-elname="updater-notification" className="fixed bottom-4 right-4 z-50 w-96">
      <div data-elname="updater-card" className="bg-bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div data-elname="updater-header" className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isReady ? (
              <div data-elname="status-icon" className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Download className="w-5 h-5 text-green-500" />
              </div>
            ) : isError ? (
              <div data-elname="status-icon" className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
            ) : (
              <div data-elname="status-icon" className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center">
                <RefreshCw className={`w-5 h-5 text-accent ${isDownloading ? 'animate-spin' : ''}`} />
              </div>
            )}
            <div>
              <h3 data-elname="updater-title" className="font-semibold text-text-primary">
                {isReady ? 'Aktualizace připravena' :
                 isInstalling ? 'Instalace aktualizace...' :
                 isError ? 'Chyba aktualizace' :
                 isDownloading ? 'Stahování aktualizace...' :
                 isVerifying ? 'Ověřování...' : 'Kontrola aktualizací'}
              </h3>
              <p data-elname="version-text" className="text-xs text-text-muted">
                {store.latestVersion ? `Verze ${store.latestVersion}` : ''}
              </p>
            </div>
          </div>
          {!isInstalling && (
            <button
              data-elname="dismiss-button"
              onClick={handleDismiss}
              className="p-1 hover:bg-bg-hover rounded transition-colors"
            >
              <X className="w-4 h-4 text-text-muted" />
            </button>
          )}
        </div>

        {/* Content */}
        <div data-elname="updater-content" className="p-4">
          {isError ? (
            <div data-elname="error-content" className="space-y-3">
              <p data-elname="error-message" className="text-sm text-text-secondary">{store.error}</p>
              <button
                data-elname="retry-button"
                onClick={handleRetry}
                className="w-full py-2 px-4 bg-accent hover:bg-accent/90 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Zkusit znovu
              </button>
            </div>
          ) : isReady ? (
            <div data-elname="ready-content" className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Check data-elname="verified-check" className="w-4 h-4 text-green-500" />
                <span data-elname="ready-message">Aktualizace je ověřená a připravená k instalaci</span>
              </div>

              {store.downloadSize && (
                <div data-elname="size-info" className="flex items-center gap-2 text-sm text-text-muted">
                  <HardDrive className="w-4 h-4" />
                  <span>Velikost: {formatFileSize(store.downloadSize)}</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  data-elname="install-button"
                  onClick={handleInstall}
                  className="flex-1 py-2 px-4 bg-accent hover:bg-accent/90 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Nainstalovat a restartovat
                </button>
                <button
                  data-elname="later-button"
                  onClick={handleDismiss}
                  className="py-2 px-4 border border-border hover:bg-bg-hover rounded-lg transition-colors"
                >
                  Později
                </button>
              </div>
            </div>
          ) : isDownloading ? (
            <div data-elname="downloading-content" className="space-y-4">
              {/* Progress bar */}
              <div data-elname="download-progress" className="h-2 bg-bg-hover rounded-full overflow-hidden">
                <div
                  data-elname="progress-fill"
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${store.downloadProgress?.percentage || 0}%` }}
                />
              </div>

              {/* Progress details */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-text-muted">Staženo</p>
                  <p className="text-text-primary font-mono">
                    <span data-elname="downloaded-text">{formatFileSize(store.downloadProgress?.downloadedBytes || 0)}</span>
                    <span className="text-text-muted"> / {formatFileSize(store.downloadProgress?.totalBytes || 0)}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-text-muted">Rychlost</p>
                  <p data-elname="speed-text" className="text-text-primary font-mono">{formatSpeed(store.downloadProgress?.speedBytesPerSecond || 0)}</p>
                </div>
              </div>

              {/* ETA */}
              <div data-elname="eta-text" className="flex items-center gap-2 text-sm text-text-muted">
                <Clock className="w-4 h-4" />
                <span>Zbývá: {formatEta(store.downloadProgress?.etaSeconds || 0)}</span>
              </div>
            </div>
          ) : isVerifying ? (
            <div data-elname="verifying-content" className="space-y-3">
              <div data-elname="verifying-spinner" className="flex items-center justify-center py-4">
                <div className="flex items-center gap-2 text-text-secondary">
                  <RefreshCw className="w-5 h-5 animate-spin text-accent" />
                  <span>{store.verificationProgress || 'Ověřování...'}</span>
                </div>
              </div>
            </div>
          ) : (
            /* Checking state */
            <div data-elname="checking-content" className="flex items-center justify-center py-6">
              <div className="flex items-center gap-2 text-text-secondary">
                <RefreshCw className="w-5 h-5 animate-spin text-accent" />
                <span>Kontrola aktualizací...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
