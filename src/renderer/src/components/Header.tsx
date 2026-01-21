import { useAppStore } from '../store'
import { useLocaleStore } from '../i18n'
import { RefreshCw, Settings, Minus, UploadCloud } from 'lucide-react'

export function Header() {
  const uiStore = useAppStore()
  const { isProcessing, addLog } = uiStore
  const t = useLocaleStore(state => state.t)

  const handleRefresh = async () => {
    addLog({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      level: 'info',
      message: t('progress.checkingUpdates'),
      source: 'app'
    })

    if (!window.electronAPI) {
      addLog({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        level: 'warning',
        message: 'Nelze zkontrolovat verzi mimo Electron',
        source: 'app'
      })
      return
    }

    try {
      const result = await window.electronAPI.versionCheck()
      if (result.remoteVersion) {
        addLog({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          level: 'info',
          message: `Aktuální verze: ${result.remoteVersion}`,
          source: 'app'
        })
      }
    } catch {
      addLog({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        level: 'error',
        message: 'Nepodařilo se zkontrolovat verzi',
        source: 'app'
      })
    }
  }

  const handleMinimize = () => {
    if (window.electronAPI?.windowMinimize) {
      window.electronAPI.windowMinimize()
    }
  }

  return (
    <header data-elname="app-header" style={{
      backgroundColor: 'var(--color-surface-base)',
      borderBottom: '1px solid var(--color-border-base)',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      WebkitAppRegion: 'drag'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div data-elname="logo-container" style={{
          width: 32,
          height: 32,
          backgroundColor: 'var(--color-accent-base)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <UploadCloud style={{ width: 18, height: 18, color: 'white' }} />
        </div>
        <div>
          <h1 data-elname="app-title" style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text-primary)' }}>{t('header.title')}</h1>
          <p data-elname="app-subtitle" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{t('header.subtitle')}</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, WebkitAppRegion: 'no-drag' }}>
        {isProcessing && (
          <span data-elname="processing-indicator" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-accent-base)' }}>
            <span style={{ width: 8, height: 8, backgroundColor: 'var(--color-accent-base)', borderRadius: '50%', animation: 'pulse 2s infinite' }}></span>
            {t('header.processing')}
          </span>
        )}

        <button
          data-elname="refresh-button"
          onClick={handleRefresh}
          style={{
            padding: 8,
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-elevated)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          title={t('header.checkUpdates')}
        >
          <RefreshCw style={{ width: 16, height: 16, color: 'var(--color-text-secondary)' }} />
        </button>

        <button
          data-elname="settings-button"
          onClick={() => uiStore.setActiveTab('settings')}
          style={{
            padding: 8,
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-elevated)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          title={t('header.settings')}
        >
          <Settings style={{ width: 16, height: 16, color: 'var(--color-text-secondary)' }} />
        </button>

        <button
          data-elname="minimize-button"
          onClick={handleMinimize}
          style={{
            padding: 8,
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-elevated)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          title={t('header.minimize')}
        >
          <Minus style={{ width: 16, height: 16, color: 'var(--color-text-secondary)' }} />
        </button>
      </div>
    </header>
  )
}
