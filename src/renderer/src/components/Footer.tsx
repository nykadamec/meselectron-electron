import { useEffect, useState } from 'react'
import { getAppVersion, getAppName } from '../utils'
import { useLocaleStore } from '../i18n'

export function Footer() {
  const localeStore = useLocaleStore()
  const [version, setVersion] = useState<string>('')
  const [appName, setAppName] = useState<string>('')

  useEffect(() => {
    getAppVersion().then(setVersion)
    getAppName().then(setAppName)
  }, [])

  return (
    <footer style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'var(--color-surface-base)',
      borderTop: '1px solid var(--color-border-base)',
      padding: '8px 16px',
      fontSize: 11,
      color: 'var(--color-text-muted)',
      display: 'flex',
      justifyContent: 'space-between',
      zIndex: 50
    }}>
      <span>{appName}</span>
      <span style={{ fontSize: '90%' }}>v{version} | LANG: {localeStore.locale.toUpperCase()} | BUILD: 261601</span>
    </footer>
  )
}
