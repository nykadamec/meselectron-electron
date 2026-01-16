import { useEffect, useState, useCallback } from 'react'
import path from 'path'
import { useAppStore } from './store'
import { Header } from './components/Header'
import { AccountCard } from './components/AccountCard'
import { StatsPanel } from './components/StatsPanel'
import { VideoCard } from './components/VideoCard'
import { MyVideosCard } from './components/MyVideosCard'
import { QueueList } from './components/QueueList'
import { LogViewer } from './components/LogViewer'
import { SettingsPanel } from './components/SettingsPanel'
import { Footer } from './components/Footer'
import type { VideoCandidate } from './types'

function App() {
  const {
    activeTab,
    setActiveTab,
    accounts,
    setAccounts,
    settings,
    setSettings,
    logs,
    addLog,
    videos,
    addVideo,
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
    setIsProcessing,
    isProcessing,
    videoCandidates,
    selectedCandidates,
    isDiscovering,
    discoverProgress,
    discoverMessage,
    setVideoCandidates,
    toggleCandidate,
    selectAllCandidates,
    clearCandidates,
    setDiscovering,
    myVideos,
    myVideosPage,
    isLoadingMyVideos,
    myVideosHasMore,
    myVideosError
  } = useAppStore()

  const [isLoading, setIsLoading] = useState(true)
  const [loginEmail, setLoginEmail] = useState<string | null>(null)

  // Helper function to read cookies for an account
  const accountsReadCookies = async (accountId: string): Promise<string | null> => {
    if (!window.electronAPI) return null
    return window.electronAPI.accountsReadCookies(accountId)
  }

  // Initialize app
  useEffect(() => {
    const initApp = async () => {
      if (!window.electronAPI) {
        addLog({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          level: 'warning',
          message: 'Aplikace běží mimo Electron prostředí',
          source: 'app'
        })
        setIsLoading(false)
        return
      }

      try {
        const loadedSettings = await window.electronAPI.settingsRead()
        setSettings(loadedSettings)

        const loadedAccounts = await window.electronAPI.accountsList()
        setAccounts(loadedAccounts)

        // Auto-login for accounts with credentials but no cookies
        // First, find accounts that need login
        const accountsNeedingLogin = loadedAccounts.filter((a: { needsLogin: boolean }) => a.needsLogin)
        if (accountsNeedingLogin.length > 0) {
          // Set login email for loading display
          setLoginEmail(accountsNeedingLogin[0].email)
        }

        const autoLoginResults = await window.electronAPI.accountsAutoLogin()
        if (autoLoginResults && autoLoginResults.length > 0) {
          const successful = autoLoginResults.filter((r: { success: boolean }) => r.success).length
          addLog({
            id: crypto.randomUUID(),
            timestamp: new Date(),
            level: successful > 0 ? 'success' : 'error',
            message: `Auto-login: ${successful}/${autoLoginResults.length} účtů přihlášeno`,
            source: 'app'
          })
          // Refresh accounts list after auto-login
          const refreshedAccounts = await window.electronAPI.accountsList()
          setAccounts(refreshedAccounts)
        }
        setLoginEmail(null)

        const platformInfo = await window.electronAPI.platformInfo()
        updateStats({ activeAccounts: loadedAccounts.length })

        addLog({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          level: 'info',
          message: `Aplikace spuštěna na ${platformInfo.platform}`,
          source: 'app'
        })

        setIsLoading(false)
      } catch (error) {
        addLog({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          level: 'error',
          message: `Chyba při inicializaci: ${error}`,
          source: 'app'
        })
        setIsLoading(false)
      }
    }

    initApp()
  }, [])

  // Set up listeners for progress updates
  useEffect(() => {
    if (!window.electronAPI) return

    const handleDownloadProgress = (_event: unknown, data: unknown) => {
      const progressData = data as {
        type: string
        status?: string
        progress?: number
        speed?: number
        eta?: number
        message?: string
        error?: string
        videoId?: string
        size?: number
        path?: string  // File path returned from successful download
      }

      // Debug: log all progress updates
      console.log(
        '[RENDERER-DOWNLOAD]',
        'type:', progressData.type,
        '| status:', progressData.status,
        '| videoId:', progressData.videoId?.substring(0, 8),
        '| progress:', progressData.progress?.toFixed(1) + '%',
        '| speed:', progressData.speed ? (progressData.speed / 1024 / 1024).toFixed(1) + ' MB/s' : 'N/A',
        '| error:', progressData.error || 'none',
        '| success:', progressData.type === 'complete' && !progressData.error
      )

      if (progressData.videoId) {
        // Determine status based on type and worker status
        let newStatus: 'pending' | 'downloading' | 'processing' | 'uploading' | 'completed' | 'failed' | 'already-exists' | 'skipped' = 'downloading'

        if (progressData.type === 'complete') {
          // Check if completed with error or skipped
          if (progressData.error) {
            newStatus = progressData.status as 'failed' | 'already-exists' | 'skipped' || 'failed'
          } else {
            newStatus = 'completed'
          }
        } else if (progressData.type === 'error') {
          newStatus = 'failed'
        } else if (progressData.status) {
          // Use status from worker (extracting, downloading, already-exists, skipped, etc.)
          if (['extracting', 'checking-size', 'downloading', 'assembling', 'watermarking'].includes(progressData.status)) {
            newStatus = 'downloading'
          } else if (progressData.status === 'already-exists') {
            newStatus = 'already-exists'
          } else if (progressData.status === 'skipped') {
            newStatus = 'skipped'
          } else if (progressData.status === 'completed') {
            newStatus = 'completed'
          } else {
            newStatus = progressData.status as typeof newStatus
          }
        }

        // Build update object - only include size if provided
        const videoUpdate: Record<string, unknown> = {
          status: newStatus,
          progress: progressData.progress || 0,
          speed: progressData.speed,
          eta: progressData.eta,
          error: progressData.error
        }
        if (progressData.size) {
          videoUpdate.size = progressData.size
        }
        updateVideo(progressData.videoId, videoUpdate)

        // Sync progress to queue item
        const { queue, updateQueueItem } = useAppStore.getState()
        const queueItem = queue.find(item => item.video.id === progressData.videoId)
        if (queueItem) {
          // Only update download progress when in download phase
          if (queueItem.phase === 'download') {
            // Prevent progress from jumping backwards (parallel chunk downloads)
            const currentProgress = queueItem.progress || 0
            const newProgress = progressData.progress ?? 0
            if (newProgress >= currentProgress || currentProgress === 0 || currentProgress === 100) {
              updateQueueItem(queueItem.id, {
                progress: progressData.progress,
                speed: progressData.speed,
                eta: progressData.eta,
                size: progressData.size || queueItem.size,
                subPhase: progressData.status === 'assembling' ? 'assembling' :
                          progressData.status === 'watermarking' ? 'watermarking' : 'downloading'
              })
            }
          }
        }

        // Handle queue completion - 2 phase system (download -> upload)
        if (progressData.type === 'complete') {
          const { queue, updateQueueItem, accounts } = useAppStore.getState()
          const queueItem = queue.find(item => item.video.id === progressData.videoId)
          if (queueItem) {
            if (progressData.error) {
              // Download failed
              updateQueueItem(queueItem.id, {
                status: 'failed',
                error: progressData.error,
                completedAt: new Date()
              })
              processQueue()
            } else {
              // Download successful - start upload phase
              updateQueueItem(queueItem.id, {
                phase: 'upload',
                progress: 100,
                uploadProgress: 0,
                status: 'active'
              })

              addLog({
                id: crypto.randomUUID(),
                timestamp: new Date(),
                level: 'info',
                message: `Nahrávám: ${queueItem.video.title}`,
                source: 'upload'
              })

              // Start upload
              const account = accounts.find(a => a.id === queueItem.accountId)
              if (account && progressData.path) {
                // Read cookies from file first (FIX: was using cookiesFile path instead of actual cookies)
                window.electronAPI.accountsReadCookies(account.id).then((cookies) => {
                  window.electronAPI.uploadStart({
                    filePath: progressData.path,
                    cookies: cookies || undefined,
                    videoId: queueItem.video.id
                  }).catch((error) => {
                    addLog({
                      id: crypto.randomUUID(),
                      timestamp: new Date(),
                      level: 'error',
                      message: `Chyba nahrávání ${queueItem.video.title}: ${error}`,
                      source: 'upload'
                    })
                    updateQueueItem(queueItem.id, {
                      status: 'failed',
                      error: String(error),
                      completedAt: new Date()
                    })
                    processQueue()
                  })
                }).catch((error) => {
                  addLog({
                    id: crypto.randomUUID(),
                      timestamp: new Date(),
                      level: 'error',
                      message: `Chyba čtení cookies: ${error}`,
                      source: 'upload'
                    })
                  updateQueueItem(queueItem.id, {
                    status: 'failed',
                    error: String(error),
                    completedAt: new Date()
                  })
                  processQueue()
                })
              } else {
                // No account or file path - mark as completed with error
                updateQueueItem(queueItem.id, {
                  status: 'failed',
                  error: 'Chybí účet nebo cesta k souboru',
                  completedAt: new Date()
                })
                processQueue()
              }
            }
          }
        }
      }

      // Log status updates from worker
      if (progressData.status && progressData.type !== 'progress') {
        addLog({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          level: progressData.type === 'error' ? 'error' : 'info',
          message: `[${progressData.status}]`,
          source: 'download'
        })
      }

      if (progressData.message) {
        addLog({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          level: progressData.type === 'error' ? 'error' : 'info',
          message: progressData.message,
          source: 'download'
        })
      }
    }

    const handleUploadProgress = (_event: unknown, data: unknown) => {
      const progressData = data as {
        type: string
        progress?: number
        speed?: number
        eta?: number
        message?: string
        error?: string
        videoId?: string  // Track which video is uploading
      }

      // Helper to find upload item by video.id or fallback to active upload
      const findUploadItem = () => {
        const { queue } = useAppStore.getState()
        if (progressData.videoId) {
          return queue.find(item => item.video.id === progressData.videoId)
        }
        return queue.find(item => item.phase === 'upload' && item.status === 'active')
      }

      // Sync upload progress to queue
      if (progressData.progress !== undefined || progressData.speed !== undefined) {
        const { updateQueueItem } = useAppStore.getState()
        const uploadItem = findUploadItem()
        if (uploadItem) {
          updateQueueItem(uploadItem.id, {
            uploadProgress: progressData.progress,
            speed: progressData.speed,
            eta: progressData.eta
          })
        }
      }

      // Handle upload completion
      if (progressData.type === 'complete') {
        const { updateQueueItem, queue } = useAppStore.getState()
        console.log('[UI] complete received:', {
          videoId: progressData.videoId,
          queueVideoIds: queue.map(q => q.video.id)
        })
        const uploadItem = findUploadItem()
        console.log('[UI] findUploadItem result:', uploadItem ? uploadItem.video.id : 'NOT FOUND')
        if (uploadItem) {
          if (progressData.error) {
            updateQueueItem(uploadItem.id, {
              status: 'failed',
              error: progressData.error,
              completedAt: new Date()
            })
          } else {
            updateQueueItem(uploadItem.id, {
              status: 'completed',
              progress: 100,
              uploadProgress: 100,
              completedAt: new Date()
            })
          }
          processQueue()  // Process next item in queue
        }
      }

      if (progressData.message || progressData.error) {
        addLog({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          level: progressData.type === 'error' ? 'error' : 'info',
          message: progressData.message || progressData.error || '',
          source: 'upload'
        })
      }
    }

    const handleDiscoverProgress = (_event: unknown, data: unknown) => {
      const progressData = data as {
        type: string
        progress?: number
        message?: string
        candidates?: VideoCandidate[]
        scanned?: number
        total?: number
        found?: number
        error?: string
        success?: boolean
      }

      if (progressData.type === 'progress') {
        setDiscovering(true, progressData.progress || 0, progressData.message || '')
        if (progressData.message) {
          addLog({
            id: crypto.randomUUID(),
            timestamp: new Date(),
            level: 'info',
            message: progressData.message,
            source: 'discover'
          })
        }
      } else if (progressData.type === 'status') {
        setDiscovering(true, progressData.progress || 0, progressData.message || '')
      } else if (progressData.type === 'complete') {
        setDiscovering(false, 100, progressData.success ? 'Hotovo' : 'Chyba')
        if (progressData.success && progressData.candidates) {
          setVideoCandidates(progressData.candidates)
          addLog({
            id: crypto.randomUUID(),
            timestamp: new Date(),
            level: 'success',
            message: `Nalezeno ${progressData.candidates.length} videí k stažení`,
            source: 'discover'
          })
        }
        if (progressData.error) {
          addLog({
            id: crypto.randomUUID(),
            timestamp: new Date(),
            level: 'error',
            message: `Chyba při vyhledávání: ${progressData.error}`,
            source: 'discover'
          })
        }
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
  }, [updateVideo, addLog, setVideoCandidates, setDiscovering])

  // Process next item in queue
  const processQueue = useCallback(() => {
    if (!window.electronAPI) return

    const { isQueuePaused, queue, getActiveItem, updateQueueItem, getPendingCount } = useAppStore.getState()

    // Check if paused
    if (isQueuePaused) {
      return
    }

    // Check if already processing something
    const activeItem = getActiveItem()
    if (activeItem) {
      return
    }

    // Find next pending item
    const nextItem = queue.find(item => item.status === 'pending')
    if (!nextItem) {
      const pendingCount = getPendingCount()
      if (pendingCount === 0) {
        addLog({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          level: 'info',
          message: 'Fronta je prázdná',
          source: 'queue'
        })
      }
      return
    }

    // Mark as active
    updateQueueItem(nextItem.id, {
      status: 'active',
      phase: 'download',
      startedAt: new Date()
    })

    addLog({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      level: 'info',
      message: `Zahájeno stahování: ${nextItem.video.title}`,
      source: 'queue'
    })

    // Start the download
    window.electronAPI.downloadStart({
      videoId: nextItem.video.id,
      url: nextItem.video.url,
      cookies: nextItem.cookies || ''
    }).catch((error) => {
      addLog({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        level: 'error',
        message: `Chyba při stahování ${nextItem.video.title}: ${error}`,
        source: 'download'
      })

      // Mark as failed and continue with next
      updateQueueItem(nextItem.id, {
        status: 'failed',
        error: String(error),
        completedAt: new Date()
      })

      // Process next item
      processQueue()
    })
  }, [addLog])

  // Handler for downloading selected videos
  const handleDownloadSelected = useCallback(async () => {
    if (!window.electronAPI || selectedCandidates.length === 0 || accounts.length === 0) {
      addLog({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        level: 'warning',
        message: 'Nelze stáhnout - žádná videa vybrána',
        source: 'app'
      })
      return
    }

    // Clear candidates to hide the video list
    clearCandidates()

    addLog({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      level: 'info',
      message: `Přidávám ${selectedCandidates.length} videí do fronty`,
      source: 'app'
    })

    // Get account cookies
    const cookies = await window.electronAPI.accountsReadCookies(accounts[0].id)

    // Get addToQueue from store
    const { addToQueue } = useAppStore.getState()

    // Add each selected video to the queue
    for (const url of selectedCandidates) {
      const candidate = videoCandidates.find(c => c.url === url)
      if (candidate) {
        const videoId = crypto.randomUUID()

        // Create video entry
        addVideo({
          id: videoId,
          title: candidate.title,
          url: candidate.url,
          status: 'pending',
          progress: 0,
          size: 0
        })

        // Add to queue
        addToQueue({
          id: crypto.randomUUID(),
          type: 'download',
          video: {
            id: videoId,
            title: candidate.title,
            url: candidate.url,
            status: 'pending',
            progress: 0,
            size: 0
          },
          accountId: accounts[0].id,
          status: 'pending',
          priority: useAppStore.getState().queue.length + 1,
          cookies: cookies || '',
          addedAt: new Date()
        })
      }
    }

    // Start processing queue
    processQueue()

    addLog({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      level: 'success',
      message: `Přidáno ${selectedCandidates.length} videí do fronty`,
      source: 'app'
    })
  }, [accounts, selectedCandidates, videoCandidates, addLog, clearCandidates])

  // Handler for starting video discovery
  const handleStartDownload = useCallback(async () => {
    if (!window.electronAPI || accounts.length === 0) {
      addLog({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        level: 'warning',
        message: 'Nelze stáhnout - žádné účty',
        source: 'app'
      })
      return
    }

    // Show info about settings
    addLog({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      level: 'info',
      message: `Vyhledávám videa: max ${settings.videoCount} kandidátů`,
      source: 'app'
    })

    // Clear previous candidates
    clearCandidates()

    // Get account cookies
    const cookies = await window.electronAPI.accountsReadCookies(accounts[0].id)

    // Start discovery
    setIsProcessing(true)
    setDiscovering(true, 0, 'Začínám vyhledávání...')

    try {
      await window.electronAPI.discoverStart({
        cookies: cookies || '',
        count: settings.videoCount
      })
    } catch (error) {
      addLog({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        level: 'error',
        message: `Chyba při vyhledávání: ${error}`,
        source: 'app'
      })
      setDiscovering(false, 0, '')
      setIsProcessing(false)
    }
  }, [accounts, settings, addLog, clearCandidates, setDiscovering, setIsProcessing])

  // Handler for selecting and uploading files
  const handleUploadFiles = useCallback(async () => {
    if (!window.electronAPI || accounts.length === 0) {
      addLog({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        level: 'warning',
        message: 'Nelze nahrát - žádné účty',
        source: 'app'
      })
      return
    }

    try {
      const filePaths = await window.electronAPI.filesSelectUpload()
      if (filePaths.length === 0) return

      setIsProcessing(true)
      addLog({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        level: 'info',
        message: `Vybráno ${filePaths.length} souborů k nahrání`,
        source: 'upload'
      })

      // Get account cookies
      const cookies = await window.electronAPI.accountsReadCookies(accounts[0].id)

      // Upload each file
      for (const filePath of filePaths) {
        const fileName = filePath.split('/').pop() || 'unknown'

        addLog({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          level: 'info',
          message: `Nahrávání: ${fileName}`,
          source: 'upload'
        })

        try {
          await window.electronAPI.uploadStart({ filePath, cookies: cookies || undefined })
          updateStats({ totalUploaded: stats.totalUploaded + 1 })

          addLog({
            id: crypto.randomUUID(),
            timestamp: new Date(),
            level: 'success',
            message: `Nahráno: ${fileName}`,
            source: 'upload'
          })
        } catch (error) {
          addLog({
            id: crypto.randomUUID(),
            timestamp: new Date(),
            level: 'error',
            message: `Chyba při nahrávání ${fileName}: ${error}`,
            source: 'upload'
          })
        }
      }

      setIsProcessing(false)
    } catch (error) {
      addLog({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        level: 'error',
        message: `Chyba: ${error}`,
        source: 'app'
      })
      setIsProcessing(false)
    }
  }, [accounts, updateStats, addLog, setIsProcessing])

  // Handler for opening folder
  const handleOpenFolder = useCallback(async () => {
    if (!window.electronAPI) return

    const platformInfo = await window.electronAPI.platformInfo()
    const videosPath = path.join(platformInfo.appPath, 'VIDEOS')

    try {
      await window.electronAPI.filesOpenFolder(videosPath)
    } catch {
      addLog({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        level: 'error',
        message: 'Nelze otevřít složku',
        source: 'app'
      })
    }
  }, [addLog])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary">
            {loginEmail ? `Logging in as ${loginEmail}...` : 'Načítání...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-main text-text-primary flex flex-col">
      <Header />

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-bg-card border-r border-border flex flex-col">
          {/* Accounts */}
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-3">
              Účty
            </h3>
            <div className="space-y-2">
              {accounts.map((account) => (
                <AccountCard key={account.id} account={account} />
              ))}
              {accounts.length === 0 && (
                <p className="text-sm text-text-muted">Žádné účty nenalezeny</p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="p-4 border-b border-border">
            <StatsPanel stats={stats} accounts={accounts} />
          </div>

          {/* Actions */}
          <div className="p-4 space-y-2">
            <button
              onClick={handleStartDownload}
              disabled={queue.length > 0}
              className="btn-primary w-full text-sm disabled:opacity-50"
            >
              Stáhnout videa
            </button>
            <button
              onClick={handleUploadFiles}
              disabled={queue.length > 0}
              className="btn-primary w-full text-sm disabled:opacity-50"
            >
              Nahrát videa
            </button>
            <button
              onClick={handleOpenFolder}
              className="btn-secondary w-full text-sm"
            >
              Otevřít složku
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border bg-bg-card">
            {[
              { id: 'downloads', label: 'Stahování' },
              { id: 'uploads', label: 'Nahrávání' },
              { id: 'logs', label: 'Logy' },
              { id: 'settings', label: 'Nastavení' },
              { id: 'myvideos', label: 'Moje videa' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto p-4">
            {activeTab === 'downloads' && (
              <div className="space-y-4">
                {queue.length > 0 && (
                  <div className="card">
                    <h3 className="font-medium mb-3">Fronta ({queue.length})</h3>
                    <QueueList
                      queue={queue}
                      isQueuePaused={isQueuePaused}
                      onPause={pauseQueue}
                      onResume={resumeQueue}
                      onCancel={clearQueue}
                      onRetry={retryFailedItems}
                      onRemove={removeFromQueue}
                      onReorder={reorderQueue}
                    />
                  </div>
                )}

                {/* Video Candidates Section */}
                {videoCandidates.length > 0 && (
                  <div className="card">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-medium">
                        Nalezená videa ({selectedCandidates.length}/{videoCandidates.length} vybráno)
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={selectAllCandidates}
                          className="btn-secondary text-sm"
                        >
                          Vybrat vše
                        </button>
                        <button
                          onClick={clearCandidates}
                          className="btn-secondary text-sm"
                        >
                          Vymazat
                        </button>
                      </div>
                    </div>

                    {/* Discovery progress bar */}
                    {isDiscovering && (
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span>{discoverMessage}</span>
                          <span>{Math.round(discoverProgress)}%</span>
                        </div>
                        <div className="w-full bg-bg-hover rounded-full h-2">
                          <div
                            className="bg-accent h-2 rounded-full transition-all"
                            style={{ width: `${discoverProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Video candidates list */}
                    <div className="space-y-1">
                      {videoCandidates.map((candidate) => (
                        <VideoCard
                          key={candidate.url}
                          video={candidate}
                          variant="list"
                          selected={selectedCandidates.includes(candidate.url)}
                          onClick={() => toggleCandidate(candidate.url)}
                        />
                      ))}
                    </div>

                    {/* Download selected button */}
                    {selectedCandidates.length > 0 && (
                      <div className="mt-4 flex justify-end">
                        <button onClick={handleDownloadSelected} className="btn-primary">
                          Stáhnout vybraná ({selectedCandidates.length})
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Completed videos - only show completed, not downloading */}
                {videos.filter(v => v.status === 'completed' || v.status === 'failed' || v.status === 'already-exists' || v.status === 'skipped').length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {videos
                      .filter(v => v.status === 'completed' || v.status === 'failed' || v.status === 'already-exists' || v.status === 'skipped')
                      .map((video) => (
                        <VideoCard key={video.id} video={video} />
                      ))}
                  </div>
                )}

                {videos.filter(v => v.status === 'completed' || v.status === 'failed' || v.status === 'already-exists' || v.status === 'skipped').length === 0 && videoCandidates.length === 0 && !isDiscovering && (
                  <div className="text-center py-12">
                    <p className="text-text-muted">Žádná dokončená videa</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'uploads' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-medium">Nahrávání</h2>
                  <button
                    onClick={handleUploadFiles}
                    disabled={isProcessing}
                    className="btn-primary disabled:opacity-50"
                  >
                    Vybrat videa
                  </button>
                </div>

                {videos.filter(v => v.status === 'uploading').length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {videos
                      .filter(v => v.status === 'uploading')
                      .map((video) => (
                        <VideoCard key={video.id} video={video} />
                      ))}
                  </div>
                )}

                {videos.filter(v => v.status === 'uploading').length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-text-muted">Žádná videa se nenahrávají</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'logs' && (
              <LogViewer logs={logs} />
            )}

            {activeTab === 'settings' && (
              <SettingsPanel />
            )}

            {activeTab === 'myvideos' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-medium">Moje videa</h2>
                  <button
                    onClick={() => {
                      // Load first page with first active account's cookies
                      const activeAccount = accounts.find(acc => acc.isActive)
                      if (activeAccount) {
                        accountsReadCookies(activeAccount.id).then(cookies => {
                          if (cookies) {
                            useAppStore.getState().clearMyVideos()
                            useAppStore.getState().loadMyVideos(1, cookies)
                          }
                        })
                      }
                    }}
                    disabled={isLoadingMyVideos || accounts.length === 0}
                    className="btn-primary disabled:opacity-50"
                  >
                    {isLoadingMyVideos ? 'Načítání...' : 'Načíst videa'}
                  </button>
                </div>

                {myVideosError && (
                  <div className="p-4 bg-error/10 border border-error rounded-lg">
                    <p className="text-error text-sm">{myVideosError}</p>
                  </div>
                )}

                {myVideos.length > 0 && (
                  <div className="card">
                    <div className="space-y-1">
                      {myVideos.map((video) => (
                        <MyVideosCard key={video.id} video={video} />
                      ))}
                    </div>
                  </div>
                )}

                {myVideos.length === 0 && !isLoadingMyVideos && (
                  <div className="text-center py-12">
                    <p className="text-text-muted">Žádná videa k zobrazení</p>
                    <p className="text-xs text-text-muted mt-2">Klikněte na tlačítko "Načíst videa" pro zobrazení vašich nahraných videí</p>
                  </div>
                )}

                {isLoadingMyVideos && (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
                  </div>
                )}

                {myVideos.length > 0 && myVideosHasMore && !isLoadingMyVideos && (
                  <div className="flex justify-center gap-4">
                    {myVideosPage > 1 && (
                      <button
                        onClick={() => {
                          const activeAccount = accounts.find(acc => acc.isActive)
                          if (activeAccount) {
                            accountsReadCookies(activeAccount.id).then(cookies => {
                              if (cookies) {
                                const prevPage = myVideosPage - 1
                                useAppStore.getState().loadMyVideos(prevPage, cookies)
                              }
                            })
                          }
                        }}
                        className="btn-secondary"
                      >
                        Zpět (stránka {myVideosPage - 1})
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const activeAccount = accounts.find(acc => acc.isActive)
                        if (activeAccount) {
                          accountsReadCookies(activeAccount.id).then(cookies => {
                            if (cookies) {
                              const nextPage = myVideosPage + 1
                              useAppStore.getState().loadMyVideos(nextPage, cookies)
                            }
                          })
                        }
                      }}
                      className="btn-secondary"
                    >
                      Načíst další (stránka {myVideosPage + 1})
                    </button>
                  </div>
                )}

                {myVideos.length > 0 && !myVideosHasMore && (
                  <div className="flex justify-center py-4 gap-4">
                    {myVideosPage > 1 && (
                      <button
                        onClick={() => {
                          const activeAccount = accounts.find(acc => acc.isActive)
                          if (activeAccount) {
                            accountsReadCookies(activeAccount.id).then(cookies => {
                              if (cookies) {
                                const prevPage = myVideosPage - 1
                                useAppStore.getState().loadMyVideos(prevPage, cookies)
                              }
                            })
                          }
                        }}
                        className="btn-secondary"
                      >
                        Zpět (stránka {myVideosPage - 1})
                      </button>
                    )}
                    <p className="text-xs text-text-muted self-center">Konec seznamu</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default App
