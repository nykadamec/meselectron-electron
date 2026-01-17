import type { GlobalStats, Account } from '../types'
import { useLocaleStore } from '../i18n'

interface StatsPanelProps {
  stats: GlobalStats
  accounts?: Account[]
}

export function StatsPanel({ stats, accounts = [] }: StatsPanelProps) {
  const localeStore = useLocaleStore()

  // Calculate earnings from credits (1000 points = 300 Kč)
  const calculateEarnings = () => {
    // Sum credits from all active accounts
    const totalCredits = accounts
      .filter(acc => acc.isActive)
      .reduce((sum, acc) => sum + (acc.credits || 0), 0)
    // 1000 credits = 300 Kč
    return (totalCredits / 1000) * 300
  }

  const earnings = calculateEarnings()

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm text-text-secondary">{localeStore.t('stats.totalUploaded')}</span>
        <span className="text-sm font-medium">{stats.totalUploaded}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm text-text-secondary">{localeStore.t('stats.totalDownloaded')}</span>
        <span className="text-sm font-medium">{stats.totalDownloaded}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm text-text-secondary">{localeStore.t('stats.activeAccounts')}</span>
        <span className="text-sm font-medium text-accent">{stats.activeAccounts}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm text-text-secondary">{localeStore.t('stats.queueLength')}</span>
        <span className="text-sm font-medium">{stats.queueLength}</span>
      </div>
      <div className="pt-2 border-t border-border">
        <div className="flex justify-between items-center">
          <span className="text-sm text-text-secondary">{localeStore.t('stats.earnings')}</span>
          <span className="text-sm font-bold text-success">{earnings.toFixed(0)} Kč</span>
        </div>
      </div>
    </div>
  )
}
