import type { GlobalStats, Account } from '../types'

interface StatsPanelProps {
  stats: GlobalStats
  accounts?: Account[]
}

export function StatsPanel({ stats, accounts = [] }: StatsPanelProps) {
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
        <span className="text-sm text-text-secondary">Celkem nahraných</span>
        <span className="text-sm font-medium">{stats.totalUploaded}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm text-text-secondary">Celkem staženo</span>
        <span className="text-sm font-medium">{stats.totalDownloaded}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm text-text-secondary">Aktivních účtů</span>
        <span className="text-sm font-medium text-accent">{stats.activeAccounts}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm text-text-secondary">Ve frontě</span>
        <span className="text-sm font-medium">{stats.queueLength}</span>
      </div>
      <div className="pt-2 border-t border-border">
        <div className="flex justify-between items-center">
          <span className="text-sm text-text-secondary">Výdělek</span>
          <span className="text-sm font-bold text-success">{earnings.toFixed(0)} Kč</span>
        </div>
      </div>
    </div>
  )
}
