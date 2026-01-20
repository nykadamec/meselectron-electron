import { useEffect, useState, useCallback } from 'react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import * as Avatar from '@radix-ui/react-avatar'
import * as Separator from '@radix-ui/react-separator'
import { useAppStore, setOnQueueChange, loadProcessedFromDisk } from './store'
import { initUpdaterStore } from './store/updater'
import { initI18n, useLocaleStore } from './i18n'
import { Header } from './components/Header'
import { StatsPanel } from './components/StatsPanel'
import { MyVideosList } from './components/MyVideosList'
import { QueueList } from './components/QueueList'
import { LogViewer } from './components/LogViewer'
import { SettingsPanel } from './components/SettingsPanel'
import { Footer } from './components/Footer'
import { VideoList } from './components/VideoList'
import { UpdaterNotification } from './components/UpdaterNotification'
import type { VideoCandidate } from './types'
import {
  Search,
  Download,
  Settings,
  PlayCircle,
  FileText
} from 'lucide-react'

function App() {
  const localeStore = useLocaleStore()
  const {
    activeTab,
    setActiveTab,
    accounts,
    setAccounts,
    settings,
    setSettings,
    logs,
    addLog,
    updateVideo,
    queue,
    removeFromQueue,
    reorderQueue,
    clearQueue,
    pauseQueue,
    resumeQueue,
    retryFailedItems,
    isQueuePaused,
    stats,
    updateStats,
    setVideoCandidates,
    setDiscovering
  } = useAppStore()

  const [isLoading, setIsLoading] = useState(true)
  const [loginEmail, setLoginEmail] = useState<string | null>(null)

  const accountsReadCookies = async (accountId: string): Promise<string | null> => {
    if (!window.electronAPI) return null
    return window.electronAPI.accountsReadCookies(accountId)
  }

  const processQueue = useCallback(() => {
    if (!window.electronAPI) return
    const state = useAppStore.getState()
    const { isQueuePaused, queue, getActiveItem, updateQueueItem, getPendingCount, addLog } = state
    if (isQueuePaused) return
    if (getActiveItem()) return
    const nextItem = queue.find(item => item.status === 'pending')
    if (!nextItem) {
      const pendingCount = getPendingCount()
      if (pendingCount === 0) {
        addLog({ id: crypto.randomUUID(), timestamp: new Date(), level: 'info', message: 'Fronta je prázdná', source: 'queue' })
      }
      return
    }
    updateQueueItem(nextItem.id, { status: 'active', phase: 'download', startedAt: new Date() })
    addLog({ id: crypto.randomUUID(), timestamp: new Date(), level: 'info', message: `Zahájeno stahování: ${nextItem.video.title}`, source: 'queue' })
    window.electronAPI.downloadStart({
      videoId: nextItem.video.id,
      url: nextItem.video.url,
      cookies: nextItem.cookies || '',
      hqProcessing: settings.hqProcessing
    }).catch((error) => {
      addLog({ id: crypto.randomUUID(), timestamp: new Date(), level: 'error', message: `Chyba při stahování ${nextItem.video.title}: ${error}`, source: 'download' })
      updateQueueItem(nextItem.id, { status: 'failed', error: String(error), completedAt: new Date() })
      processQueue()
    })
  }, [settings.hqProcessing, addLog])

  const handleKillItem = useCallback((itemId: string) => {
    const state = useAppStore.getState()
    const { updateQueueItem } = state
    const item = state.queue.find(i => i.id === itemId)
    if (!item || item.status !== 'active') return
    updateQueueItem(itemId, { status: 'failed', error: 'Uživatel zrušil', completedAt: new Date() })
    if (window.electronAPI) {
      window.electronAPI.downloadStop?.()
      window.electronAPI.uploadStop?.()
    }
    processQueue()
  }, [processQueue])

  useEffect(() => {
    const initApp = async () => {
      if (!window.electronAPI) {
        addLog({ id: crypto.randomUUID(), timestamp: new Date(), level: 'warning', message: 'Aplikace běží mimo Electron prostředí', source: 'app' })
        setIsLoading(false)
        return
      }
      try {
        await initI18n()
        const loadedSettings = await window.electronAPI.settingsRead()
        setSettings(loadedSettings)
        await loadProcessedFromDisk()
        const loadedAccounts = await window.electronAPI.accountsList()
        setAccounts(loadedAccounts)
        const accountsNeedingLogin = loadedAccounts.filter((a: { needsLogin: boolean }) => a.needsLogin)
        if (accountsNeedingLogin.length > 0) setLoginEmail(accountsNeedingLogin[0].email)
        const autoLoginResults = await window.electronAPI.accountsAutoLogin()
        if (autoLoginResults && autoLoginResults.length > 0) {
          const successful = autoLoginResults.filter((r: { success: boolean }) => r.success).length
          addLog({ id: crypto.randomUUID(), timestamp: new Date(), level: successful > 0 ? 'success' : 'error', message: `Auto-login: ${successful}/${autoLoginResults.length} účtů přihlášeno`, source: 'app' })
          const refreshedAccounts = await window.electronAPI.accountsList()
          setAccounts(refreshedAccounts)
        }
        setLoginEmail(null)
        const platformInfo = await window.electronAPI.platformInfo()
        updateStats({ activeAccounts: loadedAccounts.length })
        addLog({ id: crypto.randomUUID(), timestamp: new Date(), level: 'info', message: `Aplikace spuštěna na ${platformInfo.platform}`, source: 'app' })
        initUpdaterStore().catch(console.error)
        setIsLoading(false)
      } catch (error) {
        addLog({ id: crypto.randomUUID(), timestamp: new Date(), level: 'error', message: `Chyba při inicializaci: ${error}`, source: 'app' })
        setIsLoading(false)
      }
    }
    initApp()
  }, [])

  useEffect(() => {
    setOnQueueChange(() => processQueue())
  }, [processQueue])

  useEffect(() => {
    if (!window.electronAPI) return
    const handleDownloadProgress = (_event: unknown, data: unknown) => {
      const d = data as { type: string; status?: string; progress?: number; speed?: number; eta?: number; message?: string; error?: string; videoId?: string; size?: number; path?: string }
      if (d.videoId) {
        let newStatus: 'pending' | 'downloading' | 'processing' | 'uploading' | 'completed' | 'failed' | 'already-exists' | 'skipped' = 'downloading'
        if (d.type === 'complete') newStatus = d.error ? (d.status as typeof newStatus) || 'failed' : 'completed'
        else if (d.type === 'error') newStatus = 'failed'
        else if (d.status && ['extracting', 'checking-size', 'downloading', 'assembling', 'watermarking'].includes(d.status)) newStatus = 'downloading'
        else if (d.status === 'already-exists') newStatus = 'already-exists'
        else if (d.status === 'skipped') newStatus = 'skipped'
        else if (d.status === 'completed') newStatus = 'completed'
        const videoUpdate: Record<string, unknown> = { status: newStatus, progress: d.progress || 0, speed: d.speed, eta: d.eta, error: d.error }
        if (d.size) videoUpdate.size = d.size
        updateVideo(d.videoId, videoUpdate)
        const { queue, updateQueueItem } = useAppStore.getState()
        const queueItem = queue.find(item => item.video.id === d.videoId)
        if (queueItem && queueItem.phase === 'download') {
          const currentProgress = queueItem.progress || 0
          const newProgress = d.progress ?? 0
          if (newProgress >= currentProgress || currentProgress === 0 || currentProgress === 100) {
            updateQueueItem(queueItem.id, { progress: d.progress, speed: d.speed, eta: d.eta, size: d.size || queueItem.size, subPhase: d.status === 'assembling' ? 'assembling' : d.status === 'watermarking' ? 'watermarking' : 'downloading' })
          }
        }
        if (d.type === 'complete') {
          const { queue, updateQueueItem, accounts } = useAppStore.getState()
          const q = queue.find(item => item.video.id === d.videoId)
          if (q) {
            if (d.error) {
              updateQueueItem(q.id, { status: 'failed', error: d.error, completedAt: new Date() })
              processQueue()
            } else {
              updateQueueItem(q.id, { phase: 'upload', progress: 100, uploadProgress: 0, status: 'active' })
              addLog({ id: crypto.randomUUID(), timestamp: new Date(), level: 'info', message: `Nahrávám: ${q.video.title}`, source: 'upload' })
              const account = accounts.find(a => a.id === q.accountId)
              if (account && d.path) {
                window.electronAPI.accountsReadCookies(account.id).then((cookies) => {
                  window.electronAPI.uploadStart({ filePath: d.path, cookies: cookies || undefined, videoId: q.video.id }).catch((error) => {
                    addLog({ id: crypto.randomUUID(), timestamp: new Date(), level: 'error', message: `Chyba nahrávání ${q.video.title}: ${error}`, source: 'upload' })
                    updateQueueItem(q.id, { status: 'failed', error: String(error), completedAt: new Date() })
                    processQueue()
                  })
                }).catch((error) => {
                  addLog({ id: crypto.randomUUID(), timestamp: new Date(), level: 'error', message: `Chyba čtení cookies: ${error}`, source: 'upload' })
                  updateQueueItem(q.id, { status: 'failed', error: String(error), completedAt: new Date() })
                  processQueue()
                })
              } else {
                updateQueueItem(q.id, { status: 'failed', error: 'Chybí účet nebo cesta k souboru', completedAt: new Date() })
                processQueue()
              }
            }
          }
        }
      }
      if (d.status && d.type !== 'progress') {
        addLog({ id: crypto.randomUUID(), timestamp: new Date(), level: d.type === 'error' ? 'error' : 'info', message: `[${d.status}]`, source: 'download' })
      }
      if (d.message) {
        addLog({ id: crypto.randomUUID(), timestamp: new Date(), level: d.type === 'error' ? 'error' : 'info', message: d.message, source: 'download' })
      }
    }
    const handleUploadProgress = (_event: unknown, data: unknown) => {
      const d = data as { type: string; progress?: number; speed?: number; eta?: number; message?: string; error?: string; videoId?: string }
      const findUploadItem = () => {
        const { queue } = useAppStore.getState()
        if (d.videoId) return queue.find(item => item.video.id === d.videoId)
        return queue.find(item => item.phase === 'upload' && item.status === 'active')
      }
      if (d.progress !== undefined || d.speed !== undefined) {
        const { updateQueueItem } = useAppStore.getState()
        const uploadItem = findUploadItem()
        if (uploadItem) updateQueueItem(uploadItem.id, { uploadProgress: d.progress, speed: d.speed, eta: d.eta })
      }
      if (d.type === 'complete') {
        const { updateQueueItem } = useAppStore.getState()
        const uploadItem = findUploadItem()
        if (uploadItem) {
          if (d.error) {
            updateQueueItem(uploadItem.id, { status: 'failed', error: d.error, completedAt: new Date() })
          } else {
            updateQueueItem(uploadItem.id, { status: 'completed', progress: 100, uploadProgress: 100, completedAt: new Date() })
            useAppStore.getState().addProcessedUrl(uploadItem.video.url)
          }
          processQueue()
        }
      }
      if (d.message || d.error) {
        addLog({ id: crypto.randomUUID(), timestamp: new Date(), level: d.type === 'error' ? 'error' : 'info', message: d.message || d.error || '', source: 'upload' })
      }
    }
    const handleDiscoverProgress = (_event: unknown, data: unknown) => {
      const d = data as { type: string; progress?: number; message?: string; candidates?: VideoCandidate[]; error?: string; success?: boolean }
      if (d.type === 'progress') {
        setDiscovering(true, d.progress || 0, d.message || '')
        if (d.message) addLog({ id: crypto.randomUUID(), timestamp: new Date(), level: 'info', message: d.message, source: 'discover' })
      } else if (d.type === 'status') {
        setDiscovering(true, d.progress || 0, d.message || '')
      } else if (d.type === 'complete') {
        setDiscovering(false, 100, d.success ? 'Hotovo' : 'Chyba')
        if (d.success && d.candidates) {
          setVideoCandidates(d.candidates)
          addLog({ id: crypto.randomUUID(), timestamp: new Date(), level: 'success', message: `Nalezeno ${d.candidates.length} videí k stažení`, source: 'discover' })
        }
        if (d.error) addLog({ id: crypto.randomUUID(), timestamp: new Date(), level: 'error', message: `Chyba při vyhledávání: ${d.error}`, source: 'discover' })
      }
    }
    window.electronAPI.onDownloadProgress(handleDownloadProgress)
    window.electronAPI.onUploadProgress(handleUploadProgress)
    window.electronAPI.onDiscoverProgress(handleDiscoverProgress)
    return () => {
      window.electronAPI.removeListener('download:progress', handleDownloadProgress)
      window.electronAPI.removeListener('upload:progress', handleUploadProgress)
      window.electronAPI.removeListener('discover:progress', handleDiscoverProgress)
    }
  }, [updateVideo, addLog, setVideoCandidates, setDiscovering, processQueue])

  const navItems = [
    { id: 'videos', label: localeStore.t('nav.videos'), icon: Search },
    { id: 'downloads', label: localeStore.t('nav.process'), icon: Download },
    { id: 'logs', label: localeStore.t('nav.logs'), icon: FileText },
    { id: 'settings', label: localeStore.t('nav.settings'), icon: Settings },
    { id: 'myvideos', label: localeStore.t('nav.myVideos'), icon: PlayCircle }
  ]

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-background-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px', width: 48, height: 48 }} />
          <p style={{ color: 'var(--color-text-secondary)' }}>
            {loginEmail ? `Přihlašování jako ${loginEmail}...` : 'Načítání...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-background-base)', color: 'var(--color-text-primary)', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <aside style={{ width: 260, backgroundColor: 'var(--color-surface-base)', borderRight: '1px solid var(--color-border-base)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <ScrollArea.Root style={{ flex: 1, overflow: 'hidden' }}>
            <ScrollArea.Viewport style={{ width: '100%', height: '100%' }}>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Accounts Section - First */}
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, paddingLeft: 12 }}>{localeStore.t('accounts.accounts')}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {accounts.map((account) => (
                      <div key={account.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', backgroundColor: 'var(--color-surface-elevated)', borderRadius: 8, border: '1px solid var(--color-border-base)', transition: 'border-color 0.15s ease' }}>
                        <Avatar.Root style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', backgroundColor: account.isActive ? 'var(--color-success)' : 'var(--color-text-muted)', overflow: 'hidden', flexShrink: 0 }}>
                          <Avatar.Fallback style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>{account.email[0].toUpperCase()}</Avatar.Fallback>
                        </Avatar.Root>
                        <div style={{ flex: 1, minWidth: 0, lineHeight: '15px'}}>
                          <p style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{account.email.split('@')[0]}</p>
                          {account.credits !== undefined && (
                            <span style={{ fontSize: 11, color: 'var(--color-accent-base)' }}>
                              {account.credits} kred
                            </span>
                          )}
                        </div>
                        {account.isActive && <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--color-success)', flexShrink: 0 }} />}
                      </div>
                    ))}
                    {accounts.length === 0 && <p style={{ fontSize: 13, color: 'var(--color-text-muted)', paddingLeft: 12 }}>{localeStore.t('accounts.noAccounts')}</p>}
                  </div>
                </div>
                <Separator.Root style={{ backgroundColor: 'var(--color-border-base)', height: 1 }} />

                {/* Navigation Section - Second */}
                <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, paddingLeft: 12 }}>Navigace</p>
                  {navItems.map((item) => (
                    <button key={item.id} onClick={() => setActiveTab(item.id as typeof activeTab)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: 'none', backgroundColor: activeTab === item.id ? 'var(--color-accent-muted)' : 'transparent', color: activeTab === item.id ? 'var(--color-accent-base)' : 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 14, fontWeight: 500, transition: 'all 0.15s ease', textAlign: 'left' }}>
                      <item.icon style={{ width: 18, height: 18 }} />
                      {item.label}
                      {activeTab === item.id && <div style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--color-accent-base)' }} />}
                    </button>
                  ))}
                </nav>
                <Separator.Root style={{ backgroundColor: 'var(--color-border-base)', height: 1 }} />

                {/* Statistics Section - Enhanced */}
                <div style={{ backgroundColor: 'var(--color-surface-elevated)', borderRadius: 10, padding: 12, border: '1px solid var(--color-border-base)' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Statistiky</p>
                  <StatsPanel stats={stats} accounts={accounts} />
                </div>
              </div>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar orientation="vertical" style={{ display: 'flex', width: 6, padding: 2, backgroundColor: 'transparent' }}>
              <ScrollArea.Thumb style={{ flex: 1, backgroundColor: 'var(--color-border-base)', borderRadius: 3 }} />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        </aside>

        {/* Main Content */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          <ScrollArea.Root style={{ flex: 1, overflow: 'hidden' }}>
            <ScrollArea.Viewport style={{ width: '100%', height: '100%' }}>
              <div style={{ padding: 24, paddingBottom: 80 }}>
                {activeTab === 'videos' && <VideoList />}
                {activeTab === 'downloads' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {queue.length > 0 && (
                      <div className="card-base">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                          <h3 style={{ fontWeight: 600, fontSize: 16 }}>Fronta ({queue.length})</h3>
                          <div style={{ display: 'flex', gap: 8 }}>
                            {isQueuePaused ? <button onClick={resumeQueue} className="btn-secondary" style={{ fontSize: 13, padding: '6px 12px' }}>Pokračovat</button> : <button onClick={pauseQueue} className="btn-secondary" style={{ fontSize: 13, padding: '6px 12px' }}>Pozastavit</button>}
                            {queue.some(item => item.status === 'failed') && <button onClick={retryFailedItems} className="btn-secondary" style={{ fontSize: 13, padding: '6px 12px' }}>Zkusit znovu</button>}
                            <button onClick={clearQueue} className="btn-secondary" style={{ fontSize: 13, padding: '6px 12px', color: 'var(--color-error)' }}>Vyčistit</button>
                          </div>
                        </div>
                        <QueueList queue={queue} isQueuePaused={isQueuePaused} onPause={pauseQueue} onResume={resumeQueue} onCancel={clearQueue} onRetry={retryFailedItems} onRemove={removeFromQueue} onReorder={reorderQueue} onKill={handleKillItem} />
                      </div>
                    )}
                    {queue.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '48px 24px', backgroundColor: 'var(--color-surface-base)', borderRadius: 12, border: '1px dashed var(--color-border-base)' }}>
                        <div style={{ width: 48, height: 48, margin: '0 auto 16px', borderRadius: '50%', backgroundColor: 'var(--color-surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Download style={{ width: 24, height: 24, color: 'var(--color-text-muted)' }} />
                        </div>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 8 }}>Prázdná fronta</p>
                        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Přidejte videa z karty "Objevit videa"</p>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'logs' && <LogViewer logs={logs} />}
                {activeTab === 'settings' && <SettingsPanel />}
                {activeTab === 'myvideos' && <MyVideosList />}
              </div>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar orientation="vertical" style={{ display: 'flex', width: 6, padding: 2, backgroundColor: 'transparent' }}>
              <ScrollArea.Thumb style={{ flex: 1, backgroundColor: 'var(--color-border-base)', borderRadius: 3 }} />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
          <Footer />
        </main>
      </div>
      <UpdaterNotification />
    </div>
  )
}

export default App
