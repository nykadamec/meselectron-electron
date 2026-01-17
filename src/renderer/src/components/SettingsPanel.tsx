import { useState } from 'react'
import { useAppStore } from '../store'
import { useUpdaterStore, checkForUpdates } from '../store/updater'
import { useLocaleStore, type Locale } from '../i18n'
import { RefreshCw } from 'lucide-react'

export function SettingsPanel() {
  const { settings, setSettings } = useAppStore()
  const updaterStore = useUpdaterStore()
  const localeStore = useLocaleStore()
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    await window.electronAPI.settingsWrite(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSelectOutputDir = async () => {
    const result = await window.electronAPI.fileSelectOutput()
    if (result) {
      setSettings({ ...settings, outputDir: result })
    }
  }

  const handleLocaleChange = async (locale: Locale) => {
    await localeStore.setLocale(locale)
  }

  // Default output dir - will be replaced by actual value from IPC
  const defaultOutputDir = settings.outputDir || '~/Videos/meselectron'

  return (
    <div className="flex flex-col h-full">
      {/* Header - fixed at top */}
      <div className="flex-shrink-0 p-4 pb-2">
        <h2 className="text-lg font-medium mb-1">{localeStore.t('settings.title')}</h2>
        <p className="text-sm text-text-muted">{localeStore.t('settings.subtitle')}</p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-4 pt-0 max-w-2xl space-y-6">
          {/* General Settings */}
          <div className="card space-y-4">
            <h3 className="font-medium text-text-secondary uppercase text-xs tracking-wider">{localeStore.t('settings.general')}</h3>

        {/* Language selector */}
        <div>
          <label className="block font-medium mb-2">{localeStore.t('settings.language')}</label>
          <select
            value={localeStore.locale}
            onChange={(e) => handleLocaleChange(e.target.value as Locale)}
            className="w-full input-dark"
          >
            <option value="en">English</option>
            <option value="cz">Čeština</option>
          </select>
          <p className="text-xs text-text-muted mt-1">{localeStore.t('settings.languageRestart')}</p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{localeStore.t('settings.autoRestart')}</p>
            <p className="text-sm text-text-muted">{localeStore.t('settings.autoRestartDesc')}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoReset}
              onChange={(e) => setSettings({ ...settings, autoReset: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
          </label>
        </div>
      </div>

      {/* Concurrency Settings */}
      <div className="card space-y-4">
        <h3 className="font-medium text-text-secondary uppercase text-xs tracking-wider">{localeStore.t('settings.parallelism')}</h3>

        <div>
          <label className="block font-medium mb-2">
            {localeStore.t('settings.downloadConcurrency', { count: String(settings.downloadConcurrency) })}
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={settings.downloadConcurrency}
            onChange={(e) => setSettings({ ...settings, downloadConcurrency: parseInt(e.target.value) })}
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-xs text-text-muted">
            <span>1</span>
            <span>10</span>
          </div>
        </div>

        <div>
          <label className="block font-medium mb-2">
            {localeStore.t('settings.uploadConcurrency', { count: String(settings.uploadConcurrency) })}
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={settings.uploadConcurrency}
            onChange={(e) => setSettings({ ...settings, uploadConcurrency: parseInt(e.target.value) })}
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-xs text-text-muted">
            <span>1</span>
            <span>10</span>
          </div>
        </div>

        <div>
          <label className="block font-medium mb-2">
            {localeStore.t('settings.videoCount', { count: String(settings.videoCount) })}
          </label>
          <input
            type="range"
            min="1"
            max="50"
            value={settings.videoCount}
            onChange={(e) => setSettings({ ...settings, videoCount: parseInt(e.target.value) })}
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-xs text-text-muted">
            <span>1</span>
            <span>50</span>
          </div>
        </div>
      </div>

      {/* Download Settings */}
      <div className="card space-y-4">
        <h3 className="font-medium text-text-secondary uppercase text-xs tracking-wider">{localeStore.t('settings.download')}</h3>

        {/* Watermark toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{localeStore.t('settings.addWatermark')}</p>
            <p className="text-sm text-text-muted">{localeStore.t('settings.addWatermarkDesc')}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.addWatermark}
              onChange={(e) => setSettings({ ...settings, addWatermark: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
          </label>
        </div>

        {/* HQ Processing toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{localeStore.t('settings.hqProcessing')}</p>
            <p className="text-sm text-text-muted">{localeStore.t('settings.hqProcessingDesc')}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.hqProcessing}
              onChange={(e) => setSettings({ ...settings, hqProcessing: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
          </label>
        </div>

        {/* Download mode */}
        <div>
          <label className="block font-medium mb-2">{localeStore.t('settings.downloadMode')}</label>
          <select
            value={settings.downloadMode}
            onChange={(e) => setSettings({ ...settings, downloadMode: e.target.value as 'ffmpeg-chunks' | 'curl' | 'wget' })}
            className="w-full input-dark"
          >
            <option value="ffmpeg-chunks">{localeStore.t('settings.ffmpegChunks')}</option>
            <option value="curl">{localeStore.t('settings.curl')}</option>
            <option value="wget">{localeStore.t('settings.wget')}</option>
          </select>
          <p className="text-xs text-text-muted mt-1">{localeStore.t('settings.downloadModeDesc')}</p>
        </div>

        {/* Output directory */}
        <div>
          <label className="block font-medium mb-2">{localeStore.t('settings.outputDir')}</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={settings.outputDir || defaultOutputDir}
              onChange={(e) => setSettings({ ...settings, outputDir: e.target.value })}
              className="flex-1 input-dark text-sm font-mono"
              placeholder={defaultOutputDir}
            />
            <button onClick={handleSelectOutputDir} className="btn-secondary text-sm whitespace-nowrap">
              {localeStore.t('settings.browse')}
            </button>
          </div>
          <p className="text-xs text-text-muted mt-1">{localeStore.t('settings.outputDirDesc')}</p>
        </div>
      </div>

      {/* Speed Settings */}
      <div className="card space-y-4">
        <h3 className="font-medium text-text-secondary uppercase text-xs tracking-wider">{localeStore.t('settings.speed')}</h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{localeStore.t('settings.noSpeedLimit')}</p>
            <p className="text-sm text-text-muted">{localeStore.t('settings.noSpeedLimitDesc')}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.nospeed}
              onChange={(e) => setSettings({ ...settings, nospeed: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
          </label>
        </div>
      </div>

      {/* Updater Settings */}
      <div className="card space-y-4">
        <h3 className="font-medium text-text-secondary uppercase text-xs tracking-wider">{localeStore.t('settings.updates')}</h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{localeStore.t('settings.autoCheck')}</p>
            <p className="text-sm text-text-muted">{localeStore.t('settings.autoCheckDesc')}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={updaterStore.autoCheck}
              onChange={(e) => updaterStore.setAutoCheck(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
          </label>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{localeStore.t('settings.autoDownload')}</p>
            <p className="text-sm text-text-muted">{localeStore.t('settings.autoDownloadDesc')}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={updaterStore.autoDownload}
              onChange={(e) => updaterStore.setAutoDownload(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
          </label>
        </div>

        {/* Version info */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{localeStore.t('settings.version')}</p>
              <p className="text-sm text-text-muted">
                Current: {updaterStore.currentVersion}
                {updaterStore.latestVersion && updaterStore.latestVersion !== updaterStore.currentVersion && (
                  <span className="text-accent ml-2">→ {updaterStore.latestVersion}</span>
                )}
              </p>
            </div>
            <button
              onClick={() => checkForUpdates()}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              {localeStore.t('settings.checkUpdates')}
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={handleSave} className="btn-primary">
          {saved ? localeStore.t('settings.saved') : localeStore.t('settings.save')}
        </button>
        <button
          onClick={() => setSettings({
            autoReset: true,
            downloadConcurrency: 2,
            uploadConcurrency: 2,
            videoCount: 20,
            nospeed: false,
            addWatermark: true,
            outputDir: defaultOutputDir,
            downloadMode: 'ffmpeg-chunks',
            hqProcessing: true
          })}
          className="btn-secondary"
        >
          {localeStore.t('settings.resetDefaults')}
        </button>
      </div>
      </div>
      </div>
    </div>
  )
}
