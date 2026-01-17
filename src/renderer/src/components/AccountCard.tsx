import { useEffect, useState } from 'react'
import type { Account } from '../types'
import { useLocaleStore } from '../i18n'

interface AccountCardProps {
  account: Account
}

export function AccountCard({ account }: AccountCardProps) {
  const localeStore = useLocaleStore()
  const [credits, setCredits] = useState<number | null>(null)
  const [loadingCredits, setLoadingCredits] = useState(false)

  // Extract username from email (e.g., "dominik96" from "dominik96@wojtach99_com")
  const displayName = account.email.split('@')[0]

  // Fetch credits on mount
  useEffect(() => {
    const fetchCredits = async () => {
      if (!window.electronAPI) return

      setLoadingCredits(true)
      try {
        const creditsData = await window.electronAPI.accountsGetCredits(account.id)
        if (creditsData !== null) {
          setCredits(creditsData)
        }
      } catch {
        // Silently fail - credits are optional
      } finally {
        setLoadingCredits(false)
      }
    }

    fetchCredits()
  }, [account.id])

  // Calculate CZK value (1000 credits = 300 CZK) - for future use
  // const czkValue = credits ? (credits / 1000) * 300 : 0

  return (
    <div className="flex items-center gap-2 p-2 bg-bg-main rounded-lg border border-border">
      <div className={`w-2 h-2 rounded-full ${account.isActive ? 'bg-success' : 'bg-text-muted'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{displayName}</p>
        <div className="flex items-center gap-2">
          <p className="text-xs text-text-muted">
            {account.isActive ? localeStore.t('accounts.active') : localeStore.t('accounts.inactive')}
          </p>
          {credits !== null && (
            <span className="text-xs text-accent">
              {localeStore.t('stats.points', { count: credits.toLocaleString() })}
            </span>
          )}
          {loadingCredits && (
            <span className="text-xs text-text-muted animate-pulse">...</span>
          )}
        </div>
      </div>
    </div>
  )
}
