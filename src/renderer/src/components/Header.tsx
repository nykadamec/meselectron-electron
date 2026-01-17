import { useAppStore } from '../store'
import { useLocaleStore } from '../i18n'

export function Header() {
  const { isProcessing, addLog } = useAppStore()
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

  return (
    <header className="bg-bg-header border-b border-border px-4 py-3 flex items-center justify-between drag-region">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div>
          <h1 className="font-semibold text-text-primary">{t('header.title')}</h1>
          <p className="text-xs text-text-muted">{t('header.subtitle')}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 no-drag">
        {isProcessing && (
          <span className="flex items-center gap-2 text-sm text-accent">
            <span className="w-2 h-2 bg-accent rounded-full animate-pulse"></span>
            {t('header.processing')}
          </span>
        )}

        <button
          onClick={handleRefresh}
          className="p-2 hover:bg-bg-hover rounded-lg transition-colors"
          title={t('header.checkUpdates')}
        >
          <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        <button className="p-2 hover:bg-bg-hover rounded-lg transition-colors" title={t('header.settings')}>
          <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <button className="p-2 hover:bg-bg-hover rounded-lg transition-colors" title={t('header.minimize')}>
          <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
      </div>
    </header>
  )
}
