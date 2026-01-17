import { useState } from 'react'
import { useAppStore } from '../store'

export function SettingsPanel() {
  const { settings, setSettings } = useAppStore()
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

  // Default output dir - will be replaced by actual value from IPC
  const defaultOutputDir = settings.outputDir || '~/Videos/meselectron'

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-medium mb-1">Nastavení</h2>
        <p className="text-sm text-text-muted">Konfigurace aplikace</p>
      </div>

      {/* General Settings */}
      <div className="card space-y-4">
        <h3 className="font-medium text-text-secondary uppercase text-xs tracking-wider">Obecné</h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Automatický restart</p>
            <p className="text-sm text-text-muted">Restartovat aplikaci po dokončení všech úloh</p>
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
        <h3 className="font-medium text-text-secondary uppercase text-xs tracking-wider">Paralelizace</h3>

        <div>
          <label className="block font-medium mb-2">
            Počet současných stahování: <span className="text-accent">{settings.downloadConcurrency}</span>
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
            Počet současných nahrávání: <span className="text-accent">{settings.uploadConcurrency}</span>
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
            Počet videí ke stažení: <span className="text-accent">{settings.videoCount}</span>
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
        <h3 className="font-medium text-text-secondary uppercase text-xs tracking-wider">Stahování</h3>

        {/* Watermark toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Přidat vodoznak</p>
            <p className="text-sm text-text-muted">Přidat text "prehrajto.cz" na video</p>
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
            <p className="font-medium">HQ Processing</p>
            <p className="text-sm text-text-muted">Pokud je HQ Processing zapnutý, process bude brát především odkazy na original video + kvalita</p>
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
          <label className="block font-medium mb-2">Režim stahování</label>
          <select
            value={settings.downloadMode}
            onChange={(e) => setSettings({ ...settings, downloadMode: e.target.value as 'ffmpeg-chunks' | 'curl' | 'wget' })}
            className="w-full input-dark"
          >
            <option value="ffmpeg-chunks">FFmpeg Chunks (parallel)</option>
            <option value="curl">cURL</option>
            <option value="wget">wget</option>
          </select>
          <p className="text-xs text-text-muted mt-1">cURL/wget stáhnou celý soubor najednou</p>
        </div>

        {/* Output directory */}
        <div>
          <label className="block font-medium mb-2">Výstupní složka</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={settings.outputDir || defaultOutputDir}
              onChange={(e) => setSettings({ ...settings, outputDir: e.target.value })}
              className="flex-1 input-dark text-sm font-mono"
              placeholder={defaultOutputDir}
            />
            <button onClick={handleSelectOutputDir} className="btn-secondary text-sm whitespace-nowrap">
              Procházet
            </button>
          </div>
          <p className="text-xs text-text-muted mt-1">Sem se uloží stažená videa</p>
        </div>
      </div>

      {/* Speed Settings */}
      <div className="card space-y-4">
        <h3 className="font-medium text-text-secondary uppercase text-xs tracking-wider">Rychlost</h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Bez limitu rychlosti</p>
            <p className="text-sm text-text-muted">Rychlejší stahování na rychlých discích</p>
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

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={handleSave} className="btn-primary">
          {saved ? 'Uloženo!' : 'Uložit nastavení'}
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
          Obnovit výchozí
        </button>
      </div>
    </div>
  )
}
